/**
 * Reports Controller - Independent Reports Module
 * Handles comprehensive compliance reporting across all modules
 */

const { pool, auditLog } = require('../server-utils');

/**
 * Get all organizations with data across modules
 * Endpoint: GET /api/reports/organizations
 */
const getOrganizations = async (req, res, authenticate) => {
  try {
    const isDpoAdmin = ['data_protection_officer', 'system_administrator', 'potraz_assessor'].includes(req.user.role);
    
    const q = `
      SELECT DISTINCT org_name
      FROM (
        SELECT DISTINCT organization_name as org_name FROM compliance_assessments
        UNION
        SELECT DISTINCT organization_name as org_name FROM gap_analysis
        UNION
        SELECT DISTINCT organization_name as org_name FROM ropa_records
        UNION
        SELECT DISTINCT organization_name as org_name FROM dpia_assessments
        UNION
        SELECT DISTINCT organization_name as org_name FROM security_gap_analysis
        UNION
        SELECT DISTINCT organization_name as org_name FROM department_assessments
        UNION
        SELECT DISTINCT organization_name as org_name FROM assets
        UNION
        SELECT DISTINCT organization_name as org_name FROM kpi_tracking
        UNION
        SELECT DISTINCT organization_name as org_name FROM cia_data
        UNION
        SELECT DISTINCT organization_name as org_name FROM controller_validations
        UNION
        SELECT DISTINCT organization_name as org_name FROM department_remediation_plans
        UNION
        SELECT DISTINCT organization_name as org_name FROM raci_matrix
      ) orgs
      WHERE org_name IS NOT NULL AND org_name != ''
      ORDER BY org_name
    `;
    
    const result = await pool.query(q);
    
    const orgsWithStats = await Promise.all(result.rows.map(async (row) => {
      const orgName = row.org_name;
      
      const stats = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM compliance_assessments WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))) as assessments,
          (SELECT COUNT(*) FROM gap_analysis WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))) as gaps,
          (SELECT COUNT(*) FROM ropa_records WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))) as ropas,
          (SELECT COUNT(*) FROM dpia_assessments WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))) as dpias,
          (SELECT COUNT(*) FROM security_gap_analysis WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))) as sgas,
          (SELECT AVG(overall_score) FROM compliance_assessments WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text)) AND overall_score IS NOT NULL) as avg_compliance_score,
          (SELECT MAX(created_at) FROM (
            SELECT created_at FROM compliance_assessments WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))
            UNION ALL
            SELECT created_at FROM gap_analysis WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))
            UNION ALL
            SELECT created_at FROM ropa_records WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))
            UNION ALL
            SELECT created_at FROM dpia_assessments WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))
            UNION ALL
            SELECT created_at FROM security_gap_analysis WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))
            UNION ALL
            SELECT created_at FROM department_assessments WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))
            UNION ALL
            SELECT created_at FROM assets WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))
            UNION ALL
            SELECT created_at FROM kpi_tracking WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))
            UNION ALL
            SELECT created_at as created_at FROM controller_validations WHERE TRIM(LOWER(organization_name))=TRIM(LOWER($1::text))
          ) t) as last_updated
      `, [orgName]);
      
      return {
        organization_name: orgName.trim(),
        assessments: parseInt(stats.rows[0].assessments || 0),
        gaps: parseInt(stats.rows[0].gaps || 0),
        ropas: parseInt(stats.rows[0].ropas || 0),
        dpias: parseInt(stats.rows[0].dpias || 0),
        security_gap_analyses: parseInt(stats.rows[0].sgas || 0),
        avg_compliance_score: stats.rows[0].avg_compliance_score ? parseFloat(stats.rows[0].avg_compliance_score).toFixed(2) : null,
        last_updated: stats.rows[0].last_updated
      };
    }));
    
    auditLog(req.user.id, 'REPORT_ORGANIZATIONS_VIEWED', 'reports', { count: orgsWithStats.length }, req.ip);
    res.json({ organizations: orgsWithStats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

/**
 * Get comprehensive report for specific organization
 * Endpoint: GET /api/reports/organization/:orgName
 */
const getOrganizationReport = async (req, res) => {
  let orgName = decodeURIComponent(req.params.orgName);
  // Normalize: trim whitespace and replace multiple spaces with single
  orgName = orgName.trim().replace(/\s+/g, ' ');
  
  try {
    const isDpoAdmin = ['data_protection_officer', 'system_administrator', 'potraz_assessor'].includes(req.user.role);
    console.log(`[Reports] Generating report for: "${orgName}" (Requested by: ${req.user.username}, Role: ${req.user.role})`);
    
    // Get organization license number and registration number first
    let organization_license_number = null;
    let organization_registration_number = null;
    const orgLicense = await pool.query(
      'SELECT license_number, registration_number FROM organizations WHERE LOWER(name) = LOWER($1)',
      [orgName]
    );
    if (orgLicense.rows.length > 0) {
      organization_license_number = orgLicense.rows[0].license_number;
      organization_registration_number = orgLicense.rows[0].registration_number;
    }
    
    // 1. Compliance Assessments
    const assessmentsQuery = `
      SELECT ca.*, u.username,
             COALESCE(ca.license_number, $2) as license_number,
             COALESCE(ca.registration_number, $3) as registration_number
      FROM compliance_assessments ca
      LEFT JOIN users u ON ca.user_id = u.id
      WHERE TRIM(LOWER(ca.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY ca.created_at DESC
    `;
    const assessments = await pool.query(assessmentsQuery, [orgName, organization_license_number, organization_registration_number]);
    
    const assessmentsWithDetails = await Promise.all(assessments.rows.map(async (a) => {
      const responses = await pool.query(
        'SELECT COUNT(*) as total, COUNT(CASE WHEN response=\'yes\' THEN 1 END) as yes_count FROM checklist_responses WHERE assessment_id=$1',
        [a.id]
      );
      return {
        ...a,
        checklist_responses: parseInt(responses.rows[0].total || 0),
        checklist_yes_responses: parseInt(responses.rows[0].yes_count || 0)
      };
    }));
    
    // 2. Gap Analysis
    const gapsQuery = `
      SELECT g.*, u.username,
             COALESCE(g.license_number, $2) as license_number,
             COALESCE(g.registration_number, $3) as registration_number
      FROM gap_analysis g
      LEFT JOIN users u ON g.user_id = u.id
      WHERE TRIM(LOWER(g.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY g.priority DESC, g.created_at DESC
    `;
    const gaps = await pool.query(gapsQuery, [orgName, organization_license_number, organization_registration_number]);
    
    const gapStats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status='open' THEN 1 END) as open,
        COUNT(CASE WHEN status='in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status='closed' THEN 1 END) as closed,
        COUNT(CASE WHEN priority='critical' THEN 1 END) as critical,
        COUNT(CASE WHEN priority='high' THEN 1 END) as high,
        COUNT(CASE WHEN priority='medium' THEN 1 END) as medium,
        COUNT(CASE WHEN priority='low' THEN 1 END) as low
      FROM gap_analysis
      WHERE TRIM(LOWER(organization_name)) = TRIM(LOWER($1::text))
    `, [orgName]);
    
    // 3. ROPA Records
    const ropaQuery = `
      SELECT r.*, u.username,
        (SELECT COUNT(*) FROM ropa_processing_activities WHERE ropa_id=r.id) as activity_count,
        COALESCE(r.license_number, $2) as license_number,
        COALESCE(r.registration_number, $3) as registration_number
      FROM ropa_records r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE TRIM(LOWER(r.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY r.created_at DESC
    `;
    const ropaResult = await pool.query(ropaQuery, [orgName, organization_license_number, organization_registration_number]);
    const ropas = ropaResult.rows;
    
    // 4. DPIA Assessments
    const dpiaQuery = `
      SELECT d.*, u.username,
             COALESCE(d.license_number, $2) as license_number,
             COALESCE(d.registration_number, $3) as registration_number
      FROM dpia_assessments d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE TRIM(LOWER(d.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY d.created_at DESC
    `;
    const dpias = await pool.query(dpiaQuery, [orgName, organization_license_number, organization_registration_number]);
    
    const dpiasWithDetails = await Promise.all(dpias.rows.map(async (d) => {
      const measures = await pool.query('SELECT COUNT(*) FROM dpia_measure_catalog WHERE dpia_id=$1', [d.id]);
      const risks = await pool.query('SELECT COUNT(*) FROM dpia_risk_catalog WHERE dpia_id=$1', [d.id]);
      return {
        ...d,
        measure_count: parseInt(measures.rows[0].count || 0),
        risk_count: parseInt(risks.rows[0].count || 0)
      };
    }));
    
    // 5. Security Gap Analysis
    const sgaQuery = `
      SELECT s.*, u.username,
             COALESCE(s.license_number, $2) as license_number,
             COALESCE(s.registration_number, $3) as registration_number
      FROM security_gap_analysis s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE TRIM(LOWER(s.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY s.domain_category, s.created_at DESC
    `;
    const sgas = await pool.query(sgaQuery, [orgName, organization_license_number, organization_registration_number]);
    
    const sgaStats = await pool.query(`
      SELECT
        domain_category,
        COUNT(*) as total,
        COUNT(CASE WHEN in_place='yes' THEN 1 END) as in_place,
        COUNT(CASE WHEN in_place='partial' THEN 1 END) as partial,
        COUNT(CASE WHEN in_place='no' THEN 1 END) as not_in_place,
        COUNT(CASE WHEN rating='critical' THEN 1 END) as critical,
        COUNT(CASE WHEN rating='high' THEN 1 END) as high,
        COUNT(CASE WHEN rating='medium' THEN 1 END) as medium,
        COUNT(CASE WHEN rating='low' THEN 1 END) as low
      FROM security_gap_analysis
      WHERE TRIM(LOWER(organization_name)) = TRIM(LOWER($1::text))
      GROUP BY domain_category
      ORDER BY domain_category
    `, [orgName]);
    
    // Calculate overall security score
    let totalSgaItems = 0, sgaYes = 0, sgaPartial = 0;
    if (sgaStats.rows.length > 0) {
      sgaStats.rows.forEach(row => {
        totalSgaItems += parseInt(row.total || 0);
        sgaYes += parseInt(row.in_place || 0);
        sgaPartial += parseInt(row.partial || 0);
      });
    } else if (sgas.rows.length > 0) {
      // Fallback calculation from raw rows if stats group-by failed
      totalSgaItems = sgas.rows.length;
      sgaYes = sgas.rows.filter(s => s.in_place === 'yes').length;
      sgaPartial = sgas.rows.filter(s => s.in_place === 'partial').length;
    }

    const overallSecurityScore = totalSgaItems > 0 
      ? Math.round(((sgaYes + sgaPartial * 0.5) / totalSgaItems) * 100)
      : null;
    
    // 6. Controller Details (from most recent ROPA or Validations, plus organizations table)
    let controllerDetails = await pool.query(`
      SELECT controller_name, controller_address, controller_contact, dpo_name, dpo_contact,
             controller_license_number, controller_contact_number, license_number, registration_number,
             num_data_subjects, dpo_practice_number
      FROM ropa_records
      WHERE TRIM(LOWER(organization_name)) = TRIM(LOWER($1::text))
      ORDER BY created_at DESC LIMIT 1
    `, [orgName]);

    if (controllerDetails.rows.length === 0) {
      controllerDetails = await pool.query(`
        SELECT controller_name, controller_address, controller_contact, dpo_name, dpo_contact,
               controller_license_number, NULL as controller_contact_number, license_number, registration_number,
               num_data_subjects, NULL as dpo_practice_number
        FROM controller_validations
        WHERE TRIM(LOWER(organization_name)) = TRIM(LOWER($1::text))
        ORDER BY validated_at DESC LIMIT 1
      `, [orgName]);
    }
    
    // Merge with organizations table data (prioritize organizations table)
    if (controllerDetails.rows.length > 0) {
      controllerDetails.rows[0].controller_license_number = 
        organization_license_number || 
        controllerDetails.rows[0].license_number || 
        controllerDetails.rows[0].controller_license_number;
      controllerDetails.rows[0].license_number = 
        organization_license_number || 
        controllerDetails.rows[0].license_number;
      controllerDetails.rows[0].registration_number = 
        organization_registration_number || 
        controllerDetails.rows[0].registration_number;
    }

    // 7. Department Assessments
    const deptAssessQuery = `
      SELECT da.*, u.username
      FROM department_assessments da
      LEFT JOIN users u ON da.user_id = u.id
      WHERE TRIM(LOWER(da.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY da.created_at DESC
    `;
    const deptAssessments = await pool.query(deptAssessQuery, [orgName]);

    // 8. Assets
    const assetsQuery = `
      SELECT a.*, u.username
      FROM assets a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE TRIM(LOWER(a.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY a.created_at DESC
    `;
    const assets = await pool.query(assetsQuery, [orgName]);

    // 9. KPI Tracking
    const kpiQuery = `
      SELECT k.*, u.username
      FROM kpi_tracking k
      LEFT JOIN users u ON k.user_id = u.id
      WHERE TRIM(LOWER(k.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY k.created_at DESC
    `;
    const kpis = await pool.query(kpiQuery, [orgName]);

    // 10. CIA Data
    const ciaQuery = `
      SELECT c.*, u.username
      FROM cia_data c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE TRIM(LOWER(c.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY c.created_at DESC
    `;
    const ciaData = await pool.query(ciaQuery, [orgName]);

    // 11. Validations
    const validationsQuery = `
      SELECT v.*, u.username,
             COALESCE(v.license_number, $2) as license_number,
             COALESCE(v.registration_number, $3) as registration_number
      FROM controller_validations v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE TRIM(LOWER(v.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY v.validated_at DESC
    `;
    const validations = await pool.query(validationsQuery, [orgName, organization_license_number, organization_registration_number]);

    // 12. Technical Recommendations
    const techRecsQuery = `
      SELECT t.*, u.username
      FROM tech_recommendations t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE TRIM(LOWER(t.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY t.created_at DESC
    `;
    const techRecs = await pool.query(techRecsQuery, [orgName]);

    // 13. Remediation Plans
    const remsQuery = `
      SELECT r.*, u.username
      FROM department_remediation_plans r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE TRIM(LOWER(r.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY r.priority DESC, r.created_at DESC
    `;
    const remsData = await pool.query(remsQuery, [orgName]);

    // 14. RACI Matrix
    const raciQuery = `
      SELECT r.*, u.username
      FROM raci_matrix r
      LEFT JOIN users u ON r.user_id=u.id
      WHERE TRIM(LOWER(r.organization_name)) = TRIM(LOWER($1::text))
      ORDER BY r.process_name, r.role
    `;
    const raciData = await pool.query(raciQuery, [orgName]);

    // 15. Assessor Comments
    const commentsResult = await pool.query(
      `SELECT ac.*, u.username as assessor_username
       FROM assessor_comments ac
       JOIN users u ON ac.assessor_id=u.id
       WHERE LOWER(ac.organization_name) = LOWER($1) AND ac.is_visible_to_dpo = TRUE
       ORDER BY ac.created_at DESC`,
      [orgName]
    );
    
    console.log(`[Reports] Counts for "${orgName}": CA:${assessments.rows.length}, Gaps:${gaps.rows.length}, ROPA:${ropas.length}, DPIA:${dpias.rows.length}, Dept:${deptAssessments.rows.length}`);

    // Calculate overall compliance score (Core Assessment)
    const complianceScore = assessments.rows.length > 0
      ? parseFloat(
          (assessments.rows.reduce((sum, a) => sum + (a.overall_score || 0), 0) / 
           assessments.rows.length).toFixed(2)
        )
      : null;

    // Calculate Dept Score
    const deptScore = deptAssessments.rows.length > 0
      ? parseFloat(
          (deptAssessments.rows.reduce((sum, a) => sum + (a.overall_score || 0), 0) / 
           deptAssessments.rows.length).toFixed(2)
        )
      : null;

    const reportSummary = {
      organization_name: orgName,
      organization_license_number: organization_license_number,
      organization_registration_number: organization_registration_number,
      report_generated_at: new Date().toISOString(),
      assessor_comments: commentsResult.rows,
      
      controller_details: controllerDetails.rows[0] || {
        controller_name: orgName,
        controller_address: null,
        controller_contact: null,
        dpo_name: null,
        dpo_contact: null,
        controller_license_number: null,
        controller_contact_number: null,
        registration_number: organization_registration_number,
        license_number: organization_license_number,
        num_data_subjects: null,
        dpo_practice_number: null
      },

      compliance_assessments: {
        total: assessmentsWithDetails.length,
        average_score: complianceScore,
        by_status: {
          draft: assessmentsWithDetails.filter(a => a.status === 'draft').length,
          submitted: assessmentsWithDetails.filter(a => a.status === 'submitted').length,
          reviewed: assessmentsWithDetails.filter(a => a.status === 'reviewed').length,
          approved: assessmentsWithDetails.filter(a => a.status === 'approved').length
        },
        details: assessmentsWithDetails
      },
      
      gap_analysis: {
        total: parseInt(gapStats.rows[0].total || 0),
        by_status: {
          open: parseInt(gapStats.rows[0].open || 0),
          in_progress: parseInt(gapStats.rows[0].in_progress || 0),
          closed: parseInt(gapStats.rows[0].closed || 0)
        },
        by_priority: {
          critical: parseInt(gapStats.rows[0].critical || 0),
          high: parseInt(gapStats.rows[0].high || 0),
          medium: parseInt(gapStats.rows[0].medium || 0),
          low: parseInt(gapStats.rows[0].low || 0)
        },
        details: gaps.rows
      },
      
      ropa_records: {
        total: ropas.length,
        by_status: {
          draft: ropas.filter(r => r.status === 'draft').length,
          active: ropas.filter(r => r.status === 'active').length,
          archived: ropas.filter(r => r.status === 'archived').length
        },
        total_processing_activities: ropas.reduce((sum, r) => sum + (r.activity_count || 0), 0),
        details: ropas
      },
      
      dpia_assessments: {
        total: dpiasWithDetails.length,
        by_status: {
          draft: dpiasWithDetails.filter(d => d.status === 'draft').length,
          submitted: dpiasWithDetails.filter(d => d.status === 'submitted').length,
          approved: dpiasWithDetails.filter(d => d.status === 'approved').length,
          rejected: dpiasWithDetails.filter(d => d.status === 'rejected').length
        },
        by_risk_level: {
          critical: dpiasWithDetails.filter(d => d.overall_risk_level === 'critical').length,
          high: dpiasWithDetails.filter(d => d.overall_risk_level === 'high').length,
          medium: dpiasWithDetails.filter(d => d.overall_risk_level === 'medium').length,
          low: dpiasWithDetails.filter(d => d.overall_risk_level === 'low').length
        },
        total_measures: dpiasWithDetails.reduce((sum, d) => sum + (d.measure_count || 0), 0),
        total_risks: dpiasWithDetails.reduce((sum, d) => sum + (d.risk_count || 0), 0),
        details: dpiasWithDetails
      },
      
      security_gap_analysis: {
        overall_score: overallSecurityScore,
        rating: overallSecurityScore !== null ? (overallSecurityScore >= 80 ? 'GOOD' : overallSecurityScore >= 60 ? 'FAIR' : 'POOR') : 'N/A',
        total_items: totalSgaItems,
        in_place: sgaYes,
        partial: sgaPartial,
        not_in_place: totalSgaItems - sgaYes - sgaPartial,
        by_domain: sgaStats.rows,
        by_risk_level: {
          critical: sgaStats.rows.reduce((sum, d) => sum + parseInt(d.critical || 0), 0),
          high: sgaStats.rows.reduce((sum, d) => sum + parseInt(d.high || 0), 0),
          medium: sgaStats.rows.reduce((sum, d) => sum + parseInt(d.medium || 0), 0),
          low: sgaStats.rows.reduce((sum, d) => sum + parseInt(d.low || 0), 0)
        },
        details: sgas.rows
      },
      
      department_assessments: {
        total: deptAssessments.rows.length,
        average_score: deptScore,
        details: deptAssessments.rows
      },

      assets: {
        total: assets.rows.length,
        details: assets.rows
      },

      kpi_tracking: {
        total: kpis.rows.length,
        details: kpis.rows
      },

      cia_data: {
        total: ciaData.rows.length,
        details: ciaData.rows
      },

      validations: {
        total: validations.rows.length,
        details: validations.rows
      },

      technical_recommendations: {
        total: techRecs.rows.length,
        by_type: {
          electronic: techRecs.rows.filter(t => t.type === 'electronic').length,
          manual: techRecs.rows.filter(t => t.type === 'manual').length
        },
        details: techRecs.rows
      },

      remediation_plans: {
        total: remsData.rows.length,
        details: remsData.rows
      },

      raci_matrix: {
        total: raciData.rows.length,
        details: raciData.rows
      },
      
      overall_compliance_status: {
        compliance_score: complianceScore,
        dept_score: deptScore,
        security_score: overallSecurityScore,
        health_score: Math.round(((complianceScore || 0) + (overallSecurityScore || 0) + (deptScore || 0)) / ( (complianceScore ? 1:0) + (overallSecurityScore ? 1:0) + (deptScore ? 1:0) || 1 )),
        gaps_critical: parseInt(gapStats.rows[0].critical || 0),
        risks_critical: dpiasWithDetails.filter(d => d.overall_risk_level === 'critical').length,
        dpia_approval_status: dpiasWithDetails.filter(d => d.status === 'approved').length + ' of ' + dpiasWithDetails.length + ' DPIAs approved',
        recommended_action: complianceScore < 70 || overallSecurityScore < 70 
          ? 'URGENT: Immediate remediation required'
          : complianceScore < 85 || overallSecurityScore < 80
          ? 'REVIEW: Enhancement recommended'
          : 'MAINTAIN: Current controls adequate'
      }
    };
    
    auditLog(req.user.id, 'DETAILED_REPORT_GENERATED', 'reports', { organization: orgName }, req.ip);
    res.json({ report: reportSummary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

module.exports = {
  getOrganizations,
  getOrganizationReport
};
