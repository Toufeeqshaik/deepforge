#!/bin/sh
# Install SimLBR if not already present
if ! python -c "import simlbr" 2>/dev/null; then
    echo "Installing SimLBR from GitHub..."
    pip install git+https://github.com/mvrl/SimLBR.git
fi

# Start the app
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}