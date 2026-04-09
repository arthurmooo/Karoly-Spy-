from datetime import datetime
from typing import Optional, Dict, Any
from projectk_core.db.connector import DBConnector
from projectk_core.logic.models import PhysioProfile

class ProfileManager:
    """
    Handles physiological profile retrieval using SCD Type 2 logic.
    Ensures that for any given date, the correct thresholds are used.
    """
    def __init__(self, db_connector: Optional[DBConnector] = None):
        self.db = db_connector or DBConnector()

    def get_profile_for_date(
        self,
        athlete_id: str,
        sport: str,
        date: datetime,
        profile_state: str = "fresh",
    ) -> Optional[PhysioProfile]:
        """
        Fetch the physiological profile valid at a specific timestamp.
        Logic: valid_from <= date AND (valid_to > date OR valid_to IS NULL)
        Defaults to the canonical `fresh` profile state used by MLS.
        """
        date_str = date.isoformat()
        
        response = self.db.client.table("physio_profiles") \
            .select("*") \
            .eq("athlete_id", athlete_id) \
            .eq("sport", sport) \
            .eq("profile_state", profile_state) \
            .lte("valid_from", date_str) \
            .or_(f"valid_to.gt.{date_str},valid_to.is.null") \
            .order("valid_from", desc=True) \
            .limit(1) \
            .execute()

        if response.data:
            # Map DB fields to Pydantic model
            raw = response.data[0]
            # Convert timestamp string to datetime object if needed (Pydantic handles ISO strings)
            return PhysioProfile(**raw)
        
        return None

    def create_profile(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new profile entry and automatically handle valid_to for the previous one.
        (Future implementation for Phase 4)
        """
        # TODO: Implement SCD Type 2 insertion logic (closing previous interval)
        pass
