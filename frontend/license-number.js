/**
 * License Number Display Module
 * Displays organization license numbers in all compliance modules
 * License numbers are read-only and cannot be edited
 */

// Function to display license number in module headers
function displayLicenseNumber(organizationName, licenseNumber) {
  const licenseDisplay = document.createElement('div');
  licenseDisplay.className = 'license-number-display';
  licenseDisplay.innerHTML = `
    <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #2196F3;">
      <div style="font-size: 12px; color: #666; font-weight: 600; text-transform: uppercase;">License Number</div>
      <div style="font-size: 16px; color: #1976D2; font-family: monospace; margin-top: 4px; font-weight: 600;">
        ${licenseNumber}
      </div>
      <div style="font-size: 11px; color: #999; margin-top: 4px;">
        🔒 Read-Only • Assigned to: ${organizationName}
      </div>
    </div>
  `;
  return licenseDisplay;
}

// Function to inject license number into assessment forms
function addLicenseNumberField(organizationName, licenseNumber) {
  const existingLicense = document.querySelector('.license-number-display');
  if (existingLicense) {
    existingLicense.remove();
  }
  
  const orgNameField = document.querySelector('[name="organization_name"], input[value*="' + organizationName + '"]');
  if (orgNameField) {
    const parent = orgNameField.closest('.form-group') || orgNameField.parentElement;
    if (parent) {
      const licenseDisplay = displayLicenseNumber(organizationName, licenseNumber);
      parent.insertAdjacentElement('afterend', licenseDisplay);
    }
  }
}

// Function to prevent license number from being edited in form submissions
function protectLicenseNumber() {
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      // Remove any license_number fields from submission
      const licenseInputs = form.querySelectorAll('[name="license_number"]');
      licenseInputs.forEach(input => input.remove());
      
      // Add class to prevent accidental editing
      form.querySelectorAll('[data-license="true"]').forEach(field => {
        field.setAttribute('readonly', 'readonly');
        field.setAttribute('disabled', 'disabled');
        field.style.backgroundColor = '#f0f0f0';
        field.style.cursor = 'not-allowed';
      });
    });
  });
}

// Hook into assessment loading
const originalLoadAssessment = window.loadAssessment;
window.loadAssessment = function(id) {
  originalLoadAssessment.call(this, id);
  
  setTimeout(() => {
    const orgName = document.querySelector('[name="organization_name"]')?.value;
    const licenseNumber = document.querySelector('[data-field="license_number"]')?.textContent;
    
    if (orgName && licenseNumber) {
      addLicenseNumberField(orgName, licenseNumber);
      protectLicenseNumber();
    }
  }, 500);
};

// Hook into gap analysis
const originalLoadGap = window.loadGap;
if (originalLoadGap) {
  window.loadGap = function(id) {
    originalLoadGap.call(this, id);
    
    setTimeout(() => {
      const orgName = document.querySelector('[name="organization_name"]')?.value;
      const licenseNumber = document.querySelector('[data-field="license_number"]')?.textContent;
      
      if (orgName && licenseNumber) {
        addLicenseNumberField(orgName, licenseNumber);
      }
    }, 500);
  };
}

// Hook into ROPA
const originalLoadROPA = window.loadROPA;
if (originalLoadROPA) {
  window.loadROPA = function(id) {
    originalLoadROPA.call(this, id);
    
    setTimeout(() => {
      const orgName = document.querySelector('[name="organization_name"]')?.value;
      const licenseNumber = document.querySelector('[data-field="license_number"]')?.textContent;
      
      if (orgName && licenseNumber) {
        addLicenseNumberField(orgName, licenseNumber);
      }
    }, 500);
  };
}

// Hook into DPIA
const originalLoadDPIA = window.loadDPIA;
if (originalLoadDPIA) {
  window.loadDPIA = function(id) {
    originalLoadDPIA.call(this, id);
    
    setTimeout(() => {
      const orgName = document.querySelector('[name="organization_name"]')?.value;
      const licenseNumber = document.querySelector('[data-field="license_number"]')?.textContent;
      
      if (orgName && licenseNumber) {
        addLicenseNumberField(orgName, licenseNumber);
      }
    }, 500);
  };
}

console.log('✅ License Number protection loaded - License numbers are read-only');
