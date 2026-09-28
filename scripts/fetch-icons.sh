#!/usr/bin/env bash
#
# Installs the AWS Architecture Icons so this MCP server can inline them.
#
# The official icon set is NOT redistributed with this repo (see
# https://aws.amazon.com/architecture/icons/ — Terms of Use), so it has to be
# downloaded once. It installs into a PER-MACHINE cache
# (~/.aws-architecture-icons) that every copy of this server reads — a plugin
# install, an npx run and a git clone all share it, so reinstalling or upgrading
# the plugin never means downloading the zip again.
#
# Usage:
#   ./scripts/fetch-icons.sh                      # newest Asset-Package zip in ~/Downloads (or ~/Desktop, .)
#   ./scripts/fetch-icons.sh <Asset-Package.zip>  # a specific zip
#   ./scripts/fetch-icons.sh <extracted-dir>      # an already-extracted asset package
#   ./scripts/fetch-icons.sh <src> --dest <dir>   # install elsewhere (e.g. this repo's assets/)
#
# Override the destination for one run with --dest, or permanently by exporting
# AWS_DIAGRAM_ICON_ROOT (the server honours the same variable).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC=""
DEST="${AWS_DIAGRAM_ICON_ROOT:-$HOME/.aws-architecture-icons}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest) DEST="${2:?--dest needs a directory}"; shift 2 ;;
    --dest=*) DEST="${1#--dest=}"; shift ;;
    -h|--help) sed -n '3,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) SRC="$1"; shift ;;
  esac
done

# No source given: look where a browser download actually lands. Newest wins,
# because AWS refreshes the icon set quarterly.
if [[ -z "$SRC" ]]; then
  for dir in "$HOME/Downloads" "$HOME/Desktop" "$PWD" "$ROOT"; do
    [[ -d "$dir" ]] || continue
    found="$(ls -t "$dir"/Asset-Package*.zip 2>/dev/null | head -n 1 || true)"
    if [[ -n "$found" ]]; then SRC="$found"; echo "Using $SRC"; break; fi
  done
fi

if [[ -z "$SRC" ]]; then
  cat <<EOF
AWS Architecture Icons are required but not bundled (license).

1. Download the LATEST "Asset Package" zip from:
   https://aws.amazon.com/architecture/icons/
   (AWS refreshes the icon set quarterly — always grab the newest one rather
    than reusing an old download, per AWS diagram guidelines.)
2. Re-run this script. With the zip left in ~/Downloads, no argument is needed:
   ./scripts/fetch-icons.sh

Icons install into $DEST and are shared by every copy of this server.
You may also drop custom SVGs into $DEST/aws-icons/ and $DEST/tech-icons/.
EOF
  exit 0
fi

ICONS="$DEST/icons"
mkdir -p "$ICONS" "$DEST/aws-icons" "$DEST/tech-icons"

# A zip gets extracted to a temp dir; an already-extracted directory is read in place.
if [[ -d "$SRC" ]]; then
  TMP="$SRC"
elif [[ -f "$SRC" ]]; then
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  echo "Extracting $SRC ..."
  unzip -q "$SRC" -d "$TMP"
else
  echo "Not a zip or a directory: $SRC" >&2
  exit 1
fi

# Drop macOS resource-fork metadata so the ._* files don't get copied as junk.
rm -rf "$TMP/__MACOSX"
find "$TMP" -name '._*' -delete 2>/dev/null || true

echo "Collecting 48px architecture, resource and category icons into $ICONS ..."
# Flatten: copy all 48px PNGs, stripping the nested category directories.
# Arch-Category_*_48.png are used as fallbacks for niche services without a
# dedicated icon (see lib/service-icons.json).
find "$TMP" -type f \( -name 'Arch_*_48.png' -o -name 'Res_*_48.png' -o -name 'Arch-Category_*_48.png' \) -exec cp -n {} "$ICONS/" \;

echo "Collecting group icons (AWS Cloud, VPC, subnets, Region) ..."
# The HTML/draw.io group containers reference these 32px icons by exact name.
# Matched by name rather than by directory so this also works when the source is
# an already-flattened icon root (not only the nested asset package).
find "$TMP" -type f \( -path '*Architecture-Group-Icons*' -name '*_32.png' \
  -o -name 'AWS-Cloud_32.png' -o -name 'Region_32.png' \
  -o -name 'Virtual-private-cloud-VPC_32.png' -o -name 'Public-subnet_32.png' \
  -o -name 'Private-subnet_32.png' -o -name 'AWS-Account_32.png' \
  -o -name 'Auto-Scaling-group_32.png' -o -name 'Corporate-data-center_32.png' \) \
  -exec cp -n {} "$ICONS/" \;

echo "Collecting actor icons (Users) ..."
# Light-variant actor icons used for external/user nodes (e.g. Res_Users_48_Light.png).
find "$TMP" -type f \( -name 'Res_User_48_Light.png' -o -name 'Res_Users_48_Light.png' \) -exec cp -n {} "$ICONS/" \;

# Custom (non-AWS) SVGs ship in the repo, not in the asset package — copy them
# along so a shared cache is a COMPLETE icon root, not just the AWS half. Also
# take them from the source when it is itself an icon root.
for extra in aws-icons tech-icons; do
  for from in "$ROOT/assets/$extra" "$TMP/$extra"; do
    [[ -d "$from" && "$from" != "$DEST/$extra" ]] || continue
    find "$from" -type f \( -name '*.svg' -o -name '*.png' \) -exec cp -n {} "$DEST/$extra/" \; 2>/dev/null || true
  done
done

COUNT=$(find "$ICONS" -name '*.png' | wc -l | tr -d ' ')
echo "Done. $COUNT icons in $ICONS"
