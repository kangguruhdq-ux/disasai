FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Gunakan shell form (tanpa tanda kurung siku/quotes) agar $PORT terbaca
CMD uvicorn main:app --host 0.0.0.0 --port $PORT