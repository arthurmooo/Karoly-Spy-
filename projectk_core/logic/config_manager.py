from typing import Dict, Any, Optional
from projectk_core.db.connector import DBConnector

class AthleteConfig:
    """
    Manages global processing configuration for the analysis engine.
    Fetches configuration from the 'processing_config' table in Supabase.
    """
    
    _config_cache: Dict[str, float] = {}
    _loaded: bool = False

    def __init__(self, db: Optional[DBConnector] = None):
        """
        Initializes the config manager.
        If db is provided, it uses it (useful for dependency injection/testing).
        Otherwise, it creates a new DBConnector.
        """
        if not AthleteConfig._loaded:
            self.refresh_config(db)

    def refresh_config(self, db: Optional[DBConnector] = None):
        """
        Refreshes the configuration cache from the database.
        """
        if db is None:
            # Lazy import to avoid circular dependency if any, though unlikely here
            db = DBConnector()
            
        try:
            response = db.client.table('processing_config').select('key, value').execute()
            # Convert list of dicts to a single dict {key: value}
            if response.data:
                AthleteConfig._config_cache = {item['key']: float(item['value']) for item in response.data}
                AthleteConfig._loaded = True
        except Exception as e:
            # Fallback or re-raise depending on strictness. For now, we log/print.
            print(f"Error fetching configuration: {e}")
            # We keep default empty dict or stale cache if error

    def get(self, key: str, default: float = 0.0) -> float:
        """
        Retrieves a configuration value by key.
        Returns 'default' if key is not found.
        """
        return AthleteConfig._config_cache.get(key, default)
