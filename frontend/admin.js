/**
 * CDPA Compliance System - Administration Dashboard
 * Enterprise-style: user list table + tabbed detail panel + action bar
 */

var _adminUsers=[], _selectedUserId=null, _adminDetailTab='general', _adminViewTab='users';
var _languages = ['ENGLISH', 'AFRIKAANS', 'ZULU', 'XHOSA', 'SETSWANA'];

function loadAdminDashboard(){ renderAdminShell(); }

function renderAdminShell(){
  var c=document.getElementById('admin-content'); if(!c) return;
  c.innerHTML='<div class="adm-wrap">'+
    '<div class="adm-topbar">'+
      '<button class="adm-topbtn '+(_adminViewTab==='users'?'on':'')+'" onclick="adminSwitchTab(\'users\')">&#128100; Users</button>'+
      '<button class="adm-topbtn '+(_adminViewTab==='roles'?'on':'')+'" onclick="adminSwitchTab(\'roles\')">&#9881; User Roles</button>'+
      '<button class="adm-topbtn '+(_adminViewTab==='orgs'?'on':'')+'" onclick="adminSwitchTab(\'orgs\')">&#127970; Organisations</button>'+
      '<button class="adm-topbtn '+(_adminViewTab==='audit'?'on':'')+'" onclick="adminSwitchTab(\'audit\')">&#128203; Audit Trail</button>'+
      '<button class="adm-topbtn '+(_adminViewTab==='stats'?'on':'')+'" onclick="adminSwitchTab(\'stats\')">&#128202; System Statistics</button>'+
    '</div><div id="adm-body"></div></div>';
  injectAdminStyles();
  adminSwitchTab(_adminViewTab);
}

function adminSwitchTab(tab){
  _adminViewTab=tab;
  document.querySelectorAll('.adm-topbtn').forEach(function(b){
    b.classList.toggle('on',(tab==='users'&&b.textContent.indexOf('User')>-1)||
                          (tab==='roles'&&b.textContent.indexOf('Role')>-1)||
                          (tab==='orgs'&&b.textContent.indexOf('Org')>-1)||
                          (tab==='audit'&&b.textContent.indexOf('Audit')>-1)||
                          (tab==='stats'&&b.textContent.indexOf('Stat')>-1));
  });
  if(tab==='users') renderUserManagement();
  if(tab==='roles') renderRolesPanel();
  if(tab==='orgs') renderOrgsPanel();
  if(tab==='audit') renderAuditPanel();
  if(tab==='stats') renderStatsPanel();
}

function renderRolesPanel(){
  var body=document.getElementById('adm-body'); if(!body) return;
  body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate)"><h3>Role Management</h3><p>Role management interface coming soon!</p></div>';
}

function renderOrgsPanel(){
  var body=document.getElementById('adm-body'); if(!body) return;
  body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate)"><h3>Organisation Management</h3><p>Organisation management interface coming soon!</p></div>';
}

function renderUserManagement(){
  var body=document.getElementById('adm-body'); if(!body) return;
  body.innerHTML='<div style="padding:1rem;color:var(--slate)">Loading users...</div>';
  apiReq('GET','/admin/users',null).then(function(resp){
    if(resp.error){body.innerHTML='<div class="adm-err">Error: '+resp.error+'</div>';return;}
    _adminUsers=resp.users||[];
    if(!_selectedUserId&&_adminUsers.length) _selectedUserId=_adminUsers[0].id;
    paintUserView();
  }).catch(function(e){body.innerHTML='<div class="adm-err">'+e.message+'</div>';});
}

