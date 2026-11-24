#!/bin/sh
# Start the app - SimLBR installed during Docker build
# GRACEFUL: if SimLBR/models fail to load, the app still starts with fallback
echo "=== Starting DeepForge backend ==="

# Test if SimLBR is importable
if python -c "import simlbr" 2>/dev/null; then
    echo "✅ SimLBR is importable"
else
    echo "⚠️  SimLBR not importable — running with fallback models only"
fi

echo "=== Starting uvicorn ==="
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}