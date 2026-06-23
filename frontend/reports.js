/**
 * Reports Module - Frontend
 * Handles customised reporting with modular selection
 */

var currentCustomReportData = null;

/**
 * Load Reports UI - Main entry point
 */
function buildReportsDashboard() {
  // Navigation to section is handled by workflow/showSec('sreports')
  _buildRepOrgIndex();
  
  // Reset UI
  document.getElementById('repEmpty').style.display = 'block';
  document.getElementById('repResults').style.display = 'none';
  document.getElementById('repDetail').style.display = 'none';
  
  // Clear search
  const searchInp = document.getElementById('repSearch');
  if (searchInp) searchInp.value = '';
}

/**
 * Toggle all module checkboxes
 */
function selectAllRepModules(val) {
  const cbs = document.querySelectorAll('#rep-module-checkboxes input[type="checkbox"]');
  cbs.forEach(cb => cb.checked = val);
}

/**
 * Generate Custom Report based on selected modules
 */
function generateCustomReport() {
  const orgName = document.getElementById('repSearch').value.trim();
  if (!orgName) {
    toast2('Please select or enter an organisation name', true);
    return;
  }

  const resultsCont = document.getElementById('repResults');
  const emptyCont = document.getElementById('repEmpty');
  const detailCont = document.getElementById('repDetail');

  emptyCont.style.display = 'none';
  detailCont.style.display = 'none';
  resultsCont.style.display = 'block';
  resultsCont.innerHTML = `
    <div style="padding:3rem; text-align:center; color:var(--slate)">
      <div style="font-size:2rem; margin-bottom:1rem; animation: pulse 1.5s infinite">📊</div>
      <div style="font-weight:700; color:var(--gold2)">Generating Custom Report...</div>
      <p style="font-size:.85rem; margin-top:.5rem">Fetching data for ${orgName}</p>
    </div>
  `;

  // Get selected modules
  const selectedModules = {
    validation: document.getElementById('rm-validation').checked,
    assessment: document.getElementById('rm-assessment').checked,
    gaps: document.getElementById('rm-gaps').checked,
    sga: document.getElementById('rm-sga').checked,
    ropa: document.getElementById('rm-ropa').checked,
    dpia: document.getElementById('rm-dpia').checked,
    dept: document.getElementById('rm-dept').checked,
    tech: document.getElementById('rm-tech').checked,
    rems: document.getElementById('rm-rems').checked,
    assets: document.getElementById('rm-assets').checked,
    kpi: document.getElementById('rm-kpi').checked,
    cia: document.getElementById('rm-cia').checked,
    raci: document.getElementById('rm-raci').checked
  };

  // Fetch data from backend
  apiReq('GET', '/reports/organization/' + encodeURIComponent(orgName))
    .then(r => {
      if (r.error || !r.report) {
        throw new Error(r.error || 'Failed to fetch report data');
      }
      currentCustomReportData = r.report;
      renderCustomisedReport(r.report, selectedModules);
    })
    .catch(err => {
      console.error(err);
      resultsCont.innerHTML = `
        <div style="padding:2rem; text-align:center; color:var(--red2)">
          <div style="font-size:3rem; margin-bottom:1rem">⚠️</div>
          <div style="font-weight:700">Error Generating Report</div>
          <p style="font-size:.85rem; margin-top:.5rem">${err.message}</p>
          <button class="bsm" style="margin-top:1rem" onclick="document.getElementById('repEmpty').style.display='block'; document.getElementById('repResults').style.display='none'">Try Again</button>
        </div>
      `;
    });
}

/**
 * Render the customised report output
 */
