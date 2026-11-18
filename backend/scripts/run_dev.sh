#!/bin/bash
set -e

# Change directory to backend root
cd "$(dirname "$0")/.."

# Activate Python 3.12 virtual environment if present at root
if [ -d "../venv" ]; then
    echo "Activating virtual environment from ../venv..."
    source ../venv/bin/activate
elif [ -d "venv" ]; then
    echo "Activating virtual environment from venv..."
    source venv/bin/activate
fi

echo "Starting NyayaSetu FastAPI Server on http://localhost:8000 ..."
python run.py
