#!/bin/bash

# DeepForge Setup Script
# Copy this script into the extracted deepforge folder and run it
# It will install everything and start the server

echo "=========================================="
echo "  DeepForge - AI Forensics Platform"
echo "  Setting up..."
echo "=========================================="
echo ""

cd "$(dirname "$0")"

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "Error: This script is designed for Linux"
    exit 1
fi

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not installed"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "Found Python: $PYTHON_VERSION"

# Setup Backend
echo ""
echo ">>> Setting up Backend..."
cd backend

# Check if venv exists
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate venv and install
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Start backend in background
echo "Starting backend server on http://localhost:8000..."
uvicorn app.main:app --port 8000 --host 0.0.0.0 > /tmp/deepforge_backend.log 2>&1 &
BACKEND_PID=$!
sleep 5

# Check if backend started
if ! curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "Error: Backend failed to start. Check /tmp/deepforge_backend.log"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi
echo "Backend running (PID: $BACKEND_PID)"

# Setup Frontend
echo ""
echo ">>> Setting up Frontend..."
cd ../frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Start frontend
echo "Starting frontend server on http://localhost:5173..."
npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/deepforge_frontend.log 2>&1 &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "  DeepForge is running!"
echo "=========================================="
echo ""
echo "  🌐 Open your browser to:"
echo "     http://localhost:5173"
echo ""
echo "  📊 Backend API:"
echo "     http://localhost:8000"
echo ""
echo "  📝 Logs:"
echo "     Backend: /tmp/deepforge_backend.log"
echo "     Frontend: /tmp/deepforge_frontend.log"
echo ""
echo "  ⏹️  To stop: Press Ctrl+C"
echo ""

# Keep script running
wait