function renderCustomisedReport(data, modules) {
  const container = document.getElementById('repResults');
  let html = '';

  // 1. Report Cover / Header with Download Buttons
  html += `
    <div class="card" style="margin-bottom:1.5rem; background:linear-gradient(to bottom right, var(--bg2), rgba(0,0,0,0.4)); border-left:4px solid var(--gold2)">
      <div class="cb2" style="padding:1.5rem">
        <div style="display:flex; justify-content:space-between; align-items:flex-start">
          <div style="flex:1">
            <h1 style="margin:0; color:var(--gold2); font-size:1.8rem">Compliance Performance Report</h1>
            <div style="font-size:1rem; color:var(--white2); margin-top:.3rem; font-weight:700">${data.organization_name}</div>
            <div style="font-size:.8rem; color:var(--gold2); margin-top:.3rem; font-weight:700">Registration Number: ${data.organization_registration_number || data.organization_license_number || 'N/A'}</div>
            <div style="font-size:.8rem; color:var(--gold2); margin-top:.1rem; font-weight:700">License Number: ${data.organization_license_number || 'N/A'}</div>
            <div style="font-size:.75rem; color:var(--slate); margin-top:.5rem">Report Period: ${document.getElementById('rep-date-from').value || 'All Time'} to ${document.getElementById('rep-date-to').value || 'Present'}</div>
            <div style="font-size:.7rem; color:var(--slate); margin-top:.2rem">Generated: ${new Date().toLocaleString()}</div>
            <div style="margin-top:1rem; display:flex; gap:.5rem; flex-wrap:wrap">
              <button class="bsm" onclick="downloadReportJSON()" style="background:var(--blue2); font-size:.75rem; padding:.4rem .6rem">📥 JSON</button>
              <button class="bsm" onclick="downloadReportCSV()" style="background:var(--green2); font-size:.75rem; padding:.4rem .6rem">📥 CSV All</button>
              <button class="bsm" onclick="downloadAllForms()" style="background:var(--amber2); font-size:.75rem; padding:.4rem .6rem; color:black">📋 All Forms</button>
              <button class="bsm" onclick="window.print()" style="background:var(--slate); font-size:.75rem; padding:.4rem .6rem">🖨️ Print</button>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:.65rem; color:var(--slate); text-transform:uppercase; letter-spacing:0.1em">Overall Health</div>
            <div style="font-size:2.5rem; font-weight:900; color:${data.overall_compliance_status.health_score >= 80 ? 'var(--green2)' : 'var(--amber2)'}">${data.overall_compliance_status.health_score || 0}%</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // 2. Executive Summary (Always included)
  html += `
    <div class="crep-module-section">
      <div class="crep-module-header">
        <span class="crep-module-title">🎯 Executive Summary</span>
      </div>
      <div class="crep-module-body">
        <div class="crep-score-grid">
          <div class="crep-score-card">
            <div class="crep-score-val" style="color:var(--gold2)">${data.compliance_assessments.average_score || 0}%</div>
            <div class="crep-score-lbl">Compliance Score</div>
          </div>
          <div class="crep-score-card">
            <div class="crep-score-val" style="color:var(--green2)">${data.security_gap_analysis.overall_score || 0}%</div>
            <div class="crep-score-lbl">Security Score</div>
          </div>
          <div class="crep-score-card">
            <div class="crep-score-val" style="color:var(--blue2)">${data.department_assessments.average_score || 0}%</div>
            <div class="crep-score-lbl">Dept Audit Avg</div>
          </div>
          <div class="crep-score-card">
            <div class="crep-score-val" style="color:var(--red2)">${data.gap_analysis.by_priority.critical || 0}</div>
            <div class="crep-score-lbl">Critical Gaps</div>
          </div>
        </div>
        <div style="padding:1rem; background:rgba(212,175,55,0.05); border:1px solid rgba(212,175,55,0.1); border-radius:6px">
          <div style="font-size:.75rem; color:var(--gold2); font-weight:700; text-transform:uppercase; margin-bottom:.3rem">System Recommendation</div>
          <div style="font-size:.9rem; color:var(--white2)">${data.overall_compliance_status.recommended_action}</div>
        </div>
      </div>
    </div>
  `;

  // 2.5. Controller Details
  const cd = data.controller_details || {};
  html += `
    <div class="crep-module-section">
      <div class="crep-module-header">
        <span class="crep-module-title">🏢 Organisation Details</span>
      </div>
      <div class="crep-module-body">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem">
          <!-- Organisation Name -->
          <div>
            <div style="font-size:.7rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.3rem">Organisation Name</div>
            <div style="font-weight:700">${data.organization_name || 'N/A'}</div>
          </div>
          <!-- Estimated No. of Data Subjects -->
          <div>
            <div style="font-size:.7rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.3rem">Estimated No. of Data Subjects</div>
            <div style="font-weight:700">${cd.num_data_subjects || 'N/A'}</div>
          </div>
          <!-- Organisation Registration Number -->
          <div>
            <div style="font-size:.7rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.3rem">Organisation Registration Number</div>
            <div style="font-weight:700; color:var(--gold2)">${cd.registration_number || data.organization_registration_number || 'N/A'}</div>
          </div>
          <!-- Controller Name -->
          <div>
            <div style="font-size:.7rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.3rem">Controller Name</div>
            <div style="font-weight:700">${cd.controller_name || 'N/A'}</div>
          </div>
          <!-- Registered Address (full width) -->
          <div style="grid-column:1/-1">
            <div style="font-size:.7rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.3rem">Registered Address</div>
            <div style="font-weight:700">${cd.controller_address || 'N/A'}</div>
          </div>
          <!-- Controller Contact -->
          <div>
            <div style="font-size:.7rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.3rem">Controller Contact</div>
            <div style="font-weight:700">${cd.controller_contact || 'N/A'}</div>
          </div>
          <!-- DPO Name -->
          <div>
            <div style="font-size:.7rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.3rem">DPO Name</div>
            <div style="font-weight:700">${cd.dpo_name || 'N/A'}</div>
          </div>
          <!-- DPO Contact -->
          <div>
            <div style="font-size:.7rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.3rem">DPO Contact</div>
            <div style="font-weight:700">${cd.dpo_contact || 'N/A'}</div>
          </div>
          <!-- DPO Practice Number -->
          <div>
            <div style="font-size:.7rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.3rem">DPO Practice Number</div>
            <div style="font-weight:700">${cd.dpo_practice_number || 'N/A'}</div>
          </div>
          <!-- Licence Number -->
          <div>
            <div style="font-size:.7rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.3rem">Licence Number</div>
            <div style="font-weight:700; color:var(--gold2)">${cd.license_number || cd.controller_license_number || data.organization_license_number || 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // 3. Controller Validation
  if (modules.validation) {
    const v = data.validations || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">✅ Controller Validation (${v.details.length})</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${v.details.length === 0 ? '<p style="color:var(--slate); font-size:.8rem">No validation records found.</p>' : `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Controller</th>
                  <th>Score</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                ${v.details.map(item => `
                  <tr>
                    <td>${new Date(item.validated_at || item.time).toLocaleDateString()}</td>
                    <td>${item.controller_name || data.organization_name}</td>
                    <td style="font-weight:700; color:${item.weighted_score >= 80 ? 'var(--green2)' : 'var(--amber2)'}">${item.weighted_score}%</td>
                    <td><span style="padding:.1rem .4rem; border-radius:4px; font-size:.65rem; background:${item.is_valid ? 'var(--green2)' : 'var(--red2)'}; color:white">${item.is_valid ? 'PASSED' : 'FAILED'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  // 4. Compliance Assessments
  if (modules.assessment) {
    const a = data.compliance_assessments || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">📋 Compliance Assessments (${a.total})</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${a.details.length === 0 ? '<p style="color:var(--slate); font-size:.8rem">No assessments found.</p>' : `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>License Number</th>
                  <th>Registration #</th>
                  <th>DPO Name</th>
                  <th>Date</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                ${a.details.map(item => `
                  <tr>
                    <td style="font-weight:700; color:var(--gold2)">${item.license_number || 'N/A'}</td>
                    <td style="font-weight:700; color:var(--gold2)">${item.registration_number || 'N/A'}</td>
                    <td>${item.dpo_name || 'N/A'}</td>
                    <td>${new Date(item.created_at).toLocaleDateString()}</td>
                    <td>#${item.id}</td>
                    <td style="text-transform:capitalize">${item.status}</td>
                    <td style="font-weight:700; color:${item.overall_score >= 70 ? 'var(--green2)' : 'var(--red2)'}">${item.overall_score || 0}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  // 5. Gap Analysis
  if (modules.gaps) {
    const g = data.gap_analysis || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">⚠️ Gap Analysis (${g.total})</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${g.details.length === 0 ? '<p style="color:var(--slate); font-size:.8rem">No gaps found.</p>' : `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>License Number</th>
                  <th>Registration #</th>
                  <th>Priority</th>
                  <th>Gap Description</th>
                  <th>Status</th>
                  <th>Date Found</th>
                </tr>
              </thead>
              <tbody>
                ${g.details.map(item => `
                  <tr>
                    <td style="font-weight:700; color:var(--gold2)">${item.license_number || 'N/A'}</td>
                    <td style="font-weight:700; color:var(--gold2)">${item.registration_number || 'N/A'}</td>
                    <td><span style="color:${item.priority === 'critical' ? 'var(--red2)' : item.priority === 'high' ? 'var(--amber2)' : 'var(--gold2)'}">${(item.priority || 'med').toUpperCase()}</span></td>
                    <td>${item.gap_description || item.text}</td>
                    <td>${(item.status || 'open').toUpperCase()}</td>
                    <td>${new Date(item.created_at).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  // 6. Security Gap Analysis
  if (modules.sga) {
    const s = data.security_gap_analysis || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">🛡️ Security Gap Analysis (${s.total_items || 0} Controls)</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          <div class="crep-score-grid" style="margin-bottom:1.5rem">
            <div class="crep-score-card">
              <div class="crep-score-val" style="color:var(--green2)">${s.in_place || 0}</div>
              <div class="crep-score-lbl">In Place</div>
            </div>
            <div class="crep-score-card">
              <div class="crep-score-val" style="color:var(--amber2)">${s.partial || 0}</div>
              <div class="crep-score-lbl">Partial</div>
            </div>
            <div class="crep-score-card">
              <div class="crep-score-val" style="color:var(--red2)">${s.not_in_place || 0}</div>
              <div class="crep-score-lbl">Missing</div>
            </div>
          </div>
          ${s.by_domain && s.by_domain.length > 0 ? `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>Domain/Category</th>
                  <th>Progress</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                ${s.by_domain.map(d => `
                  <tr>
                    <td>${d.domain_category}</td>
                    <td>${d.in_place || d.in_place_yes}/${d.total || d.total_items}</td>
                    <td style="font-weight:700">${Math.round(((parseInt(d.in_place || d.in_place_yes) + parseInt(d.partial || d.in_place_partial || 0)*0.5) / parseInt(d.total || d.total_items)) * 100)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 7. ROPA
  if (modules.ropa) {
    const r = data.ropa_records || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">📝 ROPA Records (${r.total})</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${r.details.length === 0 ? '<p style="color:var(--slate); font-size:.8rem">No ROPA records found.</p>' : `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>DPO Name</th>
                  <th>Activities</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                ${r.details.map(item => `
                  <tr>
                    <td>${item.dpo_name || 'Not Set'}</td>
                    <td>${item.activity_count || 0}</td>
                    <td style="text-transform:capitalize">${item.status}</td>
                    <td>${new Date(item.created_at).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  // 8. DPIA
  if (modules.dpia) {
    const d = data.dpia_assessments || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">🔎 DPIA Assessments (${d.total})</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${d.details.length === 0 ? '<p style="color:var(--slate); font-size:.8rem">No DPIA assessments found.</p>' : `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Risk Level</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${d.details.map(item => `
                  <tr>
                    <td style="font-weight:700">${item.project_name || 'DPIA'}</td>
                    <td><span style="color:${item.overall_risk_level === 'critical' ? 'var(--red2)' : item.overall_risk_level === 'high' ? 'var(--amber2)' : 'var(--green2)'}">${(item.overall_risk_level || 'med').toUpperCase()}</span></td>
                    <td style="text-transform:capitalize">${item.status}</td>
                    <td>${new Date(item.created_at).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  // 9. Department Assessments
  if (modules.dept) {
    const da = data.department_assessments || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">🏢 Departmental Audits (${da.total})</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${da.details.length === 0 ? '<p style="color:var(--slate); font-size:.8rem">No departmental assessments found.</p>' : `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>HOD/Manager</th>
                  <th>Score</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${da.details.map(item => `
                  <tr>
                    <td style="font-weight:700">${item.department_name}</td>
                    <td>${item.assessor || item.mgr || 'N/A'}</td>
                    <td style="font-weight:700; color:${item.overall_score >= 80 ? 'var(--green2)' : 'var(--amber2)'}">${item.overall_score || 0}%</td>
                    <td>${new Date(item.created_at || item.timestamp).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  // 10. Technical Recommendations
  if (modules.tech) {
    const tech = data.technical_recommendations || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">💡 Technical Recommendations (${tech.total || 0})</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${tech.details.length === 0 ? '<p style="color:var(--slate); font-size:.8rem">No technical recommendations found.</p>' : `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem">
              <div>
                <div style="font-size:.8rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.5rem">Electronic Systems</div>
                <div style="font-size:.85rem; color:var(--white)">${tech.details.filter(t => t.type === 'electronic').map(t => `
                  <div style="margin-bottom:.8rem; padding:.6rem; background:var(--bg2); border-radius:4px">
                    <div style="font-weight:700">${t.tech_data?.category || 'N/A'}</div>
                    <div style="font-size:.75rem; margin-top:.3rem">${t.tech_data?.description || 'N/A'}</div>
                    <div style="font-size:.7rem; color:var(--gold2); margin-top:.3rem">Priority: ${t.tech_data?.priority || 'Medium'}</div>
                  </div>
                `).join('')}</div>
              </div>
              <div>
                <div style="font-size:.8rem; color:var(--slate); text-transform:uppercase; font-weight:700; margin-bottom:.5rem">Manual/Paper Systems</div>
                <div style="font-size:.85rem; color:var(--white)">${tech.details.filter(t => t.type === 'manual').map(t => `
                  <div style="margin-bottom:.8rem; padding:.6rem; background:var(--bg2); border-radius:4px">
                    <div style="font-weight:700">${t.tech_data?.category || 'N/A'}</div>
                    <div style="font-size:.75rem; margin-top:.3rem">${t.tech_data?.description || 'N/A'}</div>
                    <div style="font-size:.7rem; color:var(--gold2); margin-top:.3rem">Priority: ${t.tech_data?.priority || 'Medium'}</div>
                  </div>
                `).join('')}</div>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // 11. Remediation Plans
  if (modules.rems) {
    // Note: If backend doesn't aggregate remediation plans in data.remediation_plans, we'll need to fetch them
    // For now we check data.remediation_plans or details inside dept
    const rems = data.remediation_plans || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">🚧 Remediation Plans</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${rems.details && rems.details.length > 0 ? `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Dept</th>
                  <th>Priority</th>
                  <th>Target Date</th>
                </tr>
              </thead>
              <tbody>
                ${rems.details.map(item => `
                  <tr>
                    <td>${item.action_required || item.rem}</td>
                    <td>${item.department_name || item.dept}</td>
                    <td style="font-weight:700">${(item.priority || 'med').toUpperCase()}</td>
                    <td>${item.target_date || 'TBD'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color:var(--slate); font-size:.8rem">No remediation plans listed for this report.</p>'}
        </div>
      </div>
    `;
  }

  // 12. Information Assets
  if (modules.assets) {
    const assets = data.assets || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">📦 Information Assets (${assets.total || 0})</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${assets.details.length === 0 ? '<p style="color:var(--slate); font-size:.8rem">No asset records found.</p>' : `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>Asset Name</th>
                  <th>Type</th>
                  <th>Owner</th>
                  <th>Classification</th>
                </tr>
              </thead>
              <tbody>
                ${assets.details.map(item => `
                  <tr>
                    <td style="font-weight:700">${item.asset_name || item.name}</td>
                    <td>${item.asset_type || '-'}</td>
                    <td>${item.owner || '-'}</td>
                    <td>${(item.classification || '-').toUpperCase()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  // 13. KPI Tracking
  if (modules.kpi) {
    const kpis = data.kpi_tracking || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">📈 KPI Tracking</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${kpis.details && kpis.details.length > 0 ? `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>KPI Indicator</th>
                  <th>Actual Value</th>
                  <th>Target</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${kpis.details.map(item => `
                  <tr>
                    <td style="font-weight:700">${item.kpi_name}</td>
                    <td>${item.actual_value}</td>
                    <td>${item.target_value || '-'}</td>
                    <td>${item.status || 'Active'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color:var(--slate); font-size:.8rem">No KPI metrics tracked for this report.</p>'}
        </div>
      </div>
    `;
  }

  // 14. CIA
  if (modules.cia) {
    const cia = data.cia_data || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">🔒 CIA Assessment</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${cia.details && cia.details.length > 0 ? `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>Asset/System</th>
                  <th>C</th>
                  <th>I</th>
                  <th>A</th>
                  <th>Weighted Risk</th>
                </tr>
              </thead>
              <tbody>
                ${cia.details.map(item => `
                  <tr>
                    <td>${item.asset_name}</td>
                    <td>${(item.confidentiality || 'L').charAt(0).toUpperCase()}</td>
                    <td>${(item.integrity || 'L').charAt(0).toUpperCase()}</td>
                    <td>${(item.availability || 'L').charAt(0).toUpperCase()}</td>
                    <td style="text-transform:capitalize">${item.risk_assessment || 'Low'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color:var(--slate); font-size:.8rem">No CIA data available.</p>'}
        </div>
      </div>
    `;
  }

  // 15. RACI
  if (modules.raci) {
    const r = data.raci_matrix || { details: [] };
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)">
          <span class="crep-module-title">📋 RACI Matrix (${r.total || 0} Entries)</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          ${r.details.length === 0 ? '<p style="color:var(--slate); font-size:.8rem">No RACI matrix entries found.</p>' : `
            <table class="crep-table">
              <thead>
                <tr>
                  <th>Process Name</th>
                  <th>Role</th>
                  <th style="text-align:center">R</th>
                  <th style="text-align:center">A</th>
                  <th style="text-align:center">C</th>
                  <th style="text-align:center">I</th>
                </tr>
              </thead>
              <tbody>
                ${r.details.map(item => `
                  <tr>
                    <td style="font-weight:700">${item.process_name}</td>
                    <td>${item.role}</td>
                    <td style="text-align:center">${item.responsible_party ? '●' : ''}</td>
                    <td style="text-align:center">${item.accountable_party ? '●' : ''}</td>
                    <td style="text-align:center">${item.consulted_parties ? '●' : ''}</td>
                    <td style="text-align:center">${item.informed_parties ? '●' : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  // Assessor Comments Section
  if (data.assessor_comments && data.assessor_comments.length > 0) {
    html += `
      <div class="crep-module-section">
        <div class="crep-module-header" onclick="toggleCrepBody(this)" style="background: linear-gradient(90deg, rgba(155, 89, 182, 0.15), transparent); border-left: 4px solid #9b59b6; cursor:pointer;">
          <span class="crep-module-title" style="color: #c39bd3;">🔍 POTRAZ Assessor Comments & Reviews (${data.assessor_comments.length})</span>
          <span style="font-size:.7rem; color:var(--slate)">▼</span>
        </div>
        <div class="crep-module-body">
          <div style="display:flex; flex-direction:column; gap:1rem;">
            ${data.assessor_comments.map(c => {
              const typeColors = {
                general: '#7f8c8d',
                compliance: '#3498db',
                dpo: '#2ecc71',
                risk: '#e74c3c'
              };
              const badgeColor = typeColors[c.comment_type] || '#7f8c8d';
              return `
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--bdr); border-radius:6px; padding:1rem; border-left: 3px solid ${badgeColor}">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.5rem;">
                    <div style="display:flex; align-items:center; gap:.5rem;">
                      <span style="font-weight:700; color:var(--white); font-size:.9rem">${c.assessor_username}</span>
                      <span style="background:${badgeColor}; color:white; font-size:.65rem; padding:.2rem .4rem; border-radius:3px; text-transform:uppercase; font-weight:700">${c.comment_type}</span>
                    </div>
                    <span style="font-size:.75rem; color:var(--slate)">${new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style="margin:0; font-size:.85rem; color:var(--white2); line-height:1.5; white-space:pre-wrap;">${c.comment_text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // 4. Footer Disclaimer
  html += `
    <div style="margin-top:2rem; padding:1rem; border-top:1px solid var(--bdr); text-align:center; color:var(--slate); font-size:.7rem">
      CONFIDENTIAL COMPLIANCE REPORT - This document is intended for internal use only by ${data.organization_name}.
      Generated by CDPA Compliance Management System.
    </div>
  `;

  container.innerHTML = html;
}

/**
 * UI Helper: Toggle section accordion
 */
function toggleCrepBody(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector('span:last-child');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    arrow.textContent = '▼';
  } else {
    body.style.display = 'none';
    arrow.textContent = '▶';
  }
}

/**
 * Export current report as PDF (Print)
 */
function exportCustomReport() {
  if (!currentCustomReportData) {
    toast2('Please generate a report first', true);
    return;
  }
  window.print();
}

/**
 * Export report to text format
 */
function exportCustomReportText() {
  if (!currentCustomReportData) {
    toast2('Please generate a report first', true);
    return;
  }
  
  const d = currentCustomReportData;
  const lines = [];
  lines.push('====================================================');
  lines.push('COMPLIANCE PERFORMANCE REPORT');
  lines.push('Organisation: ' + d.organization_name);
  lines.push('Generated: ' + new Date().toLocaleString());
  lines.push('Overall Health: ' + d.overall_compliance_status.health_score + '%');
  lines.push('====================================================');
  lines.push('');
  lines.push('CONTROLLER DETAILS');
  lines.push('Controller Name: ' + (d.controller_details?.controller_name || 'N/A'));
  lines.push('Registration Number: ' + (d.controller_details?.registration_number || d.organization_registration_number || d.controller_details?.controller_license_number || d.controller_details?.license_number || d.organization_license_number || 'N/A'));
  lines.push('License Number: ' + (d.controller_details?.controller_license_number || d.controller_details?.license_number || d.organization_license_number || 'N/A'));
  lines.push('Contact Number: ' + (d.controller_details?.controller_contact_number || 'N/A'));
  lines.push('Primary Contact: ' + (d.controller_details?.controller_contact || 'N/A'));
  lines.push('Address: ' + (d.controller_details?.controller_address || 'N/A'));
  lines.push('DPO Name: ' + (d.controller_details?.dpo_name || 'N/A'));
  lines.push('DPO Contact: ' + (d.controller_details?.dpo_contact || 'N/A'));
  lines.push('');
  lines.push('EXECUTIVE SUMMARY');
  lines.push('Compliance: ' + (d.compliance_assessments.average_score || 0) + '%');
  lines.push('Security: ' + (d.security_gap_analysis.overall_score || 0) + '%');
  lines.push('Dept Audit: ' + (d.department_assessments.average_score || 0) + '%');
  lines.push('Recommendation: ' + d.overall_compliance_status.recommended_action);
  lines.push('');
  
  // Download file
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Compliance_Report_' + d.organization_name.replace(/\s+/g,'_') + '.txt';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ─── HELPER FUNCTIONS FROM PREVIOUS REPORTS.JS ────────────────────────

var _repOrgList = [];

function _buildRepOrgIndex() {
  var map = {};
  if (typeof CU !== 'undefined' && CU.org) map[CU.org.trim()] = true;
  
  // Fetch from API
  if (typeof API_TOKEN !== 'undefined' && API_TOKEN) {
    apiReq('GET', '/reports/organizations').then(r => {
      if (r && r.organizations) {
        r.organizations.forEach(o => { map[o.organization_name.trim()] = true; });
        _repOrgList = Object.keys(map).sort();
      }
    }).catch(e => console.warn('API org index fetch failed', e));
  }
}

function searchOrgReports(val) {
  const box = document.getElementById('repSuggestBox');
  const cb = document.getElementById('repClearBtn');
  if (cb) cb.style.display = val ? 'block' : 'none';
  if (!val || !val.trim()) {
    if (box) box.style.display = 'none';
    return;
  }
  const q = val.trim().toLowerCase();
  const matches = _repOrgList.filter(o => o.toLowerCase().indexOf(q) >= 0);
  
  let html = matches.map(m => `
    <div class="rep-sug" onclick="selectOrgReport('${m.replace(/'/g, "\\'")}')">${m}</div>
  `).join('');
  
  if (matches.length === 0) {
    html += `<div class="rep-sug" style="color:var(--gold2)" onclick="selectOrgReport('${val.replace(/'/g, "\\'")}')">🔍 Use "${val}"</div>`;
  }
  
  box.innerHTML = html;
  box.style.display = 'block';
}

function selectOrgReport(name) {
  const inp = document.getElementById('repSearch');
  if (inp) inp.value = name;
  const box = document.getElementById('repSuggestBox');
  if (box) box.style.display = 'none';
  const cb = document.getElementById('repClearBtn');
  if (cb) cb.style.display = 'block';
}

function clearRepSearch() {
  const inp = document.getElementById('repSearch');
  if (inp) { inp.value = ''; inp.focus(); }
  searchOrgReports('');
}

/**
 * Download entire report as JSON
 */
function downloadReportJSON() {
  if (!currentCustomReportData) {
    toast2('Please generate a report first', true);
    return;
  }
  
  const data = currentCustomReportData;
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Compliance_Report_${data.organization_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
  
  toast2('Report downloaded as JSON ✓');
}

/**
 * Convert array of objects to CSV
 */
function arrayToCSV(headers, rows) {
  let csv = headers.map(h => `"${h}"`).join(',') + '\n';
  rows.forEach(row => {
    csv += headers.map(h => {
      const val = row[h] === undefined || row[h] === null ? '' : String(row[h]).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',') + '\n';
  });
  return csv;
}

/**
 * Download all forms and activities as CSV
 */
function downloadReportCSV() {
  if (!currentCustomReportData) {
    toast2('Please generate a report first', true);
    return;
  }
  
  const d = currentCustomReportData;
  const timestamp = new Date().toISOString().split('T')[0];
  const orgName = d.organization_name.replace(/\s+/g, '_');
  
  // Create a combined CSV with multiple sections
  const sections = [];
  
  // 0. Controller Details
  sections.push({
    name: 'Controller Details',
    headers: ['Field', 'Value'],
    rows: [
      { Field: 'Controller Name', Value: d.controller_details?.controller_name || 'N/A' },
      { Field: 'Registration Number', Value: d.controller_details?.registration_number || d.organization_registration_number || d.controller_details?.controller_license_number || d.controller_details?.license_number || d.organization_license_number || 'N/A' },
      { Field: 'License Number', Value: d.controller_details?.controller_license_number || d.controller_details?.license_number || d.organization_license_number || 'N/A' },
      { Field: 'Contact Number', Value: d.controller_details?.controller_contact_number || 'N/A' },
      { Field: 'Primary Contact', Value: d.controller_details?.controller_contact || 'N/A' },
      { Field: 'Address', Value: d.controller_details?.controller_address || 'N/A' },
      { Field: 'DPO Name', Value: d.controller_details?.dpo_name || 'N/A' },
      { Field: 'DPO Contact', Value: d.controller_details?.dpo_contact || 'N/A' }
    ]
  });
  
  // 1. Summary Sheet
  sections.push({
    name: 'Summary',
    headers: ['Metric', 'Value'],
    rows: [
      { Metric: 'Organization', Value: d.organization_name },
      { Metric: 'Report Date', Value: new Date().toLocaleString() },
      { Metric: 'Overall Health Score', Value: d.overall_compliance_status.health_score },
      { Metric: 'Compliance Score', Value: d.compliance_assessments.average_score || 'N/A' },
      { Metric: 'Security Score', Value: d.security_gap_analysis.overall_score || 'N/A' },
      { Metric: 'Department Score', Value: d.department_assessments.average_score || 'N/A' },
      { Metric: 'Critical Gaps', Value: d.gap_analysis.by_priority.critical || 0 },
      { Metric: 'Recommendation', Value: d.overall_compliance_status.recommended_action }
    ]
  });
  
  // 2. Validations
  if (d.validations && d.validations.details && d.validations.details.length > 0) {
    sections.push({
      name: 'Validations',
      headers: ['Date', 'Controller', 'Score', 'Valid', 'Licensing Tier', 'Data Subjects', 'Registration Fee'],
      rows: d.validations.details.map(v => ({
        Date: new Date(v.validated_at).toLocaleDateString(),
        Controller: v.controller_name || d.organization_name,
        Score: v.weighted_score,
        Valid: v.is_valid ? 'Yes' : 'No',
        'Licensing Tier': v.licensing_tier || '-',
        'Data Subjects': v.num_data_subjects || '-',
        'Registration Fee': v.registration_fee || '-'
      }))
    });
  }
  
  // 3. Compliance Assessments
  if (d.compliance_assessments && d.compliance_assessments.details && d.compliance_assessments.details.length > 0) {
    sections.push({
      name: 'Assessments',
      headers: ['License Number', 'ID', 'Date', 'Score', 'Level', 'Status', 'Submitted', 'Reviewed'],
      rows: d.compliance_assessments.details.map(a => ({
        'License Number': a.license_number || 'N/A',
        ID: a.id,
        Date: new Date(a.created_at).toLocaleDateString(),
        Score: a.overall_score || 'N/A',
        Level: a.compliance_level || '-',
        Status: a.status,
        Submitted: a.submitted_at ? 'Yes' : 'No',
        Reviewed: a.reviewed_at ? 'Yes' : 'No'
      }))
    });
  }
  
  // 4. Gap Analysis
  if (d.gap_analysis && d.gap_analysis.details && d.gap_analysis.details.length > 0) {
    sections.push({
      name: 'Gaps',
      headers: ['Area', 'Description', 'Priority', 'Status', 'Responsible', 'Target Date'],
      rows: d.gap_analysis.details.map(g => ({
        Area: g.gap_area || '-',
        Description: g.gap_description || '-',
        Priority: g.priority || '-',
        Status: g.status || '-',
        Responsible: g.responsible_person || '-',
        'Target Date': g.target_date || '-'
      }))
    });
  }
  
  // 5. ROPA Records & Activities
  if (d.ropa_records && d.ropa_records.details && d.ropa_records.details.length > 0) {
    sections.push({
      name: 'ROPA',
      headers: ['Organization', 'Controller', 'DPO', 'Status', 'Activities', 'Version'],
      rows: d.ropa_records.details.map(r => ({
        Organization: r.organization_name || '-',
        Controller: r.controller_name || '-',
        DPO: r.dpo_name || '-',
        Status: r.status || '-',
        Activities: r.activity_count || 0,
        Version: r.version || '-'
      }))
    });
  }
  
  // 6. DPIA Assessments
  if (d.dpia_assessments && d.dpia_assessments.details && d.dpia_assessments.details.length > 0) {
    sections.push({
      name: 'DPIA',
      headers: ['Project', 'Department', 'Risk Level', 'Status', 'Measures', 'Risks'],
      rows: d.dpia_assessments.details.map(di => ({
        Project: di.project_name || '-',
        Department: di.department || '-',
        'Risk Level': di.overall_risk_level || '-',
        Status: di.status || '-',
        Measures: di.measure_count || 0,
        Risks: di.risk_count || 0
      }))
    });
  }
  
  // 7. Security Gaps
  if (d.security_gap_analysis && d.security_gap_analysis.details && d.security_gap_analysis.details.length > 0) {
    sections.push({
      name: 'Security Gaps',
      headers: ['Domain', 'Item', 'In Place', 'Rating', 'Notes'],
      rows: d.security_gap_analysis.details.map(s => ({
        Domain: s.domain_category || '-',
        Item: s.control_item || '-',
        'In Place': s.in_place || '-',
        Rating: s.rating || '-',
        Notes: s.findings || '-'
      }))
    });
  }
  
  // 8. Department Assessments
  if (d.department_assessments && d.department_assessments.details && d.department_assessments.details.length > 0) {
    sections.push({
      name: 'Dept Assessments',
      headers: ['Department', 'Assessor', 'Score', 'Status', 'Date'],
      rows: d.department_assessments.details.map(da => ({
        Department: da.department_name || '-',
        Assessor: da.assessor || '-',
        Score: da.overall_score || 'N/A',
        Status: da.compliance_status || '-',
        Date: new Date(da.assessment_date || da.created_at).toLocaleDateString()
      }))
    });
  }
  
  // 9. KPI Tracking
  if (d.kpi_tracking && d.kpi_tracking.details && d.kpi_tracking.details.length > 0) {
    sections.push({
      name: 'KPIs',
      headers: ['KPI Name', 'Actual Value', 'Target Value', 'Status'],
      rows: d.kpi_tracking.details.map(k => ({
        'KPI Name': k.kpi_name || '-',
        'Actual Value': k.actual_value || '-',
        'Target Value': k.target_value || '-',
        Status: k.status || 'Active'
      }))
    });
  }
  
  // 10. Assets
  if (d.assets && d.assets.details && d.assets.details.length > 0) {
    sections.push({
      name: 'Assets',
      headers: ['Asset Type', 'Description', 'Location', 'Status'],
      rows: d.assets.details.map(ast => ({
        'Asset Type': ast.asset_type || '-',
        Description: ast.description || '-',
        Location: ast.asset_location || '-',
        Status: ast.status || '-'
      }))
    });
  }
  
  // Create ZIP or single file based on sections
  let masterCSV = '';
  sections.forEach((section, idx) => {
    if (idx > 0) masterCSV += '\n\n';
    masterCSV += `# ${section.name}\n`;
    masterCSV += arrayToCSV(section.headers, section.rows) + '\n';
  });
  
  const blob = new Blob([masterCSV], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Compliance_Report_AllData_${orgName}_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
  
  toast2('All data exported to CSV ✓');
}

/**
 * Download all forms and activities as comprehensive document
 */
function downloadAllForms() {
  if (!currentCustomReportData) {
    toast2('Please generate a report first', true);
    return;
  }
  
  const d = currentCustomReportData;
  let content = [];
  
  content.push('COMPLIANCE MANAGEMENT SYSTEM');
  content.push('COMPREHENSIVE REPORT - ALL FORMS & ACTIVITIES');
  content.push('='.repeat(80));
  content.push('');
  content.push('Organization: ' + d.organization_name);
  content.push('Generated: ' + new Date().toLocaleString());
  content.push('Overall Health Score: ' + d.overall_compliance_status.health_score + '%');
  content.push('');
  content.push('='.repeat(80));
  content.push('');
  
  // 1. Validations
  if (d.validations && d.validations.details && d.validations.details.length > 0) {
    content.push('CONTROLLER VALIDATIONS');
    content.push('-'.repeat(40));
    d.validations.details.forEach((v, i) => {
      content.push(`\n[${i+1}] Controller Validation`);
      content.push(`    Date: ${new Date(v.validated_at).toLocaleString()}`);
      content.push(`    Controller: ${v.controller_name || d.organization_name}`);
      content.push(`    Score: ${v.weighted_score}%`);
      content.push(`    Status: ${v.is_valid ? 'PASSED' : 'FAILED'}`);
      content.push(`    Licensing Tier: ${v.licensing_tier || 'N/A'}`);
      content.push(`    Data Subjects: ${v.num_data_subjects || 'N/A'}`);
      content.push(`    Registration Fee: ${v.registration_fee || 'N/A'}`);
    });
    content.push('\n');
  }
  
  // 2. Compliance Assessments
  if (d.compliance_assessments && d.compliance_assessments.details && d.compliance_assessments.details.length > 0) {
    content.push('COMPLIANCE ASSESSMENTS');
    content.push('-'.repeat(40));
    d.compliance_assessments.details.forEach((a, i) => {
      content.push(`\n[${i+1}] Assessment #${a.id}`);
      content.push(`    License Number: ${a.license_number || 'N/A'}`);
      content.push(`    Date: ${new Date(a.created_at).toLocaleString()}`);
      content.push(`    Overall Score: ${a.overall_score || 'N/A'}%`);
      content.push(`    Compliance Level: ${a.compliance_level || '-'}`);
      content.push(`    Status: ${a.status}`);
      content.push(`    Checklist Responses: ${a.checklist_responses || 0}`);
      if (a.review_notes) content.push(`    Review Notes: ${a.review_notes}`);
    });
    content.push('\n');
  }
  
  // 3. Gap Analysis
  if (d.gap_analysis && d.gap_analysis.details && d.gap_analysis.details.length > 0) {
    content.push('GAP ANALYSIS RESULTS');
    content.push('-'.repeat(40));
    d.gap_analysis.details.forEach((g, i) => {
      content.push(`\n[${i+1}] Gap #${g.id}`);
      content.push(`    Area: ${g.gap_area || '-'}`);
      content.push(`    Description: ${g.gap_description || '-'}`);
      content.push(`    Current State: ${g.current_state || '-'}`);
      content.push(`    Required State: ${g.required_state || '-'}`);
      content.push(`    Priority: ${g.priority || '-'}`);
      content.push(`    Status: ${g.status || '-'}`);
      content.push(`    Target Date: ${g.target_date || '-'}`);
      content.push(`    Responsible: ${g.responsible_person || '-'}`);
      if (g.recommended_action) content.push(`    Action: ${g.recommended_action}`);
    });
    content.push('\n');
  }
  
  // 4. ROPA Records
  if (d.ropa_records && d.ropa_records.details && d.ropa_records.details.length > 0) {
    content.push('RECORDS OF PROCESSING ACTIVITIES');
    content.push('-'.repeat(40));
    d.ropa_records.details.forEach((r, i) => {
      content.push(`\n[${i+1}] ROPA #${r.id}`);
      content.push(`    Organization: ${r.organization_name || '-'}`);
      content.push(`    Controller: ${r.controller_name || '-'}`);
      content.push(`    Controller Address: ${r.controller_address || '-'}`);
      content.push(`    DPO: ${r.dpo_name || '-'}`);
      content.push(`    Status: ${r.status || '-'}`);
      content.push(`    Version: ${r.version || '-'}`);
      content.push(`    Processing Activities: ${r.activity_count || 0}`);
    });
    content.push('\n');
  }
  
  // 5. DPIA Assessments
  if (d.dpia_assessments && d.dpia_assessments.details && d.dpia_assessments.details.length > 0) {
    content.push('DATA PROTECTION IMPACT ASSESSMENTS');
    content.push('-'.repeat(40));
    d.dpia_assessments.details.forEach((di, i) => {
      content.push(`\n[${i+1}] DPIA #${di.id}`);
      content.push(`    Project: ${di.project_name || '-'}`);
      content.push(`    Department: ${di.department || '-'}`);
      content.push(`    Responsible: ${di.responsible_person || '-'}`);
      content.push(`    Business Process: ${di.business_process || '-'}`);
      content.push(`    Risk Level: ${di.overall_risk_level || '-'}`);
      content.push(`    Status: ${di.status || '-'}`);
      content.push(`    Measures: ${di.measure_count || 0}`);
      content.push(`    Risks: ${di.risk_count || 0}`);
      if (di.objectives) content.push(`    Objectives: ${di.objectives}`);
    });
    content.push('\n');
  }
  
  // 6. Security Gap Analysis
  if (d.security_gap_analysis && d.security_gap_analysis.details && d.security_gap_analysis.details.length > 0) {
    content.push('SECURITY GAP ANALYSIS');
    content.push('-'.repeat(40));
    content.push(`Overall Score: ${d.security_gap_analysis.overall_score || 'N/A'}%`);
    content.push(`Total Items: ${d.security_gap_analysis.total_items}`);
    content.push(`In Place: ${d.security_gap_analysis.in_place}`);
    content.push(`Partial: ${d.security_gap_analysis.partial}`);
    content.push(`Not In Place: ${d.security_gap_analysis.not_in_place}`);
    content.push('');
    d.security_gap_analysis.details.forEach((s, i) => {
      content.push(`\n[${i+1}] Control Item`);
      content.push(`    Domain: ${s.domain_category || '-'}`);
      content.push(`    Item: ${s.control_item || '-'}`);
      content.push(`    In Place: ${s.in_place || '-'}`);
      content.push(`    Rating: ${s.rating || '-'}`);
      if (s.findings) content.push(`    Findings: ${s.findings}`);
    });
    content.push('\n');
  }
  
  // 7. Department Assessments
  if (d.department_assessments && d.department_assessments.details && d.department_assessments.details.length > 0) {
    content.push('DEPARTMENT ASSESSMENTS');
    content.push('-'.repeat(40));
    d.department_assessments.details.forEach((da, i) => {
      content.push(`\n[${i+1}] Dept Assessment`);
      content.push(`    Department: ${da.department_name || '-'}`);
      content.push(`    Assessor: ${da.assessor || '-'}`);
      content.push(`    Date: ${new Date(da.assessment_date || da.created_at).toLocaleString()}`);
      content.push(`    Score: ${da.overall_score || 'N/A'}%`);
      content.push(`    Status: ${da.compliance_status || '-'}`);
      if (da.notes) content.push(`    Notes: ${da.notes}`);
    });
    content.push('\n');
  }
  
  // 8. Remediation Plans
  if (d.remediation_plans && d.remediation_plans.details && d.remediation_plans.details.length > 0) {
    content.push('REMEDIATION PLANS');
    content.push('-'.repeat(40));
    d.remediation_plans.details.forEach((rem, i) => {
      content.push(`\n[${i+1}] Remediation Plan`);
      content.push(`    Gap ID: ${rem.gap_id || '-'}`);
      content.push(`    Priority: ${rem.priority || '-'}`);
      content.push(`    Status: ${rem.status || '-'}`);
      if (rem.action_items) content.push(`    Action Items: ${rem.action_items}`);
      if (rem.timeline) content.push(`    Timeline: ${rem.timeline}`);
    });
    content.push('\n');
  }
  
  // 9. RACI Matrix
  if (d.raci_matrix && d.raci_matrix.details && d.raci_matrix.details.length > 0) {
    content.push('RACI MATRIX');
    content.push('-'.repeat(40));
    d.raci_matrix.details.forEach((rac, i) => {
      content.push(`\n[${i+1}] RACI Entry`);
      content.push(`    Process: ${rac.process_name || '-'}`);
      content.push(`    Role: ${rac.role || '-'}`);
      content.push(`    Responsibility: ${rac.responsibility || '-'}`);
    });
    content.push('\n');
  }
  
  content.push('\n' + '='.repeat(80));
  content.push('END OF REPORT');
  content.push('Generated by CDPA Compliance Management System');
  
  const text = content.join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `All_Forms_Activities_${d.organization_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
  
  toast2('All forms and activities downloaded ✓');
}

// ─── ASSESSOR COMMENTS MODULE (POTRAZ) ─────────────────

let allCommentsCache = [];

function loadCommentsSection() {
  const container = document.getElementById('scomments');
  if (!container) return;

  // Set loading state
  container.innerHTML = `
    <div class="card" style="margin-bottom: 1.5rem;">
      <div class="ch">
        <h2 style="margin:0; color:var(--gold2); font-size:1.5rem">💬 Assessor & Compliance Comments</h2>
        <p style="margin:0; font-size:.85rem; color:var(--slate)">Loading comments log...</p>
      </div>
    </div>
  `;

  // Fetch comments and orgs in parallel
  Promise.all([
    apiReq('GET', '/api/assessor-comments'),
    apiReq('GET', '/api/reports/organizations')
  ]).then(([commentsRes, orgsRes]) => {
    const comments = commentsRes.comments || [];
    allCommentsCache = comments;
    const orgs = orgsRes.organizations || [];

    const isAssessor = CU && (CU.role === 'potraz_assessor' || CU.role === 'system_administrator');
    const leaveCommentForm = isAssessor ? `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="ch"><h3>✍️ Leave a New Comment</h3></div>
        <div class="cb2" style="padding:1rem; display:grid; grid-template-columns: 1fr 1fr; gap:1.2rem;">
          <div>
            <label style="display:block; font-size:.75rem; color:var(--slate); font-weight:700; margin-bottom:.3rem;">Target Organisation</label>
            <select id="comment-org" style="width:100%; background:rgba(0,0,0,0.25); color:white; border:1px solid var(--bdr); padding:.55rem; border-radius:4px; outline:none; font-family:Arial,sans-serif">
               <option value="">Select Organisation...</option>
               ${orgs.map(o => `<option value="${o.organization_name}">${o.organization_name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block; font-size:.75rem; color:var(--slate); font-weight:700; margin-bottom:.3rem;">Comment Type</label>
            <select id="comment-type" style="width:100%; background:rgba(0,0,0,0.25); color:white; border:1px solid var(--bdr); padding:.55rem; border-radius:4px; outline:none; font-family:Arial,sans-serif">
               <option value="general">General Review</option>
               <option value="compliance">Compliance Assessment</option>
               <option value="dpo">DPO Performance</option>
               <option value="risk">Risk / DPIA</option>
            </select>
          </div>
          <div style="grid-column: 1 / -1;">
            <label style="display:block; font-size:.75rem; color:var(--slate); font-weight:700; margin-bottom:.3rem;">Comment Text</label>
            <textarea id="comment-text" rows="4" style="width:100%; background:rgba(0,0,0,0.25); color:white; border:1px solid var(--bdr); padding:.55rem; border-radius:4px; outline:none; font-family:Arial,sans-serif" placeholder="Write your compliance review, grading or comments..."></textarea>
          </div>
          <div style="grid-column: 1 / -1; display:flex; justify-content:flex-end;">
            <button class="btn-pri" onclick="submitAssessorComment()" style="width:auto; padding:.55rem 1.8rem;">Submit Comment</button>
          </div>
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="ch">
          <h2 style="margin:0; color:var(--gold2); font-size:1.5rem">💬 Assessor & Compliance Comments</h2>
          <p style="margin:0; font-size:.85rem; color:var(--slate)">View and manage comments left by POTRAZ Assessors regarding organizations and DPOs</p>
        </div>
      </div>

      ${leaveCommentForm}

      <div class="card">
        <div class="ch" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.5rem;">
          <h3>📜 Comments Log</h3>
          <div style="display:flex; gap:.5rem;">
            <select id="filter-comment-org" onchange="filterCommentsList()" style="background:var(--bg2); color:white; border:1px solid var(--bdr); padding:.4rem; border-radius:4px; font-size:.8rem; outline:none; font-family:Arial,sans-serif">
               <option value="">All Organisations</option>
               ${orgs.map(o => `<option value="${o.organization_name}">${o.organization_name}</option>`).join('')}
            </select>
            <select id="filter-comment-type" onchange="filterCommentsList()" style="background:var(--bg2); color:white; border:1px solid var(--bdr); padding:.4rem; border-radius:4px; font-size:.8rem; outline:none; font-family:Arial,sans-serif">
               <option value="">All Types</option>
               <option value="general">General</option>
               <option value="compliance">Compliance</option>
               <option value="dpo">DPO Performance</option>
               <option value="risk">Risk</option>
            </select>
          </div>
        </div>
        <div class="cb2" id="comments-list-container" style="padding:1rem;">
           <!-- Comments rendered dynamically -->
        </div>
      </div>
    `;

    renderCommentsSublist(comments);
  }).catch(e => {
    container.innerHTML = `<div class="card" style="padding:2rem; color:var(--red2)">Error loading comments: ${e.message}</div>`;
  });
}

function renderCommentsSublist(comments) {
  const listCont = document.getElementById('comments-list-container');
  if (!listCont) return;

  if (comments.length === 0) {
    listCont.innerHTML = `<div style="text-align:center; color:var(--slate); padding:2rem; font-size:.85rem">No comments found matching filter criteria.</div>`;
    return;
  }

  const typeColors = {
    general: '#7f8c8d',
    compliance: '#3498db',
    dpo: '#2ecc71',
    risk: '#e74c3c'
  };

  listCont.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1.2rem;">
      ${comments.map(c => {
        const badgeColor = typeColors[c.comment_type] || '#7f8c8d';
        const canDelete = CU && (CU.role === 'system_administrator' || (CU.role === 'potraz_assessor' && c.assessor_id === CU.id));
        const deleteBtn = canDelete ? `
          <button class="btn-sec" onclick="deleteAssessorComment(${c.id})" style="width:auto; padding:.25rem .6rem; font-size:.7rem; background:rgba(231,76,60,0.15); color:var(--red2); border-color:rgba(231,76,60,0.3)">Delete</button>
        ` : '';

        return `
          <div class="card" style="background:rgba(255,255,255,0.02); border:1px solid var(--bdr); border-radius:8px; padding:1.2rem; border-left:4px solid ${badgeColor}; display:flex; flex-direction:column; gap:.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:.5rem;">
              <div>
                <span style="font-weight:700; color:var(--white); font-size:.95rem;">${c.assessor_username}</span>
                <span style="background:${badgeColor}; color:white; font-size:.65rem; padding:.2rem .4rem; border-radius:3px; text-transform:uppercase; font-weight:700; margin-left:.5rem;">${c.comment_type}</span>
              </div>
              <div style="display:flex; align-items:center; gap:.5rem;">
                <span style="font-size:.75rem; color:var(--slate);">${new Date(c.created_at).toLocaleString()}</span>
                ${deleteBtn}
              </div>
            </div>
            <div>
              <span style="font-size:.75rem; color:var(--gold2); font-weight:700;">Organisation: ${c.organization_name || 'General'}</span>
            </div>
            <p style="margin:0; font-size:.85rem; color:var(--white2); line-height:1.5; white-space:pre-wrap; background:rgba(0,0,0,0.25); padding:.8rem; border-radius:4px; border:1px solid rgba(255,255,255,0.03);">${c.comment_text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function filterCommentsList() {
  const org = document.getElementById('filter-comment-org').value;
  const type = document.getElementById('filter-comment-type').value;

  let filtered = allCommentsCache;
  if (org) {
    filtered = filtered.filter(c => c.organization_name === org);
  }
  if (type) {
    filtered = filtered.filter(c => c.comment_type === type);
  }

  renderCommentsSublist(filtered);
}

function submitAssessorComment() {
  const org = document.getElementById('comment-org').value;
  const type = document.getElementById('comment-type').value;
  const text = document.getElementById('comment-text').value.trim();

  if (!org) { alert('Please select a target Organisation'); return; }
  if (!text) { alert('Please enter comment text'); return; }

  apiReq('POST', '/api/assessor-comments', {
    organization_name: org,
    comment_type: type,
    comment_text: text
  }).then(r => {
    if (r.error) {
      alert('Error: ' + r.error);
    } else {
      alert('Comment submitted successfully!');
      loadCommentsSection();
    }
  }).catch(e => alert(e.message));
}

function deleteAssessorComment(id) {
  if (!confirm('Are you sure you want to delete this comment?')) return;
  apiReq('DELETE', '/api/assessor-comments/' + id).then(r => {
    if (r.error) {
      alert('Error deleting comment: ' + r.error);
    } else {
      loadCommentsSection();
    }
  }).catch(e => alert(e.message));
}
