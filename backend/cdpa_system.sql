-- Drop existing tables if any
DROP TABLE IF EXISTS department_compliance_questions CASCADE;
DROP TABLE IF EXISTS department_remediation_plans CASCADE;
DROP TABLE IF EXISTS department_assessments CASCADE;
DROP TABLE IF EXISTS raci_matrix CASCADE;
DROP TABLE IF EXISTS kpi_tracking CASCADE;
DROP TABLE IF EXISTS cia_data CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS dpia_risk_catalog CASCADE;
DROP TABLE IF EXISTS dpia_measure_catalog CASCADE;
DROP TABLE IF EXISTS dpia_assessments CASCADE;
DROP TABLE IF EXISTS ropa_processing_activities CASCADE;
DROP TABLE IF EXISTS ropa_records CASCADE;
DROP TABLE IF EXISTS gap_analysis CASCADE;
DROP TABLE IF EXISTS evidence_uploads CASCADE;
DROP TABLE IF EXISTS checklist_responses CASCADE;
DROP TABLE IF EXISTS compliance_assessments CASCADE;
DROP TABLE IF EXISTS controller_validations CASCADE;
DROP TABLE IF EXISTS security_gap_analysis CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- ORGANIZATIONS
CREATE TABLE organizations (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(255) UNIQUE NOT NULL,
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    license_locked      BOOLEAN DEFAULT FALSE,
    license_created_by  INTEGER,
    license_locked_at   TIMESTAMP,
    license_edit_allowed BOOLEAN DEFAULT TRUE,
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- USERS
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL CHECK (role IN ('potraz_assessor','data_protection_officer','system_administrator','data_controller')),
    organization    VARCHAR(255),
    dpo_number      VARCHAR(50),
    email           VARCHAR(255),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    last_login      TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- CONTROLLER VALIDATIONS
CREATE TABLE controller_validations (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    validation_answers  JSONB NOT NULL,
    weighted_score      DECIMAL(5,2) NOT NULL,
    is_valid            BOOLEAN NOT NULL,
    licensing_tier      INTEGER DEFAULT 0,
    num_data_subjects   INTEGER DEFAULT 0,
    registration_fee    DECIMAL(10,2) DEFAULT 0,
    attempt_number      INTEGER DEFAULT 1,
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    controller_name     VARCHAR(255),
    controller_address  TEXT,
    controller_contact  VARCHAR(100),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    validated_at        TIMESTAMP DEFAULT NOW()
);

-- COMPLIANCE ASSESSMENTS
CREATE TABLE compliance_assessments (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    overall_score       DECIMAL(5,2),
    compliance_level    VARCHAR(50),
    status              VARCHAR(20) DEFAULT 'draft',
    attempt_number      INTEGER DEFAULT 1,
    reviewed_by         INTEGER REFERENCES users(id),
    reviewed_at         TIMESTAMP,
    review_notes        TEXT,
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    submitted_at        TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- CHECKLIST RESPONSES
CREATE TABLE checklist_responses (
    id              SERIAL PRIMARY KEY,
    assessment_id   INTEGER REFERENCES compliance_assessments(id) ON DELETE CASCADE,
    department      VARCHAR(100) NOT NULL,
    item_key        VARCHAR(100) NOT NULL,
    item_text       TEXT,
    response        VARCHAR(10) CHECK (response IN ('yes','partial','no')),
    weight          DECIMAL(4,2) DEFAULT 1.0,
    evidence_file   VARCHAR(500),
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(assessment_id, department, item_key)
);

-- EVIDENCE UPLOADS
CREATE TABLE evidence_uploads (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    assessment_id   INTEGER REFERENCES compliance_assessments(id) ON DELETE SET NULL,
    department      VARCHAR(100),
    item_key        VARCHAR(100),
    original_name   VARCHAR(500) NOT NULL,
    stored_name     VARCHAR(500) NOT NULL,
    file_size       INTEGER,
    mime_type       VARCHAR(100),
    uploaded_at     TIMESTAMP DEFAULT NOW()
);

-- GAP ANALYSIS
CREATE TABLE gap_analysis (
    id                  SERIAL PRIMARY KEY,
    assessment_id       INTEGER REFERENCES compliance_assessments(id) ON DELETE CASCADE,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255),
    gap_area            VARCHAR(255),
    current_state       TEXT,
    required_state      TEXT,
    gap_description     TEXT,
    priority            VARCHAR(20) DEFAULT 'medium',
    recommended_action  TEXT,
    responsible_person  VARCHAR(255),
    target_date         DATE,
    evidence_file       VARCHAR(500),
    gap_score           INTEGER DEFAULT 0,
    status              VARCHAR(20) DEFAULT 'open',
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- ROPA RECORDS
CREATE TABLE ropa_records (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    controller_name     VARCHAR(255),
    controller_address  TEXT,
    controller_contact  VARCHAR(255),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(255),
    version             VARCHAR(20) DEFAULT 'V1.0',
    review_date         DATE,
    approved_by         VARCHAR(255),
    status              VARCHAR(20) DEFAULT 'draft',
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- ROPA PROCESSING ACTIVITIES
CREATE TABLE ropa_processing_activities (
    id                          SERIAL PRIMARY KEY,
    ropa_id                     INTEGER REFERENCES ropa_records(id) ON DELETE CASCADE,
    process_number              INTEGER,
    business_function           VARCHAR(255),
    process_owner               VARCHAR(255),
    processing_activity_name    VARCHAR(255),
    purpose                     TEXT,
    categories_personal_data    TEXT,
    special_categories          TEXT,
    source_of_data              VARCHAR(255),
    category_of_individual      VARCHAR(255),
    lawful_basis                VARCHAR(100),
    additional_condition        TEXT,
    exemption_case              TEXT,
    additional_info             TEXT,
    dpia_reference              VARCHAR(100),
    internal_sharing            TEXT,
    internal_geo_location       VARCHAR(255),
    external_parties            TEXT,
    contract_reference          VARCHAR(255),
    cross_border                BOOLEAN DEFAULT FALSE,
    safeguards                  TEXT,
    security_measures           TEXT,
    retention_period            VARCHAR(255),
    storage_location            VARCHAR(255),
    breach_records              TEXT,
    created_at                  TIMESTAMP DEFAULT NOW()
);

-- DPIA ASSESSMENTS
CREATE TABLE dpia_assessments (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    department          VARCHAR(255),
    responsible_person  VARCHAR(255),
    project_name        VARCHAR(255),
    business_process    VARCHAR(255),
    objectives          TEXT,
    data_subjects       TEXT,
    categories_data     TEXT,
    means_techniques    TEXT,
    entities_involved   TEXT,
    processing_locations TEXT,
    special_aspects     TEXT,
    overall_risk_level  VARCHAR(20) DEFAULT 'undetermined',
    status              VARCHAR(20) DEFAULT 'draft',
    approved_by         INTEGER REFERENCES users(id),
    approved_at         TIMESTAMP,
    approval_notes      TEXT,
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- DPIA MEASURE CATALOG
CREATE TABLE dpia_measure_catalog (
    id                      SERIAL PRIMARY KEY,
    dpia_id                 INTEGER REFERENCES dpia_assessments(id) ON DELETE CASCADE,
    measure_type            VARCHAR(50),
    measure_name            VARCHAR(255) NOT NULL,
    description             TEXT,
    protection_level        INTEGER DEFAULT 1,
    is_selected             BOOLEAN DEFAULT FALSE,
    implementation_notes    TEXT,
    created_at              TIMESTAMP DEFAULT NOW()
);

-- DPIA RISK CATALOG
CREATE TABLE dpia_risk_catalog (
    id                      SERIAL PRIMARY KEY,
    dpia_id                 INTEGER REFERENCES dpia_assessments(id) ON DELETE CASCADE,
    risk_id                 VARCHAR(20),
    risk_category           VARCHAR(100),
    threat_description      TEXT,
    affected_data_subjects  VARCHAR(255),
    likelihood              VARCHAR(20),
    impact                  VARCHAR(20),
    risk_level              VARCHAR(20),
    existing_controls       TEXT,
    residual_risk           VARCHAR(20),
    mitigation_measures     TEXT,
    responsible_person      VARCHAR(255),
    target_date             DATE,
    status                  VARCHAR(20) DEFAULT 'open',
    created_at              TIMESTAMP DEFAULT NOW()
);

-- SECURITY GAP ANALYSIS
CREATE TABLE security_gap_analysis (
    id                  SERIAL PRIMARY KEY,
    assessment_id       INTEGER REFERENCES compliance_assessments(id) ON DELETE CASCADE,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255),
    domain_category     VARCHAR(100) NOT NULL,
    control_item        VARCHAR(500) NOT NULL,
    in_place            VARCHAR(20),
    rating              VARCHAR(20),
    notes               TEXT,
    control_key         VARCHAR(100),
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    resource    VARCHAR(100),
    details     JSONB DEFAULT '{}',
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ASSETS MANAGEMENT
CREATE TABLE assets (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    asset_type          VARCHAR(100) NOT NULL,
    asset_name          VARCHAR(255) NOT NULL,
    description         TEXT,
    location            VARCHAR(255),
    owner                VARCHAR(255),
    classification      VARCHAR(50),
    status              VARCHAR(20) DEFAULT 'active',
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- DEPARTMENT ASSESSMENTS
CREATE TABLE department_assessments (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    department_name     VARCHAR(255) NOT NULL,
    assessment_date     DATE,
    assessor            VARCHAR(255),
    compliance_status   VARCHAR(20),
    overall_score       DECIMAL(5,2),
    notes               TEXT,
    status              VARCHAR(20) DEFAULT 'draft',
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- DEPARTMENT COMPLIANCE QUESTIONS
CREATE TABLE department_compliance_questions (
    id                  SERIAL PRIMARY KEY,
    dept_assessment_id  INTEGER REFERENCES department_assessments(id) ON DELETE CASCADE,
    question_number     INTEGER,
    question_text       TEXT NOT NULL,
    category            VARCHAR(100),
    response            VARCHAR(10) CHECK (response IN ('yes','partial','no','n/a')),
    evidence            TEXT,
    notes               TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- DEPARTMENT REMEDIATION PLANS
CREATE TABLE department_remediation_plans (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    department_name     VARCHAR(255) NOT NULL,
    remediation_title   VARCHAR(255) NOT NULL,
    issue_description   TEXT,
    action_required     TEXT,
    responsible_person  VARCHAR(255),
    target_date         DATE,
    status              VARCHAR(20) DEFAULT 'open',
    priority            VARCHAR(20) DEFAULT 'medium',
    completion_percent  INTEGER DEFAULT 0,
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- RACI MATRIX
CREATE TABLE raci_matrix (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    process_name        VARCHAR(255) NOT NULL,
    role                VARCHAR(100) NOT NULL,
    responsible_party   VARCHAR(255),
    accountable_party   VARCHAR(255),
    consulted_parties   TEXT,
    informed_parties    TEXT,
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- KPI TRACKING
CREATE TABLE kpi_tracking (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    kpi_name            VARCHAR(255) NOT NULL,
    kpi_description     TEXT,
    target_value        VARCHAR(100),
    actual_value        VARCHAR(100),
    measurement_date    DATE,
    owner               VARCHAR(255),
    status              VARCHAR(20),
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- CIA TRIAD DATA (Confidentiality, Integrity, Availability)
CREATE TABLE cia_data (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    asset_name          VARCHAR(255) NOT NULL,
    confidentiality     VARCHAR(20),
    integrity           VARCHAR(20),
    availability        VARCHAR(20),
    controls            TEXT,
    risk_assessment     TEXT,
    license_number      VARCHAR(100),
    registration_number VARCHAR(100),
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- TECH RECOMMENDATIONS
CREATE TABLE tech_recommendations (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    type                VARCHAR(50) NOT NULL CHECK (type IN ('electronic','manual')),
    tech_data           JSONB NOT NULL,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_ca_user ON compliance_assessments(user_id);
CREATE INDEX idx_cr_assessment ON checklist_responses(assessment_id);
CREATE INDEX idx_ga_assessment ON gap_analysis(assessment_id);
CREATE INDEX idx_sga_assessment ON security_gap_analysis(assessment_id);
CREATE INDEX idx_sga_user ON security_gap_analysis(user_id);
CREATE INDEX idx_rr_user ON ropa_records(user_id);
CREATE INDEX idx_da_user ON dpia_assessments(user_id);
CREATE INDEX idx_al_user ON audit_logs(user_id);
CREATE INDEX idx_al_time ON audit_logs(created_at DESC);
CREATE INDEX idx_assets_user ON assets(user_id);
CREATE INDEX idx_dept_assess_user ON department_assessments(user_id);
CREATE INDEX idx_dept_compliance_assess ON department_compliance_questions(dept_assessment_id);
CREATE INDEX idx_dept_remed_user ON department_remediation_plans(user_id);
CREATE INDEX idx_raci_user ON raci_matrix(user_id);
CREATE INDEX idx_kpi_user ON kpi_tracking(user_id);
CREATE INDEX idx_cia_user ON cia_data(user_id);
CREATE INDEX idx_tech_recs_user ON tech_recommendations(user_id);

-- ASSESSOR COMMENTS (for POTRAZ Assessors to comment on organisations/DPOs)
CREATE TABLE assessor_comments (
    id                  SERIAL PRIMARY KEY,
    assessor_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255),
    target_dpo_username VARCHAR(50),
    comment_text        TEXT NOT NULL,
    comment_type        VARCHAR(20) DEFAULT 'general' CHECK (comment_type IN ('general','compliance','dpo','risk')),
    is_visible_to_dpo   BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assessor_comments_org ON assessor_comments(organization_name);
CREATE INDEX idx_assessor_comments_assessor ON assessor_comments(assessor_id);
CREATE INDEX idx_assessor_comments_dpo ON assessor_comments(target_dpo_username);

ALTER TABLE organizations ADD CONSTRAINT fk_organizations_license_created_by FOREIGN KEY (license_created_by) REFERENCES users(id) ON DELETE SET NULL;


SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
