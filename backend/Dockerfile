# DeepForge Backend - Railway Deployment
# Uses multi-stage build for smaller image

FROM python:3.12-slim AS builder

# Install system dependencies for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt

# Download SimLBR models during build to cache them
RUN python -c "
from simlbr import SimLBR
for model in ['aigc', 'genimage']:
    print(f'Downloading SimLBR-{model}...')
    SimLBR.from_pretrained(model)
    print(f'SimLBR-{model} cached successfully')
" 2>/dev/null || echo "SimLBR download skipped (will download at runtime)"

# Production stage
FROM python:3.12-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY . .

# Create required directories
RUN mkdir -p uploads temp reports

# Expose port (Railway sets $PORT)
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]