function paintUserView(){
  var body=document.getElementById('adm-body'); if(!body) return;
  var isAdmin=CU&&CU.role==='system_administrator';
  var tableRows='';
  _adminUsers.forEach(function(u,i){
    var sel=u.id===_selectedUserId?' adm-row-sel':'';
    var dot=u.is_active?'<span class="adm-dot green"></span>':'<span class="adm-dot red"></span>';
    tableRows+='<tr class="adm-row'+sel+'" onclick="selectAdminUser('+u.id+')">'+
      '<td class="adm-td adm-td-num">'+(i+1)+'</td>'+
      '<td class="adm-td adm-td-name">'+escHtml(u.username)+'</td>'+
      '<td class="adm-td">'+escHtml(u.email||'--')+'</td>'+
      '<td class="adm-td">'+escHtml(u.organization||u.dpo_number||'--')+'</td>'+
      '<td class="adm-td"><span class="adm-role-badge '+roleCssClass(u.role)+'">'+fmtRoleShort(u.role)+'</span></td>'+
      '<td class="adm-td adm-td-status">'+dot+'</td></tr>';
  });
  var detail=buildDetailPanel();
  var bar=isAdmin?
    '<div class="adm-actionbar-row">'+
      '<button class="adm-act adm-act-pri" onclick="admNewUser()">&#43; New</button>'+
      '<button class="adm-act adm-act-save" onclick="admSaveUser()">&#10003; Save</button>'+
      '<button class="adm-act" onclick="admResetForm()">Reset</button>'+
      '<button class="adm-act adm-act-warn" onclick="admResetPassword()">&#128274; Password Rollover</button>'+
      '<button class="adm-act">Function Passwords</button>'+
      '<button class="adm-act">Print User ID Card</button>'+
    '</div>'+
    '<div class="adm-actionbar-row">'+
      '<button class="adm-act adm-act-del" onclick="lockAllUsers()">Lock All Users</button>'+
      '<button class="adm-act adm-act-tog" onclick="unlockAllUsers()">Unlock All Users</button>'+
      '<button class="adm-act" onclick="admToggleActive()">Lock User</button>'+
      '<button class="adm-act" onclick="admToggleActive()">Unlock User</button>'+
      '<button class="adm-act">Reset User MFA</button>'+
      '<button class="adm-act">Reset All MFA</button>'+
      '<button class="adm-act">Sessions</button>'+
      '<button class="adm-act">Print RB Card</button>'+
      '<button class="adm-act adm-act-del" onclick="admDeleteUser()">&#128465; Delete</button>'+
    '</div>'
    :'<span style="color:#a8c4e0;font-size:.82rem">&#128274; View-only mode</span>';
  body.innerHTML='<div class="adm-layout">'+
    '<div class="adm-list-wrap"><table class="adm-table">'+
      '<thead><tr>'+
        '<th class="adm-th adm-td-num">#</th>'+
        '<th class="adm-th adm-td-name">Username / Login ID</th>'+
        '<th class="adm-th">Email</th>'+
        '<th class="adm-th">Organisation / DPO No.</th>'+
        '<th class="adm-th">Role</th>'+
        '<th class="adm-th adm-td-status">Active</th>'+
      '</tr></thead><tbody>'+tableRows+'</tbody></table></div>'+
    '<div class="adm-detail">'+
      '<div class="adm-dtabs">'+
        '<button class="adm-dtab '+(_adminDetailTab==='general'?'on':'')+'" onclick="switchDetailTab(\'general\')">General</button>'+
        '<button class="adm-dtab '+(_adminDetailTab==='security'?'on':'')+'" onclick="switchDetailTab(\'security\')">Security</button>'+
        '<button class="adm-dtab '+(_adminDetailTab==='permissions'?'on':'')+'" onclick="switchDetailTab(\'permissions\')">Functions / Permissions</button>'+
      '</div>'+
      '<div class="adm-dform" id="adm-dform">'+detail+'</div>'+
    '</div>'+
    '<div class="adm-actionbar">'+bar+'</div>'+
  '</div>';
}

function lockAllUsers(){
  if(!confirm('Lock ALL users?')) return;
  admToast('Locking all users (demo)');
}

function unlockAllUsers(){
  if(!confirm('Unlock ALL users?')) return;
  admToast('Unlocking all users (demo)');
}

function selectAdminUser(id){_selectedUserId=id;_adminDetailTab='general';paintUserView();}
function switchDetailTab(tab){
  _adminDetailTab=tab;
  document.querySelectorAll('.adm-dtab').forEach(function(b){
    b.classList.toggle('on',(tab==='general'&&b.textContent==='General')||(tab==='security'&&b.textContent==='Security')||(tab==='permissions'&&b.textContent.indexOf('Perm')>-1));
  });
  var form=document.getElementById('adm-dform'); if(form) form.innerHTML=buildDetailPanel();
}
function getSelectedUser(){return _adminUsers.find(function(u){return u.id===_selectedUserId;})||null;}
function getToggleLabel(){var u=getSelectedUser();if(!u)return 'Toggle Active';return u.is_active?'&#10006; Deactivate':'&#10003; Activate';}
function buildDetailPanel(){
  var u=getSelectedUser();
  if(!u) return '<div class="adm-nosel">Select a user from the list above to view and edit their details.</div>';
  if(_adminDetailTab==='general')     return buildGeneralTab(u);
  if(_adminDetailTab==='security')    return buildSecurityTab(u);
  if(_adminDetailTab==='permissions') return buildPermissionsTab(u);
  return '';
}

function buildGeneralTab(u){
  return '<div class="adm-fg-grid">'+
    '<div class="adm-fg-col">'+
      '<div class="adm-fg"><label>Username / Login ID</label><input id="det_username" value="'+escHtml(u.username)+'" readonly></div>'+
      '<div class="adm-fg"><label>Email Address</label><input id="det_email" value="'+escHtml(u.email||'')+'" placeholder="user@example.com"></div>'+
      '<div class="adm-fg"><label>Organisation</label><input id="det_org" value="'+escHtml(u.organization||'')+'" placeholder="Organisation name"></div>'+
      '<div class="adm-fg"><label>DPO Practice Number</label><input id="det_dpo" value="'+escHtml(u.dpo_number||'')+'" placeholder="e.g. DPO-00001"></div>'+
    '</div>'+
    '<div class="adm-fg-col">'+
      '<div class="adm-fg"><label>Assigned Role</label>'+
        '<select id="det_role">'+
          '<option value="system_administrator"'+(u.role==='system_administrator'?' selected':'')+'>System Administrator</option>'+
          '<option value="data_protection_officer"'+(u.role==='data_protection_officer'?' selected':'')+'>Data Protection Officer</option>'+
          '<option value="potraz_assessor"'+(u.role==='potraz_assessor'?' selected':'')+'>POTRAZ Assessor</option>'+
        '</select>'+
      '</div>'+
      '<div class="adm-fg"><label>Account Status</label>'+
        '<div class="adm-status-row"><span class="adm-dot '+(u.is_active?'green':'red')+'" style="width:14px;height:14px"></span>'+
        '<strong>'+(u.is_active?'Active':'Inactive')+'</strong></div>'+
      '</div>'+
      '<div class="adm-fg"><label>Account Created</label><input value="'+(u.created_at?new Date(u.created_at).toLocaleString():'N/A')+'" readonly></div>'+
      '<div class="adm-fg"><label>Last Updated</label><input value="'+(u.updated_at?new Date(u.updated_at).toLocaleString():'N/A')+'" readonly></div>'+
      '<div class="adm-info-box">'+
        '<div class="adm-info-row"><span>User ID</span><strong>#'+u.id+'</strong></div>'+
        '<div class="adm-info-row"><span>Role Category</span><strong>'+fmtRoleShort(u.role)+'</strong></div>'+
      '</div>'+
    '</div>'+
  '</div>';
}

