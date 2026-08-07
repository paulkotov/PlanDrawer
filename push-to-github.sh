#!/usr/bin/env bash
# Push current local code to https://github.com/paulkotov/PlanDrawer
set -euo pipefail

REMOTE_URL="https://github.com/paulkotov/PlanDrawer.git"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo master)"

cd "$(dirname "$0")"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Error: not a git repository."
  exit 1
fi

# Ensure remote "origin" points to PlanDrawer
if git remote get-url origin >/dev/null 2>&1; then
  CURRENT_URL="$(git remote get-url origin)"
  if [[ "$CURRENT_URL" != "$REMOTE_URL" && "$CURRENT_URL" != "${REMOTE_URL%.git}" ]]; then
    echo "Updating origin: $CURRENT_URL -> $REMOTE_URL"
    git remote set-url origin "$REMOTE_URL"
  fi
else
  echo "Adding remote origin: $REMOTE_URL"
  git remote add origin "$REMOTE_URL"
fi

# Stage all tracked/untracked files (respects .gitignore)
git add -A

if git diff --cached --quiet; then
  echo "Nothing new to commit."
else
  if git rev-parse HEAD >/dev/null 2>&1; then
    MSG="Update PlanDrawer"
  else
    MSG="Initial commit"
  fi
  git commit -m "$MSG"
  echo "Created commit: $MSG"
fi

# Push (creates remote branch on first push)
echo "Pushing branch '$BRANCH' to origin..."
git push -u origin "$BRANCH"

echo "Done: https://github.com/paulkotov/PlanDrawer"
