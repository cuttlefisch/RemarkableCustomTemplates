#!/usr/bin/env bash
#
# Bump the project version, update CHANGELOG.md, commit, and tag.
# Usage: ./scripts/version-bump.sh 0.2.0
#

set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.2.0"
  exit 1
fi

# Validate semver format (major.minor.patch, optional pre-release)
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: '$VERSION' is not a valid semver version (expected X.Y.Z or X.Y.Z-pre)"
  exit 1
fi

# Ensure we're in the project root (where package.json lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f package.json ]; then
  echo "Error: package.json not found in $PROJECT_ROOT"
  exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes. Commit or stash them first."
  exit 1
fi

# Check if tag already exists
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "Error: tag v$VERSION already exists"
  exit 1
fi

TODAY=$(date +%Y-%m-%d)

echo "Bumping version to $VERSION..."

# 1. Update package.json
# Use node for reliable JSON editing (no external deps needed)
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  Updated package.json"

# 2. Update electron-builder.yml if it has an explicit version field
if [ -f electron-builder.yml ]; then
  if grep -qE '^version:' electron-builder.yml; then
    sed -i "s/^version:.*/version: $VERSION/" electron-builder.yml
    echo "  Updated electron-builder.yml"
  else
    echo "  electron-builder.yml has no version field (reads from package.json)"
  fi
fi

# 3. Update CHANGELOG.md
if [ -f CHANGELOG.md ]; then
  # Insert new version section after [Unreleased]
  # Find the [Unreleased] line and add the new version section after it
  ENTRY="\\
## [$VERSION] - $TODAY\\
\\
### Added\\
\\
### Changed\\
\\
### Fixed\\
"
  # Insert after the [Unreleased] section's blank line
  if grep -q "## \[Unreleased\]" CHANGELOG.md; then
    sed -i "/^## \[Unreleased\]/a\\$ENTRY" CHANGELOG.md
    echo "  Updated CHANGELOG.md with [$VERSION] section"
  else
    echo "  Warning: no [Unreleased] section found in CHANGELOG.md; skipping changelog update"
  fi
else
  echo "  Warning: CHANGELOG.md not found; skipping changelog update"
fi

# 4. Commit and tag
git add package.json CHANGELOG.md
if [ -f electron-builder.yml ]; then
  git add electron-builder.yml
fi

git commit -m "chore: bump version to $VERSION"
git tag "v$VERSION"

echo ""
echo "Version $VERSION committed and tagged as v$VERSION."
echo "Push with: git push && git push --tags"