function buildSecurityTab(u){
  return '<div class="adm-sec-notice">'+
      '<span style="font-size:1.3rem">&#128274;</span>'+
      '<div><strong>Password Management</strong><br>Passwords are stored as secure bcrypt hashes and cannot be viewed. '+
      'Use the <em>Reset Password</em> button in the action bar to set a new password for this user.</div>'+
    '</div>'+
    '<div class="adm-fg-grid">'+
      '<div class="adm-fg-col">'+
        '<div class="adm-fg"><label>Username (Login ID)</label><input value="'+escHtml(u.username)+'" readonly></div>'+
        '<div class="adm-fg"><label>Account Active</label><input value="'+(u.is_active?'Yes - account is enabled':'No - account is disabled')+'" readonly></div>'+
      '</div>'+
      '<div class="adm-fg-col">'+
        '<div class="adm-fg"><label>Account Created</label><input value="'+(u.created_at?new Date(u.created_at).toLocaleString():'N/A')+'" readonly></div>'+
        '<div class="adm-fg"><label>Last Modified</label><input value="'+(u.updated_at?new Date(u.updated_at).toLocaleString():'N/A')+'" readonly></div>'+
      '</div>'+
    '</div>';
}

function buildPermissionsTab(u){
  var perms=getPermissionsForRole(u.role);
  var rows=perms.map(function(p){
    return '<div class="adm-perm-row">'+
      '<span class="adm-perm-icon '+(p.allowed?'allow':'deny')+'">'+(p.allowed?'&#10003;':'&#10007;')+'</span>'+
      '<span class="adm-perm-label">'+p.label+'</span>'+
      '<span class="adm-perm-val '+(p.allowed?'allow':'deny')+'">'+(p.allowed?'Allowed':'Denied')+'</span>'+
    '</div>';
  }).join('');
  return '<div class="adm-perm-panel">'+
    '<div class="adm-perm-header">Permissions for <strong>'+fmtRoleShort(u.role)+'</strong></div>'+
    '<div class="adm-perm-list">'+rows+'</div>'+
    '<p style="font-size:.78rem;color:var(--slate);margin-top:1rem">&#9432; Permissions are role-based and cannot be customised per individual user.</p>'+
  '</div>';
}

function getPermissionsForRole(role){
  var all=[
    {label:'Create and manage user accounts',roles:['system_administrator']},
    {label:'Reset any user password',roles:['system_administrator']},
    {label:'View full system audit trail',roles:['system_administrator']},
    {label:'View system statistics and health',roles:['system_administrator']},
    {label:'Capture compliance assessment data',roles:['data_protection_officer','system_administrator']},
    {label:'Capture ROPA (Record of Processing Activities)',roles:['data_protection_officer','system_administrator']},
    {label:'Capture DPIA (Data Protection Impact Assessments)',roles:['data_protection_officer','system_administrator']},
    {label:'Capture and manage Gap Analysis data',roles:['data_protection_officer','system_administrator']},
    {label:'Download and export compliance reports',roles:['data_protection_officer','system_administrator']},
    {label:'View compliance reports and scores',roles:['potraz_assessor','data_protection_officer','system_administrator']},
    {label:'Leave assessor comments on organisations',roles:['potraz_assessor','system_administrator']},
    {label:'View all organisations assessments',roles:['potraz_assessor','system_administrator']}
  ];
  return all.map(function(p){return{label:p.label,allowed:p.roles.indexOf(role)!==-1};});
}

