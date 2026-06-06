#!/bin/sh
set -e

echo "▸ waiting for postgres (db:5432)…"
until node -e "const n=require('net');const s=n.connect(5432,'db');s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))" 2>/dev/null; do
  sleep 1
done
echo "▸ postgres is up"

echo "▸ applying migrations…"
npm run db:migrate

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "▸ seeding (best-effort, pulls live data)…"
  npm run db:seed || echo "  seed skipped (data source unavailable)"
fi

echo "▸ starting AlphaPicker on :${PORT:-3000}"
exec npm run start
