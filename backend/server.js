// =====================================================
// CDPA Compliance System — Node.js Backend Server
// Cyber & Data Protection Act [Chapter 12:07] Zimbabwe
// =====================================================
'use strict';

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { Pool }   = require('pg');
const reportsController = require('./controllers/reportsController');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const dbInit     = require('./db-initialization');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cdpa_zim_fallback_secret_change_in_production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h';

// ─── DATABASE ────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'cdpa_system',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASS     || 'masie*03e',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => console.error('PostgreSQL pool error:', err.message));

// Test DB connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌  Database connection failed:', err.message);
    console.error('    Check your .env file (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS)');
  } else {
    console.log('✅  Database connected successfully');
    release();
  }
});

// ─── MIDDLEWARE ──────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// Serve frontend
const frontendDir = path.join(__dirname, '..', process.env.FRONTEND_DIR || 'frontend');
app.use(express.static(frontendDir));

// ─── FILE UPLOAD ─────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.doc','.docx','.xls','.xlsx','.jpg','.jpeg','.png','.txt','.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('File type not permitted: ' + ext));
  }
});

// ─── ROLE PERMISSIONS (Least Privilege) ──────────────
// ══════════════════════════════════════════════════════════
// LEAST PRIVILEGE PRINCIPLE - Data Controller Role Removed
// DPO (Data Protection Officer) - Only Assessment Role
// ══════════════════════════════════════════════════════════
const PERMISSIONS = {
  data_protection_officer: [
    // Assessment & Compliance Modules - FULL ACCESS
    'create_assessment',        // Can create assessments
    'submit_checklist',         // Can submit assessment responses
    'view_all_assessments',     // Can view all assessments
    'review_assessments',       // Can review assessments
    'upload_evidence',          // Can upload evidence
    'view_all_gap',             // Can view all gap analyses
    'save_gap',                 // Can save/edit gap analyses
    'view_tech_recommendations',// Can view tech recommendations
    'view_all_ropa',            // Can view ROPA records
    'create_ropa',              // Can create ROPA
    'view_all_dpia',            // Can view DPIA assessments
    'create_dpia',              // Can create DPIA
    'approve_dpia',             // Can approve DPIA
    'validate_controller',      // Can validate controllers
    // Organization Reports (NOT system-wide)
    'generate_org_reports',     // Can generate organization-level reports
    // NO Permissions:
    // ✗ NO user management
    // ✗ NO audit logs
    // ✗ NO admin dashboards
  ],
  system_administrator: [
    // Assessment & Compliance Modules - FULL ACCESS
    'create_assessment',        // Can create assessments
    'submit_checklist',         // Can submit assessment responses
    'view_all_assessments',     // Can view all assessments
    'review_assessments',       // Can review assessments
    'upload_evidence',          // Can upload evidence
    'view_all_gap',             // Can view all gap analyses
    'save_gap',                 // Can save/edit gap analyses
    'view_tech_recommendations',// Can view tech recommendations
    'view_all_ropa',            // Can view ROPA records
    'create_ropa',              // Can create ROPA
    'view_all_dpia',            // Can view DPIA assessments
    'create_dpia',              // Can create DPIA
    'approve_dpia',             // Can approve DPIA
    'validate_controller',      // Can validate controllers
    'generate_org_reports',     // Can generate organization-level reports
    // System Administration
    'manage_users',             // Can create/modify/delete users
    'reset_passwords',          // Can reset user passwords
    'manage_system',            // Can configure system settings
    'view_audit_logs',          // Can view who did what
    'export_audit_logs',        // Can export audit trail
    'manage_dpo',               // Can manage DPO accounts
    'manage_system_admin',      // Can manage admin accounts
  ]
};

// ─── AUTH MIDDLEWARE ─────────────────────────────────
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result  = await pool.query(
      'SELECT id, username, role, organization, dpo_number, email, is_active FROM users WHERE id = $1 AND is_active = TRUE',
      [decoded.id]
    );
    if (!result.rows[0]) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = result.rows[0];
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authorize = (permission) => (req, res, next) => {
  const perms = PERMISSIONS[req.user.role] || [];
  if (!perms.includes(permission)) {
    auditLog(req.user.id, 'ACCESS_DENIED', permission, { role: req.user.role }, req.ip);
    return res.status(403).json({
      error: 'Access denied — insufficient permissions',
      required: permission,
      your_role: req.user.role
    });
  }
  next();
};

// ─── AUDIT LOGGER ────────────────────────────────────
// Enhanced audit logging with module and role tracking
const auditLog = async (userId, action, resource, details = {}, ip = null, module = 'GENERAL') => {
  try {
    const detailsObj = {
      ...details,
      module,
      timestamp: new Date().toISOString(),
    };
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, resource, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, resource, JSON.stringify(detailsObj), ip]
    );
  } catch (e) {
    console.error('Audit log write error:', e.message);
  }
};

// ─── HELPERS ─────────────────────────────────────────
const QUESTION_WEIGHTS = {
  q1:1.5, q2:1.5, q3:1.0, q4:1.0, q5:1.5,
  q6:1.0, q7:1.5, q8:1.5, q9:1.0, q10:1.0,
  q11:1.0, q12:1.5, q13:1.0
};

const getLicensingTier = (n) => {
  n = parseInt(n) || 0;
  if (n >= 50     && n <= 1000)   return { tier: 1, fee: 50,   range: '50 to 1,000' };
  if (n >= 1001   && n <= 100000) return { tier: 2, fee: 300,  range: '1,001 to 100,000' };
  if (n >= 100001 && n <= 500000) return { tier: 3, fee: 500,  range: '100,001 to 500,000' };
  if (n > 500000)                 return { tier: 4, fee: 2500, range: '500,000 and above' };
  return { tier: 0, fee: 0, range: 'Below minimum (50 required)' };
};

const calcWeightedScore = (answers) => {
  let total = 0, yes = 0;
  for (const [key, weight] of Object.entries(QUESTION_WEIGHTS)) {
    total += weight;
    if (answers[key] === 'yes') yes += weight;
  }
  return parseFloat(((yes / total) * 100).toFixed(2));
};

const calcComplianceScore = (responses) => {
  let total = 0, achieved = 0;
  responses.forEach(r => {
    total    += parseFloat(r.weight) || 1;
    if (r.response === 'yes')     achieved += parseFloat(r.weight) || 1;
    if (r.response === 'partial') achieved += (parseFloat(r.weight) || 1) * 0.5;
  });
  return total > 0 ? parseFloat(((achieved / total) * 100).toFixed(2)) : 0;
};

const getComplianceLevel = (score) => {
  if (score >= 90) return 'Fully Compliant';
  if (score >= 70) return 'Substantially Compliant';
  if (score >= 50) return 'Partially Compliant';
  return 'Non-Compliant';
};

const calcRiskLevel = (likelihood, impact) => {
  const matrix = {
    'low-low':'low',    'low-medium':'low',    'low-high':'medium',
    'medium-low':'low', 'medium-medium':'medium','medium-high':'high',
    'high-low':'medium','high-medium':'high',   'high-high':'critical'
  };
  return matrix[`${likelihood}-${impact}`] || 'medium';
};

// =====================================================
// ROUTES
// =====================================================

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});

// ─── AUTH ─────────────────────────────────────────────

