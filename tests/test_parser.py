import pytest
import pandas as pd
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import FitParser

# Chemin vers le fichier de test réel
SAMPLE_FILE = "allure_semi.fit"

@pytest.mark.skipif(not os.path.exists(SAMPLE_FILE), reason="Fichier de sample manquant")
def test_parse_real_file():
    """Test le parsing du fichier Coros 5x2000m."""
    df, meta = FitParser.parse(SAMPLE_FILE)
    
    # Vérifications structurelles
    assert isinstance(df, pd.DataFrame)
    assert not df.empty
    assert isinstance(meta, dict)
    assert 'serial_number' in meta
    
    # Vérification des colonnes essentielles
    expected_cols = ['timestamp', 'power', 'heart_rate', 'cadence', 'speed', 'altitude']
    for col in expected_cols:
        assert col in df.columns, f"Colonne manquante : {col}"
        
    # Vérification du typage
    assert pd.api.types.is_datetime64_any_dtype(df['timestamp'])
    assert pd.api.types.is_float_dtype(df['power'])
    
    # Vérification du contenu (basé sur notre debug précédent)
    # On sait que la puissance moyenne est autour de 245W
    mean_power = df['power'].mean()
    assert 200 < mean_power < 300
    
    # Vérification qu'on a bien ~1h de données
    duration_min = (df['timestamp'].max() - df['timestamp'].min()).total_seconds() / 60
    assert 40 < duration_min < 120

def test_parser_missing_file():
    with pytest.raises(FileNotFoundError):
        FitParser.parse("non_existent.fit")
