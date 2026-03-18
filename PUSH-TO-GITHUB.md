# Push King-G to GitHub

**Repo:** https://github.com/MandisaBiyela/King-G-System.git

## Option 1: Use the PowerShell script (easiest)

1. In File Explorer, go to the King-G folder.
2. Right-click **`push-to-github.ps1`** → **Run with PowerShell**.
3. If you see "Git not found", install Git from https://git-scm.com/download/win, then run the script again.

## Option 2: Run commands manually

Use **Git Bash** (from the Start menu after installing Git) or a terminal where `git` is in PATH. PowerShell in Cursor often doesn’t have `git` in PATH.

## First time (no repo yet)

```bash
cd "c:\Users\Zwelethu Sec\OneDrive - Durban University of Technology\Desktop\King-G"

git init
git add .
git commit -m "Initial commit: King-G POS and shift management"

git remote add origin https://github.com/MandisaBiyela/King-G-System.git
git branch -M main
git push -u origin main
```

## Already have a repo (or after first push)

```bash
cd "c:\Users\Zwelethu Sec\OneDrive - Durban University of Technology\Desktop\King-G"

git remote add origin https://github.com/MandisaBiyela/King-G-System.git
# (skip the line above if origin already exists)

git add .
git commit -m "Back buttons, shift for cashiers only, shift history page"
git branch -M main
git push -u origin main
```
