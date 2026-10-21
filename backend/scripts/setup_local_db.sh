#!/usr/bin/env bash
# Create (or reset) a local database for Ìtọ́ni and fill it with test data.
#
# Usage (from backend/):
#   ./scripts/setup_local_db.sh              # SQLite (default, zero setup)
#   ./scripts/setup_local_db.sh postgres     # local PostgreSQL, same engine as Render
#   ./scripts/setup_local_db.sh --reset      # wipe and recreate (works with either)
#
# Always runs in mock mode, so it never spends NKENNEAi tokens.
# Postgres mode needs: sudo apt install postgresql && sudo systemctl start postgresql

set -euo pipefail

cd "$(dirname "$0")/.."

ENGINE="sqlite"
RESET=false
for arg in "$@"; do
  case "$arg" in
    postgres|pg) ENGINE="postgres" ;;
    sqlite) ENGINE="sqlite" ;;
    --reset) RESET=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

DB_NAME="itoni_dev"
DB_USER="itoni"
DB_PASS="itoni_local_pw"   # local-only throwaway password, never used in production

# --- .env ---
if [[ ! -f .env ]]; then
  cp .env.example .env
  secret=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
  sed -i "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=${secret}|" .env
  sed -i "s|^DJANGO_DEBUG=.*|DJANGO_DEBUG=true|" .env
  echo "Created .env with a random secret key."
fi

set_env() {  # set_env KEY VALUE  (replaces an existing or commented line, else appends)
  if grep -qE "^#? ?$1=" .env; then
    sed -i -E "s|^#? ?$1=.*|$1=$2|" .env
  else
    echo "$1=$2" >> .env
  fi
}

# --- database ---
if [[ "$ENGINE" == "postgres" ]]; then
  command -v psql >/dev/null || { echo "psql not found. Install: sudo apt install postgresql"; exit 1; }

  if $RESET; then
    sudo -u postgres psql -qc "DROP DATABASE IF EXISTS ${DB_NAME};"
  fi
  sudo -u postgres psql -qtc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
    || sudo -u postgres psql -qc "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}' CREATEDB;"
  sudo -u postgres psql -qtc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
    || sudo -u postgres psql -qc "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

  set_env DATABASE_URL "postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
  echo "PostgreSQL database '${DB_NAME}' ready."
else
  # Comment out DATABASE_URL so Django falls back to SQLite.
  sed -i -E "s|^DATABASE_URL=|# DATABASE_URL=|" .env
  if $RESET; then rm -f db.sqlite3; fi
  echo "Using SQLite (db.sqlite3)."
fi

# --- schema and data (forced mock mode: zero tokens) ---
export NKENNE_MOCK=true
python manage.py migrate --no-input
python manage.py seed_templates
python manage.py translate_templates
python manage.py seed_demo

cat <<EOF

Local database ready (${ENGINE}, mock mode).
  Admin:  http://localhost:8000/admin/   user: nurse   password: itoni-demo-123
  Run:    python manage.py runserver   (API on :8000)
          cd ../frontend && npm run dev  (UI on http://localhost:5173)

Note: data here is MOCK. When you switch to live mode, run
  python manage.py translate_templates --live
and the mock translations and audio are replaced automatically.
EOF
