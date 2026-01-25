
import sys
import os
import argparse
from rich.console import Console

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.logic.reprocessor import ReprocessingEngine

console = Console()

def main():
    parser = argparse.ArgumentParser(description="Global Reprocessing with Meta-Precision")
    parser.add_argument("--athlete", type=str, help="Filter by athlete name (optional)")
    parser.add_argument("--force", action="store_true", help="Force recalculation")
    
    args = parser.parse_args()
    
    engine = ReprocessingEngine()
    
    console.print(f"[bold green]Starting Global Reprocessing...[/bold green]")
    if args.athlete:
        console.print(f"Filtering for athlete: [yellow]{args.athlete}[/yellow]")
        
    engine.run(athlete_name_filter=args.athlete, force=args.force)
    
    console.print(f"\n[bold green]✅ Reprocessing Complete![/bold green]")

if __name__ == "__main__":
    main()

