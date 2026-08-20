@echo off
echo Creating junction for my-app-backend (no admin rights needed)...
mklink /J "C:\xammpp\htdocs\my-app-backend" "C:\xammpp\htdocs\tcims\my-app-backend"
echo.
echo Done. Check the message above:
echo   - "Junction created" = SUCCESS
echo   - "Access is denied" = something else is blocking it, tell Claude
echo   - "already exists" = it's already set up
echo.
pause
