FROM python:3.13-slim
WORKDIR /app
COPY orchestrator/requirements.txt orchestrator/requirements.txt
RUN pip install --no-cache-dir -r orchestrator/requirements.txt
COPY orchestrator orchestrator
CMD ["uvicorn", "orchestrator.api:app", "--host", "0.0.0.0", "--port", "8000"]
