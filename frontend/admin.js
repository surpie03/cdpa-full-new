/**
 * Admin Dashboard Module
 * For System Administrators and Data Protection Officers
 */

// ─────────────────────────────────────────────────────
// USER MANAGEMENT INTERFACE
// ─────────────────────────────────────────────────────

function loadAdminDashboard() {
  // The section is already in index.html, just load default view
  loadUserManagement();
}

function loadUserManagement() {
  var content = document.getElementById('admin-content');
  if (!content) return;
  
  content.innerHTML = '<div style="text-align:center;color:var(--slate);padding:2rem">Loading users...</div>';
  
  // Check if current user is a System Admin
  var isSystemAdmin = CU && CU.role === 'system_administrator';
  
  // Use backend API
  apiReq('GET', '/api/admin/users', null)
    .then(function(response) {
      if (response.error) {
        content.innerHTML = '<div style="padding:1rem;color:var(--red2)">Error loading users: ' + response.error + '</div>';
        return;
      }
      
      var users = response.users || [];
      var html = '<div class="card"><div class="ch"><h3>User Management</h3>';
      if (isSystemAdmin) {
        html += '<button class="btn-sec" style="width:auto;padding:.4rem .8rem;font-size:.8rem" onclick="showCreateUserDialog()">+ Create New User</button>';
      }
      html += '</div><div class="cb2" style="padding:1rem">';
      
      var roles = {
        'data_controller': { label: '👤 Data Controllers', color: '#3498db', users: users.filter(function(u) { return u.role === 'data_controller'; }) },
        'data_protection_officer': { label: '🛡️ Data Protection Officers', color: '#2ecc71', users: users.filter(function(u) { return u.role === 'data_protection_officer'; }) },
        'system_administrator': { label: '⚙️ System Administrators', color: '#e74c3c', users: users.filter(function(u) { return u.role === 'system_administrator'; }) }
      };
      
      for (var roleKey in roles) {
        var roleData = roles[roleKey];
        if (roleData.users.length === 0) continue;
        
        html += '<div style="margin-bottom:1.5rem"><h4 style="color:' + roleData.color + ';margin-bottom:.8rem;padding-bottom:.5rem;border-bottom:2px solid ' + roleData.color + '">' + roleData.label + '</h4><div class="users-grid">';
        
        roleData.users.forEach(function(user, index) {
          var statusColor = user.is_active ? '#27ae60' : '#c0392b';
          var statusText = user.is_active ? '🟢 Active' : '🔴 Inactive';
          var userInfo = user.role === 'data_controller' ? 'Organization: ' + (user.organization || 'N/A') : 'DPO Number: ' + (user.dpo_number || 'N/A');
          
          html += '<div class="card" style="margin-bottom:.8rem;background:#f9f9f9;padding:1rem;border:1px solid #ddd;border-radius:6px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem"><div><div style="font-weight:700;color:#333">' + user.username + '</div><div style="font-size:.8rem;color:#666">' + userInfo + '</div></div><div style="color:' + statusColor + ';font-weight:700;font-size:.8rem">' + statusText + '</div></div><div style="font-size:.75rem;color:#666;margin-bottom:.8rem">';
          if (user.created_at) {
            html += 'Created: ' + new Date(user.created_at).toLocaleString();
          }
          html += '</div>';
          if (isSystemAdmin) {
            html += '<div style="display:flex;gap:.4rem">';
            html += '<button class="btn-sec" style="width:auto;padding:.3rem .6rem;font-size:.75rem" onclick="showEditUserDialog(' + user.id + ')">Edit</button>';
            html += '<button class="btn-sec" style="width:auto;padding:.3rem .6rem;font-size:.75rem" onclick="toggleUserActive(' + user.id + ',' + (!user.is_active) + ')">' + (user.is_active ? 'Deactivate' : 'Activate') + '</button>';
            html += '<button class="btn-sec" style="width:auto;padding:.3rem .6rem;font-size:.75rem;background:#ff9800;color:#fff" onclick="showResetPasswordDialog(' + user.id + ')">Reset Pass</button>';
            html += '</div>';
          }
          html += '</div>';
        });
        
        html += '</div></div>';
      }
      
      html += '</div></div>';
      content.innerHTML = html;
    })
    .catch(function(e) {
      content.innerHTML = '<div style="padding:1rem;color:var(--red2)">Error: ' + e.message + '</div>';
    });
}

