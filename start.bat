@echo off
echo =====================================================
echo  CDPA Compliance System — Quick Start (Windows)
echo  Cyber ^& Data Protection Act [Chapter 12:07]
echo =====================================================
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Download from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js found

REM Install dependencies
echo.
echo Installing Node.js dependencies...
call npm install
if errorlevel 1 ( echo ERROR: npm install failed & pause & exit /b 1 )
echo [OK] Dependencies installed

REM Check .env
if not exist .env (
    echo.
    echo Creating .env from template...
    copy .env.example .env
    echo.
    echo IMPORTANT: Edit .env file and set your PostgreSQL password!
    echo    DB_PASS=your_password_here
    echo.
    notepad .env
    echo Press any key when you have saved your .env file...
    pause >nul
)
echo [OK] .env file found

REM Verify setup
echo.
echo Verifying database setup...
node scripts/setup.js
if errorlevel 1 (
    echo.
    echo Database setup failed. Please:
    echo   1. Make sure PostgreSQL is running
    echo   2. Create the database: psql -U postgres -c "CREATE DATABASE cdpa_system;"
    echo   3. Apply schema: psql -U postgres -d cdpa_system -f backend/schema.sql
    echo   4. Run seed: node scripts/seed.js
    echo   5. Then run this script again
    pause
    exit /b 1
)

REM Start server
echo.
echo =====================================================
echo  Starting CDPA Compliance System...
echo  Open your browser to: http://localhost:3000
echo =====================================================
echo.
npm start
