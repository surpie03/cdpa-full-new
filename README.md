# CDPA Compliance System
## Cyber & Data Protection Act [Chapter 12:07] — Republic of Zimbabwe

---

## Overview

A full-stack compliance management system for organisations subject to the Cyber and Data Protection Act (CDPA) [Chapter 12:07] of Zimbabwe. The system guides organisations through the complete CDPA compliance lifecycle — from controller validation through to gap remediation and risk assessment.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (zero dependencies) |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Authentication | JWT (JSON Web Tokens) + bcryptjs |
| File Uploads | Multer |

---

## Project Structure

```
cdpa-compliance-system/
│
├── backend/
│   ├── server.js          ← Express API server (all routes, auth, business logic)
│   └── schema.sql         ← PostgreSQL schema (12 tables)
│
├── frontend/
│   └── index.html         ← Complete single-file frontend (116KB, zero dependencies)
│
├── scripts/
│   ├── seed.js            ← Creates default users with hashed passwords
│   └── setup.js           ← Verifies database connection and tables
│
├── uploads/               ← Evidence file uploads (auto-created, gitignored)
├── docs/                  ← Documentation
│
├── .env.example           ← Environment variable template
├── package.json
├── start.bat              ← Windows quick-start
├── start.sh               ← Linux/Mac quick-start
└── README.md
```

---

## Quick Start

### Option A — Automated (Recommended)

**Windows:**
```
Double-click start.bat
```

**Linux / Mac:**
```bash
chmod +x start.sh && ./start.sh
```

### Option B — Manual Setup

**Step 1 — Install Node.js dependencies**
```bash
npm install
```

**Step 2 — Configure environment**
```bash
cp .env.example .env
# Edit .env — set DB_HOST, DB_PASS, JWT_SECRET at minimum
```

**Step 3 — PostgreSQL: create database and schema**
```bash
# Create the database
psql -U postgres -c "CREATE DATABASE cdpa_system;"

# Apply all tables and indexes
psql -U postgres -d cdpa_system -f backend/schema.sql
```

**Step 4 — Create default users**
```bash
node scripts/seed.js
```

**Step 5 — Verify everything**
```bash
node scripts/setup.js
```

**Step 6 — Start the server**
```bash
npm start          # Production
npm run dev        # Development (auto-restart on changes)
```

**Step 7 — Open browser**
```
http://localhost:3000
```

---

## Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | System Administrator |
| `dpo_officer` | `dpo123` | Data Protection Officer |
| Register new | your choice | Data Controller |

> ⚠️ Change all passwords before deploying to production

---

## System Modules

### 1. Controller Validation
- 13 weighted questions from Section 3 CDPA
- Weighted average scoring model (threshold: 60%)
- Licensing tier detection (Tier 1–4, $50–$2,500)
- Re-validation with attempt tracking
- Automatic qualification decision

### 2. Compliance Assessment Checklist
- 15 hospital departments, 80+ checklist items
- Three-level response: YES / PARTIAL / NO
- Evidence file upload per checklist item
- Live compliance score calculation
- Compliance levels: Fully / Substantially / Partially / Non-Compliant

### 3. Gap Analysis
- Auto-populated from failed checklist items
- Priority levels: Critical / High / Medium / Low
- Responsible person and target date fields
- Evidence upload per gap
- Save and track remediation progress

### 4. Security Gap Analysis (ISO 27001-aligned)
- 9 security domains, 122 control items
- Based on Security Gap Analysis Template
- YES / PARTIAL / NO per control item
- GOOD / FAIR / POOR ratings
- Per-domain scoring + overall security score
- Export full report as text file

### 5. Technical Recommendations
- Electronic Systems recommendations (6 categories)
- Manual/Paper-Based Systems recommendations (6 categories)
- CDPA Section references (11, 12, 16, 19, 23)
- Priority ratings: High / Medium / Low

### 6. ROPA (Record of Processing Activities)
- Sheet 2: Full processing activities form
- Sheet 4: Cover sheet reference example
- All mandatory CDPA fields
- Multiple processing activities per record

### 7. DPIA (Data Protection Impact Assessment)
- Main project/processing overview form
- Measure Catalog: 18 pre-loaded measures (Organizational/Technical/Physical)
- Risk Catalog: auto-calculated risk matrix (Likelihood × Impact)
- Protection levels: Basic / Standard / Enhanced
- Risk levels: Low / Medium / High / Critical
- DPO approval workflow

---

## User Roles & Permissions (Least Privilege)

### Data Controller
Can access: Controller Validation, Compliance Assessment, Gap Analysis, Tech Recommendations, Security Gap Analysis, ROPA (own), DPIA (own)

Cannot access: Other users' data, audit logs, user management

### Data Protection Officer
Can access: All assessments (view), Gap Analysis, Tech Recommendations, Security Gap Analysis, All ROPAs, All DPIAs, DPIA approval, Audit logs, DPO Dashboard

Cannot access: User management, system configuration

### System Administrator
Can access: User management, audit logs, activate/deactivate users, reset passwords, system stats

Cannot access: Assessment content, personal data in assessments

---

## API Reference

### Base URL
```
http://localhost:3000/api
```

### Authentication
All API requests (except `/auth/login` and `/auth/register`) require:
```
Authorization: Bearer <jwt_token>
```

### Endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/health` | Public | Server + DB health check |
| POST | `/auth/login` | Public | Login, returns JWT token |
| POST | `/auth/register` | Public | Register DC or DPO |
| GET | `/auth/me` | Any | Current user + permissions |
| POST | `/validation/submit` | DC | Submit 13-question validation |
| GET | `/validation` | DC | My validation history |
| POST | `/assessment` | DC | Create new assessment |
| GET | `/assessment` | All | List assessments |
| GET | `/assessment/:id` | All | Assessment + responses |
| POST | `/assessment/:id/checklist` | DC | Save checklist responses |
| POST | `/assessment/:id/submit` | DC | Calculate final score |
| PATCH | `/assessment/:id/review` | DPO | Review/approve assessment |
| POST | `/evidence/upload` | DC | Upload evidence file |
| POST | `/gap` | DC | Save gap analysis |
| GET | `/gap` | All | List gaps |
| PATCH | `/gap/:id` | DC | Update gap status |
| GET | `/tech-recommendations/:type` | All | electronic or manual |
| POST | `/ropa` | DC | Create ROPA record |
| GET | `/ropa` | All | List ROPAs |
| GET | `/ropa/:id` | All | ROPA + activities |
| POST | `/dpia` | DC | Create DPIA |
| GET | `/dpia` | All | List DPIAs |
| GET | `/dpia/:id` | All | DPIA + measures + risks |
| PATCH | `/dpia/:id/approve` | DPO | Approve/reject DPIA |
| GET | `/admin/users` | Admin | List all users |
| POST | `/admin/users` | Admin | Create user (any role) |
| PATCH | `/admin/users/:id` | Admin | Activate/deactivate |
| PATCH | `/admin/users/:id/reset-password` | Admin | Reset password |
| GET | `/admin/audit-logs` | Admin/DPO | Audit log |
| GET | `/admin/stats` | Admin/DPO | System statistics |

---

## Database Schema

| Table | Description |
|-------|-------------|
| `users` | System users with roles and auth |
| `controller_validations` | Section 3 CDPA weighted validation results |
| `compliance_assessments` | Assessment records per organisation |
| `checklist_responses` | Individual checklist item responses |
| `evidence_uploads` | Uploaded evidence files metadata |
| `gap_analysis` | Gap items with priority and remediation |
| `ropa_records` | ROPA record headers |
| `ropa_processing_activities` | Individual processing activities (Sheet 2) |
| `dpia_assessments` | DPIA project records |
| `dpia_measure_catalog` | Selected protection measures per DPIA |
| `dpia_risk_catalog` | Risk items with likelihood/impact matrix |
| `audit_logs` | Full audit trail of all actions |

---

## Compliance Score Interpretation

| Score | Level |
|-------|-------|
| 90 – 100% | Fully Compliant |
| 70 – 89% | Substantially Compliant |
| 50 – 69% | Partially Compliant |
| Below 50% | Non-Compliant — Immediate action required |

## Controller Validation
- Minimum weighted score: **60%** to qualify
- Questions weighted 1.0× to 1.5× based on CDPA Section 3 importance
- Unlimited re-validation attempts with attempt tracking

## Licensing Tiers (CDPA Schedule 7)

| Tier | Data Subjects | Registration & Licence Fee |
|------|--------------|---------------------------|
| 1 | 50 to 1,000 | $50 |
| 2 | 1,001 to 100,000 | $300 |
| 3 | 100,001 to 500,000 | $500 |
| 4 | 500,000 and above | $2,500 |

---

## Offline / Standalone Mode

The frontend (`frontend/index.html`) works completely standalone without the backend:
- Open the file directly in any web browser
- All data saved to browser localStorage
- Full functionality available offline
- When backend is running, data automatically syncs to PostgreSQL

The browser shows a status indicator:
- 🟢 **Backend Connected** — data syncs to PostgreSQL
- 🟡 **Offline Mode** — data stays in localStorage

---

## Production Deployment Checklist

- [ ] Change `JWT_SECRET` to a long random string (32+ characters)
- [ ] Change all default user passwords
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Use HTTPS — add SSL certificate or reverse proxy (nginx/Apache)
- [ ] Set a strong `DB_PASS`
- [ ] Restrict CORS in `server.js` to your domain
- [ ] Configure firewall to allow only port 3000 (or 443 via proxy)
- [ ] Set up regular PostgreSQL backups (`pg_dump`)
- [ ] Review and rotate `uploads/` directory permissions
- [ ] Enable PostgreSQL connection pooling (PgBouncer) for high traffic
- [ ] Configure log rotation for Node.js process logs

---

## Troubleshooting

**Cannot connect to database**
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check connection with correct credentials
psql -U postgres -d cdpa_system -c "SELECT version();"
```

**Port 3000 already in use**
```bash
# Change port in .env
PORT=3001
```

**Tables don't exist**
```bash
psql -U postgres -d cdpa_system -f backend/schema.sql
node scripts/seed.js
```

**File uploads failing**
```bash
# Create uploads directory manually
mkdir uploads
```

---

*CDPA Compliance System v2.0 — Built for Zimbabwe Cyber & Data Protection Act [Chapter 12:07]*