function showCreateUserDialog() {
  // Only System Admins can create users
  if (!CU || CU.role !== 'system_administrator') {
    alert('Only System Administrators can create users');
    return;
  }
  
  var fields = [
    { id: 'new_username', label: 'Username', type: 'text' },
    { id: 'new_password', label: 'Password (min 6 chars)', type: 'password' },
    { id: 'new_email', label: 'Email', type: 'email' }
  ];
  
  // System Admin can create users of any role
  var roleOptions = ['data_controller', 'data_protection_officer', 'system_administrator'];
  
  fields.push({
    id: 'new_role',
    label: 'Role',
    type: 'select',
    options: roleOptions
  });
  
  // Add DPO number and organization fields - organization for DC, dpo_number for admin users
  fields.push(
    { id: 'new_organization', label: 'Organization (for Data Controller)', type: 'text' },
    { id: 'new_dpo_number', label: 'DPO Number (for DPO/Admin)', type: 'text' },
    { id: 'new_controller_license_number', label: 'Controller License Number', type: 'text' },
    { id: 'new_controller_contact_number', label: 'Controller Contact Number', type: 'text' }
  );
  
  window._createUserFields = fields;
  window._createUserCallback = function() {
    var usernameEl = document.getElementById('new_username');
    var passwordEl = document.getElementById('new_password');
    var roleEl = document.getElementById('new_role');
    var orgEl = document.getElementById('new_organization');
    var dpoNumEl = document.getElementById('new_dpo_number');
    var licEl = document.getElementById('new_controller_license_number');
    var contactEl = document.getElementById('new_controller_contact_number');
    
    if (!usernameEl || !passwordEl || !roleEl) {
      alert('Form not found');
      return;
    }
    
    var username = usernameEl.value.trim();
    var password = passwordEl.value;
    var role = roleEl.value;
    var organization = orgEl ? orgEl.value.trim() : '';
    var dpo_number = dpoNumEl ? dpoNumEl.value.trim() : '';
    var controller_license_number = licEl ? licEl.value.trim() : '';
    var controller_contact_number = contactEl ? contactEl.value.trim() : '';
    
    if (!username || !password || !role) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Validate DPO number for DPO/Admin roles
    if ((role === 'data_protection_officer' || role === 'system_administrator') && !dpo_number) {
      alert('DPO Number is required for DPO and System Admin roles');
      return;
    }
    
    apiReq('POST', '/api/admin/users', {
      username: username,
      password: password,
      role: role,
      organization: organization || null,
      dpo_number: dpo_number || null,
      email: null,
      controller_license_number: controller_license_number || null,
      controller_contact_number: controller_contact_number || null
    })
    .then(function(response) {
      if (response.error) {
        alert('Error creating user: ' + response.error);
      } else {
        alert('User created successfully!');
        document.getElementById('_dialog').remove();
        loadUserManagement();
      }
    })
    .catch(function(e) {
      alert('Error: ' + e.message);
    });
  };
  
  showSimpleDialog('Create New User', fields);
}

