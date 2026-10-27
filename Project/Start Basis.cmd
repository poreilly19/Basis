@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Basis Studio
where py >nul 2>nul
if errorlevel 1 goto try_python
py -3 -c "import sys;sys.exit(not (sys.version_info >= (3,10)))" >nul 2>nul
if errorlevel 1 goto try_python
py -3 "%~dp0scripts\start-basis.py" %*
goto finished
:try_python
where python >nul 2>nul
if errorlevel 1 goto try_python3
python -c "import sys;sys.exit(not (sys.version_info >= (3,10)))" >nul 2>nul
if errorlevel 1 goto try_python3
python "%~dp0scripts\start-basis.py" %*
goto finished
:try_python3
where python3 >nul 2>nul
if errorlevel 1 goto missing
python3 -c "import sys;sys.exit(not (sys.version_info >= (3,10)))" >nul 2>nul
if errorlevel 1 goto missing
python3 "%~dp0scripts\start-basis.py" %*
goto finished
:missing
echo Basis needs Python 3.10 or newer.
echo Install Python from https://www.python.org/downloads/windows/
echo During installation, enable Add Python to PATH. Then double-click Start Basis again.
pause
exit /b 1
:finished
if not errorlevel 1 exit /b 0
echo.
echo Basis could not start. Read the message above, then try again.
pause
exit /b 1
