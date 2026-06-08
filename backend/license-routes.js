/**
 * Manual License Number Entry System
 * Backend API Endpoints for managing manual license number assignment
 */

// Add these endpoints to your backend/server.js

const manualLicenseRoutes = {
  
  // REQUEST: Submit manual license number for organization
  'POST /api/admin/license/request': `
    app.post('/api/admin/license/request', authenticate, authorize('manage_system'), async (req, res) => {
      const { organization_id, organization_name, license_number } = req.body;
      
      if (!organization_name || !license_number) {
        return res.status(400).json({ error: 'Organization name and license number required' });
      }
      
      // Validate license number format: ZW-CDPA-XXXXXX-XXXXX or custom format
      const licenseFormat = /^[A-Z0-9\-]+$/;
      if (!licenseFormat.test(license_number)) {
        return res.status(400).json({ error: 'Invalid license number format (use uppercase letters, numbers, hyphens)' });
      }
      
      try {
        // Check if license already exists
        const existing = await pool.query(
          'SELECT id FROM organizations WHERE license_number = $1',
          [license_number]
        );
        
        if (existing.rows[0]) {
          return res.status(409).json({ error: 'License number already assigned to another organization' });
        }
        
        // Insert request
        const result = await pool.query(
          \`INSERT INTO license_number_requests 
           (organization_id, organization_name, requested_license, requested_by, status) 
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING *\`,
          [organization_id || null, organization_name, license_number, req.user.id]
        );
        
        auditLog(req.user.id, 'LICENSE_REQUEST_SUBMITTED', 'license_management', 
                 { organization_name, license_number }, req.ip);
        
        res.json({
          message: 'License number request submitted',
          request: result.rows[0]
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  `,

  // LOCK: Lock/finalize license number (make it read-only)
  'POST /api/admin/license/lock': `
    app.post('/api/admin/license/lock', authenticate, authorize('manage_system'), async (req, res) => {
      const { request_id } = req.body;
      
      try {
        // Get the request
        const request = await pool.query(
          'SELECT * FROM license_number_requests WHERE id = $1',
          [request_id]
        );
        
        if (!request.rows[0]) {
          return res.status(404).json({ error: 'License request not found' });
        }
        
        const licReq = request.rows[0];
        
        // Check if already locked
        if (licReq.is_locked) {
          return res.status(400).json({ error: 'License number already locked' });
        }
        
        // Update license in organizations table
        let orgResult;
        if (licReq.organization_id) {
          orgResult = await pool.query(
            \`UPDATE organizations 
             SET license_number = $1, license_locked = true, license_locked_at = NOW(), 
                 license_edit_allowed = false
             WHERE id = $2
             RETURNING *\`,
            [licReq.requested_license, licReq.organization_id]
          );
        } else {
          // Create organization if doesn't exist
          orgResult = await pool.query(
            \`INSERT INTO organizations (name, license_number, license_locked, license_locked_at, license_edit_allowed)
             VALUES ($1, $2, true, NOW(), false)
             RETURNING *\`,
            [licReq.organization_name, licReq.requested_license]
          );
        }
        
        // Update request status
        await pool.query(
          \`UPDATE license_number_requests 
           SET status = 'approved', approved_by = $1, approved_at = NOW(), is_locked = true, locked_at = NOW()
           WHERE id = $2\`,
          [req.user.id, request_id]
        );
        
        // Update all module records with license number
        const tables = [
          'compliance_assessments',
          'gap_analysis',
          'ropa_records',
          'dpia_assessments',
          'security_gap_analysis',
          'controller_validations'
        ];
        
        for (const table of tables) {
          await pool.query(
            \`UPDATE \${table} SET license_number = $1 
             WHERE TRIM(LOWER(organization_name)) = TRIM(LOWER($2))\`,
            [licReq.requested_license, licReq.organization_name]
          );
        }
        
        auditLog(req.user.id, 'LICENSE_LOCKED', 'license_management', 
                 { organization_name: licReq.organization_name, license_number: licReq.requested_license }, req.ip);
        
        res.json({
          message: 'License number locked and applied to organization',
          organization: orgResult.rows[0],
          license_number: licReq.requested_license,
          locked: true
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  `,

  // VIEW: Get all license requests
  'GET /api/admin/license/requests': `
    app.get('/api/admin/license/requests', authenticate, authorize('manage_system'), async (req, res) => {
      try {
        const status = req.query.status || 'all'; // pending, approved, rejected
        
        let q = 'SELECT * FROM license_number_requests';
        if (status !== 'all') {
          q += ' WHERE status = $1';
        }
        q += ' ORDER BY requested_at DESC';
        
        const result = await pool.query(q, status !== 'all' ? [status] : []);
        
        res.json({ 
          requests: result.rows,
          total: result.rows.length
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  `,

  // EDIT: Edit license number (only if not locked)
  'PATCH /api/admin/license/edit': `
    app.patch('/api/admin/license/edit', authenticate, authorize('manage_system'), async (req, res) => {
      const { organization_id, new_license_number } = req.body;
      
      try {
        // Check if organization's license is locked
        const org = await pool.query(
          'SELECT * FROM organizations WHERE id = $1',
          [organization_id]
        );
        
        if (!org.rows[0]) {
          return res.status(404).json({ error: 'Organization not found' });
        }
        
        if (org.rows[0].license_locked) {
          return res.status(403).json({ 
            error: 'License number is locked and cannot be edited',
            locked_at: org.rows[0].license_locked_at,
            locked_by: org.rows[0].license_created_by
          });
        }
        
        // Validate new license number
        const licenseFormat = /^[A-Z0-9\-]+$/;
        if (!licenseFormat.test(new_license_number)) {
          return res.status(400).json({ error: 'Invalid license number format' });
        }
        
        // Check uniqueness
        const existing = await pool.query(
          'SELECT id FROM organizations WHERE license_number = $1 AND id != $2',
          [new_license_number, organization_id]
        );
        
        if (existing.rows[0]) {
          return res.status(409).json({ error: 'License number already in use' });
        }
        
        // Update
        const result = await pool.query(
          \`UPDATE organizations 
           SET license_number = $1, updated_at = NOW()
           WHERE id = $2 AND NOT license_locked
           RETURNING *\`,
          [new_license_number, organization_id]
        );
        
        if (result.rows.length === 0) {
          return res.status(403).json({ error: 'License is locked and cannot be modified' });
        }
        
        auditLog(req.user.id, 'LICENSE_EDITED', 'license_management', 
                 { organization_id, new_license: new_license_number }, req.ip);
        
        res.json({
          message: 'License number updated',
          organization: result.rows[0]
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  `
};

module.exports = { manualLicenseRoutes };
