"""
Storage monitoring for Supabase FIT file bucket.
Checks usage, logs to system_monitoring, and triggers email alerts via Edge Function.
"""
import logging
import os
from datetime import datetime, timezone

log = logging.getLogger(__name__)

# Thresholds (percentage of limit_gb)
WARNING_PCT = 80
CRITICAL_PCT = 90
# Cooldown: don't re-send email if last one was < 7 days ago
EMAIL_COOLDOWN_DAYS = 7

BUCKET_NAME = "raw_fits"
MONITORING_KEY = "storage_raw_fits"
LIMIT_GB = 100.0


class StorageMonitor:
    """Checks Supabase storage usage and triggers alerts if thresholds are exceeded."""

    def __init__(self, db):
        """
        Args:
            db: DBConnector instance (has .client attribute for Supabase operations)
        """
        self.db = db

    def check_and_log(self) -> dict:
        """
        Main entry point: query storage usage, upsert monitoring row, trigger alert if needed.
        Returns dict with keys: total_gb, pct, status (ok|warning|critical)
        """
        # 1. Get storage usage via RPC
        total_bytes = self._get_storage_bytes()
        total_gb = round(total_bytes / (1024 ** 3), 3)
        pct = round((total_gb / LIMIT_GB) * 100, 1)

        # 2. Determine status
        if pct >= CRITICAL_PCT:
            status = "critical"
        elif pct >= WARNING_PCT:
            status = "warning"
        else:
            status = "ok"

        # 3. Get current details (for preserving last_email_sent)
        existing_details = self._get_existing_details()

        # 4. Build new details
        details = {
            **existing_details,
            "pct": pct,
            "status": status,
            "file_count": self._get_file_count(),
        }

        # 5. Upsert monitoring row
        self.db.client.table("system_monitoring").upsert({
            "key": MONITORING_KEY,
            "value_gb": total_gb,
            "limit_gb": LIMIT_GB,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "details": details,
        }).execute()

        # 6. Log
        if status == "ok":
            log.info(f"Storage check: {total_gb:.2f} GB / {LIMIT_GB} GB ({pct}%) — OK")
        else:
            log.warning(f"Storage check: {total_gb:.2f} GB / {LIMIT_GB} GB ({pct}%) — {status.upper()}")

        # 7. Trigger email alert if threshold exceeded and cooldown elapsed
        if status in ("warning", "critical"):
            self._maybe_send_alert(total_gb, pct, status, existing_details)

        return {"total_gb": total_gb, "pct": pct, "status": status}

    def _get_storage_bytes(self) -> int:
        """Call the get_storage_usage_bytes RPC function."""
        res = self.db.client.rpc("get_storage_usage_bytes", {"bucket": BUCKET_NAME}).execute()
        return int(res.data) if res.data else 0

    def _get_file_count(self) -> int:
        """Get approximate file count in the bucket via count query."""
        try:
            res = self.db.client.rpc("get_storage_usage_bytes", {"bucket": BUCKET_NAME}).execute()
            # Use a simple count approach - list objects with limit
            count_res = self.db.client.from_("storage.objects").select("id", count="exact").eq("bucket_id", BUCKET_NAME).execute()
            return count_res.count if hasattr(count_res, 'count') and count_res.count else 0
        except Exception:
            return 0

    def _get_existing_details(self) -> dict:
        """Fetch existing details from system_monitoring to preserve fields like last_email_sent."""
        try:
            res = self.db.client.table("system_monitoring").select("details").eq("key", MONITORING_KEY).execute()
            if res.data and len(res.data) > 0:
                return res.data[0].get("details", {}) or {}
        except Exception:
            pass
        return {}

    def _maybe_send_alert(self, total_gb: float, pct: float, status: str, details: dict):
        """Send email alert via Edge Function if cooldown has elapsed."""
        last_sent = details.get("last_email_sent")
        if last_sent:
            try:
                last_dt = datetime.fromisoformat(last_sent.replace("Z", "+00:00"))
                days_since = (datetime.now(timezone.utc) - last_dt).total_seconds() / 86400
                if days_since < EMAIL_COOLDOWN_DAYS:
                    log.info(f"Storage alert skipped: last email sent {days_since:.1f} days ago (cooldown={EMAIL_COOLDOWN_DAYS}d)")
                    return
            except (ValueError, TypeError):
                pass  # Invalid date, proceed with sending

        self._call_storage_alert(total_gb, pct, status)

    def _call_storage_alert(self, total_gb: float, pct: float, status: str):
        """Invoke the storage-alert Edge Function."""
        try:
            import requests

            supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
            service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

            if not supabase_url or not service_key:
                log.warning("Cannot call storage-alert: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
                return

            url = f"{supabase_url}/functions/v1/storage-alert"
            resp = requests.post(
                url,
                json={
                    "total_gb": total_gb,
                    "limit_gb": LIMIT_GB,
                    "pct": pct,
                    "status": status,
                },
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )

            if resp.ok:
                data = resp.json()
                if data.get("sent"):
                    log.info(f"Storage alert email sent (email_id={data.get('email_id')})")
                else:
                    log.info(f"Storage alert not sent: {data.get('reason', 'unknown')}")
            else:
                log.warning(f"Storage alert Edge Function returned {resp.status_code}: {resp.text}")

        except ImportError:
            # requests not available — try urllib
            self._call_storage_alert_urllib(total_gb, pct, status)
        except Exception as e:
            log.warning(f"Failed to call storage-alert Edge Function: {e}")

    def _call_storage_alert_urllib(self, total_gb: float, pct: float, status: str):
        """Fallback: call Edge Function using urllib (no external deps)."""
        import json
        import urllib.request

        supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

        if not supabase_url or not service_key:
            return

        url = f"{supabase_url}/functions/v1/storage-alert"
        payload = json.dumps({
            "total_gb": total_gb,
            "limit_gb": LIMIT_GB,
            "pct": pct,
            "status": status,
        }).encode()

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                if data.get("sent"):
                    log.info(f"Storage alert email sent via urllib (email_id={data.get('email_id')})")
                else:
                    log.info(f"Storage alert not sent: {data.get('reason', 'unknown')}")
        except Exception as e:
            log.warning(f"Failed to call storage-alert via urllib: {e}")