function showEditUserDialog(userId) {
  apiReq('GET', '/api/admin/users/' + userId, null)
    .then(function(response) {
      if (response.error) {
        alert('Error loading user: ' + response.error);
        return;
      }
      
      var user = response.user;
      var fields = [
        { id: 'edit_username', label: 'Username', type: 'text', value: user.username, readonly: true },
        { id: 'edit_email', label: 'Email', type: 'email', value: user.email || '' }
      ];
      
      // Add Organization field for Data Controllers, DPO Number for Admin roles
      if (user.role === 'data_protection_officer' || user.role === 'system_administrator') {
        fields.push({ id: 'edit_dpo_number', label: 'DPO Number', type: 'text', value: user.dpo_number || '' });
      } else {
        fields.push({ id: 'edit_organization', label: 'Organization', type: 'text', value: user.organization || '' });
      }
      
      // Add controller license and contact number fields
      fields.push(
        { id: 'edit_controller_license_number', label: 'Controller License Number', type: 'text', value: user.controller_license_number || '' },
        { id: 'edit_controller_contact_number', label: 'Controller Contact Number', type: 'text', value: user.controller_contact_number || '' }
      );
      
      window._editUserFields = fields;
      window._editUserId = userId;
      window._editUserCallback = function() {
        var emailEl = document.getElementById('edit_email');
        var dpoNumEl = document.getElementById('edit_dpo_number');
        var orgEl = document.getElementById('edit_organization');
        var licEl = document.getElementById('edit_controller_license_number');
        var contactEl = document.getElementById('edit_controller_contact_number');
        
        var updateData = {};
        
        if (emailEl) updateData.email = emailEl.value.trim() || null;
        if (dpoNumEl) updateData.dpo_number = dpoNumEl.value.trim() || null;
        if (orgEl) updateData.organization = orgEl.value.trim() || null;
        if (licEl) updateData.controller_license_number = licEl.value.trim() || null;
        if (contactEl) updateData.controller_contact_number = contactEl.value.trim() || null;
        
        apiReq('PATCH', '/api/admin/users/' + userId, updateData)
        .then(function(response) {
          if (response.error) {
            alert('Error updating user: ' + response.error);
          } else {
            alert('User updated successfully!');
            document.getElementById('_dialog').remove();
            loadUserManagement();
          }
        })
        .catch(function(e) {
          alert('Error: ' + e.message);
        });
      };
      
      showSimpleDialog('Edit User: ' + user.username, fields);
    })
    .catch(function(e) {
      alert('Error: ' + e.message);
    });
}

