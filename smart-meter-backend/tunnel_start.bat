@echo off
:start
cls
echo ---------------------------------------------------
echo  Starting LocalTunnel (Meter Project)
echo  Auto-Restart enabled. Do not close this window!
echo ---------------------------------------------------

:: ใส่คำสั่งของคุณตรงนี้ (ผมใส่ subdomain ให้แล้ว)
call lt --port 3000 --subdomain meter-test-02

echo.
echo ⚠️ LocalTunnel Crashed! Restarting in 2 seconds...
timeout /t 2 >nul
goto start