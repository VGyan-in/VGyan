#!/bin/sh
set -e
# Forward-only, non-destructive migrations run before the API starts.
python -m alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*' --workers "${WEB_CONCURRENCY:-2}" --no-access-log
