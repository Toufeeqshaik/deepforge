#!/bin/sh
# Start the app - SimLBR and models are pre-installed during Docker build
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}