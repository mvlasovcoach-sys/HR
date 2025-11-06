
#!/usr/bin/env bash
set -euo pipefail

# Run from repo root if possible; else update paths below accordingly.
TARGET_DIR="HR/assets/fonts"
mkdir -p "$TARGET_DIR"

echo "Downloading Inter Variable (roman) ..."
curl -L -o "$TARGET_DIR/Inter-Variable.woff2" "https://rsms.me/inter/font-files/Inter-roman.var.woff2"

echo "Downloading Inter Variable (italic) ..."
curl -L -o "$TARGET_DIR/Inter-Variable-Italic.woff2" "https://rsms.me/inter/font-files/Inter-italic.var.woff2"

echo "Downloading license (OFL.txt) ..."
curl -L -o "$TARGET_DIR/OFL.txt" "https://raw.githubusercontent.com/rsms/inter/master/OFL.txt"

echo "Done. Files saved to $TARGET_DIR"
ls -lh "$TARGET_DIR"
