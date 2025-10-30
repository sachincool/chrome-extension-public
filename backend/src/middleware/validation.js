/**
 * Request Validation Middleware
 * Validates and sanitizes incoming requests
 */

const config = require('../config')

/**
 * Validate company analysis request - MVP format
 */
function validateCompanyAnalysis(req, res, next) {
  const { companyName, companyUrl } = req.body
  const errors = []

  // Check if companyName exists and is a string
  if (!companyName) {
    errors.push({
      field: 'companyName',
      message: 'Company name is required',
      code: 'MISSING_FIELD',
    })
  } else if (typeof companyName !== 'string') {
    errors.push({
      field: 'companyName',
      message: 'Company name must be a string',
      code: 'INVALID_TYPE',
      received: typeof companyName,
    })
  } else {
    // Validate length
    if (companyName.length > config.analysis.maxCompanyNameLength) {
      errors.push({
        field: 'companyName',
        message: `Company name must be less than ${config.analysis.maxCompanyNameLength} characters`,
        code: 'TOO_LONG',
        maxLength: config.analysis.maxCompanyNameLength,
        actualLength: companyName.length,
      })
    }

    // Sanitize and check for empty content
    const trimmedName = companyName.trim()
    if (trimmedName.length === 0) {
      errors.push({
        field: 'companyName',
        message: 'Company name cannot be empty or contain only whitespace',
        code: 'EMPTY_CONTENT',
      })
    } else {
      // Validate against suspicious patterns
      if (!/^[a-zA-Z0-9\s\-&.,()]+$/.test(trimmedName)) {
        errors.push({
          field: 'companyName',
          message: 'Company name contains invalid characters',
          code: 'INVALID_CHARACTERS',
        })
      }
      req.body.companyName = trimmedName
    }
  }

  // Validate companyUrl (optional)
  if (companyUrl !== undefined && companyUrl !== null) {
    if (typeof companyUrl !== 'string') {
      errors.push({
        field: 'companyUrl',
        message: 'Company URL must be a string if provided',
        code: 'INVALID_TYPE',
        received: typeof companyUrl,
      })
    } else {
      const trimmedUrl = companyUrl.trim()
      if (trimmedUrl.length > 0) {
        // Basic URL validation for LinkedIn company URLs
        // Allow query parameters and additional path segments
        if (
          !/^https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9\-_]+/.test(
            trimmedUrl
          )
        ) {
          errors.push({
            field: 'companyUrl',
            message: 'Company URL must be a valid LinkedIn company URL',
            code: 'INVALID_URL_FORMAT',
          })
        } else {
          req.body.companyUrl = trimmedUrl
        }
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errorType: 'validation_error',
      errors,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    })
  }

  next()
}

/**
 * Validate person analysis request - MVP format
 */
function validatePersonAnalysis(req, res, next) {
  const { fullName, title, profileUrl, companyName } = req.body
  const errors = []

  // Validate fullName (required)
  if (!fullName) {
    errors.push({
      field: 'fullName',
      message: 'Person full name is required',
      code: 'MISSING_FIELD',
    })
  } else if (typeof fullName !== 'string') {
    errors.push({
      field: 'fullName',
      message: 'Person full name must be a string',
      code: 'INVALID_TYPE',
      received: typeof fullName,
    })
  } else {
    if (fullName.length > config.analysis.maxPersonNameLength) {
      errors.push({
        field: 'fullName',
        message: `Person full name must be less than ${config.analysis.maxPersonNameLength} characters`,
        code: 'TOO_LONG',
        maxLength: config.analysis.maxPersonNameLength,
        actualLength: fullName.length,
      })
    }

    const trimmedName = fullName.trim()
    if (trimmedName.length === 0) {
      errors.push({
        field: 'fullName',
        message: 'Person full name cannot be empty or contain only whitespace',
        code: 'EMPTY_CONTENT',
      })
    } else {
      // Enhanced name validation for real LinkedIn names
      // Supports international characters, professional suffixes, and common punctuation
      if (
        !/^[\p{L}\p{M}\s\-'.,()\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF]+(?:\s*,?\s*(?:Jr\.?|Sr\.?|[IVX]+|PhD|MD|CPA|MBA|JD|EdD|DDS|PharmD|RN|BSN|MSN|DVM|PE|CFA|FCA|ACCA|CA|CISA|CISSP|PMP|CISSP|CRISC|CISM|CGEIT|CPP|PCI|PSP|CFP|CMA|CIA|CRMA|CRM|CSM|CSPO|ITIL|[A-Z]{2,6}))*$/iu.test(
          trimmedName
        )
      ) {
        errors.push({
          field: 'fullName',
          message: 'Person full name contains invalid characters',
          code: 'INVALID_CHARACTERS',
        })
      }
      req.body.fullName = trimmedName
    }
  }

  // Validate title (optional)
  if (title !== undefined && title !== null) {
    if (typeof title !== 'string') {
      errors.push({
        field: 'title',
        message: 'Title must be a string if provided',
        code: 'INVALID_TYPE',
        received: typeof title,
      })
    } else if (title.length > 100) {
      errors.push({
        field: 'title',
        message: 'Title must be less than 100 characters',
        code: 'TOO_LONG',
        maxLength: 100,
        actualLength: title.length,
      })
    } else {
      req.body.title = title.trim()
    }
  } else {
    req.body.title = ''
  }

  // Validate profileUrl (optional)
  if (profileUrl !== undefined && profileUrl !== null) {
    if (typeof profileUrl !== 'string') {
      errors.push({
        field: 'profileUrl',
        message: 'Profile URL must be a string if provided',
        code: 'INVALID_TYPE',
        received: typeof profileUrl,
      })
    } else {
      const trimmedUrl = profileUrl.trim()
      if (trimmedUrl.length > 0) {
        // Basic URL validation for LinkedIn profile URLs
        // Allow query parameters and additional path segments
        if (
          !/^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_]+/.test(
            trimmedUrl
          )
        ) {
          errors.push({
            field: 'profileUrl',
            message: 'Profile URL must be a valid LinkedIn profile URL',
            code: 'INVALID_URL_FORMAT',
          })
        } else {
          req.body.profileUrl = trimmedUrl
        }
      }
    }
  }

  // Validate companyName (optional)
  if (companyName !== undefined && companyName !== null) {
    if (typeof companyName !== 'string') {
      errors.push({
        field: 'companyName',
        message: 'Company name must be a string if provided',
        code: 'INVALID_TYPE',
        received: typeof companyName,
      })
    } else if (companyName.length > config.analysis.maxCompanyNameLength) {
      errors.push({
        field: 'companyName',
        message: `Company name must be less than ${config.analysis.maxCompanyNameLength} characters`,
        code: 'TOO_LONG',
        maxLength: config.analysis.maxCompanyNameLength,
        actualLength: companyName.length,
      })
    } else {
      req.body.companyName = companyName.trim()
    }
  } else {
    req.body.companyName = ''
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errorType: 'validation_error',
      errors,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    })
  }

  next()
}

/**
 * Add request ID for tracing
 */
function addRequestId(req, res, next) {
  req.requestId = req.headers['x-request-id'] || generateRequestId()
  res.setHeader('X-Request-ID', req.requestId)
  next()
}

/**
 * Generate a simple request ID
 */
function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

module.exports = {
  validateCompanyAnalysis,
  validatePersonAnalysis,
  addRequestId,
}
