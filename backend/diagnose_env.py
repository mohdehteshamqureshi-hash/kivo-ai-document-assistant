import os
import sys
import platform
import subprocess
import shutil
import urllib.request
import json

def diagnose():
    print("=== SYSTEM & HARDWARE DIAGNOSTICS ===")
    print("OS:", platform.system(), platform.release(), platform.version())
    print("Architecture:", platform.architecture(), platform.machine())
    print("Python Executable:", sys.executable)
    print("Python Version:", sys.version)

    # Check RAM & Disk
    try:
        import psutil
        ram = psutil.virtual_memory()
        print(f"Total RAM: {ram.total / (1024**3):.2f} GB (Available: {ram.available / (1024**3):.2f} GB)")
    except ImportError:
        # Fallback using ctypes or wmic
        try:
            cmd = subprocess.run(["wmic", "computersystem", "get", "TotalPhysicalMemory"], capture_fmt=subprocess.PIPE, text=True)
            print("TotalPhysicalMemory (wmic):", cmd.stdout.strip())
        except Exception:
            pass

    # Disk Space
    total, used, free = shutil.disk_usage("C:\\")
    print(f"Drive C: Free Space = {free / (1024**3):.2f} GB (Total: {total / (1024**3):.2f} GB)")

    print("\n=== AVAILABLE PYTHON INSTALLATIONS ===")
    py_locations = shutil.which("python")
    print("Active python:", py_locations)
    # Check py launcher
    py_launcher = shutil.which("py")
    if py_launcher:
        try:
            res = subprocess.run(["py", "--list"], capture_output=True, text=True)
            print("py --list output:\n", res.stdout)
        except Exception as e:
            print("py --list error:", e)

    print("\n=== INSTALLED AI PACKAGES IN ACTIVE PYTHON ===")
    for pkg in ["torch", "sentence_transformers", "transformers", "numpy", "scipy", "fastapi"]:
        try:
            mod = __import__(pkg)
            version = getattr(mod, "__version__", "unknown")
            file_loc = getattr(mod, "__file__", "unknown")
            print(f"  ✓ {pkg}: {version} ({file_loc})")
        except Exception as e:
            print(f"  ✗ {pkg}: FAILED TO IMPORT -> {type(e).__name__}: {str(e)[:120]}")

    print("\n=== DETAILED TORCH IMPORT INSPECTION ===")
    try:
        import torch
        print("  ✓ Torch imported successfully! Version:", torch.__version__)
    except Exception as e:
        print(f"  ✗ Exact torch error: {type(e).__name__}: {e}")
        # Check if c10.dll exists
        torch_dir = os.path.join(os.path.dirname(sys.executable), "Lib", "site-packages", "torch", "lib")
        c10_dll = os.path.join(torch_dir, "c10.dll")
        print(f"  c10.dll path: {c10_dll}")
        print(f"  c10.dll exists: {os.path.exists(c10_dll)}")
        if os.path.exists(c10_dll):
            print(f"  c10.dll size: {os.path.getsize(c10_dll)} bytes")

    print("\n=== OLLAMA SERVICE CHECK ===")
    ollama_bin = shutil.which("ollama")
    print("Ollama CLI binary in PATH:", ollama_bin if ollama_bin else "NOT FOUND")

    # Check localhost:11434
    try:
        req = urllib.request.Request("http://127.0.0.1:11434/api/tags")
        with urllib.request.urlopen(req, timeout=2) as response:
            data = json.loads(response.read().decode())
            print("  ✓ Ollama local HTTP API is ACTIVE at http://127.0.0.1:11434")
            models = data.get("models", [])
            print(f"  Installed Ollama models ({len(models)}):")
            for m in models:
                size_gb = m.get("size", 0) / (1024**3)
                print(f"    - {m.get('name')}: {size_gb:.2f} GB")
    except Exception as e:
        print(f"  ✗ Ollama is NOT reachable at http://127.0.0.1:11434 ({type(e).__name__}: {e})")

if __name__ == "__main__":
    diagnose()