function admNewUser(){
  if(!CU||CU.role!=='system_administrator'){admAlert('Only System Administrators can create users.');return;}
  _selectedUserId=null;
  paintUserView();
  var form=document.getElementById('adm-dform'); if(!form) return;
  form.innerHTML='<div class="adm-new-notice">&#43; Creating New User Account</div>'+
    '<div class="adm-fg-grid">'+
      '<div class="adm-fg-col">'+
        '<div class="adm-fg"><label>Username <span class="req">*</span></label><input id="nu_username" placeholder="Choose a unique username"></div>'+
        '<div class="adm-fg"><label>Password <span class="req">*</span></label><input id="nu_password" type="password" placeholder="Minimum 6 characters"></div>'+
        '<div class="adm-fg"><label>Confirm Password <span class="req">*</span></label><input id="nu_password2" type="password" placeholder="Repeat password"></div>'+
        '<div class="adm-fg"><label>Email Address</label><input id="nu_email" type="email" placeholder="user@example.com"></div>'+
        '<div class="adm-fg"><label>Organisation</label><input id="nu_org" placeholder="Organisation name"></div>'+
        '<div class="adm-fg"><label>DPO Practice Number</label><input id="nu_dpo" placeholder="e.g. DPO-00001"></div>'+
      '</div>'+
      '<div class="adm-fg-col">'+
        '<div class="adm-fg"><label>Assign Role <span class="req">*</span></label>'+
          '<select id="nu_role">'+
            '<option value="">-- Select Role --</option>'+
            '<option value="data_protection_officer">Data Protection Officer</option>'+
            '<option value="potraz_assessor">POTRAZ Assessor</option>'+
            '<option value="system_administrator">System Administrator</option>'+
          '</select>'+
        '</div>'+
        '<div class="adm-fg"><label>Controller Licence Number</label><input id="nu_lic" placeholder="Licence no."></div>'+
        '<div class="adm-fg"><label>Controller Contact Number</label><input id="nu_contact" placeholder="Contact no."></div>'+
        '<div class="adm-info-box" style="margin-top:.8rem">'+
          '<div class="adm-info-row"><span>&#9432;</span><span>The new account will be active immediately upon creation.</span></div>'+
        '</div>'+
        '<div style="margin-top:1rem;display:flex;gap:.6rem">'+
          '<button class="adm-act adm-act-pri" onclick="admDoCreateUser()">&#10003; Create Account</button>'+
          '<button class="adm-act" onclick="renderUserManagement()">Cancel</button>'+
        '</div>'+
      '</div>'+
    '</div>';
}

function admDoCreateUser(){
  var username=((document.getElementById('nu_username')||{}).value||'').trim();
  var password=(document.getElementById('nu_password')||{}).value||'';
  var password2=(document.getElementById('nu_password2')||{}).value||'';
  var role=(document.getElementById('nu_role')||{}).value||'';
  var email=((document.getElementById('nu_email')||{}).value||'').trim();
  var org=((document.getElementById('nu_org')||{}).value||'').trim();
  var dpo=((document.getElementById('nu_dpo')||{}).value||'').trim();
  var lic=((document.getElementById('nu_lic')||{}).value||'').trim();
  var contact=((document.getElementById('nu_contact')||{}).value||'').trim();
  if(!username||!password||!role){admAlert('Username, Password and Role are required.');return;}
  if(password.length<6){admAlert('Password must be at least 6 characters.');return;}
  if(password!==password2){admAlert('Passwords do not match.');return;}
  apiReq('POST','/admin/users',{username:username,password:password,role:role,
    email:email||null,organization:org||null,dpo_number:dpo||null,
    controller_license_number:lic||null,controller_contact_number:contact||null})
  .then(function(r){
    if(r.error){admAlert('Error: '+r.error);return;}
    admToast('User "'+username+'" created successfully!');
    renderUserManagement();
  }).catch(function(e){admAlert('Error: '+e.message);});
}

function admSaveUser(){
  var u=getSelectedUser(); if(!u){admAlert('Select a user to save changes.');return;}
  var email=((document.getElementById('det_email')||{}).value||'').trim();
  var org=((document.getElementById('det_org')||{}).value||'').trim();
  var dpo=((document.getElementById('det_dpo')||{}).value||'').trim();
  var role=((document.getElementById('det_role')||{}).value)||u.role;
  apiReq('PATCH','/admin/users/'+u.id,{email:email||null,organization:org||null,
    dpo_number:dpo||null,role:role})
  .then(function(r){
    if(r.error){admAlert('Save error: '+r.error);return;}
    admToast('User "'+u.username+'" updated successfully!');
    renderUserManagement();
  }).catch(function(e){admAlert('Error: '+e.message);});
}

function admResetForm(){paintUserView();}

function admResetPassword(){
  var u=getSelectedUser(); if(!u){admAlert('Select a user first.');return;}
  var form=document.getElementById('adm-dform'); if(!form) return;
  form.innerHTML='<div class="adm-sec-notice" style="margin-bottom:1.2rem">'+
      '<span style="font-size:1.3rem">&#128274;</span>'+
      '<div><strong>Reset Password for "'+escHtml(u.username)+'"</strong><br>'+
      'Enter a new password. The user will need to use this on their next login.</div>'+
    '</div>'+
    '<div class="adm-fg" style="max-width:340px"><label>New Password <span class="req">*</span></label><input id="rp_new" type="password" placeholder="Minimum 6 characters"></div>'+
    '<div class="adm-fg" style="max-width:340px;margin-top:.6rem"><label>Confirm New Password <span class="req">*</span></label><input id="rp_confirm" type="password" placeholder="Repeat new password"></div>'+
    '<div style="margin-top:.8rem;display:flex;gap:.6rem">'+
      '<button class="adm-act adm-act-warn" onclick="admDoResetPwd('+u.id+')">&#128274; Apply Reset</button>'+
      '<button class="adm-act" onclick="admResetForm()">Cancel</button>'+
    '</div>';
}

