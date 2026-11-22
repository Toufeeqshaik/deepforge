#!/bin/bash
# Test the health endpoint
echo "Testing /api/health..."
curl -s http://localhost:8000/api/health
echo ""
echo "Testing /api/analyze/image..."
# We'll need a valid image file for this test