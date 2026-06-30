#!/usr/bin/env bash
#
# Populates assets/{icons,aws-icons,tech-icons}/ with the AWS Architecture Icons.
#
# The official AWS Architecture Icon set is NOT redistributed with this repo
# (see https://aws.amazon.com/architecture/icons/ — Terms of Use). This script
# downloads/extracts them locally so the MCP server can inline them into diagrams.
#
# Usage:
#   ./scripts/fetch-icons.sh /path/to/Asset-Package.zip   # from a downloaded zip
#   ./scripts/fetch-icons.sh                               # prints download steps
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/assets"
ICONS="$ASSETS/icons"

if [[ $# -lt 1 ]]; then
  cat <<'EOF'
AWS Architecture Icons are required but not bundled (license).

1. Download the latest "Asset Package" zip from:
   https://aws.amazon.com/architecture/icons/
2. Re-run this script pointing at the downloaded zip:
   ./scripts/fetch-icons.sh ~/Downloads/Asset-Package_*.zip

The script copies every Arch_*_48.png (and Res_*_48.png) into assets/icons/.
You may also drop custom SVGs into assets/aws-icons/ and assets/tech-icons/.
EOF
  exit 0
fi

ZIP="$1"
[[ -f "$ZIP" ]] || { echo "Zip not found: $ZIP" >&2; exit 1; }

mkdir -p "$ICONS" "$ASSETS/aws-icons" "$ASSETS/tech-icons"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Extracting $ZIP ..."
unzip -q "$ZIP" -d "$TMP"

echo "Collecting 48px architecture + resource icons into $ICONS ..."
# Flatten: copy all 48px PNGs, stripping the nested category directories.
find "$TMP" -type f \( -name 'Arch_*_48.png' -o -name 'Res_*_48.png' \) -exec cp -n {} "$ICONS/" \;

COUNT=$(find "$ICONS" -name '*_48.png' | wc -l | tr -d ' ')
echo "Done. $COUNT icons in $ICONS"
echo "Tip: keep group icons (AWS-Cloud_32.png, *-subnet_32.png, Region_32.png) in $ICONS too."
