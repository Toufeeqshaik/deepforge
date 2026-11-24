#!/bin/sh
# Start Railway app

# Install SimLBR models if not already present
python -c "
from simlbr import SimLBR
for model in ['aigc', 'genimage']:
    try:
        SimLBR.from_pretrained(model)
        print(f'SimLBR-{model} loaded successfully')
    except Exception as e:
        print(f'SimLBR-{model} failed: {e}')
"
    
# Start the app
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}