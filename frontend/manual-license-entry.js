/**
 * Manual License Number Entry - Frontend UI & Functions
 * Allows manual entry of license numbers with lock/readonly enforcement
 */

// Global state for license management
const licenseManager = {
  requests: [],
  organizations: [],
  
  // Load all license requests
  loadRequests: async function() {
    try {
      const response = await fetch('/api/admin/license/requests?status=all', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      this.requests = data.requests || [];
      this.renderRequestList();
    } catch (e) {
      console.error('Error loading requests:', e);
    }
  },

  // Submit manual license number request
  requestManualLicense: async function(organizationName, licenseNumber) {
    try {
      // Validate input
      if (!organizationName || !licenseNumber) {
        alert('❌ Organization name and license number are required');
        return false;
      }

      if (!this.isValidLicenseFormat(licenseNumber)) {
        alert('❌ Invalid license format. Use format: ZW-CDPA-202605-00001 or similar\n(Uppercase letters, numbers, hyphens only)');
        return false;
      }

      const response = await fetch('/api/admin/license/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ organization_name: organizationName, license_number: licenseNumber })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`❌ ${data.error || 'Error submitting request'}`);
        return false;
      }

      alert(`✅ License request submitted!\nOrganization: ${organizationName}\nLicense: ${licenseNumber}\n\nWaiting for approval...`);
      this.loadRequests();
      return true;
    } catch (e) {
      alert(`❌ Error: ${e.message}`);
      return false;
    }
  },

  // Lock/finalize license number (make read-only)
  lockLicense: async function(requestId) {
    try {
      const confirmed = confirm('🔒 Lock this license number? Once locked, it cannot be edited.');
      if (!confirmed) return false;

      const response = await fetch('/api/admin/license/lock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ request_id: requestId })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`❌ ${data.error || 'Error locking license'}`);
        return false;
      }

      alert(`✅ License locked!\nOrganization: ${data.organization.name}\nLicense: ${data.license_number}\n\n🔒 Now read-only and cannot be edited`);
      this.loadRequests();
      return true;
    } catch (e) {
      alert(`❌ Error: ${e.message}`);
      return false;
    }
  },

  // Edit license number (only if not locked)
  editLicense: async function(organizationId, newLicenseNumber) {
    try {
      const response = await fetch('/api/admin/license/edit', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ organization_id: organizationId, new_license_number: newLicenseNumber })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`❌ ${data.error || 'Error editing license'}`);
        return false;
      }

      alert(`✅ License updated to: ${newLicenseNumber}`);
      return true;
    } catch (e) {
      alert(`❌ Error: ${e.message}`);
      return false;
    }
  },

  // Validate license format
  isValidLicenseFormat: function(license) {
    // Allow uppercase letters, numbers, and hyphens
    return /^[A-Z0-9\-]+$/.test(license) && license.length >= 5;
  },

  // Render HTML form for manual entry
  renderEntryForm: function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div style="background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
        <h3 style="margin-top: 0; color: #333;">📝 Enter License Number Manually</h3>
        
        <form onsubmit="licenseManager.handleFormSubmit(event)">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #555;">
              Organization Name *
            </label>
            <input type="text" id="orgNameInput" placeholder="e.g., binga hospital" 
                   style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"
                   required>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #555;">
              License Number *
            </label>
            <input type="text" id="licenseInput" placeholder="e.g., ZW-CDPA-202605-00001" 
                   style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-family: monospace;"
                   required>
            <small style="color: #999; display: block; margin-top: 4px;">
              Format: Uppercase letters, numbers, hyphens (e.g., ZW-CDPA-202605-00001)
            </small>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #555;">
              ⚠️ Important
            </label>
            <div style="background: #fff3cd; padding: 10px; border-radius: 4px; color: #856404; font-size: 13px; border-left: 4px solid #ffc107;">
              ✓ After entering, you can <strong>EDIT</strong> before locking<br/>
              ✓ Once <strong>LOCKED</strong>, the license number becomes READ-ONLY<br/>
              ✓ Locked licenses apply to all compliance modules
            </div>
          </div>

          <button type="submit" style="background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
            📤 Submit License Request
          </button>
        </form>
      </div>
    `;
  },

  handleFormSubmit: async function(event) {
    event.preventDefault();
    const orgName = document.getElementById('orgNameInput').value;
    const license = document.getElementById('licenseInput').value;
    
    const success = await this.requestManualLicense(orgName, license);
    if (success) {
      document.getElementById('orgNameInput').value = '';
      document.getElementById('licenseInput').value = '';
    }
  },

  // Render list of license requests with status
  renderRequestList: function() {
    const container = document.getElementById('licenseRequestsList');
    if (!container) return;

    if (this.requests.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center;">No license requests yet</p>';
      return;
    }

    let html = `
      <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
        <h3 style="margin-top: 0; color: #333;">📋 License Requests</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f5f5f5; font-weight: 600;">
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Organization</th>
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">License Number</th>
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Status</th>
            <th style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">Actions</th>
          </tr>
    `;

    this.requests.forEach((req, idx) => {
      const statusColor = {
        'pending': '#ff9800',
        'approved': '#4CAF50',
        'rejected': '#f44336'
      }[req.status] || '#999';

      const statusIcon = {
        'pending': '⏳',
        'approved': '✅',
        'rejected': '❌'
      }[req.status] || '?';

      const isLocked = req.is_locked;
      const lockIcon = isLocked ? '🔒' : '🔓';

      html += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px;">${req.organization_name}</td>
          <td style="padding: 10px; font-family: monospace; font-weight: 600; color: #1976D2;">
            ${req.requested_license}
          </td>
          <td style="padding: 10px;">
            <span style="background: ${statusColor}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
              ${statusIcon} ${req.status.toUpperCase()}
            </span>
          </td>
          <td style="padding: 10px; text-align: center;">
            ${req.status === 'pending' ? `
              <button onclick="licenseManager.lockLicense(${req.id})" style="background: #2196F3; color: white; padding: 5px 12px; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; margin-right: 5px;">
                ${lockIcon} Lock
              </button>
            ` : ''}
            ${isLocked ? '<span style="color: #4CAF50; font-weight: 600;">🔒 LOCKED</span>' : ''}
          </td>
        </tr>
      `;
    });

    html += '</table></div>';
    container.innerHTML = html;
  }
};

console.log('✅ License Manager loaded - Manual entry system ready');
