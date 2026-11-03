#!/bin/sh
# Gives the freshly generated Initial migration an id derived from its content instead of the build time.
#   - Same model, new build: same id, so the Migrator sees nothing new and leaves the database alone.
#   - Changed model: new id, so the Migrator tries to create every table again and fails loudly
#     ("There is already an object named ..."), instead of the app running on an out-of-date schema.
#     Reset the database in that case (docs/render.md), as the README describes for the Codespace.
set -eu
dir="$1"
main=$(ls "$dir"/*_Initial.cs | grep -v '\.Designer\.cs$')
designer="${main%.cs}.Designer.cs"
hash=$(sha256sum "$main" | cut -c1-12)
id="00000000000000_Initial_$hash"
sed -i -E "s/\[Migration\(\"[0-9]{14}_Initial\"\)\]/[Migration(\"$id\")]/" "$designer"
grep -q "\[Migration(\"$id\")\]" "$designer" || { echo "Could not pin the Initial migration id in $designer" >&2; exit 1; }
echo "Initial migration id: $id"
