import pytest
from unittest.mock import MagicMock, patch
# On importe la classe future (qui n'existe pas encore, donc ça échouera à l'import ou à l'exécution)
# Pour le TDD strict, on l'importe.
import sys
import os

# Ajouter le dossier parent au path pour importer les modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.logic.config_manager import AthleteConfig

@patch('projectk_core.logic.config_manager.DBConnector')
def test_athlete_config_fetch(mock_db_connector_cls):
    """
    Test que AthleteConfig récupère bien les configs depuis la DB mockée.
    """
    # Setup du mock
    mock_db_instance = mock_db_connector_cls.return_value
    # Simuler la réponse de Supabase: object avec attribut .data
    mock_response = MagicMock()
    mock_response.data = [
        {'key': 'alpha_load_hr', 'value': 1.5},
        {'key': 'stop_detection_seconds', 'value': 20.0}
    ]
    mock_db_instance.client.table.return_value.select.return_value.execute.return_value = mock_response

    # Force reset du cache pour le test (car variable de classe)
    AthleteConfig._loaded = False
    AthleteConfig._config_cache = {}

    # Exécution - Le constructeur va appeler DBConnector() qui est mocké
    config = AthleteConfig()
    
    # Assertions
    assert config.get('alpha_load_hr') == 1.5
    assert config.get('stop_detection_seconds') == 20.0
    # Valeur par défaut si clé inexistante
    assert config.get('unknown_key', default=0) == 0