function admDoResetPwd(userId){
  var p1=(document.getElementById('rp_new')||{}).value||'';
  var p2=(document.getElementById('rp_confirm')||{}).value||'';
  if(!p1||p1!==p2){admAlert('Passwords do not match or are empty.');return;}
  if(p1.length<6){admAlert('Password must be at least 6 characters.');return;}
  apiReq('PATCH','/admin/users/'+userId+'/reset-password',{new_password:p1})
  .then(function(r){
    if(r.error){admAlert('Error: '+r.error);return;}
    admToast('Password reset successfully!');
    admResetForm();
  }).catch(function(e){admAlert('Error: '+e.message);});
}

function admToggleActive(){
  var u=getSelectedUser(); if(!u){admAlert('Select a user first.');return;}
  var next=!u.is_active;
  if(!confirm('Are you sure you want to '+(next?'ACTIVATE':'DEACTIVATE')+' user "'+u.username+'"?')) return;
  apiReq('PATCH','/admin/users/'+u.id,{is_active:next})
  .then(function(r){
    if(r.error){admAlert('Error: '+r.error);return;}
    admToast('User "'+u.username+'" '+(next?'activated':'deactivated')+'.');
    renderUserManagement();
  }).catch(function(e){admAlert('Error: '+e.message);});
}

function admDeleteUser(){
  var u=getSelectedUser(); if(!u){admAlert('Select a user first.');return;}
  if(CU&&u.id===CU.id){admAlert('You cannot delete your own account.');return;}
  if(!confirm('Permanently delete user "'+u.username+'"? This cannot be undone.')) return;
  apiReq('DELETE','/admin/users/'+u.id,null)
  .then(function(r){
    if(r.error){admAlert('Error: '+r.error);return;}
    admToast('User "'+u.username+'" deleted.');
    _selectedUserId=null;
    renderUserManagement();
  }).catch(function(e){admAlert('Error: '+e.message);});
}

function renderAuditPanel(){
  var body=document.getElementById('adm-body'); if(!body) return;
  body.innerHTML='<div class="adm-audit-wrap">'+
    '<div class="adm-audit-filters">'+
      '<div class="adm-fg" style="flex:1"><label>Filter by Action</label><input id="af_action" placeholder="e.g. USER_CREATED" onkeydown="if(event.key===\'Enter\')loadAuditLogsData()"></div>'+
      '<div class="adm-fg" style="flex:1"><label>Filter by Module</label>'+
        '<select id="af_module">'+
          '<option value="">All Modules</option>'+
          '<option value="USER_MANAGEMENT">User Management</option>'+
          '<option value="ASSESSMENTS">Assessments</option>'+
          '<option value="AUDIT">Audit</option>'+
          '<option value="DPIA">DPIA</option>'+
          '<option value="ROPA">ROPA</option>'+
          '<option value="GAP">Gap Analysis</option>'+
        '</select>'+
      '</div>'+
      '<div class="adm-fg" style="flex:1"><label>Filter by Role</label>'+
        '<select id="af_role">'+
          '<option value="">All Roles</option>'+
          '<option value="system_administrator">System Administrator</option>'+
          '<option value="data_protection_officer">Data Protection Officer</option>'+
          '<option value="potraz_assessor">POTRAZ Assessor</option>'+
        '</select>'+
      '</div>'+
      '<div class="adm-fg" style="flex:1"><label>Filter by Organization</label><input id="af_org" placeholder="e.g. Company XYZ" onkeydown="if(event.key===\'Enter\')loadAuditLogsData()"></div>'+
      '<div class="adm-fg" style="align-self:flex-end"><button class="adm-act adm-act-pri" onclick="loadAuditLogsData()">&#128269; Search</button></div>'+
    '</div>'+
    '<div id="auditLogsContainer" class="adm-audit-table-wrap"><div style="padding:1.5rem;color:var(--slate)">Loading audit logs...</div></div>'+
  '</div>';
  loadAuditLogsData();
}

