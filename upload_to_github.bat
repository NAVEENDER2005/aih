@echo off
SETLOCAL EnableDelayedExpansion
echo ===================================================
echo   Uploading AI-Hirer Codebase to NAVEENDER2005/aih
echo ===================================================
echo.

:: 1. Handle the nested git repository in the frontend directory to prevent submodule issues on GitHub
if exist "frontend\.git" (
    echo [Step 1] Found nested .git folder in frontend. Backing it up to frontend\.git_backup...
    :: Use PowerShell to safely rename directory to avoid permissions issues
    powershell -Command "if (Test-Path 'frontend\.git') { Rename-Item -Path 'frontend\.git' -NewName '.git_backup' -Force }"
    if exist "frontend\.git" (
        echo   [!] Warning: Failed to rename frontend\.git. You may need to delete or rename it manually if files do not upload.
    ) else (
        echo   [+] Successfully backed up nested git repository to avoid submodule tracking errors!
    )
) else (
    echo [Step 1] No nested .git folder found in frontend. Ready to track files directly!
)
echo.

:: 2. Stage files
echo [Step 2] Staging all project files...
git add .
echo   [+] Files staged successfully.
echo.

:: 3. Commit files
echo [Step 3] Committing files...
git commit -m "Upload codebase to aih repository"
echo   [+] Files committed successfully.
echo.

:: 4. Push to remote origin
echo [Step 4] Pushing changes to https://github.com/NAVEENDER2005/aih.git...
git push -u origin main
echo.
echo ===================================================
echo   Upload process completed!
echo ===================================================
pause
