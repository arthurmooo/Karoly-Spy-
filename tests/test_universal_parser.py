import pytest
import os
import tempfile
import gzip
from unittest.mock import patch, MagicMock
from projectk_core.processing.parser import UniversalParser

# Magic signatures
FIT_HEADER = b'.FIT' # Not strictly at 0, usually at offset 8, but we can check checking logic. 
# Actually fit header is usually: 
# header_size (1b), protocol_ver (1b), profile_ver (2b), data_size (4b), .FIT (4b)
# So .FIT is at offset 8.
# But UniversalParser might implement robust detection.

TCX_HEADER = b'<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase'

@pytest.fixture
def fit_file():
    with tempfile.NamedTemporaryFile(mode='wb', suffix='.fit', delete=False) as tmp:
        # Minimal valid-looking header for detection (14 bytes min)
        # 14 bytes header: 0E 10 00 00 00 00 00 00 2E 46 49 54 00 00
        header = bytearray([14, 16, 0, 0, 0, 0, 0, 0]) + b'.FIT' + bytearray([0, 0])
        tmp.write(header)
        tmp_path = tmp.name
    yield tmp_path
    if os.path.exists(tmp_path):
        os.remove(tmp_path)

@pytest.fixture
def tcx_file():
    with tempfile.NamedTemporaryFile(mode='wb', suffix='.tcx', delete=False) as tmp:
        tmp.write(TCX_HEADER)
        tmp_path = tmp.name
    yield tmp_path
    if os.path.exists(tmp_path):
        os.remove(tmp_path)

@pytest.fixture
def gz_fit_file(fit_file):
    with open(fit_file, 'rb') as f:
        content = f.read()
    
    gz_path = fit_file + '.gz'
    with gzip.open(gz_path, 'wb') as f_out:
        f_out.write(content)
        
    yield gz_path
    if os.path.exists(gz_path):
        os.remove(gz_path)

@patch('projectk_core.processing.parser.FitParser.parse')
def test_delegate_to_fit(mock_fit_parse, fit_file):
    mock_fit_parse.return_value = ("df", "meta", "laps")
    
    # Act
    UniversalParser.parse(fit_file)
    
    # Assert
    mock_fit_parse.assert_called_once()
    args, _ = mock_fit_parse.call_args
    # It passes the file path
    assert args[0] == fit_file

@patch('projectk_core.processing.tcx_parser.TcxParser.parse')
def test_delegate_to_tcx(mock_tcx_parse, tcx_file):
    mock_tcx_parse.return_value = ("df", "meta", "laps")
    
    # Act
    UniversalParser.parse(tcx_file)
    
    # Assert
    mock_tcx_parse.assert_called_once()
    args, _ = mock_tcx_parse.call_args
    assert args[0] == tcx_file

@patch('projectk_core.processing.parser.FitParser.parse')
def test_delegate_gz_fit(mock_fit_parse, gz_fit_file):
    mock_fit_parse.return_value = ("df", "meta", "laps")
    
    # Act
    UniversalParser.parse(gz_fit_file)
    
    # Assert
    mock_fit_parse.assert_called_once()
    # It should pass a decompressed temporary file path, not the gz path
    args, _ = mock_fit_parse.call_args
    called_path = args[0]
    assert called_path != gz_fit_file
    assert not called_path.endswith('.gz')
    # The file should be cleaned up by UniversalParser after the call
    assert not os.path.exists(called_path)
    
    # Note: UniversalParser must clean up temp file, but hard to test here without complex mocks.
    # We assume it cleans up after return/exception.

def test_unknown_file():
    with tempfile.NamedTemporaryFile(mode='wb', suffix='.dat', delete=False) as tmp:
        tmp.write(b'GARBAGE DATA')
        tmp_path = tmp.name
    
    try:
        with pytest.raises(ValueError, match="Unsupported file format"):
            UniversalParser.parse(tmp_path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
