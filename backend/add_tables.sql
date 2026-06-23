CREATE TABLE IF NOT EXISTS controller_profile (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL UNIQUE,
    controller_name     VARCHAR(255),
    controller_address  TEXT,
    dpo_name            VARCHAR(255),
    dpo_contact         VARCHAR(100),
    dpo_practice_number VARCHAR(100),
    contact_number      VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
