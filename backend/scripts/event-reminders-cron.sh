#!/usr/bin/env sh
# Бесплатен cron на Acton VM — секој час; backend праќа само околу 10:00 по Скопје.
# Crontab пример (crontab -e):
#   0 * * * * CRON_SECRET=... API_URL=https://team2-zeta.vercel.app /path/to/event-reminders-cron.sh
set -eu
API_URL="${API_URL:-https://team2-zeta.vercel.app}"
if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET is not set" >&2
  exit 1
fi
curl -sfS -H "Authorization: Bearer ${CRON_SECRET}" "${API_URL}/api/cron/event-reminders"