function loadAuditLogsData(){
  var container=document.getElementById('auditLogsContainer'); if(!container) return;
  container.innerHTML='<div style="padding:1rem;color:var(--slate)">Searching...</div>';
  var action=((document.getElementById('af_action')||{}).value||'').trim();
  var module=((document.getElementById('af_module')||{}).value||'').trim();
  var role=((document.getElementById('af_role')||{}).value||'').trim();
  var org=((document.getElementById('af_org')||{}).value||'').trim();
  var url='/admin/audit-logs?limit=200';
  if(action) url+='&action='+encodeURIComponent(action);
  if(module) url+='&module='+encodeURIComponent(module);
  if(role) url+='&role='+encodeURIComponent(role);
  if(org) url+='&organization='+encodeURIComponent(org);
  apiReq('GET',url,null).then(function(resp){
    if(resp.error){container.innerHTML='<div class="adm-err">'+resp.error+'</div>';return;}
    var logs=resp.logs||[];
    var rows=logs.map(function(log,i){
      var det='';
      try{var d=typeof log.details==='string'?JSON.parse(log.details):log.details;det=d&&d.module?d.module:'';}catch(e){}
      return '<tr class="adm-row">'+
        '<td class="adm-td adm-td-num">'+(i+1)+'</td>'+
        '<td class="adm-td">'+new Date(log.created_at).toLocaleString()+'</td>'+
        '<td class="adm-td"><strong>'+escHtml(log.username||'System')+'</strong></td>'+
        '<td class="adm-td"><span class="adm-role-badge '+roleCssClass(log.role||'')+'">'+fmtRoleShort(log.role||'')+'</span></td>'+
        '<td class="adm-td"><span style="color:var(--gold2);font-weight:700">'+escHtml(log.action||'')+'</span></td>'+
        '<td class="adm-td">'+escHtml(log.resource||'')+'</td>'+
        '<td class="adm-td" style="font-size:.78rem;color:var(--slate)">'+escHtml(det)+'</td>'+
      '</tr>';
    }).join('');
    if(!rows) rows='<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--slate)">No audit logs found.</td></tr>';
    container.innerHTML='<table class="adm-table adm-audit-tbl">'+
      '<thead><tr>'+
        '<th class="adm-th adm-td-num">#</th>'+
        '<th class="adm-th">Timestamp</th>'+
        '<th class="adm-th">User</th>'+
        '<th class="adm-th">Role</th>'+
        '<th class="adm-th">Action</th>'+
        '<th class="adm-th">Resource</th>'+
        '<th class="adm-th">Module</th>'+
      '</tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div style="padding:.6rem 1rem;font-size:.8rem;color:var(--slate);border-top:1px solid var(--bdr)">Showing '+logs.length+' of '+(resp.total||logs.length)+' records</div>';
  }).catch(function(e){container.innerHTML='<div class="adm-err">'+e.message+'</div>';});
}

function applyAuditFilters(){loadAuditLogsData();}

function renderStatsPanel(){
  var body=document.getElementById('adm-body'); if(!body) return;
  body.innerHTML='<div style="padding:1rem;color:var(--slate)">Loading statistics...</div>';
  apiReq('GET','/admin/stats',null).then(function(r){
    if(r.error){body.innerHTML='<div class="adm-err">'+r.error+'</div>';return;}
    body.innerHTML='<div class="adm-stats-wrap">'+
      '<div class="adm-stats-section"><div class="adm-stats-head">Users &amp; Accounts</div><div class="adm-stats-grid">'+
        statCard('&#128100;','Active Users',r.active_users||0,'#2980b9')+
        statCard('&#128737;','Data Protection Officers',r.dpo_count||0,'#27ae60')+
        statCard('&#128269;','POTRAZ Assessors',r.assessor_count||0,'#9b59b6')+
      '</div></div>'+
      '<div class="adm-stats-section"><div class="adm-stats-head">Compliance Assessments</div><div class="adm-stats-grid">'+
        statCard('&#128203;','Total Assessments',r.total_assessments||0,'#e67e22')+
        statCard('&#10003;','Submitted',r.submitted_assessments||0,'#27ae60')+
        statCard('&#128202;','Avg Compliance Score',(r.avg_compliance_score||0)+'%','#c0392b')+
      '</div></div>'+
      '<div class="adm-stats-section"><div class="adm-stats-head">CDPA Modules</div><div class="adm-stats-grid">'+
        statCard('&#128269;','Total DPIAs',r.total_dpias||0,'#1abc9c')+
        statCard('&#128196;','Total ROPAs',r.total_ropas||0,'#f39c12')+
        statCard('&#9888;','Open Gaps',r.open_gaps||0,'#e74c3c')+
        statCard('&#128295;','Open Remediations',r.open_remediations||0,'#c0392b')+
        statCard('&#128190;','Total Assets',r.total_assets||0,'#16a085')+
        statCard('&#127970;','Dept Assessments',r.dept_assessments||0,'#34495e')+
      '</div></div>'+
    '</div>';
  }).catch(function(e){body.innerHTML='<div class="adm-err">'+e.message+'</div>';});
}

function statCard(icon,label,value,color){
  return '<div class="adm-stat-card" style="border-top:4px solid '+color+'">'+
    '<div class="adm-stat-icon" style="color:'+color+'">'+icon+'</div>'+
    '<div class="adm-stat-val" style="color:'+color+'">'+value+'</div>'+
    '<div class="adm-stat-lbl">'+label+'</div></div>';
}

// Legacy compat
function loadUserManagement()       {_adminViewTab='users';renderAdminShell();}
function loadAuditLogs()            {_adminViewTab='audit';renderAdminShell();}
function loadSystemStats()          {_adminViewTab='stats';renderAdminShell();}
function loadDPOManagement()        {_adminViewTab='users';renderAdminShell();}
function showCreateUserDialog()     {admNewUser();}
function showEditUserDialog(id)     {_selectedUserId=id;_adminDetailTab='general';paintUserView();}
function showResetPasswordDialog(id){_selectedUserId=id;paintUserView();admResetPassword();}
function toggleUserActive(id,v)     {apiReq('PATCH','/admin/users/'+id,{is_active:v}).then(function(){renderUserManagement();});}
function createStatCard(l,v,c)      {return statCard('',l,v,c);}

