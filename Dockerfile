# DeepForge Backend - Railway Deployment
FROM python:3.12-slim AS builder

# Install system dependencies for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY backend/requirements.txt .

# Install Python dependencies (including SimLBR from GitHub)
RUN pip install --no-cache-dir --user -r requirements.txt

# Pre-download SimLBR models during build to cache them
RUN python -c "
from simlbr import SimLBR
for model in ['aigc', 'genimage']:
    print(f'Downloading SimLBR-{model}...')
    SimLBR.from_pretrained(model)
    print(f'SimLBR-{model} cached successfully')
" 2>&1 | tee /tmp/model_download.log || echo "Model download had issues, will retry at runtime"

# Production stage
FROM python:3.12-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY backend/app ./app

# Create required directories
RUN mkdir -p uploads temp reports

# Copy start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port (Railway sets $PORT)
EXPOSE $PORT

# Run the application
CMD ["/app/start.sh"]