function showResetPasswordDialog(userId) {
  // Only System Admins can reset passwords
  if (!CU || CU.role !== 'system_administrator') {
    alert('Only System Administrators can reset user passwords');
    return;
  }
  
  var fields = [
    { id: 'reset_password', label: 'New Password (min 6 chars)', type: 'password' },
    { id: 'reset_password_confirm', label: 'Confirm Password', type: 'password' }
  ];
  
  window._resetPasswordUserId = userId;
  window._resetPasswordCallback = function() {
    var pwd1 = document.getElementById('reset_password');
    var pwd2 = document.getElementById('reset_password_confirm');
    
    if (!pwd1 || !pwd2) return;
    
    var pwd = pwd1.value;
    var pwdConfirm = pwd2.value;
    
    if (!pwd || pwd !== pwdConfirm) {
      alert('Passwords do not match or are empty');
      return;
    }
    
    if (pwd.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    
    apiReq('PATCH', '/api/admin/users/' + userId + '/reset-password', {
      new_password: pwd
    })
    .then(function(response) {
      if (response.error) {
        alert('Error resetting password: ' + response.error);
      } else {
        alert('Password reset successfully!');
        document.getElementById('_dialog').remove();
      }
    })
    .catch(function(e) {
      alert('Error: ' + e.message);
    });
  };
  
  showSimpleDialog('Reset User Password', fields);
}

function toggleUserActive(userId, shouldActivate) {
  // Only System Admins can toggle user status
  if (!CU || CU.role !== 'system_administrator') {
    alert('Only System Administrators can activate or deactivate users');
    return;
  }
  
  if (!confirm('Are you sure you want to ' + (shouldActivate ? 'activate' : 'deactivate') + ' this user?')) return;
  
  apiReq('PATCH', '/api/admin/users/' + userId, {
    is_active: shouldActivate
  })
  .then(function(response) {
    if (response.error) {
      alert('Error: ' + response.error);
    } else {
      alert(response.message || 'User status updated successfully');
      loadUserManagement();
    }
  })
  .catch(function(e) {
    alert('Error: ' + e.message);
  });
}

// ─────────────────────────────────────────────────────
// AUDIT LOGS VIEWER
// ─────────────────────────────────────────────────────

function loadAuditLogs() {
  var content = document.getElementById('admin-content');
  if (!content) return;
  
  content.innerHTML = '<div class="card"><div class="ch"><h3>Audit Logs</h3></div><div class="cb2" style="padding:1rem"><div style="margin-bottom:1rem;display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem"><div><label style="display:block;margin-bottom:.3rem;font-weight:700;font-size:.8rem">Filter by Action</label><input type="text" id="auditFilterAction" placeholder="e.g. USER_CREATED" style="width:100%;padding:.4rem;border:1px solid #ccc;border-radius:4px;font-size:.85rem" /></div><div><label style="display:block;margin-bottom:.3rem;font-weight:700;font-size:.8rem">Filter by Module</label><select id="auditFilterModule" style="width:100%;padding:.4rem;border:1px solid #ccc;border-radius:4px"><option value="">All Modules</option><option value="USER_MANAGEMENT">User Management</option><option value="ASSESSMENTS">Assessments</option><option value="AUDIT">Audit</option><option value="DPIA">DPIA</option><option value="ROPA">ROPA</option><option value="GAP">Gap Analysis</option></select></div><div style="display:flex;align-items:flex-end"><button class="btn-pri" style="width:100%;padding:.4rem" onclick="applyAuditFilters()">🔍 Search</button></div></div><div id="auditLogsContainer" style="margin-top:1rem">Loading audit logs...</div></div></div>';
  
  loadAuditLogsData();
}

function loadAuditLogsData() {
  var logsContainer = document.getElementById('auditLogsContainer');
  if (!logsContainer) return;
  
  var actionEl = document.getElementById('auditFilterAction');
  var moduleEl = document.getElementById('auditFilterModule');
  
  var action = actionEl ? actionEl.value : '';
  var module = moduleEl ? moduleEl.value : '';
  
  // Use backend API
  var url = '/api/admin/audit-logs?limit=500';
  if (action) url += '&action=' + encodeURIComponent(action);
  if (module) url += '&module=' + encodeURIComponent(module);
  
  apiReq('GET', url, null)
    .then(function(response) {
      if (response.error) {
        logsContainer.innerHTML = '<div style="color:var(--red2)">Error: ' + response.error + '</div>';
        return;
      }
      
      var logs = response.logs || [];
      var html = '<table style="width:100%;border-collapse:collapse;font-size:.8rem"><thead><tr style="background:#f0f0f0;border-bottom:2px solid #333"><th style="text-align:left;padding:.5rem;border-right:1px solid #ddd">Time</th><th style="text-align:left;padding:.5rem;border-right:1px solid #ddd">User</th><th style="text-align:left;padding:.5rem;border-right:1px solid #ddd">Role</th><th style="text-align:left;padding:.5rem;border-right:1px solid #ddd">Action</th><th style="text-align:left;padding:.5rem;border-right:1px solid #ddd">Resource</th><th style="text-align:left;padding:.5rem">Details</th></tr></thead><tbody>';
      
      if (logs.length === 0) {
        html += '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#666">No audit logs found</td></tr>';
      } else {
        logs.forEach(function(log) {
          var details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
          var detailsStr = JSON.stringify(details).substring(0, 100) + '...';
          
          html += '<tr style="border-bottom:1px solid #e0e0e0"><td style="padding:.5rem;border-right:1px solid #e0e0e0">' + new Date(log.created_at).toLocaleString() + '</td><td style="padding:.5rem;border-right:1px solid #e0e0e0"><strong>' + (log.username || 'System') + '</strong></td><td style="padding:.5rem;border-right:1px solid #e0e0e0"><span style="background:#f0f0f0;padding:.2rem .4rem;border-radius:3px">' + (log.role || 'N/A') + '</span></td><td style="padding:.5rem;border-right:1px solid #e0e0e0"><strong style="color:#2980b9">' + (log.action || 'UNKNOWN') + '</strong></td><td style="padding:.5rem;border-right:1px solid #e0e0e0">' + (log.resource || '') + '</td><td style="padding:.5rem;font-size:.75rem;color:#666"><span title="' + detailsStr + '">' + (details && details.module ? details.module : '') + '</span></td></tr>';
        });
      }
      
      html += '</tbody></table>';
      html += '<div style="margin-top:1rem;text-align:center;color:#666;font-size:.8rem">Showing ' + logs.length + ' of ' + (response.total || logs.length) + ' total audit logs</div>';
      
      logsContainer.innerHTML = html;
    })
    .catch(function(e) {
      logsContainer.innerHTML = '<div style="color:var(--red2)">Error: ' + e.message + '</div>';
    });
}

function applyAuditFilters() {
  loadAuditLogsData();
}

// ─────────────────────────────────────────────────────
// SYSTEM STATISTICS
// ─────────────────────────────────────────────────────

function loadSystemStats() {
  var content = document.getElementById('admin-content');
  if (!content) return;
  
  content.innerHTML = '<div style="text-align:center;color:var(--slate);padding:2rem">Loading system statistics...</div>';
  
  // Use backend API
  apiReq('GET', '/api/admin/stats', null)
    .then(function(response) {
      if (response.error) {
        content.innerHTML = '<div style="padding:1rem;color:var(--red2)">Error: ' + response.error + '</div>';
        return;
      }
      
      var html = '<div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem">' +
        createStatCard('👥 Active Users', response.active_users || 0, '#3498db') +
        createStatCard('📋 Total Assessments', response.total_assessments || 0, '#2ecc71') +
        createStatCard('✅ Submitted Assessments', response.submitted_assessments || 0, '#9b59b6') +
        createStatCard('📊 Avg Compliance Score', (response.avg_compliance_score || 0) + '%', '#e74c3c') +
        createStatCard('🔍 Total DPIAs', response.total_dpias || 0, '#1abc9c') +
        createStatCard('📝 Total ROPAs', response.total_ropas || 0, '#f39c12') +
        createStatCard('⚠️ Open Gaps', response.open_gaps || 0, '#e67e22') +
        createStatCard('🏢 Dept Assessments', response.dept_assessments || 0, '#34495e') +
        createStatCard('🔧 Open Remediations', response.open_remediations || 0, '#c0392b') +
        createStatCard('💾 Total Assets', response.total_assets || 0, '#16a085') +
        '</div>';
      
      content.innerHTML = html;
    })
    .catch(function(e) {
      content.innerHTML = '<div style="padding:1rem;color:var(--red2)">Error: ' + e.message + '</div>';
    });
}

function createStatCard(label, value, color) {
  return '<div class="card" style="background:linear-gradient(135deg,' + color + '1a,transparent);border-left:4px solid ' + color + ';display:flex;flex-direction:column;justify-content:center;align-items:center;padding:1.5rem;text-align:center"><div style="font-size:2rem;color:' + color + ';font-weight:700;margin-bottom:.5rem">' + value + '</div><div style="font-size:.9rem;color:#333;font-weight:500">' + label + '</div></div>';
}

// ─────────────────────────────────────────────────────
// DPO MANAGEMENT (System Admin only)
// ─────────────────────────────────────────────────────

function loadDPOManagement() {
  var content = document.getElementById('admin-content');
  if (!content) return;
  
  content.innerHTML = '<div class="card"><div class="ch"><h3>DPO Management</h3><p style="font-size:.85rem;color:#666;margin-top:.3rem">Create and manage Data Protection Officer accounts</p></div><div class="cb2" style="padding:1rem"><button class="btn-pri" style="width:auto;padding:.6rem 1.3rem" onclick="showCreateDPODialog()">+ Create DPO Account</button><div id="dpoListContainer" style="margin-top:1rem">Loading DPOs...</div></div></div>';
  
  // Use backend API
  apiReq('GET', '/api/admin/users', null)
    .then(function(response) {
      var dpos = (response.categorized && response.categorized.dpos) || [];
      var html = '<div style="margin-top:1rem">';
      
      if (dpos.length === 0) {
        html += '<p style="color:#666;text-align:center;padding:2rem">No DPO accounts yet. Create one above.</p>';
      } else {
        dpos.forEach(function(dpo) {
          html += '<div class="card" style="margin-bottom:.8rem;background:#f0f8ff;border-left:4px solid #2ecc71"><div style="display:flex;justify-content:space-between;align-items:center;padding:1rem"><div><div style="font-weight:700;color:#333">' + dpo.username + '</div><div style="font-size:.8rem;color:#666">' + (dpo.email || 'No email') + '</div><div style="font-size:.75rem;color:#999;margin-top:.3rem">Organization: ' + (dpo.organization || 'Not set') + '</div></div><div style="text-align:right"><div style="font-size:.85rem;color:#666;margin-bottom:.5rem">Created: ' + new Date(dpo.created_at).toLocaleDateString() + '</div><button class="btn-sec" style="width:auto;padding:.3rem .6rem;font-size:.8rem" onclick="toggleUserActive(' + dpo.id + ',false)">Deactivate</button></div></div></div>';
        });
      }
      
      html += '</div>';
      var container = document.getElementById('dpoListContainer');
      if (container) container.innerHTML = html;
    })
    .catch(function(e) {
      var container = document.getElementById('dpoListContainer');
      if (container) container.innerHTML = '<div style="color:var(--red2)">Error: ' + e.message + '</div>';
    });
}

function showCreateDPODialog() {
  var fields = [
    { id: 'dpo_username', label: 'DPO Username', type: 'text' },
    { id: 'dpo_password', label: 'Password (min 6 chars)', type: 'password' },
    { id: 'dpo_email', label: 'Email', type: 'email' },
    { id: 'dpo_organization', label: 'Organization', type: 'text' }
  ];
  
  window._createDPOCallback = function() {
    var usernameEl = document.getElementById('dpo_username');
    var passwordEl = document.getElementById('dpo_password');
    var emailEl = document.getElementById('dpo_email');
    var orgEl = document.getElementById('dpo_organization');
    
    if (!usernameEl || !passwordEl) {
      alert('Please fill in all required fields');
      return;
    }
    
    var username = usernameEl.value.trim();
    var password = passwordEl.value;
    var email = emailEl ? emailEl.value.trim() : '';
    var organization = orgEl ? orgEl.value.trim() : '';
    
    if (!username || !password) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Use backend API
    apiReq('POST', '/api/admin/users', {
      username: username,
      password: password,
      email: email || null,
      organization: organization || null,
      role: 'data_protection_officer',
      dpo_number: 'DPO-' + Date.now()
    })
    .then(function(response) {
      if (response.error) {
        alert('Error creating DPO: ' + response.error);
      } else {
        alert('DPO created successfully!');
        document.getElementById('_dialog').remove();
        loadDPOManagement();
      }
    })
    .catch(function(e) {
      alert('Error: ' + e.message);
    });
  };
  
  showSimpleDialog('Create New DPO Account', fields);
}

function deleteDPO(dpoId) {
  if (!confirm('Are you sure you want to deactivate this DPO account?')) return;
  toggleUserActive(dpoId, false);
}

// ─────────────────────────────────────────────────────
// HELPER FUNCTION
// ─────────────────────────────────────────────────────

function showSimpleDialog(title, fields) {
  var html = '<div style="background:var(--bg3);padding:1.5rem;border-radius:8px;max-width:500px"><h3 style="margin-bottom:1rem">' + title + '</h3>';
  
  fields.forEach(function(f) {
    html += '<div style="margin-bottom:.8rem"><label style="display:block;margin-bottom:.3rem;font-weight:700;font-size:.85rem">' + f.label + '</label>';
    
    if (f.type === 'select') {
      html += '<select id="' + f.id + '" style="width:100%;padding:.5rem;border:1px solid var(--bdr);border-radius:4px"><option value="">Select...</option>';
      (f.options || []).forEach(function(o) { html += '<option value="' + o + '">' + o.replace(/_/g, ' ').toUpperCase() + '</option>'; });
      html += '</select>';
    } else {
      var readonly = f.readonly ? 'readonly' : '';
      var value = f.value ? ' value="' + f.value + '"' : '';
      html += '<input type="' + (f.type || 'text') + '" id="' + f.id + '" style="width:100%;padding:.5rem;border:1px solid var(--bdr);border-radius:4px"' + value + ' ' + readonly + ' />';
    }
    html += '</div>';
  });
  
  html += '<div style="margin-top:1.5rem;display:flex;gap:.6rem;justify-content:flex-end"><button class="btn-sec" onclick="document.getElementById(\'_dialog\').remove()">Cancel</button><button class="btn-pri" onclick="saveDialog()">Save</button></div></div>';
  
  var d = document.createElement('div');
  d.id = '_dialog';
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000';
  d.innerHTML = html;
  document.body.appendChild(d);
}

function saveDialog() {
  if (window._createUserCallback) {
    window._createUserCallback();
  } else if (window._editUserCallback) {
    window._editUserCallback();
  } else if (window._resetPasswordCallback) {
    window._resetPasswordCallback();
  } else if (window._createDPOCallback) {
    window._createDPOCallback();
  }
}
