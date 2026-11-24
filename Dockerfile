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

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt

# Download SimLBR models during build to cache them
RUN python -c "from simlbr import SimLBR; [SimLBR.from_pretrained(m) for m in ['aigc', 'genimage']]"

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