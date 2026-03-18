#!/usr/bin/env python3
"""
Project K - Master CLI
The central command center for Karoly Spy's Data Pipeline.
"""
import sys
import argparse
from rich.console import Console
from rich.logging import RichHandler
import logging

# Setup Rich Console
console = Console()

# Setup Logging
logging.basicConfig(
    level="INFO",
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(console=console, rich_tracebacks=True)]
)
log = logging.getLogger("rich")

def cmd_ingest(args):
    """
    Wrapper for the Ingestion Robot (Nolio Sync).
    """
    console.print(f"[bold blue]🚀 Launching Ingestion Robot...[/bold blue]")
    console.print(f"   • Lookback: [cyan]{args.days} days[/cyan]")
    if args.athlete:
        console.print(f"   • Filter: [cyan]{args.athlete}[/cyan]")
    
    try:
        from scripts.run_ingest import IngestionRobot
        robot = IngestionRobot(history_days=args.days)
        robot.run(specific_athlete_name=args.athlete, force_metrics=args.sync_metrics)
        console.print(f"\n[bold green]✅ Ingestion Sequence Complete.[/bold green]")
    except Exception as e:
        console.print(f"\n[bold red]❌ Ingestion Failed:[/bold red] {e}")
        log.exception("Ingestion Error")
        sys.exit(1)

def cmd_reprocess(args):
    """
    Re-calculates metrics for existing activities in DB.
    """
    console.print(f"[bold purple]🔄 Launching Reprocessing Engine...[/bold purple]")
    if args.activity_id:
        console.print(f"   • Single activity: [cyan]{args.activity_id}[/cyan]")
    elif args.athlete:
        console.print(f"   • Filter: [cyan]{args.athlete}[/cyan]")

    try:
        from projectk_core.logic.reprocessor import ReprocessingEngine
        engine = ReprocessingEngine(offline_mode=getattr(args, "offline", False))
        if args.activity_id:
            engine.reprocess_single(args.activity_id)
        else:
            engine.run(athlete_name_filter=args.athlete, force=args.force)
        console.print(f"\n[bold green]✅ Reprocessing Complete.[/bold green]")
    except Exception as e:
        console.print(f"\n[bold red]❌ Reprocessing Failed:[/bold red] {e}")
        log.exception("Reprocessing Error")
        sys.exit(1)

def cmd_audit(args):
    """
    Health check for the database: identifies missing profiles or default thresholds.
    """
    console.print(f"[bold green]🩺 Launching System Audit...[/bold green]")
    from projectk_core.db.connector import DBConnector
    db = DBConnector()
    
    # 1. Check Athletes
    athletes = db.client.table("athletes").select("id, first_name, last_name").execute().data
    console.print(f"📊 Total Athletes in DB: [cyan]{len(athletes)}[/cyan]")
    
    # 2. Check Profiles with default HR
    # We look for profiles where lt1_hr is 130 and lt2_hr is 160 (our current defaults)
    defaults = db.client.table("physio_profiles")\
        .select("athlete_id, sport, lt1_hr, lt2_hr, athletes(first_name, last_name)")\
        .or_("lt1_hr.eq.130,lt2_hr.eq.160")\
        .execute().data
    
    if defaults:
        console.print(f"\n[bold yellow]⚠️ {len(defaults)} Profiles using default HR (130/160). Need manual review:[/bold yellow]")
        for d in defaults:
            name = f"{d['athletes']['first_name']} {d['athletes']['last_name']}"
            console.print(f"   • {name.ljust(25)} | Sport: {d['sport'].ljust(5)} | HR: {d['lt1_hr']}/{d['lt2_hr']}")
    else:
        console.print("\n[bold green]✅ All heart rate thresholds seem customized.[/bold green]")

    # 3. Activity Count
    count = db.client.table("activities").select("id", count="exact").limit(1).execute().count
    console.print(f"\n📈 Total Activities Ingested: [cyan]{count}[/cyan]")

def main():
    parser = argparse.ArgumentParser(
        description="Project K - The Intelligence Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_k.py ingest --days 7
  python run_k.py ingest --athlete "Adrien"
  python run_k.py reprocess --athlete "Karoly" --force
  python run_k.py audit
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # --- Command: ingest ---
    parser_ingest = subparsers.add_parser("ingest", help="Sync data from Nolio to Supabase")
    parser_ingest.add_argument("--days", type=int, default=14, help="Number of days to look back (default: 14)")
    parser_ingest.add_argument("--athlete", type=str, help="Filter by athlete first name")
    parser_ingest.add_argument("--sync-metrics", action="store_true", help="Force deep sync of athlete metrics (CP, CS...)")
    parser_ingest.set_defaults(func=cmd_ingest)
    
    # --- Command: reprocess ---
    parser_reprocess = subparsers.add_parser("reprocess", help="Re-calculate metrics for existing activities")
    parser_reprocess.add_argument("--athlete", type=str, help="Filter by athlete first name")
    parser_reprocess.add_argument("--activity-id", type=str, help="Reprocess a single activity by UUID")
    parser_reprocess.add_argument("--force", action="store_true", help="Force re-calculation even if metrics exist")
    parser_reprocess.add_argument("--offline", action="store_true", help="Skip Nolio API calls (use existing DB data only)")
    parser_reprocess.set_defaults(func=cmd_reprocess)
    
    # --- Command: audit ---
    parser_audit = subparsers.add_parser("audit", help="Check database health (profiles, duplicates)")
    parser_audit.set_defaults(func=cmd_audit)
    
    # Parse
    args = parser.parse_args()
    
    if hasattr(args, "func"):
        try:
            args.func(args)
        except KeyboardInterrupt:
            console.print("\n[bold red]⛔ Process interrupted by user.[/bold red]")
            sys.exit(130)
        except Exception as e:
            log.exception(f"Critical Error: {e}")
            sys.exit(1)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
