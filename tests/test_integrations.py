import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime
from projectk_core.integrations.weather import WeatherClient
from projectk_core.integrations.nolio import NolioClient

def test_weather_client_no_key():
    """Test that weather client returns None if no API key is provided."""
    client = WeatherClient(api_key="")
    assert client.get_weather_at_timestamp(0, 0, datetime.now()) is None

def test_nolio_client_scaffolding():
    """Test that Nolio client initializes correctly."""
    client = NolioClient(client_id="test_id")
    assert client.client_id == "test_id"
    assert client.authenticate() is False # Should fail without secret
