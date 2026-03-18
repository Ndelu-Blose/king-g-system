#!/bin/bash
# Run this in Git Bash from the King-G folder to push to GitHub.
# Repo: https://github.com/MandisaBiyela/King-G-System.git

REPO="https://github.com/MandisaBiyela/King-G-System.git"
cd "$(dirname "$0")"

if [ ! -d .git ]; then
  echo "Initializing git repo..."
  git init
  git add .
  git commit -m "Initial commit: King-G POS, roles, shift and sales history"
else
  git add .
  git status
  git commit -m "Back buttons, shift for cashiers only, shift history page" || true
fi

git remote remove origin 2>/dev/null || true
git remote add origin "$REPO"
git branch -M main
git push -u origin main
echo "Pushed to $REPO"
