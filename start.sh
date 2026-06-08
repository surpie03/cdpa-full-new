#!/bin/bash
echo "====================================================="
echo " CDPA Compliance System — Quick Start (Linux/Mac)"
echo " Cyber & Data Protection Act [Chapter 12:07]"
echo "====================================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found. Install from https://nodejs.org"
    exit 1
fi
echo "[OK] Node.js $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm not found"
    exit 1
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then echo "ERROR: npm install failed"; exit 1; fi
echo "[OK] Dependencies installed"

# Create .env if missing
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env from template..."
    cp .env.example .env
    echo ""
    echo "=========================================="
    echo "  IMPORTANT: Edit .env with your settings"
    echo "  nano .env   OR   vim .env"
    echo "=========================================="
    echo "  Minimum required:"
    echo "    DB_HOST=localhost"
    echo "    DB_PASS=your_postgres_password"
    echo "    JWT_SECRET=change_to_random_string"
    echo "=========================================="
    echo ""
    echo "Press Enter when .env is configured..."
    read
fi
echo "[OK] .env found"

# Check if DB needs setup
echo ""
echo "Checking database..."
node scripts/setup.js 2>/dev/null
if [ $? -ne 0 ]; then
    echo ""
    echo "Database needs setup. Running now..."
    echo ""
    echo "Step 1: Creating database (enter postgres password if prompted)..."
    psql -U postgres -c "CREATE DATABASE cdpa_system;" 2>/dev/null || echo "  (Database may already exist)"

    echo "Step 2: Applying schema..."
    psql -U postgres -d cdpa_system -f backend/schema.sql
    if [ $? -ne 0 ]; then echo "ERROR: Schema failed"; exit 1; fi
    echo "[OK] Schema applied"

    echo "Step 3: Seeding default users..."
    node scripts/seed.js
    echo "[OK] Users created"
fi

# Start
echo ""
echo "====================================================="
echo " Starting CDPA Compliance System..."
echo " Open your browser: http://localhost:3000"
echo ""
echo " Login: admin / admin123        (System Admin)"
echo " Login: dpo_officer / dpo123    (DPO)"
echo " Or register a new Data Controller"
echo "====================================================="
echo ""
npm start
