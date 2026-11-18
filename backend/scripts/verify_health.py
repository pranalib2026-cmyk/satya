"""Script to verify the live FastAPI server health endpoint."""

import os
import sys
from pathlib import Path
import time
from multiprocessing import Process
import httpx

# Ensure backend directory is in sys.path
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


def run_server():
    # Make sure sys.path is set in child process
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    import uvicorn
    from app.main import app
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")


def main():
    print("Starting background uvicorn server on port 8000...")
    proc = Process(target=run_server, daemon=True)
    proc.start()

    # Wait for server to bind
    time.sleep(1.5)

    try:
        with httpx.Client(base_url="http://127.0.0.1:8000", timeout=5.0) as client:
            resp = client.get("/api/v1/health")
            print(f"Status Code: {resp.status_code}")
            print(f"Response JSON: {resp.json()}")

            if resp.status_code == 200 and resp.json().get("status") == "healthy":
                print(">>> VERIFICATION SUCCESSFUL: GET /api/v1/health returned 200 OK and healthy status!")
                sys.exit(0)
            else:
                print(">>> VERIFICATION FAILED: Unexpected response")
                sys.exit(1)
    finally:
        proc.terminate()
        proc.join(timeout=2)


if __name__ == "__main__":
    main()
