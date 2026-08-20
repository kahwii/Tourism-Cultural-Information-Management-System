@echo off
REM ============================================================
REM  Start MySQL for local TCIMS development.
REM
REM  Why this exists: starting MySQL from the XAMPP Control Panel
REM  dies silently on this machine, but launching mysqld directly
REM  with the same my.ini works. This is the working path.
REM
REM  Usage: double-click this file. Leave the window OPEN —
REM  closing it stops MySQL. Press Ctrl+C in the window to stop.
REM ============================================================

title TCIMS - MySQL (keep this window open)

echo ============================================================
echo   Starting MySQL for TCIMS...
echo.
echo   KEEP THIS WINDOW OPEN while you work.
echo   Closing it will stop MySQL.
echo ============================================================
echo.

C:\xammpp\mysql\bin\mysqld --defaults-file=C:\xammpp\mysql\bin\my.ini --console

echo.
echo ============================================================
echo   MySQL has stopped.
echo ============================================================
pause