// Helpers
function fmtRoleShort(role){
  var map={system_administrator:'SysAdmin',data_protection_officer:'DPO',potraz_assessor:'Assessor'};
  return map[role]||(role?role.replace(/_/g,' '):'N/A');
}
function roleCssClass(role){
  if(role==='system_administrator')    return 'badge-admin';
  if(role==='data_protection_officer') return 'badge-dpo';
  if(role==='potraz_assessor')         return 'badge-assessor';
  return 'badge-default';
}
function escHtml(s){
  if(!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function admAlert(msg){
  var el=document.getElementById('_adm_alert');if(el)el.remove();
  var d=document.createElement('div');d.id='_adm_alert';
  d.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#c0392b;color:#fff;padding:.8rem 1.5rem;border-radius:6px;z-index:9999;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,.3)';
  d.textContent=msg;document.body.appendChild(d);setTimeout(function(){d.remove();},3500);
}
function admToast(msg){
  var el=document.getElementById('_adm_toast');if(el)el.remove();
  var d=document.createElement('div');d.id='_adm_toast';
  d.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:.8rem 1.5rem;border-radius:6px;z-index:9999;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,.3)';
  d.textContent=msg;document.body.appendChild(d);setTimeout(function(){d.remove();},3000);
}

function injectAdminStyles(){
  if(document.getElementById('_adm_styles')) return;
  var s=document.createElement('style');s.id='_adm_styles';
  s.textContent=[
  '.adm-wrap{display:flex;flex-direction:column;height:100%;background:#f0f4f8}',
  '.adm-topbar{display:flex;background:#2980b9;border-bottom:2px solid #1e5a8a}',
  '.adm-topbtn{background:none;border:none;color:#fff;padding:.7rem 1.4rem;font-size:.87rem;font-weight:600;cursor:pointer;border-bottom:3px solid transparent;transition:all .15s}',
  '.adm-topbtn:hover{background:rgba(255,255,255,.15)}',
  '.adm-topbtn.on{background:rgba(255,255,255,.2);border-bottom-color:#ffc107}',
  '.adm-layout{display:flex;flex-direction:column;flex:1;overflow:hidden}',
  '.adm-list-wrap{overflow-y:auto;max-height:200px;border-bottom:2px solid #2980b9}',
  '.adm-table{width:100%;border-collapse:collapse;font-size:.83rem}',
  '.adm-th{background:#2980b9;color:#fff;padding:.55rem .7rem;text-align:left;font-weight:600;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;position:sticky;top:0;z-index:1}',
  '.adm-td{padding:.5rem .7rem;border-bottom:1px solid #d4e4f0;vertical-align:middle}',
  '.adm-td-num{width:40px;text-align:center;color:#666}',
  '.adm-td-name{font-weight:600}',
  '.adm-td-status{width:60px;text-align:center}',
  '.adm-row{cursor:pointer;transition:background .1s}',
  '.adm-row:hover td{background:#e3f0fa}',
  '.adm-row-sel td{background:#cfe7f9!important}',
  '.adm-role-badge{padding:.18rem .55rem;border-radius:4px;font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}',
  '.badge-admin{background:#fee2e2;color:#b91c1c}',
  '.badge-dpo{background:#d1fae5;color:#065f46}',
  '.badge-assessor{background:#ede9fe;color:#5b21b6}',
  '.badge-default{background:#f3f4f6;color:#374151}',
  '.adm-dot{display:inline-block;width:10px;height:10px;border-radius:50%}',
  '.adm-dot.green{background:#27ae60}',
  '.adm-dot.red{background:#e74c3c}',
  '.adm-detail{flex:1;display:flex;flex-direction:column;overflow:hidden}',
  '.adm-dtabs{display:flex;background:#2980b9}',
  '.adm-dtab{background:none;border:none;color:#fff;padding:.55rem 1.2rem;font-size:.83rem;font-weight:600;cursor:pointer;border-bottom:3px solid transparent;transition:all .15s}',
  '.adm-dtab:hover{background:rgba(255,255,255,.15)}',
  '.adm-dtab.on{background:rgba(255,255,255,.2);border-bottom-color:#ffc107}',
  '.adm-dform{flex:1;overflow-y:auto;padding:1rem 1.2rem;background:#fff}',
  '.adm-nosel{padding:2rem;text-align:center;color:#666;font-style:italic}',
  '.adm-new-notice{background:#2980b9;color:#fff;padding:.6rem 1rem;border-radius:5px;font-weight:700;font-size:.85rem;margin-bottom:1rem}',
  '.adm-fg-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 1.5rem}',
  '.adm-fg-col{display:flex;flex-direction:column;gap:.6rem}',
  '.adm-fg{display:flex;flex-direction:column;gap:.22rem}',
  '.adm-fg label{font-weight:700;font-size:.77rem;color:#1e5a8a;text-transform:uppercase;letter-spacing:.04em}',
  '.adm-fg input,.adm-fg select{padding:.4rem .6rem;border:1px solid #a8c4e0;border-radius:4px;font-size:.84rem;background:#fff;color:#1a1a1a}',
  '.adm-fg input[readonly]{background:#f0f4f8;color:#666}',
  '.adm-fg input:focus,.adm-fg select:focus{border-color:#2980b9;outline:none;box-shadow:0 0 0 2px rgba(41,128,185,.2)}',
  '.adm-status-row{display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;background:#fff;border:1px solid #a8c4e0;border-radius:4px}',
  '.req{color:#e74c3c}',
  '.adm-info-box{background:#e3f0fa;border:1px solid #a8c4e0;border-radius:5px;padding:.6rem .8rem;display:flex;flex-direction:column;gap:.3rem}',
  '.adm-info-row{display:flex;justify-content:space-between;font-size:.8rem}',
  '.adm-info-row span{color:#666}',
  '.adm-sec-notice{background:#fffbe6;border:1px solid #f0c040;border-radius:6px;padding:.9rem 1rem;display:flex;gap:.9rem;align-items:flex-start;margin-bottom:1rem;font-size:.83rem}',
  '.adm-perm-header{font-weight:700;font-size:.9rem;color:#1e5a8a;margin-bottom:.8rem;padding-bottom:.5rem;border-bottom:2px solid #a8c4e0}',
  '.adm-perm-list{display:flex;flex-direction:column;gap:.3rem}',
  '.adm-perm-row{display:flex;align-items:center;gap:.7rem;padding:.4rem .6rem;border-radius:4px;background:#fff;border:1px solid #d4e4f0;font-size:.83rem}',
  '.adm-perm-icon{font-weight:900;width:18px;text-align:center}',
  '.adm-perm-icon.allow{color:#065f46}',
  '.adm-perm-icon.deny{color:#b91c1c}',
  '.adm-perm-label{flex:1}',
  '.adm-perm-val{font-size:.75rem;font-weight:700;padding:.15rem .5rem;border-radius:3px}',
  '.adm-perm-val.allow{background:#d1fae5;color:#065f46}',
  '.adm-perm-val.deny{background:#fee2e2;color:#b91c1c}',
  '.adm-actionbar{display:flex;flex-direction:column;gap:.3rem;background:#2980b9;padding:.55rem .9rem;border-top:2px solid #1e5a8a}',
  '.adm-actionbar-row{display:flex;gap:.4rem;flex-wrap:wrap}',
  '.adm-act{padding:.42rem .9rem;border:1px solid rgba(255,255,255,.3);border-radius:4px;background:rgba(255,255,255,.15);color:#fff;font-size:.8rem;font-weight:600;cursor:pointer;transition:all .15s}',
  '.adm-act:hover{background:rgba(255,255,255,.25)}',
  '.adm-act-pri{background:#ffc107;border-color:#e0a800;color:#000}',
  '.adm-act-pri:hover{background:#ffca28}',
  '.adm-act-save{background:#27ae60;border-color:#219a52;color:#fff}',
  '.adm-act-save:hover{background:#2ecc71}',
  '.adm-act-warn{background:#d35400;border-color:#ba4a00;color:#fff}',
  '.adm-act-warn:hover{background:#e67e22}',
  '.adm-act-tog{background:#8e44ad;border-color:#7d3c98;color:#fff}',
  '.adm-act-tog:hover{background:#9b59b6}',
  '.adm-act-del{background:#c0392b;border-color:#a93226;color:#fff}',
  '.adm-act-del:hover{background:#e74c3c}',
  '.adm-sep{width:1px;height:24px;background:rgba(255,255,255,.2);margin:0 .3rem}',
  '.adm-audit-wrap{display:flex;flex-direction:column;height:100%}',
  '.adm-audit-filters{display:flex;gap:1rem;padding:.8rem 1rem;background:#f0f4f8;border-bottom:1px solid #a8c4e0;align-items:flex-end;flex-wrap:wrap}',
  '.adm-audit-table-wrap{flex:1;overflow-y:auto}',
  '.adm-audit-tbl .adm-td{font-size:.79rem}',
  '.adm-stats-wrap{padding:1rem;display:flex;flex-direction:column;gap:1.5rem;overflow-y:auto}',
  '.adm-stats-head{font-weight:700;font-size:.9rem;color:#1e5a8a;margin-bottom:.8rem;padding-bottom:.4rem;border-bottom:2px solid #a8c4e0;text-transform:uppercase;letter-spacing:.05em}',
  '.adm-stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.8rem}',
  '.adm-stat-card{background:#fff;border:1px solid #dde6f0;border-radius:8px;padding:1rem;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.05)}',
  '.adm-stat-icon{font-size:1.6rem;margin-bottom:.4rem}',
  '.adm-stat-val{font-size:2rem;font-weight:900;line-height:1;margin-bottom:.3rem}',
  '.adm-stat-lbl{font-size:.77rem;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:.04em}',
  '.adm-err{padding:1rem;color:#b91c1c;background:#fee2e2;border-radius:5px;margin:1rem}',
  '@media(max-width:680px){.adm-fg-grid{grid-template-columns:1fr}.adm-list-wrap{max-height:160px}}'
  ].join('');
  document.head.appendChild(s);
}
