import json
import sys

def extract_code(filepath):
    try:
        with open(filepath, 'r') as f:
            notebook = json.load(f)
        
        print(f"--- Code from {filepath} ---")
        for cell in notebook['cells']:
            if cell['cell_type'] == 'code':
                source = cell['source']
                if isinstance(source, list):
                    print("".join(source))
                else:
                    print(source)
                print("\n" + "="*40 + "\n")
    except Exception as e:
        print(f"Error reading {filepath}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_notebook_code.py <notebook_path>")
    else:
        extract_code(sys.argv[1])

