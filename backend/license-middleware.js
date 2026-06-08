/**
 * Backend Updates - Make license_number read-only
 * Add validation to prevent license_number modifications
 */

// Add this middleware near the top of server.js routes

const validateLicenseNumberReadOnly = (req, res, next) => {
  // Check if request is trying to modify license_number
  if (req.body.license_number !== undefined && req.body.license_number !== null) {
    // If trying to update an existing record, license_number cannot change
    if (req.method === 'PATCH' || req.method === 'PUT') {
      return res.status(403).json({
        error: 'License Number is read-only and cannot be modified',
        field: 'license_number'
      });
    }
  }
  
  // For POST requests, license_number should not be in request body
  if (req.method === 'POST' && req.body.license_number !== undefined) {
    delete req.body.license_number;
  }
  
  next();
};

module.exports = { validateLicenseNumberReadOnly };
