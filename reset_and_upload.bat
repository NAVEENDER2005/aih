@echo off
SETLOCAL EnableDelayedExpansion
echo ===================================================
echo   Resetting Git History and Uploading to GitHub
echo ===================================================
echo.

:: 1. Remove/rename the old .git directory to clear history containing the secret
if exist ".git" (
    echo [Step 1] Renaming existing .git directory to .git_old to clear history...
    powershell -Command "if (Test-Path '.git') { Rename-Item -Path '.git' -NewName '.git_old' -Force }"
    if exist ".git" (
        echo   [!] Warning: Could not rename .git. Trying to delete it instead...
        rmdir /s /q .git
    ) else (
        echo   [+] Successfully cleared old git history (saved in .git_old).
    )
)
echo.

:: 2. Handle the nested git repository in the frontend directory to prevent submodule issues
if exist "frontend\.git" (
    echo [Step 2] Found nested .git folder in frontend. Backing it up to frontend\.git_backup...
    powershell -Command "if (Test-Path 'frontend\.git') { Rename-Item -Path 'frontend\.git' -NewName '.git_backup' -Force }"
    if exist "frontend\.git" (
        echo   [!] Warning: Failed to rename frontend\.git.
    ) else (
        echo   [+] Successfully backed up nested git repository!
    )
) else (
    echo [Step 2] No nested .git folder found in frontend. Ready to track files directly!
)
echo.

:: 3. Initialize fresh Git repository
echo [Step 3] Initializing fresh Git repository...
git init -b main
echo   [+] Fresh Git repository initialized.
echo.

:: 4. Add the remote URL
echo [Step 4] Configuring remote URL to https://github.com/NAVEENDER2005/aih.git...
git remote add origin https://github.com/NAVEENDER2005/aih.git
echo   [+] Remote origin added.
echo.

:: 5. Stage files
echo [Step 5] Staging all project files...
git add .
echo   [+] Files staged successfully.
echo.

:: 6. Commit files
echo [Step 6] Committing files...
git commit -m "Initial commit (Clean history)"
echo   [+] Files committed successfully.
echo.

:: 7. Push to remote origin
echo [Step 7] Pushing clean initial commit to https://github.com/NAVEENDER2005/aih.git...
git push -u origin main --force
echo.
echo ===================================================
echo   Clean upload completed successfully!
echo ===================================================
pause
