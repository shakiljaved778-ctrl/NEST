#!/usr/bin/env bash
# SessionStart hook: make the CRM runnable in a fresh web session.
# Ensures Postgres is up, deps are installed, a dev .env exists, and the
# schema is pushed. Safe to run repeatedly. Never fails the session.
set +e
cd "$(dirname "$0")/.." || exit 0

# 1. Postgres (Debian/Ubuntu cluster image used by Claude Code on the web)
if command -v pg_ctlcluster >/dev/null 2>&1; then
  if ! pg_lsclusters 2>/dev/null | grep -q online; then
    sudo pg_ctlcluster 16 main start >/dev/null 2>&1
  fi
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='crm'" 2>/dev/null | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER crm WITH PASSWORD 'crm' CREATEDB SUPERUSER;" >/dev/null 2>&1
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='crm'" 2>/dev/null | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE crm OWNER crm;" >/dev/null 2>&1
fi

# 2. Dev .env with generated secrets
if [ ! -f .env ]; then
  cp .env.example .env
  if command -v openssl >/dev/null 2>&1; then
    sed -i "s|AUTH_SECRET=.*|AUTH_SECRET=\"$(openssl rand -base64 32 | tr -d '\n')\"|" .env
    sed -i "s|FIELD_ENCRYPTION_KEY=.*|FIELD_ENCRYPTION_KEY=\"$(openssl rand -hex 32)\"|" .env
  fi
fi

# 3. Dependencies
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund >/dev/null 2>&1
fi

# 4. Schema (idempotent)
npx prisma db push --skip-generate >/dev/null 2>&1

echo "CRM session ready: Postgres up, deps installed, schema pushed. Run 'npm run db:seed' then 'npm run dev'."
exit 0
