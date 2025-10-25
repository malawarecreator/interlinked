# Simple Dockerfile for the Interlinked backend (FastAPI + SQLite)
# Build with: docker build -t interlinked-backend .
# Run with: docker run -p 8000:8000 -e OPENAI_API_KEY=your_key interlinked-backend
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install small set of system deps required to build wheels if needed.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends gcc build-essential libffi-dev \
	&& rm -rf /var/lib/apt/lists/*

# Copy requirements and install. The Docker build context should be the `backend/` folder
COPY requirements.txt ./requirements.txt

RUN python -m pip install --upgrade pip \
	&& pip install --no-cache-dir -r requirements.txt

# Copy backend files (including interlinked.db if present and optional `apikey` file)
COPY . /app

# Ensure the SQLite DB exists (if you want a fresh DB, recreate it outside the image or
# remove the file before building). Interlinked uses `interlinked.db` in project root.

# Expose the port the app runs on
EXPOSE 8000

# Run the app with uvicorn. The `main.py` FastAPI app is expected at the repository root
# (inside this working dir). You can override the CMD at runtime for different options.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

