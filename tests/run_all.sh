#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "[1/3] PHP syntax"
find "$ROOT/backend" -name '*.php' -print0 | xargs -0 -n1 php -l >/dev/null
echo "PHP syntax: PASS"
echo "[2/3] Warehouse safety rules"
php "$ROOT/tests/php/WarehouseRuleServiceTest.php"
echo "[3/3] Python optimizer"
cd "$ROOT"
python -m pytest -q tests/python
