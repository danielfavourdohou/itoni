#!/usr/bin/env bash
# Capture the real patient screen (the public demo instruction) for the landing page phone.
#
# Usage (from the repo root, with Django and Vite running, after Phase 1 / live translations):
#   frontend/scripts/capture_patient_screens.sh [base_url]      # default http://localhost:5173
#
# Writes frontend/src/assets/patient-screen-{light,dark}.webp. The landing page switches from the
# illustrated phone to these automatically. Refuses to run while the demo is mock text, so the
# landing page never shows "[MOCK-SW]". Uses Google Chrome headless and the backend venv's Pillow.
set -euo pipefail

BASE="${1:-http://localhost:5173}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/frontend/src/assets"
PY="$ROOT/backend/venv/bin/python"
CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || true)"
[[ -n "$CHROME" ]] || { echo "Google Chrome or Chromium is required."; exit 1; }
[[ -x "$PY" ]] || { echo "backend/venv not found (needed for Pillow)."; exit 1; }

DEMO_PATH="$(curl -fsS "$BASE/api/demo/" | "$PY" -c 'import sys, json; print(json.load(sys.stdin)["patient_path"])')" \
  || { echo "No public demo patient. Run: cd backend && python manage.py seed_demo"; exit 1; }

# Guard: only real, live Swahili goes on the landing page.
"$PY" - "$BASE$DEMO_PATH" <<'EOF'
import json, sys, urllib.request
url = sys.argv[1].replace("/p/", "/api/p/", 1) + "/"
data = json.load(urllib.request.urlopen(url))
if data.get("mock_mode") or any("[MOCK-SW]" in i["text"] for i in data["items"]):
    sys.exit("The demo patient still shows mock text. Run the live translation (Phase 1) and seed_demo, then retry.")
EOF

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for theme in light dark; do
  flags=()
  [[ "$theme" == dark ]] && flags+=(--force-dark-mode)
  # Phone-sized viewport at 2x; virtual time lets the kanga unroll finish before the shot.
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$TMP/profile" \
    "${flags[@]}" --window-size=390,844 --force-device-scale-factor=2 --virtual-time-budget=5000 \
    --screenshot="$TMP/$theme.png" "$BASE$DEMO_PATH" >/dev/null 2>&1
  "$PY" -I - "$TMP/$theme.png" "$OUT/patient-screen-$theme.webp" <<'EOF'
import sys
from PIL import Image
img = Image.open(sys.argv[1]).convert("RGB")
img = img.resize((540, round(img.height * 540 / img.width)), Image.LANCZOS)
img.save(sys.argv[2], "WEBP", quality=80, method=6)
print("wrote", sys.argv[2])
EOF
done
echo "Done. Rebuild the frontend (npm run build) and the landing page phone shows the real screen."
