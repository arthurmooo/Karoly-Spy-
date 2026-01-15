import fitdecode
import sys

def inspect_fit(file_path):
    print(f"Inspecting: {file_path}")
    with fitdecode.FitReader(file_path) as fit:
        for frame in fit:
            if frame.frame_type == fitdecode.FIT_FRAME_DATA:
                # Common names for hardware info: 'file_id', 'device_info'
                if frame.name in ['file_id', 'device_info']:
                    print(f"\n[Message: {frame.name}]")
                    for field in frame.fields:
                        print(f"  - {field.name}: {field.value}")

if __name__ == "__main__":
    inspect_fit(sys.argv[1] if len(sys.argv) > 1 else "allure_semi.fit")