// Register (Data Controller or DPO only — Admin is created via seed)
app.post('/api/auth/register', async (req, res) => {
  const { username, password, role, dpo_number, email } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password and role are required' });
  }
  if (role !== 'data_protection_officer') {
    return res.status(400).json({ error: 'Only Data Protection Officers can self-register. System Administrators and admins must be created by existing admins' });
  }
  if (!dpo_number) {
    return res.status(400).json({ error: 'DPO practice number is required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const hash   = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role, dpo_number, email) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, role, dpo_number, email',
      [username.trim(), hash, role, dpo_number.trim(), email || null]
    );
    auditLog(result.rows[0].id, 'USER_REGISTERED', 'users', { username, role, dpo_number }, req.ip);
    res.status(201).json({ message: 'Account created successfully', user: result.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    console.error(e);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = TRUE', [username.trim()]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)  return res.status(401).json({ error: 'Invalid credentials' });

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    auditLog(user.id, 'USER_LOGIN', 'auth', {}, req.ip);
    res.json({
      token,
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        organization: user.organization,
        dpo_number: user.dpo_number,
        email: user.email
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user + permissions
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({
    user: req.user,
    permissions: PERMISSIONS[req.user.role] || []
  });
});

// ─── CONTROLLER VALIDATION ────────────────────────────

// Submit validation
app.post('/api/validation/submit', authenticate, authorize('validate_controller'), async (req, res) => {
  const { answers, organization_name, organization_registration_number, num_data_subjects, attempt_number, controller_name, controller_address, controller_contact, dpo_name, dpo_contact, controller_license_number, controller_contact_number } = req.body;
  if (!answers || !organization_name) {
    return res.status(400).json({ error: 'answers and organization_name are required' });
  }
  const score     = calcWeightedScore(answers);
  const isValid   = score >= 60;
  const licensing = getLicensingTier(num_data_subjects);
  try {
    const result = await pool.query(
      `INSERT INTO controller_validations
         (user_id, organization_name, validation_answers, weighted_score, is_valid,
          licensing_tier, num_data_subjects, registration_fee, attempt_number,
          registration_number, controller_name, controller_address, controller_contact, dpo_name, dpo_contact, controller_license_number, controller_contact_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [req.user.id, organization_name.trim(), JSON.stringify(answers), score, isValid,
       licensing.tier, parseInt(num_data_subjects) || 0, licensing.fee, parseInt(attempt_number) || 1,
       organization_registration_number || null, controller_name || null, controller_address || null, controller_contact || null, dpo_name || null, dpo_contact || null,
       controller_license_number || null, controller_contact_number || null]
    );
    auditLog(req.user.id, 'VALIDATION_SUBMITTED', 'controller_validations',
             { isValid, score, attempt: attempt_number }, req.ip);
    res.status(201).json({
      validation: result.rows[0],
      weighted_score: score,
      is_valid: isValid,
      threshold: 60,
      licensing
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get my validations
app.get('/api/validation', authenticate, authorize('validate_controller'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM controller_validations WHERE user_id=$1 ORDER BY validated_at DESC',
      [req.user.id]
    );
    res.json({ validations: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── COMPLIANCE ASSESSMENT ────────────────────────────

// Create assessment
app.post('/api/assessment', authenticate, authorize('create_assessment'), async (req, res) => {
  const { organization_name, attempt_number = 1 } = req.body;
  if (!organization_name) return res.status(400).json({ error: 'organization_name required' });
  try {
    const result = await pool.query(
      'INSERT INTO compliance_assessments (user_id, organization_name, status, attempt_number) VALUES ($1,$2,\'draft\',$3) RETURNING *',
      [req.user.id, organization_name.trim(), parseInt(attempt_number) || 1]
    );
    auditLog(req.user.id, 'ASSESSMENT_CREATED', 'compliance_assessments', { id: result.rows[0].id, attempt: attempt_number }, req.ip);
    res.status(201).json({ assessment: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save / update checklist responses
app.post('/api/assessment/:id/checklist', authenticate, authorize('submit_checklist'), async (req, res) => {
  const assessmentId = parseInt(req.params.id);
  const { responses } = req.body; // array of {department, item_key, item_text, response, weight}
  if (!Array.isArray(responses)) return res.status(400).json({ error: 'responses must be an array' });

  try {
    // Verify ownership
    const check = await pool.query('SELECT id, user_id FROM compliance_assessments WHERE id=$1', [assessmentId]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Assessment not found' });
    if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not your assessment' });

    // Upsert each response
    for (const r of responses) {
      await pool.query(
        `INSERT INTO checklist_responses (assessment_id, department, item_key, item_text, response, weight)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (assessment_id, department, item_key)
         DO UPDATE SET response=$5, item_text=$4, weight=$6, updated_at=NOW()`,
        [assessmentId, r.department, r.item_key, r.item_text || '', r.response, parseFloat(r.weight) || 1.0]
      );
    }

    auditLog(req.user.id, 'CHECKLIST_SAVED', 'checklist_responses',
             { assessment_id: assessmentId, count: responses.length }, req.ip);
    res.json({ message: 'Checklist saved', count: responses.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Submit assessment (calculate score)
app.post('/api/assessment/:id/submit', authenticate, authorize('submit_checklist'), async (req, res) => {
  const assessmentId = parseInt(req.params.id);
  try {
    const check = await pool.query('SELECT * FROM compliance_assessments WHERE id=$1', [assessmentId]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Assessment not found' });
    if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not your assessment' });

    const responses = await pool.query(
      'SELECT * FROM checklist_responses WHERE assessment_id=$1', [assessmentId]
    );
    const score = calcComplianceScore(responses.rows);
    const level = getComplianceLevel(score);
    const status = score < 50 ? 'needs_redo' : 'submitted';

    await pool.query(
      `UPDATE compliance_assessments
       SET overall_score=$1, compliance_level=$2, status=$3, submitted_at=NOW(), updated_at=NOW()
       WHERE id=$4`,
      [score, level, status, assessmentId]
    );
    auditLog(req.user.id, 'ASSESSMENT_SUBMITTED', 'compliance_assessments',
             { id: assessmentId, score, level, status }, req.ip);
    res.json({ assessment_id: assessmentId, score, level, status, message: 'Assessment submitted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get my assessments
app.get('/api/assessment', authenticate, async (req, res) => {
  try {
    let q, params;
    
    if (req.user.role === 'data_protection_officer' || req.user.role === 'system_administrator') {
      // DPO & System Admins: Can view ALL assessments (no org restriction)
      q = `SELECT ca.*, u.username 
           FROM compliance_assessments ca 
           JOIN users u ON ca.user_id=u.id 
           ORDER BY ca.created_at DESC`;
      params = [];
    } else {
      return res.status(403).json({ error: 'Invalid role' });
    }
    
    const result = await pool.query(q, params);
    res.json({ assessments: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get assessment detail + responses
app.get('/api/assessment/:id', authenticate, async (req, res) => {
  const assessmentId = parseInt(req.params.id);
  try {
    const aRes = await pool.query('SELECT * FROM compliance_assessments WHERE id=$1', [assessmentId]);
    if (!aRes.rows[0]) return res.status(404).json({ error: 'Assessment not found' });

    // Check access - DPO & System Admin can access all assessments
    if (req.user.role !== 'data_protection_officer' && req.user.role !== 'system_administrator') {
      return res.status(403).json({ error: 'Invalid role' });
    }

    const responses = await pool.query(
      'SELECT * FROM checklist_responses WHERE assessment_id=$1 ORDER BY department, item_key',
      [assessmentId]
    );
    res.json({ assessment: aRes.rows[0], responses: responses.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DPO: Review assessment
app.patch('/api/assessment/:id/review', authenticate, authorize('review_assessments'), async (req, res) => {
  const { status, review_notes } = req.body;
  if (!['reviewed','approved'].includes(status)) {
    return res.status(400).json({ error: "status must be 'reviewed' or 'approved'" });
  }
  try {
    await pool.query(
      'UPDATE compliance_assessments SET status=$1, review_notes=$2, reviewed_by=$3, reviewed_at=NOW() WHERE id=$4',
      [status, review_notes || null, req.user.id, req.params.id]
    );
    auditLog(req.user.id, 'ASSESSMENT_REVIEWED', 'compliance_assessments',
             { id: req.params.id, status }, req.ip);
    res.json({ message: 'Assessment updated', status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── EVIDENCE UPLOAD ──────────────────────────────────

app.post('/api/evidence/upload', authenticate, authorize('upload_evidence'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { assessment_id, department, item_key } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO evidence_uploads
         (user_id, assessment_id, department, item_key, original_name, stored_name, file_size, mime_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, assessment_id || null, department || null, item_key || null,
       req.file.originalname, req.file.filename, req.file.size, req.file.mimetype]
    );
    // Update checklist response with file ref
    if (assessment_id && department && item_key) {
      await pool.query(
        `UPDATE checklist_responses SET evidence_file=$1, updated_at=NOW()
         WHERE assessment_id=$2 AND department=$3 AND item_key=$4`,
        [req.file.filename, assessment_id, department, item_key]
      );
    }
    auditLog(req.user.id, 'EVIDENCE_UPLOADED', 'evidence_uploads',
             { file: req.file.originalname, assessment_id }, req.ip);
    res.status(201).json({
      message: 'File uploaded',
      file: result.rows[0],
      url: `/uploads/${req.file.filename}`
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GAP ANALYSIS ─────────────────────────────────────

// Save gap analysis
app.post('/api/gap', authenticate, authorize('save_gap'), async (req, res) => {
  const { assessment_id, organization_name, gaps } = req.body;
  if (!Array.isArray(gaps)) return res.status(400).json({ error: 'gaps must be an array' });
  try {
    const org = (organization_name || (req.user ? req.user.organization : null) || '').trim();
    // Delete existing gaps for this assessment
    if (assessment_id) {
      await pool.query('DELETE FROM gap_analysis WHERE assessment_id=$1 AND user_id=$2',
                       [assessment_id, req.user.id]);
    }
    const inserted = [];
    for (const g of gaps) {
      const r = await pool.query(
        `INSERT INTO gap_analysis
           (assessment_id, user_id, organization_name, gap_area, current_state, required_state, gap_description,
            priority, recommended_action, responsible_person, target_date, evidence_file, gap_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [assessment_id || null, req.user.id, org || null, g.gap_area || g.dept || '',
         g.current_state || g.current || '', g.required_state || g.required || '',
         g.gap_description || g.desc || '', g.priority || 'medium',
         g.recommended_action || g.action || '', g.responsible_person || g.responsible || '',
         g.target_date || g.date || null, g.evidence_file || g.ev || null,
         parseInt(g.gap_score || g.score) || 0]
      );
      inserted.push(r.rows[0]);
    }
    auditLog(req.user.id, 'GAP_SAVED', 'gap_analysis',
             { assessment_id, count: inserted.length }, req.ip);
    res.status(201).json({ message: 'Gap analysis saved', count: inserted.length, gaps: inserted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get gap analysis - DPO & System Admin can view ALL gaps
app.get('/api/gap', authenticate, async (req, res) => {
  try {
    const assessment_id = req.query.assessment_id;
    let q, params;
    
    if (req.user.role === 'data_protection_officer' || req.user.role === 'system_administrator') {
      // DPO & System Admin: Can view ALL gaps (no org restriction)
      if (assessment_id) {
        q = `SELECT g.*, u.username FROM gap_analysis g 
             JOIN users u ON g.user_id=u.id 
             WHERE g.assessment_id=$1 
             ORDER BY g.priority, g.created_at`;
        params = [assessment_id];
      } else {
        q = `SELECT g.*, u.username FROM gap_analysis g 
             JOIN users u ON g.user_id=u.id 
             ORDER BY g.priority, g.created_at DESC`;
        params = [];
      }
    } else {
      return res.status(403).json({ error: 'Invalid role' });
    }
    
    const result = await pool.query(q, params);
    res.json({ gaps: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update gap status
app.patch('/api/gap/:id', authenticate, async (req, res) => {
  const { status, notes } = req.body;
  try {
    await pool.query(
      'UPDATE gap_analysis SET status=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3',
      [status, req.params.id, req.user.id]
    );
    res.json({ message: 'Gap updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── TECH RECOMMENDATIONS ─────────────────────────────

// Returns static recommendations (no DB needed — these are standard)
app.get('/api/tech-recommendations/:type', authenticate, authorize('view_tech_recommendations'), (req, res) => {
  const type = req.params.type; // 'electronic' or 'manual'
  const recs = getTechRecs(type);
  if (!recs) return res.status(400).json({ error: "type must be 'electronic' or 'manual'" });
  auditLog(req.user.id, 'TECH_RECS_VIEWED', 'tech_recommendations', { type }, req.ip);
  res.json({ type, sections: recs });
});

// Save tech recommendations worksheet
app.post('/api/tech-recommendations', authenticate, authorize('view_tech_recommendations'), async (req, res) => {
  const { org_name, type, tech_data } = req.body;
  if (!org_name || !type || !tech_data) {
    return res.status(400).json({ error: "org_name, type, and tech_data are required" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO tech_recommendations (user_id, organization_name, type, tech_data)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, org_name, type, JSON.stringify(tech_data)]
    );
    auditLog(req.user.id, 'TECH_RECS_SAVED', 'tech_recommendations', { type, org: org_name }, req.ip);
    res.status(201).json({ success: true, id: result.rows[0].id });
  } catch (e) {
    console.error('Error saving tech recommendations:', e);
    res.status(500).json({ error: e.message });
  }
});

function getTechRecs(type) {
  const recs = {
    electronic: [
      { category: '4.1 Access Control & Identity Management', items: [
        { text: 'Implement role-based access control (RBAC) with minimum necessary permissions', section: 'Section 16', priority: 'high' },
        { text: 'Enforce unique user accounts — no shared credentials permitted', section: 'Section 16', priority: 'high' },
        { text: 'Implement multi-factor authentication (MFA) for all privileged accounts', section: 'Section 16', priority: 'high' },
        { text: 'Enforce strong password policy: minimum 12 characters with complexity requirements', section: 'Section 16', priority: 'medium' },
        { text: 'Conduct quarterly access reviews and disable inactive accounts within 30 days', section: 'Section 16', priority: 'medium' },
        { text: 'Implement automatic session timeout after 15 minutes of inactivity', section: 'Section 16', priority: 'medium' },
      ]},
      { category: '4.2 Data Encryption & Protection', items: [
        { text: 'Encrypt all personal data at rest using AES-256 or equivalent standard', section: 'Section 16', priority: 'high' },
        { text: 'Encrypt all personal data in transit using TLS 1.2 minimum (TLS 1.3 preferred)', section: 'Section 16', priority: 'high' },
        { text: 'Apply database-level encryption for all tables containing personal data', section: 'Section 16', priority: 'high' },
        { text: 'Encrypt removable media, laptops and portable storage devices', section: 'Section 16', priority: 'medium' },
      ]},
      { category: '4.3 Network Security', items: [
        { text: 'Deploy and configure perimeter firewalls with internal network segmentation', section: 'Section 16', priority: 'high' },
        { text: 'Isolate patient/personal data systems in dedicated network segments', section: 'Section 16', priority: 'high' },
        { text: 'Deploy Intrusion Detection/Prevention Systems (IDS/IPS)', section: 'Section 16', priority: 'medium' },
        { text: 'Implement VPN for all remote access to clinical and administrative systems', section: 'Section 16', priority: 'medium' },
      ]},
      { category: '4.4 Audit, Monitoring & Logging', items: [
        { text: 'Enable and retain audit logs for all access to personal data (minimum 12 months)', section: 'Section 23', priority: 'high' },
        { text: 'Implement a Security Information and Event Management (SIEM) system', section: 'Section 16', priority: 'medium' },
        { text: 'Configure real-time alerts for unauthorised access attempts', section: 'Section 16', priority: 'high' },
        { text: 'Monthly review of audit logs by the DPO or designated officer', section: 'Section 23', priority: 'medium' },
      ]},
      { category: '4.5 Backup & Business Continuity', items: [
        { text: 'Perform automated daily encrypted backups of all systems containing personal data', section: 'Section 16', priority: 'high' },
        { text: 'Store backup copies in a geographically separate or secure off-site location', section: 'Section 16', priority: 'high' },
        { text: 'Test full backup restoration procedures quarterly and document results', section: 'Section 16', priority: 'medium' },
        { text: 'Maintain a documented and tested Disaster Recovery Plan (DRP)', section: 'Section 16', priority: 'high' },
      ]},
      { category: '4.6 Data Minimisation & Retention', items: [
        { text: 'Implement data minimisation at collection — only collect what is strictly necessary', section: 'Section 11', priority: 'high' },
        { text: 'Pseudonymise patient and personal records wherever clinically appropriate', section: 'Section 11', priority: 'medium' },
        { text: 'Implement automated data retention schedules with documented destruction procedures', section: 'Section 11', priority: 'medium' },
      ]},
    ],
    manual: [
      { category: '4.1 Physical Security of Records', items: [
        { text: 'Establish a dedicated, secure records storage area with restricted key-card or key access', section: 'Section 16', priority: 'high' },
        { text: 'Install lockable fireproof filing cabinets for all personal data records', section: 'Section 16', priority: 'high' },
        { text: 'Restrict records storage access to authorised personnel only — maintain an access register', section: 'Section 16', priority: 'high' },
        { text: 'Implement a visitor sign-in/sign-out procedure for all records areas', section: 'Section 16', priority: 'medium' },
        { text: 'Install CCTV at records storage entrances where operationally appropriate', section: 'Section 16', priority: 'low' },
      ]},
      { category: '4.2 Record Classification & Handling', items: [
        { text: 'Classify all manual records by sensitivity: Confidential, Restricted or Public', section: 'Section 11', priority: 'high' },
        { text: 'Apply clear, standardised labels to all folders and files containing personal data', section: 'Section 11', priority: 'medium' },
        { text: 'Establish a records movement/tracking log — record who accessed, when and why', section: 'Section 11', priority: 'medium' },
        { text: 'Enforce a clear desk policy — personal data records must not be left unattended', section: 'Section 16', priority: 'high' },
      ]},
      { category: '4.3 Access Control & Authorisation', items: [
        { text: 'Implement a sign-in/sign-out register for accessing all sensitive personal data files', section: 'Section 16', priority: 'high' },
        { text: 'Apply the need-to-know principle — only authorised staff access personal data', section: 'Section 16', priority: 'high' },
        { text: 'Maintain an up-to-date list of authorised personnel for each record category', section: 'Section 16', priority: 'medium' },
      ]},
      { category: '4.4 Retention & Secure Disposal', items: [
        { text: 'Develop and enforce a comprehensive retention schedule for all paper record categories', section: 'Section 11', priority: 'high' },
        { text: 'Shred or incinerate personal data records when retention periods expire', section: 'Section 11', priority: 'high' },
        { text: 'Issue a Certificate of Destruction for all disposed personal data records', section: 'Section 11', priority: 'medium' },
      ]},
      { category: '4.5 Staff Training & Awareness', items: [
        { text: 'Provide mandatory CDPA induction training for all staff who handle personal data', section: 'Section 23', priority: 'high' },
        { text: 'Conduct annual CDPA refresher training and maintain attendance records', section: 'Section 23', priority: 'medium' },
        { text: 'Post data protection reminders and notices in records and administrative areas', section: 'Section 23', priority: 'low' },
        { text: 'Appoint departmental data protection champions to support compliance locally', section: 'Section 23', priority: 'medium' },
      ]},
      { category: '4.6 Consent & Privacy Notices', items: [
        { text: 'Ensure all manual data collection forms include a compliant CDPA privacy notice', section: 'Section 12', priority: 'high' },
        { text: 'Obtain and document written consent where processing requires it', section: 'Section 12', priority: 'high' },
        { text: 'Store signed consent forms securely alongside corresponding personal data records', section: 'Section 12', priority: 'medium' },
        { text: 'Provide a clear and accessible process for data subjects to withdraw consent', section: 'Section 12', priority: 'medium' },
      ]},
    ]
  };
  return recs[type] || null;
}

// ─── ROPA ─────────────────────────────────────────────

// Create ROPA
app.post('/api/ropa', authenticate, authorize('create_ropa'), async (req, res) => {
  const { organization_name, controller_name, controller_address, controller_contact,
          dpo_name, dpo_contact, version, review_date, approved_by, activities } = req.body;
  if (!organization_name) return res.status(400).json({ error: 'organization_name required' });
  try {
    const ropa = await pool.query(
      `INSERT INTO ropa_records
         (user_id, organization_name, controller_name, controller_address, controller_contact,
          dpo_name, dpo_contact, version, review_date, approved_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, 'active') RETURNING *`,
      [req.user.id, organization_name.trim(), controller_name || null, controller_address || null,
       controller_contact || null, dpo_name || null, dpo_contact || null,
       version || 'V1.0', review_date || null, approved_by || null]
    );
    const ropaId = ropa.rows[0].id;

    for (let i = 0; i < (activities || []).length; i++) {
      const a = activities[i];
      await pool.query(
        `INSERT INTO ropa_processing_activities
           (ropa_id, process_number, business_function, process_owner, processing_activity_name,
            purpose, categories_personal_data, special_categories, source_of_data,
            category_of_individual, lawful_basis, additional_condition, exemption_case,
            additional_info, dpia_reference, internal_sharing, internal_geo_location,
            external_parties, contract_reference, cross_border, safeguards,
            security_measures, retention_period, storage_location, breach_records)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
        [ropaId, i + 1, a.business_function || a.bf || null, a.process_owner || a.po || null,
         a.processing_activity_name || a.name || null, a.purpose || null,
         a.categories_personal_data || a.cats || null, a.special_categories || a.special || null,
         a.source_of_data || a.source || null, a.category_of_individual || a.individuals || null,
         a.lawful_basis || a.basis || null, a.additional_condition || null,
         a.exemption_case || null, a.additional_info || null,
         a.dpia_reference || a.dpia || null, a.internal_sharing || a.internal || null,
         a.internal_geo_location || null, a.external_parties || a.ext || null,
         a.contract_reference || null, a.cross_border || a.cross || false,
         a.safeguards || null, a.security_measures || a.security || null,
         a.retention_period || a.retention || null, a.storage_location || a.storage || null,
         a.breach_records || null]
      );
    }
    auditLog(req.user.id, 'ROPA_CREATED', 'ropa_records',
             { id: ropaId, activities: (activities||[]).length }, req.ip);
    res.status(201).json({ message: 'ROPA saved', ropa: ropa.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// List ROPAs - DPO can view ALL ROPA records
app.get('/api/ropa', authenticate, async (req, res) => {
  try {
    let q, params;
    
    if (req.user.role === 'data_protection_officer' || req.user.role === 'system_administrator') {
      // DPO & System Admin: Can view ALL ROPA records (no org restriction)
      q = `SELECT r.*, u.username FROM ropa_records r 
           JOIN users u ON r.user_id=u.id 
           ORDER BY r.created_at DESC`;
      params = [];
    } else {
      return res.status(403).json({ error: 'Invalid role' });
    }
    
    const result = await pool.query(q, params);
    res.json({ ropas: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get single ROPA with activities - DPO full access
app.get('/api/ropa/:id', authenticate, async (req, res) => {
  try {
    const ropa = await pool.query('SELECT * FROM ropa_records WHERE id=$1', [req.params.id]);
    if (!ropa.rows[0]) return res.status(404).json({ error: 'ROPA not found' });
    
    if (req.user.role !== 'data_protection_officer' && req.user.role !== 'system_administrator') {
      auditLog(req.user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', 'ropa', 
               { ropa_id: req.params.id }, req.ip);
      return res.status(403).json({ error: 'Invalid role' });
    }
    
    const activities = await pool.query(
      'SELECT * FROM ropa_processing_activities WHERE ropa_id=$1 ORDER BY process_number',
      [req.params.id]
    );
    res.json({ ropa: ropa.rows[0], activities: activities.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update ROPA status
app.patch('/api/ropa/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query('UPDATE ropa_records SET status=$1, updated_at=NOW() WHERE id=$2', [status, req.params.id]);
    res.json({ message: 'ROPA status updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DPIA ─────────────────────────────────────────────

// Create DPIA
app.post('/api/dpia', authenticate, authorize('create_dpia'), async (req, res) => {
  const { organization_name, department, responsible_person, project_name, business_process,
          objectives, data_subjects, categories_data, means_techniques, entities_involved,
          processing_locations, special_aspects, measures, risks } = req.body;
  if (!organization_name) return res.status(400).json({ error: 'organization_name required' });
  try {
    const dpia = await pool.query(
      `INSERT INTO dpia_assessments
         (user_id, organization_name, department, responsible_person, project_name,
          business_process, objectives, data_subjects, categories_data, means_techniques,
          entities_involved, processing_locations, special_aspects, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, 'submitted') RETURNING *`,
      [req.user.id, organization_name.trim(), department || null, responsible_person || null,
       project_name || null, business_process || null, objectives || null, data_subjects || null,
       categories_data || null, means_techniques || null, entities_involved || null,
       processing_locations || null, special_aspects || null]
    );
    const dpiaId = dpia.rows[0].id;

    // Insert measures
    for (const m of (measures || [])) {
      await pool.query(
        `INSERT INTO dpia_measure_catalog
           (dpia_id, measure_type, measure_name, description, protection_level, is_selected, implementation_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [dpiaId, m.measure_type || m.type || 'Organizational', m.measure_name || m.name || '',
         m.description || m.desc || null, parseInt(m.protection_level || m.lvl) || 1,
         m.is_selected !== undefined ? m.is_selected : (m.sel || false),
         m.implementation_notes || m.notes || null]
      );
    }

    // Insert risks
    let highestRisk = 'low';
    const riskOrder = { low:0, medium:1, high:2, critical:3 };
    for (const r of (risks || [])) {
      const riskLevel = calcRiskLevel(r.likelihood || 'medium', r.impact || 'medium');
      if (riskOrder[riskLevel] > riskOrder[highestRisk]) highestRisk = riskLevel;
      await pool.query(
        `INSERT INTO dpia_risk_catalog
           (dpia_id, risk_id, risk_category, threat_description, affected_data_subjects,
            likelihood, impact, risk_level, existing_controls, residual_risk,
            mitigation_measures, responsible_person, target_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [dpiaId, r.risk_id || r.id || `R${Date.now()}`,
         r.risk_category || r.cat || null,
         r.threat_description || r.threat || null,
         r.affected_data_subjects || r.subjects || null,
         r.likelihood || 'medium', r.impact || 'medium', riskLevel,
         r.existing_controls || r.controls || null,
         r.residual_risk || r.residual || null,
         r.mitigation_measures || r.mitigation || null,
         r.responsible_person || r.responsible || null,
         r.target_date || r.date || null]
      );
    }

    // Update overall risk
    await pool.query('UPDATE dpia_assessments SET overall_risk_level=$1 WHERE id=$2', [highestRisk, dpiaId]);

    auditLog(req.user.id, 'DPIA_CREATED', 'dpia_assessments',
             { id: dpiaId, measures: (measures||[]).length, risks: (risks||[]).length }, req.ip);
    res.status(201).json({ message: 'DPIA saved', dpia: { ...dpia.rows[0], overall_risk_level: highestRisk } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// List DPIAs - DPO & System Admin can view ALL DPIA assessments
app.get('/api/dpia', authenticate, async (req, res) => {
  try {
    let q, params;
    
    if (req.user.role === 'data_protection_officer' || req.user.role === 'system_administrator') {
      // DPO & System Admin: Can view ALL DPIA records (no org restriction)
      q = `SELECT d.*, u.username FROM dpia_assessments d 
           JOIN users u ON d.user_id=u.id 
           ORDER BY d.created_at DESC`;
      params = [];
    } else {
      return res.status(403).json({ error: 'Invalid role' });
    }
    
    const result = await pool.query(q, params);
    res.json({ dpias: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get DPIA detail - DPO full access
app.get('/api/dpia/:id', authenticate, async (req, res) => {
  try {
    const dpia = await pool.query('SELECT * FROM dpia_assessments WHERE id=$1', [req.params.id]);
    if (!dpia.rows[0]) return res.status(404).json({ error: 'DPIA not found' });
    
    if (req.user.role !== 'data_protection_officer' && req.user.role !== 'system_administrator') {
      auditLog(req.user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', 'dpia', 
               { dpia_id: req.params.id }, req.ip);
      return res.status(403).json({ error: 'Invalid role' });
    }
    
    const measures = await pool.query('SELECT * FROM dpia_measure_catalog WHERE dpia_id=$1 ORDER BY measure_type, id', [req.params.id]);
    const risks    = await pool.query('SELECT * FROM dpia_risk_catalog WHERE dpia_id=$1 ORDER BY risk_level DESC', [req.params.id]);
    res.json({ dpia: dpia.rows[0], measures: measures.rows, risks: risks.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DPO: Approve/reject DPIA
app.patch('/api/dpia/:id/approve', authenticate, authorize('approve_dpia'), async (req, res) => {
  const { status, approval_notes } = req.body;
  if (!['approved','rejected'].includes(status)) {
    return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
  }
  try {
    await pool.query(
      'UPDATE dpia_assessments SET status=$1, approval_notes=$2, approved_by=$3, approved_at=NOW() WHERE id=$4',
      [status, approval_notes || null, req.user.id, req.params.id]
    );
    auditLog(req.user.id, 'DPIA_REVIEWED', 'dpia_assessments',
             { id: req.params.id, status }, req.ip);
    res.json({ message: 'DPIA status updated', status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SECURITY GAP ANALYSIS (SGA) ──────────────────────

// Save/Update SGA responses
app.post('/api/sga', authenticate, async (req, res) => {
  const { organization_name, assessment_id, responses } = req.body;
  let org = (organization_name || (req.user ? req.user.organization : '')).trim();
  if (!org) {
    // Last resort: check if there's a recent assessment for this user to steal the org name from
    const lastAssess = await pool.query('SELECT organization_name FROM compliance_assessments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.user.id]);
    if (lastAssess.rows.length > 0) org = lastAssess.rows[0].organization_name.trim();
  }
  
  if (!org) return res.status(400).json({ error: 'Organization name is required to save Security Gap Analysis' });

  try {
    // Delete existing responses for this assessment/user
    if (assessment_id) {
      await pool.query('DELETE FROM security_gap_analysis WHERE assessment_id=$1 AND user_id=$2',
        [assessment_id, req.user.id]);
    } else {
      await pool.query('DELETE FROM security_gap_analysis WHERE user_id=$1 AND assessment_id IS NULL',
        [req.user.id]);
    }

    // Insert new responses
    const inserted = [];
    for (const r of responses) {
      const result = await pool.query(
        `INSERT INTO security_gap_analysis
           (assessment_id, user_id, organization_name, domain_category, control_item,
            in_place, rating, notes, control_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [assessment_id || null, req.user.id, org,
         r.domain_category || r.cat || '', r.control_item || r.item || '',
         r.in_place || r.ip || null, r.rating || r.rt || null,
         r.notes || r.nt || null, r.control_key || `${r.cat||''}_${r.ii||''}` || null]
      );
      inserted.push(result.rows[0]);
    }

    auditLog(req.user.id, 'SGA_SAVED', 'security_gap_analysis',
             { assessment_id, count: responses.length }, req.ip);
    res.status(201).json({ message: 'Security Gap Analysis saved', count: inserted.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get SGA responses
app.get('/api/sga', authenticate, async (req, res) => {
  const assessment_id = req.query.assessment_id;
  try {
    let q, params;
    const isDpoAdmin = ['data_protection_officer','system_administrator'].includes(req.user.role);
    
    if (assessment_id) {
      // Get SGA for specific assessment
      q = isDpoAdmin
        ? `SELECT s.*, u.username FROM security_gap_analysis s
           JOIN users u ON s.user_id=u.id
           WHERE s.assessment_id=$1 ORDER BY s.domain_category, s.control_item`
        : `SELECT * FROM security_gap_analysis WHERE assessment_id=$1 AND user_id=$2
           ORDER BY domain_category, control_item`;
      params = isDpoAdmin ? [assessment_id] : [assessment_id, req.user.id];
    } else {
      // Get all user's SGA
      q = isDpoAdmin
        ? `SELECT s.*, u.username FROM security_gap_analysis s
           JOIN users u ON s.user_id=u.id
           WHERE s.assessment_id IS NULL ORDER BY s.created_at DESC`
        : `SELECT * FROM security_gap_analysis WHERE user_id=$1 AND assessment_id IS NULL
           ORDER BY created_at DESC`;
      params = isDpoAdmin ? [] : [req.user.id];
    }
    
    const result = await pool.query(q, params);
    res.json({ responses: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get SGA summary/statistics
app.get('/api/sga/summary/:assessment_id?', authenticate, async (req, res) => {
  try {
    const assessment_id = req.params.assessment_id;
    let q = `
      SELECT 
        domain_category,
        COUNT(*) as total_items,
        COUNT(CASE WHEN in_place='yes' THEN 1 END) as in_place_yes,
        COUNT(CASE WHEN in_place='partial' THEN 1 END) as in_place_partial,
        COUNT(CASE WHEN in_place='no' THEN 1 END) as in_place_no,
        COUNT(CASE WHEN in_place IS NOT NULL THEN 1 END) as assessed
      FROM security_gap_analysis
      WHERE user_id=$1${assessment_id ? ' AND assessment_id=$2' : ' AND assessment_id IS NULL'}
      GROUP BY domain_category
      ORDER BY domain_category
    `;
    const params = assessment_id ? [req.user.id, assessment_id] : [req.user.id];
    const result = await pool.query(q, params);
    
    // Calculate overall score
    let totalItems = 0, yesCount = 0, partialCount = 0;
    result.rows.forEach(row => {
      totalItems += parseInt(row.total_items);
      yesCount += parseInt(row.in_place_yes);
      partialCount += parseInt(row.in_place_partial);
    });
    const overallScore = totalItems > 0 
      ? Math.round(((yesCount + partialCount * 0.5) / totalItems) * 100)
      : 0;
    
    res.json({
      by_domain: result.rows,
      overall_score: overallScore,
      total_items: totalItems,
      in_place: yesCount,
      partial: partialCount,
      rating: overallScore >= 80 ? 'GOOD' : overallScore >= 60 ? 'FAIR' : overallScore >= 40 ? 'POOR' : 'CRITICAL'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DEPARTMENT ASSESSMENTS ──────────────────────────

// Save Department Assessment
app.post('/api/department-assessment', authenticate, async (req, res) => {
  const { id, name, mgr, date, org, responses, score, yesCount, partialCount, noCount, naCount, userId } = req.body;
  
  if (!org || !name || !responses) {
    return res.status(400).json({ error: 'Missing required fields: org, name, responses' });
  }

  try {
    // Insert department assessment record
    const assessment = await pool.query(
      `INSERT INTO department_assessments
         (user_id, organization_name, department_name, assessor, assessment_date, overall_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed')
       RETURNING id, user_id, organization_name, department_name, overall_score, created_at`,
      [req.user.id, org, name, mgr, date || new Date().toISOString().split('T')[0], score || 0]
    );

    const assessmentId = assessment.rows[0].id;

    // Insert individual question responses
    for (const sectionKey of Object.keys(responses)) {
      for (const itemKey of Object.keys(responses[sectionKey])) {
        const response = responses[sectionKey][itemKey];
        const qNum = parseInt(itemKey.replace(/\D/g, '')) || 0;
        await pool.query(
          `INSERT INTO department_compliance_questions
             (dept_assessment_id, question_number, category, response, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [assessmentId, qNum, sectionKey, response]
        );
      }
    }

    auditLog(req.user.id, 'DEPT_ASSESS_SAVED', 'department_assessments',
             { id: assessmentId, org, dept: name, score }, req.ip);

    res.status(201).json({
      message: 'Department assessment saved successfully',
      assessment: assessment.rows[0],
      id: assessmentId
    });
  } catch (e) {
    console.error('Error saving department assessment:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get Department Assessments
app.get('/api/department-assessment', authenticate, async (req, res) => {
  try {
    const isDpoAdmin = ['data_protection_officer', 'system_administrator'].includes(req.user.role);
    const q = isDpoAdmin
      ? `SELECT da.*, u.username FROM department_assessments da
         JOIN users u ON da.user_id=u.id ORDER BY da.created_at DESC LIMIT 100`
      : `SELECT * FROM department_assessments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`;
    
    const result = await pool.query(q, isDpoAdmin ? [] : [req.user.id]);
    res.json({ assessments: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get Department Assessment Detail
// Save Department Remediation Plan
app.post('/api/department-remediation', authenticate, async (req, res) => {
  const { org, dept, plans, conclusion } = req.body;
  
  if (!org || !dept || !Array.isArray(plans)) {
    return res.status(400).json({ error: 'Missing required fields: org, dept, plans' });
  }

  try {
    const inserted = [];
    for (const p of plans) {
      const r = await pool.query(
        `INSERT INTO department_remediation_plans
           (user_id, organization_name, department_name, remediation_title, issue_description, 
            action_required, responsible_person, target_date, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [req.user.id, org.trim(), dept, p.section || 'General', p.q, 
         p.rem || '', p.who || '', p.when || null, p.pri || 'medium']
      );
      inserted.push(r.rows[0]);
    }

    auditLog(req.user.id, 'DEPT_REMS_SAVED', 'department_remediation_plans',
             { org, dept, count: inserted.length }, req.ip);

    res.status(201).json({
      message: 'Department remediation plan saved successfully',
      count: inserted.length,
      plans: inserted
    });
  } catch (e) {
    console.error('Error saving department remediation:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get Department Remediation Plans
app.get('/api/department-remediation', authenticate, async (req, res) => {
  const { organization_name, department_name } = req.query;
  try {
    let q = 'SELECT * FROM department_remediation_plans WHERE user_id=$1';
    let params = [req.user.id];
    
    if (organization_name) {
      q += ' AND LOWER(organization_name) = LOWER($2)';
      params.push(organization_name);
    }
    if (department_name) {
      q += ' AND department_name = $' + (params.length + 1);
      params.push(department_name);
    }
    
    q += ' ORDER BY created_at DESC';
    const result = await pool.query(q, params);
    res.json({ plans: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/department-assessment/:id', authenticate, async (req, res) => {
  try {
    const assessment = await pool.query(
      'SELECT * FROM department_assessments WHERE id=$1',
      [req.params.id]
    );
    if (!assessment.rows[0]) return res.status(404).json({ error: 'Assessment not found' });

    const questions = await pool.query(
      'SELECT * FROM department_compliance_questions WHERE dept_assessment_id=$1 ORDER BY created_at',
      [req.params.id]
    );

    res.json({
      assessment: assessment.rows[0],
      questions: questions.rows
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── REPORTS MODULE (Independent) ────────────────────
// Reports endpoints - delegated to independent reports controller
app.get('/api/reports/organizations', authenticate, reportsController.getOrganizations);
app.get('/api/reports/organization/:orgName', authenticate, reportsController.getOrganizationReport);

// ─── ADMIN ROUTES ─────────────────────────────────────

// List all users
app.get('/api/admin/users', authenticate, async (req, res) => {
  // Both DPO and System Admin can view users
  if (!['data_protection_officer', 'system_administrator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    const result = await pool.query(
      `SELECT id, username, role, organization, dpo_number, email, is_active, created_at, last_login, updated_at 
       FROM users ORDER BY created_at DESC`
    );
    
    // Categorize users by role
    const categorized = {
      data_controllers: result.rows.filter(u => u.role === 'data_controller'),
      dpos: result.rows.filter(u => u.role === 'data_protection_officer'),
      admins: result.rows.filter(u => u.role === 'system_administrator'),
    };
    
    res.json({ 
      users: result.rows,
      categorized,
      total: result.rows.length 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get specific user details
app.get('/api/admin/users/:id', authenticate, async (req, res) => {
  if (!['data_protection_officer', 'system_administrator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    const result = await pool.query(
      `SELECT id, username, role, organization, dpo_number, email, is_active, created_at, last_login, updated_at, 
              controller_license_number, controller_contact_number
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Toggle user active/inactive and update user details
app.patch('/api/admin/users/:id', authenticate, async (req, res) => {
  if (!['data_protection_officer', 'system_administrator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const { is_active, email, organization, dpo_number, controller_license_number, controller_contact_number } = req.body;
  
  // Only System Admin can toggle user active status (deactivate/activate users)
  if (is_active !== undefined && req.user.role !== 'system_administrator') {
    return res.status(403).json({ error: 'Only System Administrators can deactivate or activate users' });
  }
  
  if (parseInt(req.params.id) === req.user.id && is_active === false) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }
  
  // DPO cannot manage System Administrators
  if (req.user.role === 'data_protection_officer') {
    const targetUser = await pool.query('SELECT role FROM users WHERE id=$1', [req.params.id]);
    if (targetUser.rows[0] && targetUser.rows[0].role === 'system_administrator') {
      auditLog(req.user.id, 'ACCESS_DENIED', 'users', 
               { target_id: req.params.id, reason: 'DPO cannot manage admins' }, req.ip, 'USER_MANAGEMENT');
      return res.status(403).json({ error: 'DPO cannot manage System Administrators' });
    }
  }
  
  try {
    // Build dynamic UPDATE query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (is_active !== undefined) {
      updates.push(`is_active=$${paramCount++}`);
      values.push(is_active);
    }
    if (email !== undefined) {
      updates.push(`email=$${paramCount++}`);
      values.push(email);
    }
    if (organization !== undefined) {
      updates.push(`organization=$${paramCount++}`);
      values.push(organization);
    }
    if (dpo_number !== undefined) {
      updates.push(`dpo_number=$${paramCount++}`);
      values.push(dpo_number);
    }
    if (controller_license_number !== undefined) {
      updates.push(`controller_license_number=$${paramCount++}`);
      values.push(controller_license_number);
    }
    if (controller_contact_number !== undefined) {
      updates.push(`controller_contact_number=$${paramCount++}`);
      values.push(controller_contact_number);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_at=NOW()`);
    values.push(req.params.id);
    
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id=$${paramCount} RETURNING id, username, role, organization, dpo_number, email, is_active, controller_license_number, controller_contact_number`;
    const result = await pool.query(query, values);
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    auditLog(req.user.id, 'USER_UPDATED', 'users',
             { target_id: req.params.id, updated_fields: Object.keys({is_active, email, organization, dpo_number}).filter(k => arguments[k] !== undefined) }, 
             req.ip, 'USER_MANAGEMENT');
    
    res.json({ message: 'User updated successfully', user: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create user - both DPO and Admin can create, but with restrictions
app.post('/api/admin/users', authenticate, async (req, res) => {
  // Only System Administrators can create users
  if (req.user.role !== 'system_administrator') {
    auditLog(req.user.id, 'ACCESS_DENIED', 'users', 
             { reason: 'Only System Administrators can create users' }, req.ip, 'USER_MANAGEMENT');
    return res.status(403).json({ error: 'Only System Administrators can create users' });
  }
  
  const { username, password, role, organization, dpo_number, email, controller_license_number, controller_contact_number } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password and role required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  // Validate DPO number if role is DPO or System Admin
  if (['data_protection_officer', 'system_administrator'].includes(role) && !dpo_number) {
    return res.status(400).json({ error: 'DPO number required for this role' });
  }
  
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role, organization, dpo_number, email, controller_license_number, controller_contact_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, username, role, organization, dpo_number, email, controller_license_number, controller_contact_number',
      [username.trim(), hash, role, organization || null, dpo_number || null, email || null, controller_license_number || null, controller_contact_number || null]
    );
    
    auditLog(req.user.id, 'USER_CREATED_BY_ADMIN', 'users',
             { created_user: username, role, created_by: req.user.username }, req.ip, 'USER_MANAGEMENT');
    
    res.status(201).json({ 
      message: 'User created successfully', 
      user: result.rows[0] 
    });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Reset user password
app.patch('/api/admin/users/:id/reset-password', authenticate, authorize('reset_passwords'), async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'new_password must be at least 6 characters' });
  }
  
  // DPO cannot reset System Admin passwords
  if (req.user.role === 'data_protection_officer') {
    const targetUser = await pool.query('SELECT role FROM users WHERE id=$1', [req.params.id]);
    if (targetUser.rows[0] && targetUser.rows[0].role === 'system_administrator') {
      return res.status(403).json({ error: 'DPO cannot reset System Administrator password' });
    }
  }
  
  try {
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.params.id]);
    auditLog(req.user.id, 'PASSWORD_RESET', 'users', 
             { target_id: req.params.id }, req.ip, 'USER_MANAGEMENT');
    res.json({ message: 'Password reset successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Audit logs - with filtering capabilities
app.get('/api/admin/audit-logs', authenticate, authorize('view_audit_logs'), async (req, res) => {
  const limit  = parseInt(req.query.limit)  || 200;
  const offset = parseInt(req.query.offset) || 0;
  const action = req.query.action;
  const module = req.query.module;
  const userId = req.query.userId;
  
  try {
    let query = `SELECT al.*, u.username, u.role
                 FROM audit_logs al 
                 LEFT JOIN users u ON al.user_id=u.id
                 WHERE 1=1`;
    const params = [];
    let paramCount = 1;
    
    if (action) {
      query += ` AND al.action ILIKE $${paramCount++}`;
      params.push(`%${action}%`);
    }
    if (userId) {
      query += ` AND al.user_id = $${paramCount++}`;
      params.push(userId);
    }
    if (module) {
      query += ` AND al.details->>'module' ILIKE $${paramCount++}`;
      params.push(`%${module}%`);
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    const count = await pool.query('SELECT COUNT(*) FROM audit_logs');
    
    res.json({ logs: result.rows, total: parseInt(count.rows[0].count) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get audit logs by module
app.get('/api/admin/audit-logs/module/:module', authenticate, authorize('view_module_audits'), async (req, res) => {
  const { module } = req.params;
  const limit  = parseInt(req.query.limit)  || 500;
  const offset = parseInt(req.query.offset) || 0;
  
  try {
    const result = await pool.query(
      `SELECT al.*, u.username, u.role
       FROM audit_logs al 
       LEFT JOIN users u ON al.user_id=u.id
       WHERE al.details->>'module' = $1
       ORDER BY al.created_at DESC LIMIT $2 OFFSET $3`,
      [module, limit, offset]
    );
    
    const count = await pool.query(
      `SELECT COUNT(*) FROM audit_logs 
       WHERE details->>'module' = $1`,
      [module]
    );
    
    res.json({ 
      module, 
      logs: result.rows, 
      total: parseInt(count.rows[0].count),
      limit,
      offset
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get audit summary/statistics
app.get('/api/admin/audit-summary', authenticate, authorize('view_audit_logs'), async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  
  try {
    const summary = await pool.query(
      `SELECT 
         al.action,
         COUNT(*) as count,
         MAX(al.created_at) as last_occurrence,
         COUNT(DISTINCT al.user_id) as unique_users
       FROM audit_logs al
       WHERE al.created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY al.action
       ORDER BY count DESC`,
      [days]
    );
    
    const moduleStats = await pool.query(
      `SELECT 
         al.details->>'module' as module,
         COUNT(*) as count,
         COUNT(DISTINCT al.user_id) as users
       FROM audit_logs al
       WHERE al.created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY al.details->>'module'
       ORDER BY count DESC`,
      [days]
    );
    
    const userActivity = await pool.query(
      `SELECT 
         u.id,
         u.username,
         u.role,
         COUNT(*) as actions,
         MAX(al.created_at) as last_action
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id=u.id
       WHERE al.created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY u.id, u.username, u.role
       ORDER BY actions DESC`,
      [days]
    );
    
    res.json({
      period_days: days,
      action_summary: summary.rows,
      module_summary: moduleStats.rows,
      user_activity: userActivity.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// System stats (admin / DPO)
app.get('/api/admin/stats', authenticate, async (req, res) => {
  if (!['system_administrator','data_protection_officer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE is_active=TRUE'),
      pool.query('SELECT COUNT(*) FROM compliance_assessments'),
      pool.query('SELECT COUNT(*) FROM compliance_assessments WHERE status=\'submitted\''),
      pool.query('SELECT AVG(overall_score) FROM compliance_assessments WHERE overall_score IS NOT NULL'),
      pool.query('SELECT COUNT(*) FROM dpia_assessments'),
      pool.query('SELECT COUNT(*) FROM ropa_records'),
      pool.query('SELECT COUNT(*) FROM gap_analysis WHERE status=\'open\''),
      pool.query('SELECT COUNT(*) FROM department_assessments'),
      pool.query('SELECT COUNT(*) FROM department_remediation_plans WHERE status=\'open\''),
      pool.query('SELECT COUNT(*) FROM assets'),
    ]);
    res.json({
      active_users:          parseInt(stats[0].rows[0].count),
      total_assessments:     parseInt(stats[1].rows[0].count),
      submitted_assessments: parseInt(stats[2].rows[0].count),
      avg_compliance_score:  parseFloat(stats[3].rows[0].avg || 0).toFixed(1),
      total_dpias:           parseInt(stats[4].rows[0].count),
      total_ropas:           parseInt(stats[5].rows[0].count),
      open_gaps:             parseInt(stats[6].rows[0].count),
      dept_assessments:      parseInt(stats[7].rows[0].count),
      open_remediations:     parseInt(stats[8].rows[0].count),
      total_assets:          parseInt(stats[9].rows[0].count),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ASSETS MANAGEMENT ────────────────────────────────

// Save/Add asset
app.post('/api/assets', authenticate, async (req, res) => {
  const { org_name, asset_type, asset_name, description, location, owner, classification } = req.body;
  if (!asset_type || !asset_name || !org_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO assets (user_id, organization_name, asset_type, asset_name, description, location, owner, classification)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, org_name, asset_type, asset_name, description || null, location || null, owner || null, classification || null]
    );
    auditLog(req.user.id, 'ASSET_CREATED', 'assets', { asset_id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get assets by organization
app.get('/api/assets/:org_name', authenticate, async (req, res) => {
  const org_name = req.params.org_name;
  try {
    const result = await pool.query(
      'SELECT * FROM assets WHERE user_id=$1 AND organization_name=$2 ORDER BY created_at DESC',
      [req.user.id, org_name]
    );
    res.json({ assets: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update asset
app.patch('/api/assets/:id', authenticate, async (req, res) => {
  const { asset_type, asset_name, description, location, owner, classification, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE assets SET asset_type=$1, asset_name=$2, description=$3, location=$4, owner=$5, classification=$6, status=$7, updated_at=NOW()
       WHERE id=$8 AND user_id=$9 RETURNING *`,
      [asset_type, asset_name, description, location, owner, classification, status || 'active', req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete asset
app.delete('/api/assets/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM assets WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Asset deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DEPARTMENT ASSESSMENTS ───────────────────────────

// Save department assessment
app.post('/api/dept-assessments', authenticate, async (req, res) => {
  const { org_name, dept_name, assessor, compliance_status, overall_score, notes } = req.body;
  if (!org_name || !dept_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO department_assessments (user_id, organization_name, department_name, assessment_date, assessor, compliance_status, overall_score, notes)
       VALUES ($1, $2, $3, NOW()::DATE, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, org_name, dept_name, assessor || null, compliance_status || null, overall_score || null, notes || null]
    );
    auditLog(req.user.id, 'DEPT_ASSESSMENT_CREATED', 'department_assessments', { dept_id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get department assessments
app.get('/api/dept-assessments/:org_name', authenticate, async (req, res) => {
  const org_name = req.params.org_name;
  try {
    const result = await pool.query(
      'SELECT * FROM department_assessments WHERE user_id=$1 AND organization_name=$2 ORDER BY created_at DESC',
      [req.user.id, org_name]
    );
    res.json({ assessments: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DEPARTMENT COMPLIANCE QUESTIONS ──────────────────

// Save compliance questions for department assessment
app.post('/api/dept-compliance-questions/:dept_id', authenticate, async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions)) {
    return res.status(400).json({ error: 'questions must be an array' });
  }
  try {
    // Delete existing questions
    await pool.query('DELETE FROM department_compliance_questions WHERE dept_assessment_id=$1', [req.params.dept_id]);
    
    // Insert new questions
    const savedQuestions = [];
    for (const q of questions) {
      const result = await pool.query(
        `INSERT INTO department_compliance_questions (dept_assessment_id, question_number, question_text, category, response, evidence, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.params.dept_id, q.number || null, q.text || '', q.category || null, q.response || null, q.evidence || null, q.notes || null]
      );
      savedQuestions.push(result.rows[0]);
    }
    
    auditLog(req.user.id, 'COMPLIANCE_QUESTIONS_SAVED', 'department_compliance_questions', { count: questions.length });
    res.status(201).json({ questions: savedQuestions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get compliance questions
app.get('/api/dept-compliance-questions/:dept_id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM department_compliance_questions WHERE dept_assessment_id=$1 ORDER BY question_number',
      [req.params.dept_id]
    );
    res.json({ questions: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DEPARTMENT REMEDIATION PLANS ─────────────────────

// Save remediation plan
app.post('/api/dept-remediation-plans', authenticate, async (req, res) => {
  const { org_name, dept_name, title, issue_description, action_required, responsible_person, target_date, priority } = req.body;
  if (!org_name || !dept_name || !title) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO department_remediation_plans (user_id, organization_name, department_name, remediation_title, issue_description, action_required, responsible_person, target_date, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, org_name, dept_name, title, issue_description || null, action_required || null, responsible_person || null, target_date || null, priority || 'medium']
    );
    auditLog(req.user.id, 'REMEDIATION_PLAN_CREATED', 'department_remediation_plans', { plan_id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get remediation plans
app.get('/api/dept-remediation-plans/:org_name', authenticate, async (req, res) => {
  const org_name = req.params.org_name;
  try {
    const result = await pool.query(
      'SELECT * FROM department_remediation_plans WHERE user_id=$1 AND organization_name=$2 ORDER BY priority DESC, created_at DESC',
      [req.user.id, org_name]
    );
    res.json({ plans: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update remediation plan status
app.patch('/api/dept-remediation-plans/:id', authenticate, async (req, res) => {
  const { status, completion_percent } = req.body;
  try {
    const result = await pool.query(
      'UPDATE department_remediation_plans SET status=$1, completion_percent=$2, updated_at=NOW() WHERE id=$3 AND user_id=$4 RETURNING *',
      [status, completion_percent || 0, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── RACI MATRIX ──────────────────────────────────────

// Save RACI matrix entries
app.post('/api/raci-matrix', authenticate, async (req, res) => {
  const { org_name, process_name, role, responsible_party, accountable_party, consulted_parties, informed_parties } = req.body;
  if (!org_name || !process_name || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO raci_matrix (user_id, organization_name, process_name, role, responsible_party, accountable_party, consulted_parties, informed_parties)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, org_name, process_name, role, responsible_party || null, accountable_party || null, consulted_parties || null, informed_parties || null]
    );
    auditLog(req.user.id, 'RACI_CREATED', 'raci_matrix', { raci_id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get RACI matrix
app.get('/api/raci-matrix/:org_name', authenticate, async (req, res) => {
  const org_name = req.params.org_name;
  try {
    const result = await pool.query(
      'SELECT * FROM raci_matrix WHERE user_id=$1 AND organization_name=$2 ORDER BY process_name, role',
      [req.user.id, org_name]
    );
    res.json({ raci: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── KPI TRACKING ────────────────────────────────────

// Save KPI
app.post('/api/kpis', authenticate, async (req, res) => {
  const { org_name, kpi_name, description, target_value, actual_value, owner, status } = req.body;
  if (!org_name || !kpi_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO kpi_tracking (user_id, organization_name, kpi_name, kpi_description, target_value, actual_value, measurement_date, owner, status)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()::DATE, $7, $8) RETURNING *`,
      [req.user.id, org_name, kpi_name, description || null, target_value || null, actual_value || null, owner || null, status || null]
    );
    auditLog(req.user.id, 'KPI_CREATED', 'kpi_tracking', { kpi_id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get KPIs
app.get('/api/kpis/:org_name', authenticate, async (req, res) => {
  const org_name = req.params.org_name;
  try {
    const result = await pool.query(
      'SELECT * FROM kpi_tracking WHERE user_id=$1 AND organization_name=$2 ORDER BY created_at DESC',
      [req.user.id, org_name]
    );
    res.json({ kpis: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CIA DATA (Confidentiality, Integrity, Availability) ────

// Save CIA data
app.post('/api/cia-data', authenticate, async (req, res) => {
  const { org_name, asset_name, confidentiality, integrity, availability, controls, risk_assessment } = req.body;
  if (!org_name || !asset_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO cia_data (user_id, organization_name, asset_name, confidentiality, integrity, availability, controls, risk_assessment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, org_name, asset_name, confidentiality || null, integrity || null, availability || null, controls || null, risk_assessment || null]
    );
    auditLog(req.user.id, 'CIA_DATA_CREATED', 'cia_data', { cia_id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get CIA data
app.get('/api/cia-data/:org_name', authenticate, async (req, res) => {
  const org_name = req.params.org_name;
  try {
    const result = await pool.query(
      'SELECT * FROM cia_data WHERE user_id=$1 AND organization_name=$2 ORDER BY created_at DESC',
      [req.user.id, org_name]
    );
    res.json({ cia: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ─── FRONTEND FALLBACK ────────────────────────────────
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      message: 'CDPA Compliance System API',
      version: '1.0.0',
      status: 'running',
      docs: 'Place your frontend files in the /frontend directory'
    });
  }
});

// ─── ERROR HANDLER ────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'File upload error: ' + err.message });
  }
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── START SERVER ─────────────────────────────────────
(async () => {
  // Run database initialization
  const initSuccess = await dbInit.initializeDatabase();
  
  if (!initSuccess) {
    console.error('\n❌ Server startup aborted: Database initialization failed\n');
    process.exit(1);
  }
  
  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   CDPA Compliance System — Backend Server        ║');
    console.log('║   Cyber & Data Protection Act [Chapter 12:07]    ║');
    console.log('║   Republic of Zimbabwe                           ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀  Server running on: http://localhost:${PORT}`);
    console.log(`📋  API Base URL:      http://localhost:${PORT}/api`);
    console.log(`🗄️   Environment:       ${process.env.NODE_ENV || 'development'}`);
    console.log('');
  });
})().catch(err => {
  console.error('\n❌ Fatal error during server startup:', err.message);
  process.exit(1);
});

module.exports = app;
