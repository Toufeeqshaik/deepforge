#!/bin/sh
# Start the app - SimLBR and models are pre-installed during Docker build
echo "=== Starting DeepForge backend ==="

# Test if SimLBR is importable
if python -c "import simlbr" 2>/dev/null; then
    echo "✅ SimLBR is importable"
else
    echo "❌ SimLBR import failed"
    python -c "import traceback; import simlbr" 2>&1 | head -20
    exit 1
fi

# Test model loading for both models
for model in ['aigc', 'genimage']:
    echo "Testing SimLBR-$model loading..."
    python -c "
from simlbr import SimLBR
try:
    SimLBR.from_pretrained('$model')
    print(f'✅ SimLBR-$model loaded successfully')
except Exception as e:
    print(f'❌ SimLBR-$model failed: {e}')
    import traceback
    traceback.print_exc()
"
done

echo "=== Starting uvicorn ==="
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}