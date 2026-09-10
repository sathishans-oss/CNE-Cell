/**
 * Google Apps Script Source Export
 * Authoritative source: Code.gs
 * This file is automatically synchronized from Code.gs
 */
export const APPS_SCRIPT_SOURCE_CODE = `/**
 * ============================================================================
 * CLINICAL NURSING EDUCATION (CNE) MANAGEMENT SYSTEM - GOOGLE APPS SCRIPT API
 * All India Institute of Medical Sciences, Rishikesh
 * Production Hardened, Zero-Backdoor, Server-Side Authorization & Concurrency Safe Engine
 * ============================================================================
 */

// Global Normalization Helper: Trim & Uppercase Employee ID as Pure String
function normalizeEmpId(id) {
  if (id === null || id === undefined) return '';
  return String(id).trim().toUpperCase();
}

// Authoritative Normalization: CNE Type (Strictly CENTRAL or DEPARTMENTAL) - FAIL CLOSED
function normalizeCNEType(typeStr) {
  if (typeStr === null || typeStr === undefined) return null;
  var s = String(typeStr).trim().toUpperCase();
  if (s === 'CENTRAL' || s === 'CENTRAL CNE') return 'CENTRAL';
  if (s === 'DEPARTMENTAL' || s === 'DEPT' || s === 'DEPARTMENTAL CNE') return 'DEPARTMENTAL';
  return null;
}

// Authoritative Normalization: CNE Scheduling Status (Strictly Scheduled, Completed, or Canceled)
function normalizeCNEStatus(statusStr) {
  if (!statusStr) return 'Scheduled';
  var s = String(statusStr).trim();
  var upper = s.toUpperCase();
  if (upper === 'COMPLETED') return 'Completed';
  if (upper === 'CANCELED' || upper === 'CANCELLED') return 'Canceled';
  return 'Scheduled';
}

// Formula Injection Prevention: Prepend apostrophe to user strings starting with =, +, -, @, \\t, \\r
function sanitizeCellInput(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  var str = String(val).trim();
  if (/^[=+\\-@\\t\\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

// Global Configuration & Sheet Resolution (Strict separation: Officers Roster requires DROPDOWN_SPREADSHEET_ID)
function getSpreadsheet(type) {
  var props = PropertiesService.getScriptProperties();
  
  if (type === 'OFFICERS') {
    var dropdownId = props.getProperty('DROPDOWN_SPREADSHEET_ID');
    if (!dropdownId || dropdownId.trim() === '') {
      throw new Error('DROPDOWN_SPREADSHEET_ID is not configured in Script Properties. Institutional roster lookup requires DROPDOWN_SPREADSHEET_ID to prevent reading operational CNE sheets.');
    }
    try {
      return SpreadsheetApp.openById(dropdownId.trim());
    } catch (e) {
      throw new Error('Could not open Employee Master spreadsheet with DROPDOWN_SPREADSHEET_ID: ' + e.message);
    }
  } else {
    var cneId = props.getProperty('CNE_SPREADSHEET_ID');
    if (cneId && cneId.trim() !== '') {
      try {
        return SpreadsheetApp.openById(cneId.trim());
      } catch (e) {
        throw new Error('Could not open CNE spreadsheet with CNE_SPREADSHEET_ID: ' + e.message);
      }
    }
    throw new Error('CNE_SPREADSHEET_ID is not configured in Script Properties. Please configure the CNE Database Spreadsheet ID.');
  }
}

function getCNESpreadsheet() {
  return getSpreadsheet('CNE');
}

/**
 * Setup Utility: Run this once in Apps Script Editor to generate strong random keys if missing
 */
function setupSecurityProperties() {
  var props = PropertiesService.getScriptProperties();
  var updated = [];
  
  if (!props.getProperty('SESSION_SECRET')) {
    var randomSecret = Utilities.getUuid() + '-' + Utilities.getUuid() + '-' + Date.now();
    props.setProperty('SESSION_SECRET', randomSecret);
    updated.push('SESSION_SECRET generated');
  }
  if (!props.getProperty('PASSWORD_PEPPER')) {
    var randomPepper = Utilities.getUuid() + '-pepper-' + Date.now();
    props.setProperty('PASSWORD_PEPPER', randomPepper);
    updated.push('PASSWORD_PEPPER generated');
  }
  
  Logger.log(updated.length > 0 ? updated.join(', ') : 'All security properties already configured.');
}

/**
 * Password Hashing Helper: Salted SHA-256 with Server-Side Pepper (No fallback pepper)
 */
function computePasswordHash(password, salt) {
  var pepper = PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER');
  if (!pepper || pepper.trim() === '') {
    throw new Error('PASSWORD_PEPPER is not configured in Script Properties.');
  }
  var input = password + salt + pepper.trim();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return digest.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

/**
 * Cryptographic Session Token Generation & Verification (Full HMAC-SHA256 Signature)
 */
function generateSessionToken(employeeId) {
  var normId = normalizeEmpId(employeeId);
  var timestamp = new Date().getTime();
  var nonce = Utilities.getUuid().replace(/-/g, '');
  var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');
  if (!secret || secret.trim() === '') {
    throw new Error('SESSION_SECRET is not configured in Script Properties.');
  }
  
  var payload = normId + ':' + timestamp + ':' + nonce;
  var sigBytes = Utilities.computeHmacSha256Signature(payload, secret.trim());
  var signature = sigBytes.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  
  return payload + ':' + signature;
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function verifySession(token, employeeId) {
  if (!token) return null;
  
  var parts = token.split(':');
  if (parts.length < 4) return null;
  
  var tokenEmpId = parts[0];
  var timestamp = parseInt(parts[1], 10);
  var nonce = parts[2];
  var receivedSig = parts[3];
  
  if (employeeId && normalizeEmpId(tokenEmpId) !== normalizeEmpId(employeeId)) {
    return null;
  }
  
  // 7-day expiration
  var now = new Date().getTime();
  if (isNaN(timestamp) || (now - timestamp > 7 * 24 * 60 * 60 * 1000) || (timestamp > now + 300000)) {
    return null;
  }
  
  var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');
  if (!secret || secret.trim() === '') {
    return null;
  }
  
  var expectedPayload = tokenEmpId + ':' + timestamp + ':' + nonce;
  var sigBytes = Utilities.computeHmacSha256Signature(expectedPayload, secret.trim());
  var expectedSig = sigBytes.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  
  if (!timingSafeEqual(receivedSig, expectedSig)) return null;
  
  var verifiedEmpId = normalizeEmpId(tokenEmpId);

  // Invalidate tokens issued before password change / reset
  var lastChange = CacheService.getScriptCache().get('pwd_change_' + verifiedEmpId);
  if (lastChange && timestamp < parseInt(lastChange, 10)) {
    return null;
  }

  var roleInfo = getUserRoleInfo(verifiedEmpId);
  return {
    employeeId: verifiedEmpId,
    role: roleInfo.role,
    assignedArea: roleInfo.assignedArea,
    assignedAreas: roleInfo.assignedAreas
  };
}

/**
 * 1. Reusable ADMIN Authorization Helper
 * Enforces strict server-side ADMIN authorization checking.
 */
function requireAdmin(session) {
  if (!session) {
    return {
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in.'
    };
  }

  if (String(session.role || '').toUpperCase() !== 'ADMIN') {
    return {
      success: false,
      errorCode: 'FORBIDDEN',
      message: 'Administrator privileges are required for this action.'
    };
  }

  return null;
}

/**
 * Audit Logger (Strictly Non-Destructive to Data Sheets)
 */
function logAuditAction(action, employeeId, details, status) {
  try {
    var auditSheet = getOrCreateSheet('Audit Log');
    auditSheet.appendRow([
      new Date().toISOString(),
      action || '',
      normalizeEmpId(employeeId),
      sanitizeCellInput(details || ''),
      status || 'SUCCESS'
    ]);
  } catch (e) {
    console.warn('Audit log write error: ' + e.message);
  }
}

/**
 * Handle HTTP GET / POST Requests
 */
function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

/**
 * Main Request Router with Strict Server-Side Role Enforcement
 */
function handleRequest(e, method) {
  var output = { success: false, message: 'Invalid request' };
  
  try {
    var params = {};
    if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (err) {
        params = e.parameter || {};
      }
    } else if (e && e.parameter) {
      params = e.parameter;
    }
    
    var action = params.action || '';
    
    // Authenticate session if token is provided
    var session = null;
    if (params.token && params.loggedInEmployeeId) {
      session = verifySession(params.token, params.loggedInEmployeeId);
    }
    
    switch (action) {
      // Diagnostic & Public Information Endpoints
      case 'ping':
        output = handleDiagnosticPing(params);
        break;
        
      case 'login':
        output = handleLogin(params);
        break;
        
      case 'changePassword':
        output = handleChangePassword(params, session);
        break;
        
      case 'resetPassword':
        output = handleResetPassword(params);
        break;
        
      case 'getAreas':
        output = handleGetAreas(params);
        break;
        
      case 'getUpcomingClasses':
        output = handleGetUpcomingClasses(params);
        break;
        
      case 'getGallery':
        output = handleGetGallery(params, session);
        break;
        
      case 'getNewsEvents':
        output = handleGetNewsEvents(params);
        break;
        
      case 'getChairpersonMessage':
        output = handleGetChairpersonMessage(params);
        break;
        
      case 'getQuickLinks':
        output = handleGetQuickLinks(params);
        break;
        
      case 'getCoordinatorDesk':
        output = handleGetCoordinatorDesk(params);
        break;
        
      case 'getProgramImpact':
        output = handleGetProgramImpact(params, session);
        break;
        
      // Authenticated User Endpoints
      case 'getCNERecords':
        output = handleGetCNERecords(params, session);
        break;
        
      case 'applyForClass':
        output = handleApplyForClass(params, session);
        break;
        
      case 'getMyApplications':
        output = handleGetMyApplications(params, session);
        break;
        
      case 'getDashboardStats':
        output = handleGetDashboardStats(params, session);
        break;
        
      // Administrative Endpoints (Strictly requireAdmin verified)
      case 'getOfficersDropdown':
        output = handleAdminAction(params, session, handleGetOfficersDropdown, 'GET_OFFICERS_DROPDOWN');
        break;
      case 'addArea':
        output = handleAdminAction(params, session, handleAddArea, 'ADD_AREA');
        break;
        
      case 'updateArea':
        output = handleAdminAction(params, session, handleUpdateArea, 'UPDATE_AREA');
        break;
        
      case 'getRoles':
        output = handleAdminAction(params, session, handleGetRoles, 'GET_ROLES');
        break;
        
      case 'updateRole':
        output = handleAdminAction(params, session, handleUpdateRole, 'UPDATE_ROLE');
        break;
        
      case 'addCNE':
        output = handleAdminAction(params, session, handleAddCNE, 'ADD_CNE');
        break;
        
      case 'updateCNE':
        output = handleAdminAction(params, session, handleUpdateCNE, 'UPDATE_CNE');
        break;
        
      case 'deleteCNE':
        output = handleAdminAction(params, session, handleDeleteCNE, 'DELETE_CNE');
        break;
        
      case 'addUpcomingClass':
        if (!session) {
          output = { success: false, errorCode: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' };
        } else {
          output = handleAddUpcomingClass(params, session);
        }
        break;

      case 'addDepartmentalSchedule':
        if (!session) {
          output = { success: false, errorCode: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' };
        } else {
          output = handleAddDepartmentalSchedule(params, session);
        }
        break;
        
      case 'updateUpcomingClass':
        if (!session) {
          output = { success: false, errorCode: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' };
        } else {
          output = handleUpdateUpcomingClass(params, session);
        }
        break;

      case 'setupAndVerifyCNESheets':
        output = handleAdminAction(params, session, handleSetupAndVerifyCNESheets, 'SETUP_AND_VERIFY_SHEETS');
        break;

      case 'reviewUpcomingClass':
        output = handleAdminAction(params, session, handleReviewUpcomingClass, 'REVIEW_UPCOMING_CLASS');
        break;
        
      case 'getAllApplications':
        output = handleAdminAction(params, session, handleGetAllApplications, 'GET_ALL_APPLICATIONS');
        break;
        
      case 'updateApplicationStatus':
        output = handleAdminAction(params, session, handleUpdateApplicationStatus, 'UPDATE_APP_STATUS');
        break;
        
      case 'uploadImage':
        output = handleAdminAction(params, session, handleUploadImage, 'UPLOAD_IMAGE');
        break;
        
      case 'updateGalleryItem':
        output = handleAdminAction(params, session, handleUpdateGalleryItem, 'UPDATE_GALLERY');
        break;
        
      case 'deleteGalleryItem':
        output = handleAdminAction(params, session, handleDeleteGalleryItem, 'DELETE_GALLERY');
        break;
        
      case 'addNewsEvent':
        output = handleAdminAction(params, session, handleAddNewsEvent, 'ADD_NEWS');
        break;
        
      case 'updateNewsEvent':
        output = handleAdminAction(params, session, handleUpdateNewsEvent, 'UPDATE_NEWS');
        break;
        
      case 'deleteNewsEvent':
        output = handleAdminAction(params, session, handleDeleteNewsEvent, 'DELETE_NEWS');
        break;
        
      case 'updateChairpersonMessage':
        output = handleAdminAction(params, session, handleUpdateChairpersonMessage, 'UPDATE_CHAIRPERSON_MSG');
        break;
        
      case 'updateCoordinatorDesk':
        output = handleAdminAction(params, session, handleUpdateCoordinatorDesk, 'UPDATE_COORDINATOR_DESK');
        break;
        
      case 'addQuickLink':
        output = handleAdminAction(params, session, handleAddQuickLink, 'ADD_QUICK_LINK');
        break;
        
      case 'updateQuickLink':
        output = handleAdminAction(params, session, handleUpdateQuickLink, 'UPDATE_QUICK_LINK');
        break;
        
      case 'deleteQuickLink':
        output = handleAdminAction(params, session, handleDeleteQuickLink, 'DELETE_QUICK_LINK');
        break;
        
      case 'initializeSheets':
        output = handleAdminAction(params, session, handleInitializeSheets, 'INITIALIZE_SHEETS');
        break;
        
      case 'adminResetPassword':
        output = handleAdminAction(params, session, handleAdminResetPassword, 'ADMIN_RESET_PASSWORD');
        break;
        
      // Part 2: Reference Material, AI Questions, QR, Post-Test, Participants & Completion
      case 'saveReferenceMaterial':
        output = handleSaveReferenceMaterial(params, session);
        break;

      case 'getReferenceMaterial':
        output = handleGetReferenceMaterial(params, session);
        break;

      case 'getAiQuota':
        output = handleGetAiQuota(params, session);
        break;

      case 'reserveAiQuota':
        output = handleReserveAiQuota(params, session);
        break;

      case 'commitAiQuota':
        output = handleCommitAiQuota(params, session);
        break;

      case 'releaseAiQuota':
        output = handleReleaseAiQuota(params, session);
        break;

      case 'validateAiQuotaReservation':
        output = handleValidateAiQuotaReservation(params, session);
        break;

      case 'saveCNEQuestions':
        output = handleSaveCNEQuestions(params, session);
        break;

      case 'getCNEQuestions':
        output = handleGetCNEQuestions(params, session);
        break;

      case 'getQRToken':
        output = handleGetQRToken(params, session);
        break;

      case 'resolveQRToken':
        output = handleResolveQRToken(params);
        break;

      case 'getPostTestQuestions':
        output = handleGetPostTestQuestions(params, session);
        break;

      case 'submitPostTest':
        output = handleSubmitPostTest(params, session);
        break;

      case 'addManualParticipant':
        output = handleAddManualParticipant(params, session);
        break;

      case 'getCNEParticipants':
        output = handleGetCNEParticipants(params, session);
        break;

      case 'finalizeCNE':
        output = handleFinalizeCNE(params, session);
        break;

      case 'cancelCNE':
        output = handleCancelCNE(params, session);
        break;
        
      default:
        output = { success: false, message: 'Unknown action requested: ' + action };
    }
  } catch (error) {
    output = {
      success: false,
      errorCode: 'SERVER_EXECUTION_ERROR',
      message: 'Server execution error: ' + error.message
    };
  }
  
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Administrative Dispatch Wrapper with Server-Side Session Verification & Audit
 */
function handleAdminAction(params, session, handlerFn, actionName) {
  if (!session) {
    logAuditAction(actionName, params.loggedInEmployeeId || '', 'Unauthorized access attempt - No valid session', 'FORBIDDEN');
    return {
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in.'
    };
  }
  
  var forbidden = requireAdmin(session);
  if (forbidden) {
    logAuditAction(actionName, session.employeeId, 'Forbidden - Non-admin attempted administrative action', 'FORBIDDEN');
    return forbidden;
  }
  
  return handlerFn(params, session);
}

/**
 * Diagnostic & Health Check (No Secrets or Sensitive Data Leaked)
 */
function handleDiagnosticPing(params) {
  var props = PropertiesService.getScriptProperties();
  var diagnostics = {
    backendApi: 'PASS',
    cneSpreadsheet: 'FAIL',
    employeeMaster: 'FAIL',
    dataTab: 'FAIL',
    areaTab: 'FAIL',
    roleTab: 'FAIL',
    sessionConfig: 'FAIL',
    passwordPepper: 'FAIL',
    driveGallery: 'NOT CONFIGURED'
  };
  
  var sheetNames = [];
  
  // 1. Check CNE Spreadsheet
  try {
    var cneSS = getSpreadsheet('CNE');
    diagnostics.cneSpreadsheet = 'PASS';
    var sheets = cneSS.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sName = sheets[i].getName();
      sheetNames.push(sName);
      if (sName === 'Data') diagnostics.dataTab = 'PASS';
      if (sName === 'Area') diagnostics.areaTab = 'PASS';
      if (sName === 'Role') diagnostics.roleTab = 'PASS';
    }
  } catch (e) {
    diagnostics.cneSpreadsheet = 'FAIL';
  }
  
  // 2. Check Employee Master Spreadsheet
  try {
    var offSS = getSpreadsheet('OFFICERS');
    var offSheet = offSS.getSheetByName('Rosters Master Data');
    if (offSheet) {
      diagnostics.employeeMaster = 'PASS';
    } else {
      diagnostics.employeeMaster = 'FAIL';
    }
  } catch (e) {
    diagnostics.employeeMaster = 'FAIL';
  }
  
  // 3. Check Session Security & Password Pepper
  if (props.getProperty('SESSION_SECRET') && props.getProperty('SESSION_SECRET').trim() !== '') {
    diagnostics.sessionConfig = 'PASS';
  }
  if (props.getProperty('PASSWORD_PEPPER') && props.getProperty('PASSWORD_PEPPER').trim() !== '') {
    diagnostics.passwordPepper = 'PASS';
  }
  
  // 4. Check Drive Folder
  var driveFolderId = props.getProperty('DRIVE_FOLDER_ID');
  if (driveFolderId && driveFolderId.trim() !== '') {
    try {
      DriveApp.getFolderById(driveFolderId.trim());
      diagnostics.driveGallery = 'PASS';
    } catch (e) {
      diagnostics.driveGallery = 'FAIL';
    }
  }
  
  return {
    success: true,
    message: 'CNE Apps Script API is online and responding.',
    diagnostics: diagnostics,
    sheetNames: sheetNames,
    timestamp: new Date().toISOString(),
    version: '2.2.0-PROD-SECURE'
  };
}

/**
 * Comprehensive User Role & Assigned Area Resolution
 * Supports ADMIN, AREA_INCHARGE, and EMPLOYEE roles
 */
function getUserRoleInfo(employeeId) {
  var normId = normalizeEmpId(employeeId);
  var result = { role: 'EMPLOYEE', assignedArea: '', assignedAreas: [] };
  if (!normId) return result;
  
  try {
    var ss = getSpreadsheet('CNE');
    var roleSheet = ss.getSheetByName('Role');
    if (roleSheet) {
      var data = roleSheet.getDataRange().getValues();
      if (data.length > 1) {
        var empIdCol = 0;
        var roleCol = 3;
        var areaCol = -1;
        var headers = data[0];
        for (var i = 0; i < headers.length; i++) {
          var h = String(headers[i]).toLowerCase().trim();
          if (h.indexOf('emp') !== -1 && h.indexOf('id') !== -1) empIdCol = i;
          if (h === 'role') roleCol = i;
          if (h.indexOf('area') !== -1 || h.indexOf('department') !== -1) areaCol = i;
        }
        
        for (var r = 1; r < data.length; r++) {
          var rowEmpId = normalizeEmpId(data[r][empIdCol]);
          if (rowEmpId === normId) {
            var rVal = String(data[r][roleCol] || '').toUpperCase().trim();
            if (rVal === 'ADMIN') {
              result.role = 'ADMIN';
            } else if (rVal === 'AREA_INCHARGE' || rVal === 'INCHARGE') {
              result.role = 'AREA_INCHARGE';
            }
            if (areaCol !== -1 && data[r][areaCol]) {
              var rawArea = String(data[r][areaCol]).trim();
              result.assignedArea = rawArea;
              result.assignedAreas = rawArea ? rawArea.split(/[,;\\n]+/).map(function(s) { return s.trim(); }).filter(Boolean) : [];
            }
            return result;
          }
        }
      }
    }
    
    // Also check Area sheet if assigned as Incharge
    var areaSheet = ss.getSheetByName('Area');
    if (areaSheet) {
      var aData = areaSheet.getDataRange().getValues();
      if (aData.length > 1) {
        var inchargeCol = -1;
        for (var c = 0; c < aData[0].length; c++) {
          var ah = String(aData[0][c]).toLowerCase().trim();
          if (ah.indexOf('incharge') !== -1 && ah.indexOf('id') !== -1) inchargeCol = c;
        }
        if (inchargeCol !== -1) {
          for (var ar = 1; ar < aData.length; ar++) {
            if (normalizeEmpId(aData[ar][inchargeCol]) === normId) {
              result.role = 'AREA_INCHARGE';
              var aArea = String(aData[ar][0]).trim();
              result.assignedArea = aArea;
              result.assignedAreas = aArea ? [aArea] : [];
              return result;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error reading role info: ' + e.message);
  }
  
  return result;
}

function getUserRole(employeeId) {
  return getUserRoleInfo(employeeId).role;
}

/**
 * Authorization Helper for CNE Management
 * Admin = full control over both Central and Departmental CNE
 * Area Incharge = Departmental CNE only within assigned Area(s)/Department(s)
 * Normal users = no administrative controls
 */
function checkCNEAuthorized(session, cneArea, cneType) {
  if (!session) {
    return {
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in.'
    };
  }
  
  var role = String(session.role || '').toUpperCase();
  if (role === 'ADMIN') {
    return null; // Admin has full control
  }
  
  if (role === 'AREA_INCHARGE' || role === 'INCHARGE') {
    var type = normalizeCNEType(cneType);
    // FAIL CLOSED: Only strictly valid DEPARTMENTAL CNE is manageable by Area Incharge
    if (type === 'DEPARTMENTAL') {
      var assignedAreas = [];
      if (session.assignedAreas && Array.isArray(session.assignedAreas)) {
        for (var i = 0; i < session.assignedAreas.length; i++) {
          var a = String(session.assignedAreas[i] || '').trim();
          if (a) assignedAreas.push(a);
        }
      }
      if (assignedAreas.length === 0) {
        var rawAssigned = String(session.assignedArea || (session.employeeId ? getUserRoleInfo(session.employeeId).assignedArea : '') || '').trim();
        if (rawAssigned) {
          var parts = rawAssigned.split(/[,;\\n]+/);
          for (var p = 0; p < parts.length; p++) {
            var trimmed = parts[p].trim();
            if (trimmed) assignedAreas.push(trimmed);
          }
        }
      }

      var targetArea = String(cneArea || '').trim().toLowerCase();
      if (targetArea && assignedAreas.length > 0) {
        for (var j = 0; j < assignedAreas.length; j++) {
          if (String(assignedAreas[j]).trim().toLowerCase() === targetArea) {
            return null; // Authorized for this Departmental CNE
          }
        }
      }
    }
  }
  
  return {
    success: false,
    errorCode: 'FORBIDDEN',
    message: 'Permission denied. Only an Administrator or the designated Area Incharge for this department may manage this CNE.'
  };
}

/**
 * Safe Header Detection for 'Rosters Master Data' Tab
 * Dynamically resolves column indices without silent incorrect hardcoded fallbacks.
 * Recognizes exact columns:
 *   Column A: Name of the Officers
 *   Column B: Designation
 *   Column C: Type of employment
 *   Column D: Contact No.
 *   Column E: Employee ID No.
 *   Column F: Date of Joining
 * Also recognizes common header variants for institutional resilience.
 */
function findOfficerHeaders(headers) {
  var empCol = -1, nameCol = -1, desigCol = -1, empTypeCol = -1, contactCol = -1, dojCol = -1;
  
  if (!headers || !headers.length) {
    return { empCol: -1, nameCol: -1, desigCol: -1, empTypeCol: -1, contactCol: -1, dojCol: -1 };
  }
  
  for (var c = 0; c < headers.length; c++) {
    var raw = String(headers[c] || '').trim();
    var h = raw.toLowerCase();
    if (!h) continue;
    
    // 1. Employee ID No. (Column E, or header variants)
    if (empCol === -1) {
      if (h === 'employee id no.' || h === 'employee id no' || h === 'employee id number' ||
          h === 'employee id' || h === 'employee no.' || h === 'employee no' ||
          h === 'emp id' || h === 'emp id no.' || h === 'emp id no' ||
          h === 'id' || h === 'empid' || h === 'employee_id' ||
          (h.indexOf('emp') !== -1 && (h.indexOf('id') !== -1 || h.indexOf('no') !== -1))) {
        empCol = c;
      }
    }
    
    // 2. Name of the Officers (Column A, or header variants)
    if (nameCol === -1) {
      if (h === 'name of the officers' || h === 'name of the officer' || h === 'name of officers' ||
          h === 'name of officer' || h === 'officer name' || h === 'employee name' || h === 'staff name' ||
          (h.indexOf('name') !== -1 && (h.indexOf('officer') !== -1 || h.indexOf('emp') !== -1 || h.indexOf('staff') !== -1))) {
        nameCol = c;
      }
    }
    
    // 3. Designation (Column B, or header variants)
    if (desigCol === -1) {
      if (h.indexOf('designation') !== -1 || h.indexOf('desig') !== -1 || h.indexOf('post') !== -1) {
        desigCol = c;
      }
    }

    // 4. Type of employment (Column C, or header variants)
    if (empTypeCol === -1) {
      if (h === 'type of employment' || h === 'employment type' || h.indexOf('employment') !== -1) {
        empTypeCol = c;
      }
    }

    // 5. Contact No. (Column D, or header variants)
    if (contactCol === -1) {
      if (h === 'contact no.' || h === 'contact no' || h === 'contact number' ||
          h.indexOf('contact') !== -1 || h.indexOf('phone') !== -1 || h.indexOf('mobile') !== -1) {
        contactCol = c;
      }
    }
    
    // 6. Date of Joining (Column F, or header variants)
    if (dojCol === -1) {
      if (h === 'date of joining' ||
          h === 'date of joining aiims' ||
          h === 'joining date' ||
          h === 'doj' ||
          h === 'd.o.j' ||
          h === 'd.o.j.' ||
          h === 'd. o. j' ||
          h.indexOf('joining') !== -1 ||
          h.indexOf('doj') !== -1 ||
          h.indexOf('d.o.j') !== -1) {
        dojCol = c;
      }
    }
  }
  
  // Secondary fallback for Name if specific compound was not found
  if (nameCol === -1) {
    for (var c2 = 0; c2 < headers.length; c2++) {
      var h2 = String(headers[c2] || '').toLowerCase().trim();
      if (h2 === 'name') {
        nameCol = c2;
        break;
      }
    }
  }

  // Positional fallback for standard A1:F layout if header row is present
  // Col A(0): Name, Col B(1): Designation, Col C(2): Type of employment, Col D(3): Contact No., Col E(4): Employee ID No., Col F(5): Date of Joining
  if (headers.length >= 5 && empCol === -1) {
    var rawColE = String(headers[4] || '').toLowerCase();
    if (rawColE.indexOf('emp') !== -1 || rawColE.indexOf('id') !== -1 || rawColE.indexOf('no') !== -1) {
      empCol = 4;
    }
  }
  if (headers.length >= 6 && dojCol === -1) {
    var rawColF = String(headers[5] || '').toLowerCase();
    if (rawColF.indexOf('date') !== -1 || rawColF.indexOf('join') !== -1 || rawColF.indexOf('doj') !== -1) {
      dojCol = 5;
    }
  }
  
  return { empCol: empCol, nameCol: nameCol, desigCol: desigCol, empTypeCol: empTypeCol, contactCol: contactCol, dojCol: dojCol };
}

/**
 * Calendar validation helper for date parts (leap year aware)
 */
function isValidDateParts(year, month, day) {
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year < 1920 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  var isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  var daysInMonth = [31, (isLeap ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function padTwo(n) {
  return n < 10 ? '0' + n : String(n);
}

/**
 * Robust Canonical Date Normalizer
 * Converts any valid date representation into standard canonical format: YYYY-MM-DD
 * Supports:
 *  - Google Sheets Date objects
 *  - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (e.g. 15/08/2020, 15-08-2020, 15.08.2020)
 *  - YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD (e.g. 2020-08-15)
 *  - Textual months: 15-Aug-2020, 15 August 2020, Aug 15 2020
 * Returns canonical 'YYYY-MM-DD', or '' if invalid/unparseable.
 */
function normalizeDateForComparison(val) {
  if (val === null || val === undefined || val === '') return '';
  
  // 1. Google Sheets Date object
  if (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]') {
    if (isNaN(val.getTime())) return '';
    try {
      if (typeof Utilities !== 'undefined' && Utilities.formatDate && typeof Session !== 'undefined' && Session.getScriptTimeZone) {
        var tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
        return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
      }
    } catch (e) {}
    var y = val.getFullYear();
    var m = val.getMonth() + 1;
    var d = val.getDate();
    return isValidDateParts(y, m, d) ? (y + '-' + padTwo(m) + '-' + padTwo(d)) : '';
  }
  
  var str = String(val).trim();
  if (!str) return '';
  
  // 2. Textual month format: 15-Aug-2020, 15 August 2020, Aug 15 2020 (parse BEFORE whitespace splitting)
  var monthsMap = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12
  };
  
  // DD-MMM-YYYY or DD MMM YYYY (e.g. 15-Aug-2020, 15 August 2020, 15.Aug.2020)
  var matchTextMonth = str.match(/^(\\d{1,2})[-/.\\s]+([a-zA-Z]+)[-/.\\s,]+(\\d{4})(?:[T\\s].*)?$/);
  if (matchTextMonth) {
    var day = parseInt(matchTextMonth[1], 10);
    var mStr = matchTextMonth[2].toLowerCase();
    var year = parseInt(matchTextMonth[3], 10);
    var month = monthsMap[mStr];
    if (month && isValidDateParts(year, month, day)) {
      return year + '-' + padTwo(month) + '-' + padTwo(day);
    }
    return '';
  }
  
  // MMM DD YYYY (e.g. Aug 15 2020, August 15 2020, Aug 15, 2020)
  var matchMonthText = str.match(/^([a-zA-Z]+)[-/.\\s]+(\\d{1,2})[-/.\\s,]+(\\d{4})(?:[T\\s].*)?$/);
  if (matchMonthText) {
    var mStr = matchMonthText[1].toLowerCase();
    var day = parseInt(matchMonthText[2], 10);
    var year = parseInt(matchMonthText[3], 10);
    var month = monthsMap[mStr];
    if (month && isValidDateParts(year, month, day)) {
      return year + '-' + padTwo(month) + '-' + padTwo(day);
    }
    return '';
  }

  // YYYY-MMM-DD (e.g. 2020-Aug-15, 2020 August 15)
  var matchYearText = str.match(/^(\\d{4})[-/.\\s]+([a-zA-Z]+)[-/.\\s]+(\\d{1,2})(?:[T\\s].*)?$/);
  if (matchYearText) {
    var year = parseInt(matchYearText[1], 10);
    var mStr = matchYearText[2].toLowerCase();
    var day = parseInt(matchYearText[3], 10);
    var month = monthsMap[mStr];
    if (month && isValidDateParts(year, month, day)) {
      return year + '-' + padTwo(month) + '-' + padTwo(day);
    }
    return '';
  }
  
  // 3. Strip time portion for purely numeric formats (e.g. "2020-08-15T00:00:00.000Z" or "15/08/2020 00:00:00")
  var dateOnly = str.split(/[T\\s]/)[0].trim();
  
  // 4. YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  var matchYMD = dateOnly.match(/^(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})$/);
  if (matchYMD) {
    var year = parseInt(matchYMD[1], 10);
    var month = parseInt(matchYMD[2], 10);
    var day = parseInt(matchYMD[3], 10);
    if (isValidDateParts(year, month, day)) {
      return year + '-' + padTwo(month) + '-' + padTwo(day);
    }
    return '';
  }
  
  // 5. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  var matchDMY = dateOnly.match(/^(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{4})$/);
  if (matchDMY) {
    var p1 = parseInt(matchDMY[1], 10);
    var p2 = parseInt(matchDMY[2], 10);
    var year = parseInt(matchDMY[3], 10);
    var day, month;
    if (p1 > 12 && p2 <= 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      day = p2;
      month = p1;
    } else {
      // Preferred standard: DD/MM/YYYY
      day = p1;
      month = p2;
    }
    if (isValidDateParts(year, month, day)) {
      return year + '-' + padTwo(month) + '-' + padTwo(day);
    }
    return '';
  }
  
  return '';
}

/**
 * Helper: Format Date for display in preferred DD/MM/YYYY format
 */
function formatDateDisplay(val) {
  if (!val) return '';
  var canon = normalizeDateForComparison(val);
  if (canon) {
    var parts = canon.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  return String(val).trim();
}

/**
 * Helper to retrieve the authoritative Rosters Master Data sheet from DROPDOWN_SPREADSHEET_ID.
 * Strictly resolves 'Rosters Master Data'.
 * Strictly throws if the sheet is not found; NEVER silently falls back to getActiveSheet().
 */
function getRosterSheet() {
  var ss = getSpreadsheet('OFFICERS');
  var sheet = ss.getSheetByName('Rosters Master Data');
  if (!sheet) {
    throw new Error('Rosters Master Data sheet not found in spreadsheet configured by DROPDOWN_SPREADSHEET_ID.');
  }
  return sheet;
}

/**
 * Helper: Find Officer in 'Rosters Master Data' tab (DOJ stays strictly server-side)
 * Uses safe dynamic header detection with robust employee ID matching.
 */
function findOfficerById(employeeId) {
  var normId = normalizeEmpId(employeeId);
  if (!normId) return null;
  
  var sheet = getRosterSheet();
  var range = sheet.getDataRange();
  var data = range.getValues();
  var displayData = range.getDisplayValues();
  if (data.length <= 1) return null;
  
  var headers = data[0];
  var colMap = findOfficerHeaders(headers);
  
  // Safety check: Employee ID column MUST be safely identified
  if (colMap.empCol === -1) {
    throw new Error('System configuration error: Required column "Employee ID No." could not be identified in Rosters Master Data.');
  }

  // Diagnostic logging (strictly minimal, no secrets or credentials logged)
  Logger.log('[Roster Lookup] Sheet: "' + sheet.getName() + '" | Total rows: ' + data.length + ' | EmpId Col: ' + colMap.empCol + ' | Searching ID: ' + normId);
  
  for (var r = 1; r < data.length; r++) {
    var cellVal = data[r][colMap.empCol];
    var dispVal = displayData[r] ? displayData[r][colMap.empCol] : '';
    var rowEmpId = normalizeEmpId(dispVal || cellVal);
    if (!rowEmpId) rowEmpId = normalizeEmpId(cellVal);

    if (rowEmpId === normId) {
      var rawDoj = (colMap.dojCol !== -1) ? data[r][colMap.dojCol] : '';
      var dispDoj = (colMap.dojCol !== -1 && displayData[r]) ? String(displayData[r][colMap.dojCol] || '').trim() : '';
      var rawName = (colMap.nameCol !== -1) ? String((displayData[r] && displayData[r][colMap.nameCol]) || data[r][colMap.nameCol] || '').trim() : '';
      var rawDesig = (colMap.desigCol !== -1) ? String((displayData[r] && displayData[r][colMap.desigCol]) || data[r][colMap.desigCol] || '').trim() : '';
      var rawEmpType = (colMap.empTypeCol !== -1) ? String((displayData[r] && displayData[r][colMap.empTypeCol]) || data[r][colMap.empTypeCol] || '').trim() : '';
      var rawContact = (colMap.contactCol !== -1) ? String((displayData[r] && displayData[r][colMap.contactCol]) || data[r][colMap.contactCol] || '').trim() : '';
      var empIdExact = String(dispVal || cellVal || '').trim();

      Logger.log('[Roster Lookup] Match found for employee ID: ' + normId + ' (Row ' + (r + 1) + ')');

      return {
        employeeId: empIdExact,
        name: rawName,
        designation: rawDesig,
        employmentType: rawEmpType,
        typeOfEmployment: rawEmpType,
        contactNo: rawContact,
        doj: rawDoj,
        dojFormatted: dispDoj || formatDateDisplay(rawDoj),
        dojColMissing: (colMap.dojCol === -1)
      };
    }
  }

  Logger.log('[Roster Lookup] Employee ID "' + normId + '" not found in ' + sheet.getName() + ' (' + (data.length - 1) + ' roster records checked).');
  return null;
}

/**
 * Officers Dropdown (Admin Only, Sanitized: ONLY employeeId, name, designation returned)
 */
function handleGetOfficersDropdown(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var sheet;
  try {
    sheet = getRosterSheet();
  } catch (err) {
    return { success: false, message: err.message };
  }

  var range = sheet.getDataRange();
  var data = range.getValues();
  var displayData = range.getDisplayValues();
  var list = [];
  
  if (data.length > 1) {
    var headers = data[0];
    var colMap = findOfficerHeaders(headers);
    if (colMap.empCol === -1 || colMap.nameCol === -1) {
      return { success: false, message: 'System configuration error: Required columns (Employee ID No. / Name of the Officers) could not be identified in Rosters Master Data.' };
    }
    
    for (var r = 1; r < data.length; r++) {
      var empId = String((displayData[r] && displayData[r][colMap.empCol]) || data[r][colMap.empCol] || '').trim();
      var name = String((displayData[r] && displayData[r][colMap.nameCol]) || data[r][colMap.nameCol] || '').trim();
      var desig = (colMap.desigCol !== -1) ? String((displayData[r] && displayData[r][colMap.desigCol]) || data[r][colMap.desigCol] || '').trim() : '';
      if (empId) {
        list.push({
          employeeId: empId,
          name: name,
          designation: desig
        });
      }
    }
  }
  
  return { success: true, data: list };
}

/**
 * Helper: Build an in-memory map of { [employeeId]: officerName }
 * from the authoritative 'Rosters Master Data' tab in DROPDOWN_SPREADSHEET_ID.
 */
function getOfficerNameMap() {
  var map = {};
  try {
    var sheet = getRosterSheet();
    var range = sheet.getDataRange();
    var data = range.getValues();
    var displayData = range.getDisplayValues();
    if (data.length > 1) {
      var colMap = findOfficerHeaders(data[0]);
      if (colMap.empCol !== -1 && colMap.nameCol !== -1) {
        for (var r = 1; r < data.length; r++) {
          var empId = normalizeEmpId((displayData[r] && displayData[r][colMap.empCol]) || data[r][colMap.empCol]);
          var name = String((displayData[r] && displayData[r][colMap.nameCol]) || data[r][colMap.nameCol] || '').trim();
          if (empId && name) {
            map[empId] = name;
          }
        }
      }
    }
  } catch (e) {
    Logger.log('[Roster Map Warning] ' + e.message);
  }
  return map;
}

/**
 * Login Handler with Initial Default Password (pass1234) & Salted SHA-256 (Zero Backdoors)
 */
function handleLogin(params) {
  var employeeId = normalizeEmpId(params.employeeId);
  var password = (params.password || '').trim();
  
  if (!employeeId || !password) {
    return { success: false, message: 'Employee ID and password are required.' };
  }
  
  var officer;
  try {
    officer = findOfficerById(employeeId);
  } catch (err) {
    return { success: false, message: err.message || 'Error accessing institutional roster.' };
  }

  if (!officer) {
    return { success: false, message: 'Employee ID not found in institutional roster.' };
  }
  
  var ss = getCNESpreadsheet();
  var authSheet = ss.getSheetByName('User Credentials');
  if (!authSheet) {
    return {
      success: false,
      message: 'System configuration error: "User Credentials" sheet not found in CNE database. Please contact system administrator.'
    };
  }
  
  var authData = authSheet.getDataRange().getValues();
  var savedHash = '';
  var savedSalt = '';
  var mustChangePass = false;
  var userRowIndex = -1;
  
  for (var i = 1; i < authData.length; i++) {
    if (normalizeEmpId(authData[i][0]) === employeeId) {
      savedHash = String(authData[i][1] || '').trim();
      savedSalt = String(authData[i][2] || '').trim();
      mustChangePass = (String(authData[i][3] || '').toUpperCase() === 'YES');
      userRowIndex = i + 1;
      break;
    }
  }
  
  var isValid = false;
  var isFirstLogin = false;
  
  if (savedHash && savedSalt) {
    var computed = computePasswordHash(password, savedSalt);
    if (computed === savedHash) {
      isValid = true;
    }
  } else {
    // Initial First-Time Login: Default institutional password is pass1234
    if (password === 'pass1234') {
      isValid = true;
      isFirstLogin = true;
      mustChangePass = true;
    }
  }
  
  if (!isValid) {
    logAuditAction('LOGIN_FAILED', employeeId, 'Invalid credentials attempt', 'FAILED');
    return {
      success: false,
      message: 'Invalid credentials. Default initial password is pass1234'
    };
  }
  
  // Record Last Login
  if (userRowIndex > 0) {
    authSheet.getRange(userRowIndex, 7).setValue(new Date().toISOString());
  }
  
  var roleInfo = getUserRoleInfo(employeeId);
  var role = roleInfo.role;
  var token = generateSessionToken(employeeId);
  
  logAuditAction('LOGIN_SUCCESS', employeeId, 'Role: ' + role + (roleInfo.assignedArea ? ' (' + roleInfo.assignedArea + ')' : ''), 'SUCCESS');
  
  return {
    success: true,
    message: 'Login successful',
    data: {
      employeeId: officer.employeeId,
      name: officer.name,
      designation: officer.designation,
      role: role,
      assignedArea: roleInfo.assignedArea,
      assignedAreas: roleInfo.assignedAreas,
      token: token,
      isFirstLogin: isFirstLogin,
      mustChangePassword: mustChangePass
    }
  };
}

/**
 * Change Password
 */
function handleChangePassword(params, session) {
  if (!session) {
    return { success: false, errorCode: 'UNAUTHORIZED', message: 'Invalid or expired session. Please log in again.' };
  }
  
  var newPassword = (params.newPassword || '').trim();
  if (newPassword.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters long.' };
  }
  
  var salt = Utilities.getUuid().replace(/-/g, '');
  var hashStr = computePasswordHash(newPassword, salt);
  var empId = normalizeEmpId(session.employeeId);
  
  var ss = getCNESpreadsheet();
  var authSheet = ss.getSheetByName('User Credentials');
  if (!authSheet) {
    return {
      success: false,
      message: 'System configuration error: "User Credentials" sheet not found in CNE database. Please contact system administrator.'
    };
  }
  var data = authSheet.getDataRange().getValues();
  var updated = false;
  var now = new Date().toISOString();
  
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmpId(data[i][0]) === empId) {
      authSheet.getRange(i + 1, 2).setValue(hashStr);
      authSheet.getRange(i + 1, 3).setValue(salt);
      authSheet.getRange(i + 1, 4).setValue('NO');
      authSheet.getRange(i + 1, 6).setValue(now);
      authSheet.getRange(i + 1, 8).setValue('ACTIVE');
      updated = true;
      break;
    }
  }
  
  if (!updated) {
    authSheet.appendRow([empId, hashStr, salt, 'NO', now, now, now, 'ACTIVE']);
  }
  
  // Invalidate previous active sessions
  CacheService.getScriptCache().put('pwd_change_' + empId, String(Date.now()), 7 * 24 * 60 * 60);

  logAuditAction('PASSWORD_CHANGED', empId, 'User changed personal password', 'SUCCESS');
  
  return { success: true, message: 'Password updated successfully. You can now use your new password.' };
}

/**
 * Password Reset / Forgot Password with Date of Joining (DOJ) Verification & Rate Limiting
 */
function handleResetPassword(params) {
  var employeeId = normalizeEmpId(params.employeeId);
  var doj = (params.dateOfJoining || params.doj || '').trim();
  var newPassword = (params.newPassword || '').trim();
  
  if (!employeeId || !doj || !newPassword) {
    return { success: false, message: 'Employee ID, Date of Joining (DOJ) verification, and New Password are required.' };
  }
  
  // Rate-limiting check: max 5 failed attempts per 15 minutes per employee ID
  var cache = CacheService.getScriptCache();
  var cacheKey = 'reset_fail_' + employeeId;
  var failCount = parseInt(cache.get(cacheKey) || '0', 10);
  
  if (failCount >= 5) {
    logAuditAction('PASSWORD_RESET_BLOCKED', employeeId, 'Rate limit exceeded', 'BLOCKED');
    return {
      success: false,
      errorCode: 'RATE_LIMITED',
      message: 'Too many failed verification attempts. Please try again after 15 minutes or contact Nursing Administration.'
    };
  }
  
  if (newPassword.length < 6) {
    return { success: false, message: 'New password must be at least 6 characters long.' };
  }
  
  var officer;
  try {
    officer = findOfficerById(employeeId);
  } catch (err) {
    return { success: false, message: err.message || 'Error accessing institutional roster.' };
  }

  if (!officer) {
    cache.put(cacheKey, String(failCount + 1), 900);
    return { success: false, message: 'Verification failed. Please check your details and try again.' };
  }
  
  if (officer.dojColMissing) {
    return {
      success: false,
      message: 'System configuration error: Date of Joining column could not be identified in Rosters Master Data. Please contact system administrator.'
    };
  }
  
  // Strict comparison against Date of Joining (DOJ) ONLY - NO DOB Fallback
  var inputDojNorm = normalizeDateForComparison(doj);
  if (!inputDojNorm) {
    return {
      success: false,
      message: 'Invalid Date of Joining format. Please enter a valid date in DD/MM/YYYY format.'
    };
  }
  
  var officerDojNorm = normalizeDateForComparison(officer.doj);
  if (!officerDojNorm) {
    return {
      success: false,
      message: 'Hospital record error: Date of Joining in institutional roster is not formatted properly. Please contact system administrator.'
    };
  }
  
  if (inputDojNorm !== officerDojNorm) {
    cache.put(cacheKey, String(failCount + 1), 900);
    logAuditAction('PASSWORD_RESET_FAILED', employeeId, 'DOJ mismatch', 'FAILED');
    return { success: false, message: 'Verification failed. Date of Joining does not match hospital records.' };
  }
  
  // Reset failure count on success
  cache.remove(cacheKey);
  
  var salt = Utilities.getUuid().replace(/-/g, '');
  var hashStr = computePasswordHash(newPassword, salt);
  var now = new Date().toISOString();
  
  var ss = getCNESpreadsheet();
  var authSheet = ss.getSheetByName('User Credentials');
  if (!authSheet) {
    return {
      success: false,
      message: 'System configuration error: "User Credentials" sheet not found in CNE database. Please contact system administrator.'
    };
  }
  var data = authSheet.getDataRange().getValues();
  var updated = false;
  
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmpId(data[i][0]) === employeeId) {
      authSheet.getRange(i + 1, 2).setValue(hashStr);
      authSheet.getRange(i + 1, 3).setValue(salt);
      authSheet.getRange(i + 1, 4).setValue('NO');
      authSheet.getRange(i + 1, 6).setValue(now);
      authSheet.getRange(i + 1, 8).setValue('ACTIVE');
      updated = true;
      break;
    }
  }
  
  if (!updated) {
    authSheet.appendRow([employeeId, hashStr, salt, 'NO', now, now, now, 'ACTIVE']);
  }
  
  // Invalidate previous active sessions
  CacheService.getScriptCache().put('pwd_change_' + employeeId, String(Date.now()), 7 * 24 * 60 * 60);

  logAuditAction('PASSWORD_RESET_SUCCESS', employeeId, 'Password reset via DOJ verification', 'SUCCESS');
  
  return { success: true, message: 'Password reset successfully. You can now log in with your new password.' };
}

/**
 * Admin Password Reset: Admin resets an employee's password back to pass1234
 */
function handleAdminResetPassword(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;
  
  var targetEmpId = normalizeEmpId(params.targetEmployeeId || params.employeeId);
  if (!targetEmpId) {
    return { success: false, message: 'Target Employee ID is required.' };
  }
  
  var targetOfficer = findOfficerById(targetEmpId);
  if (!targetOfficer) {
    return { success: false, message: 'Employee ID (' + targetEmpId + ') not found in master roster.' };
  }
  
  var salt = Utilities.getUuid().replace(/-/g, '');
  var defaultHash = computePasswordHash('pass1234', salt);
  var now = new Date().toISOString();
  
  var ss = getCNESpreadsheet();
  var authSheet = ss.getSheetByName('User Credentials');
  if (!authSheet) {
    return {
      success: false,
      message: 'System configuration error: "User Credentials" sheet not found in CNE database. Please contact system administrator.'
    };
  }
  var data = authSheet.getDataRange().getValues();
  var updated = false;
  
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmpId(data[i][0]) === targetEmpId) {
      authSheet.getRange(i + 1, 2).setValue(defaultHash);
      authSheet.getRange(i + 1, 3).setValue(salt);
      authSheet.getRange(i + 1, 4).setValue('YES');
      authSheet.getRange(i + 1, 6).setValue(now);
      authSheet.getRange(i + 1, 8).setValue('ACTIVE');
      updated = true;
      break;
    }
  }
  
  if (!updated) {
    authSheet.appendRow([targetEmpId, defaultHash, salt, 'YES', now, now, now, 'ACTIVE']);
  }
  
  // Invalidate previous active sessions
  CacheService.getScriptCache().put('pwd_change_' + targetEmpId, String(Date.now()), 7 * 24 * 60 * 60);

  logAuditAction('ADMIN_PASSWORD_RESET', session.employeeId, 'Target Employee ID: ' + targetEmpId + ', Timestamp: ' + now + ', Status: SUCCESS', 'SUCCESS');
  
  return {
    success: true,
    message: 'Password for ' + targetOfficer.name + ' (' + targetEmpId + ') has been reset to default password.'
  };
}

/**
 * Areas Management
 */
function handleGetAreas(params) {
  var sheet = getOrCreateSheet('Area');
  var data = sheet.getDataRange().getValues();
  var areas = [];
  
  for (var r = 1; r < data.length; r++) {
    var name = String(data[r][0] || '').trim();
    var status = String(data[r][1] || 'ACTIVE').trim().toUpperCase();
    if (name) {
      areas.push({
        id: 'AREA-' + r,
        name: name,
        status: (status === 'INACTIVE') ? 'INACTIVE' : 'ACTIVE',
        createdAt: data[r][2] ? String(data[r][2]) : ''
      });
    }
  }
  
  return { success: true, data: areas };
}

function handleAddArea(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var areaName = sanitizeCellInput(params.name);
  if (!areaName) return { success: false, message: 'Area name is required.' };
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy processing another request. Please try again.' };
  }
  
  try {
    var sheet = getOrCreateSheet('Area');
    var data = sheet.getDataRange().getValues();
    
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === areaName.toLowerCase()) {
        return { success: false, message: 'An area with this name already exists.' };
      }
    }
    
    sheet.appendRow([areaName, 'ACTIVE', new Date().toISOString()]);
    logAuditAction('ADD_AREA', session.employeeId, 'Added area: ' + areaName, 'SUCCESS');
    return { success: true, message: 'Area added successfully.' };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateArea(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var oldName = String(params.oldName || '').trim();
  var newName = sanitizeCellInput(params.name);
  var status = (params.status || 'ACTIVE').toUpperCase();
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('Area');
    if (!sheet) return { success: false, message: 'Area sheet not found.' };
    
    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === oldName.toLowerCase()) {
        sheet.getRange(r + 1, 1).setValue(newName || oldName);
        sheet.getRange(r + 1, 2).setValue(status);
        logAuditAction('UPDATE_AREA', session.employeeId, 'Updated area: ' + oldName + ' -> ' + (newName || oldName), 'SUCCESS');
        return { success: true, message: 'Area updated successfully.' };
      }
    }
    return { success: false, message: 'Area not found.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Safely normalize Duration to standard HH:MM:SS duration string.
 * Duration in Google Sheets can be returned as:
 * 1. Formatted display string from getDisplayValues() (e.g. "1:00:00", "1:30:00", "0:30:00", "15:00:00")
 * 2. Numeric serial fraction of a day (e.g. 1/24 = 0.041666... for 1 hr, 1.5/24 = 0.0625 for 1.5 hrs, 25/24 for 25 hrs)
 * 3. Formatted duration string (e.g. "1:30:00", "25:00:00")
 * 4. Date object from getValues() (e.g. Sat Dec 30 1899 01:30:00 GMT+...)
 * Note: Duration can exceed 24 hours (e.g. 25:00:00, 120:00:00). It must NEVER be converted to a JavaScript Date object.
 */
function formatDurationValue(rawValue, displayValue) {
  // 1. Prefer Google Sheets display value if available and valid duration
  if (displayValue !== null && displayValue !== undefined) {
    var disp = String(displayValue).trim();
    if (disp) {
      var durMatch = disp.match(/^(\\d+):([0-5]?\\d)(?::([0-5]?\\d))?$/);
      if (durMatch) {
        var h0 = durMatch[1].length === 1 ? '0' + durMatch[1] : durMatch[1];
        if (durMatch[3] !== undefined) {
          var m1 = durMatch[2].length === 1 ? '0' + durMatch[2] : durMatch[2];
          var s1 = durMatch[3].length === 1 ? '0' + durMatch[3] : durMatch[3];
          return h0 + ':' + m1 + ':' + s1;
        }
        var m0 = durMatch[2].length === 1 ? '0' + durMatch[2] : durMatch[2];
        return h0 + ':' + m0 + ':00';
      }
    }
  }

  // 2. Safe numeric day-fraction conversion (Google Sheets serial value)
  if (typeof rawValue === 'number' && !isNaN(rawValue)) {
    var totalSeconds = Math.round(rawValue * 86400);
    if (totalSeconds >= 0) {
      var nHours = Math.floor(totalSeconds / 3600);
      var nMinutes = Math.floor((totalSeconds % 3600) / 60);
      var nSeconds = totalSeconds % 60;
      var padNh = nHours < 10 ? '0' + nHours : nHours;
      return padNh + ':' + (nMinutes < 10 ? '0' : '') + nMinutes + ':' + (nSeconds < 10 ? '0' : '') + nSeconds;
    }
  }

  // If rawValue is a duration string (e.g. "1:30:00" or "25:00:00")
  if (typeof rawValue === 'string') {
    var str = rawValue.trim();
    var durMatchStr = str.match(/^(\\d+):([0-5]?\\d)(?::([0-5]?\\d))?$/);
    if (durMatchStr) {
      var hStr2 = durMatchStr[1].length === 1 ? '0' + durMatchStr[1] : durMatchStr[1];
      if (durMatchStr[3] !== undefined) {
        var m2 = durMatchStr[2].length === 1 ? '0' + durMatchStr[2] : durMatchStr[2];
        var s2 = durMatchStr[3].length === 1 ? '0' + durMatchStr[3] : durMatchStr[3];
        return hStr2 + ':' + m2 + ':' + s2;
      }
      var m3 = durMatchStr[2].length === 1 ? '0' + durMatchStr[2] : durMatchStr[2];
      return hStr2 + ':' + m3 + ':00';
    }

    // If string is an 1899 Date string representation
    if (str.indexOf('1899') !== -1 || str.indexOf('GMT') !== -1) {
      var parsedDate = new Date(str);
      if (!isNaN(parsedDate.getTime())) {
        var pdHours = parsedDate.getHours();
        var pdMinutes = parsedDate.getMinutes();
        var pdSeconds = parsedDate.getSeconds();
        var padPdh = pdHours < 10 ? '0' + pdHours : pdHours;
        return padPdh + ':' + (pdMinutes < 10 ? '0' : '') + pdMinutes + ':' + (pdSeconds < 10 ? '0' : '') + pdSeconds;
      }
    }
  }

  // If rawValue is an 1899 Date object (Google Sheets returns Date for time-formatted cells under 24 hrs when read without display value)
  if (Object.prototype.toString.call(rawValue) === '[object Date]' || (rawValue instanceof Date)) {
    if (!isNaN(rawValue.getTime())) {
      var dHours = rawValue.getHours();
      var dMinutes = rawValue.getMinutes();
      var dSeconds = rawValue.getSeconds();
      var padDh = dHours < 10 ? '0' + dHours : dHours;
      return padDh + ':' + (dMinutes < 10 ? '0' : '') + dMinutes + ':' + (dSeconds < 10 ? '0' : '') + dSeconds;
    }
  }

  // 3. Safe fallback handling
  return '01:00:00';
}

/**
 * Helper: Convert duration input (string "HH:MM:SS" or "HH:MM", or numeric day fraction) to day-fraction number.
 * e.g. "1:00:00" -> 1/24 (0.041666666666666664)
 *      "1:30:00" -> 1.5/24 (0.0625)
 *      "0:30:00" -> 0.5/24 (0.020833333333333332)
 *      "25:00:00" -> 25/24 (1.0416666666666667)
 * Returns number (day fraction), or null if unparseable.
 */
function parseDurationToDayFraction(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number' && !isNaN(val) && val >= 0) return val;
  var str = String(val).trim();
  var match = str.match(/^(\\d+):([0-5]?\\d)(?::([0-5]?\\d))?$/);
  if (match) {
    var hrs = parseInt(match[1], 10);
    var mins = parseInt(match[2], 10);
    var secs = match[3] !== undefined ? parseInt(match[3], 10) : 0;
    var totalSeconds = hrs * 3600 + mins * 60 + secs;
    return totalSeconds / 86400;
  }
  return null;
}

/**
 * 6. CNE Records Retrieval with Strict Server-Side Role and Privacy Filtering
 */
function handleGetCNERecords(params, session) {
  if (!session) {
    return { success: false, errorCode: 'UNAUTHORIZED', message: 'Unauthorized session.' };
  }
  
  var isAdmin = session.role === 'ADMIN';
  var loggedInId = normalizeEmpId(session.employeeId);
  
  var ss = getSpreadsheet('CNE');
  var sheet = ss.getSheetByName('Data');
  if (!sheet) return { success: true, data: [] };
  
  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();
  if (data.length <= 1) return { success: true, data: [] };
  var displayValues = dataRange.getDisplayValues();
  var officerMap = getOfficerNameMap();
  var colMap = getHeaderMap(sheet);
  
  var records = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var dataId = String(row[0] || '').trim();
    if (!dataId) continue;
    
    var area = String(row[1] || '').trim();
    var fromDate = formatDateValue(row[2]);
    var toDate = formatDateValue(row[3]);
    var displayDur = (displayValues && displayValues[r]) ? displayValues[r][4] : '';
    var duration = formatDurationValue(row[4], displayDur);
    var topic = String(row[5] || '').trim();
    var resourcePersonEmpId = normalizeEmpId(row[6]);
    var mode = String(row[7] || '').trim();
    var staffIdsRaw = String(row[8] || '').trim();
    var staffCount = parseInt(row[9], 10) || 0;
    var remarks = String(row[10] || '').trim();
    var rawType = colMap['typeofcne'] !== undefined ? row[colMap['typeofcne']] : row[15];
    var cneType = normalizeCNEType(rawType);
    
    // Strict exact participant parsing
    var staffArray = staffIdsRaw.split(',').map(function(s) {
      return normalizeEmpId(s);
    }).filter(Boolean);
    
    if (staffCount === 0 && staffArray.length > 0) {
      staffCount = staffArray.length;
    }
    
    var rpArray = resourcePersonEmpId.split(',').map(function(s) {
      return normalizeEmpId(s);
    }).filter(Boolean);
    
    var isResourcePerson = (rpArray.indexOf(loggedInId) !== -1);
    var isStaffParticipant = (staffArray.indexOf(loggedInId) !== -1);
    
    // Ordinary employees ONLY receive records where they were RP or participant
    if (!isAdmin && !isResourcePerson && !isStaffParticipant) {
      continue;
    }
    
    var extRp = row[13] ? String(row[13]).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
    var extStaff = row[14] ? String(row[14]).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];

    // PRIVACY HARDENING: Non-admins ONLY receive their own ID in staffEmpIds (never other staff IDs)
    var sanitizedStaffEmpIds = isAdmin ? staffArray : (isStaffParticipant ? [session.employeeId] : []);
    
    var rpNames = rpArray.map(function(id) {
      return officerMap[id] || id;
    }).filter(Boolean);
    var rpNameString = rpNames.join(', ');

    var staffNameList = sanitizedStaffEmpIds.map(function(id) {
      return officerMap[id] || id;
    });

    records.push({
      dataId: dataId,
      area: area,
      fromDate: fromDate,
      toDate: toDate,
      duration: duration,
      topic: topic,
      resourcePersonEmpId: resourcePersonEmpId,
      resourcePersonName: rpNameString,
      externalResourcePersons: extRp,
      externalStaffParticipants: isAdmin ? extStaff : [],
      modeOfTeaching: mode,
      staffEmpIds: sanitizedStaffEmpIds,
      staffNames: staffNameList,
      staffCount: staffCount,
      remarks: remarks,
      cneType: cneType
    });
  }
  
  return { success: true, data: records };
}

/**
 * 18 & 19. Add CNE Activity with Concurrency Locking & Server-Side Roster Validation
 */
function handleAddCNE(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy processing another update. Please try again.' };
  }
  
  try {
    var sheet = getOrCreateSheet('Data');
    
    var fromDate = (params.fromDate || '').trim();
    var toDate = (params.toDate || fromDate).trim();
    var topic = sanitizeCellInput(params.topic);
    var area = sanitizeCellInput(params.area);
    
    // Validate multiple internal Resource Person IDs individually
    var rawRp = params.resourcePersonEmpIds !== undefined ? params.resourcePersonEmpIds : params.resourcePersonEmpId;
    var listRp = Array.isArray(rawRp) ? rawRp : (rawRp || '').split(',');
    var inputRp = [];
    for (var k = 0; k < listRp.length; k++) {
      var splitParts = String(listRp[k] || '').split(/[,;\\n]+/);
      for (var sp = 0; sp < splitParts.length; sp++) {
        var trimmed = splitParts[sp].trim();
        if (trimmed) inputRp.push(trimmed);
      }
    }
    var cleanRpMap = {};
    var rpClean = [];
    var invalidRpIds = [];

    for (var i = 0; i < inputRp.length; i++) {
      var rpid = normalizeEmpId(inputRp[i]);
      if (!rpid) continue;
      if (rpid.toLowerCase().indexOf('ext:') === 0) continue;
      if (!cleanRpMap[rpid]) {
        cleanRpMap[rpid] = true;
        var rpOfficerCheck = findOfficerById(rpid);
        if (!rpOfficerCheck) {
          invalidRpIds.push(rpid);
        } else {
          rpClean.push(rpid);
        }
      }
    }

    if (invalidRpIds.length > 0) {
      return {
        success: false,
        message: 'Invalid Resource Person Employee ID(s) not found in master roster: ' + invalidRpIds.join(', ')
      };
    }

    // External Resource Persons (names, no ID validation)
    var extRp = Array.isArray(params.externalResourcePersons)
      ? params.externalResourcePersons
      : (params.externalResourcePersons || '').split(',');
    var extRpClean = extRp.map(function(s) { return sanitizeCellInput(String(s).trim()); }).filter(Boolean);

    if (!topic || !area || !fromDate || (rpClean.length === 0 && extRpClean.length === 0)) {
      return { success: false, message: 'Topic, Area, Date, and at least one Resource Person (Internal or External) are required.' };
    }

    var cneType = normalizeCNEType(params.cneType);
    if (!cneType) {
      return { success: false, errorCode: 'INVALID_CNE_TYPE', message: 'Type of CNE is required and must be either CENTRAL or DEPARTMENTAL.' };
    }
    
    // Sanitize, deduplicate, and validate staff IDs against Rosters Master Data individually
    var rawStaff = params.staffEmpIds !== undefined ? params.staffEmpIds : params.staffEmpId;
    var listStaff = Array.isArray(rawStaff) ? rawStaff : (rawStaff || '').split(',');
    var inputStaff = [];
    for (var sk = 0; sk < listStaff.length; sk++) {
      var sParts = String(listStaff[sk] || '').split(/[,;\\n]+/);
      for (var ssp = 0; ssp < sParts.length; ssp++) {
        var sTrimmed = sParts[ssp].trim();
        if (sTrimmed) inputStaff.push(sTrimmed);
      }
    }
    var cleanMap = {};
    var staffClean = [];
    var invalidStaffIds = [];
    
    for (var i = 0; i < inputStaff.length; i++) {
      var sid = normalizeEmpId(inputStaff[i]);
      if (!sid) continue;
      if (!cleanMap[sid]) {
        cleanMap[sid] = true;
        var officerCheck = findOfficerById(sid);
        if (!officerCheck) {
          invalidStaffIds.push(sid);
        } else {
          staffClean.push(sid);
        }
      }
    }
    
    if (invalidStaffIds.length > 0) {
      return {
        success: false,
        message: 'Invalid participant Employee ID(s) not found in master roster: ' + invalidStaffIds.join(', ')
      };
    }

    // External Staff Participants (names, no ID validation)
    var extStaff = Array.isArray(params.externalStaffParticipants)
      ? params.externalStaffParticipants
      : (params.externalStaffParticipants || '').split(',');
    var extStaffClean = extStaff.map(function(s) { return sanitizeCellInput(String(s).trim()); }).filter(Boolean);
    
    var staffString = staffClean.join(', ');
    var totalStaffCount = staffClean.length + extStaffClean.length;
    
    // Collision-resistant Data ID generation under ScriptLock
    var curYear = new Date().getFullYear();
    var data = sheet.getDataRange().getValues();
    var nextNum = 1;
    for (var r = 1; r < data.length; r++) {
      var rowId = String(data[r][0] || '');
      if (rowId.indexOf('CNE-' + curYear + '-') === 0) {
        var numPart = parseInt(rowId.split('-')[2], 10);
        if (!isNaN(numPart) && numPart >= nextNum) {
          nextNum = numPart + 1;
        }
      }
    }
    var dataId = 'CNE-' + curYear + '-' + ('00000' + nextNum).slice(-6);
    
    var durNum = parseDurationToDayFraction(params.duration);
    var durationValueToStore = durNum !== null ? durNum : (1 / 24);
    
    sheet.appendRow([
      dataId,
      area,
      fromDate,
      toDate,
      durationValueToStore,
      topic,
      rpClean.join(', '),
      sanitizeCellInput(params.modeOfTeaching || 'Lecture Cum Discussion'),
      staffString,
      totalStaffCount,
      sanitizeCellInput(params.remarks || ''),
      new Date().toISOString(),
      session.employeeId || '',
      extRpClean.join(', '),
      extStaffClean.join(', '),
      cneType
    ]);
    
    // Preserve Duration cell number format on newly appended row if not already formatted
    var lastRow = sheet.getLastRow();
    var durCell = sheet.getRange(lastRow, 5);
    var curFmt = durCell.getNumberFormat();
    if (!curFmt || curFmt === '@' || curFmt === 'General' || (curFmt.indexOf('h') === -1 && curFmt.indexOf('H') === -1 && curFmt.indexOf(':') === -1)) {
      var sampleFmt = sheet.getRange(2, 5).getNumberFormat();
      if (sampleFmt && (sampleFmt.indexOf('h') !== -1 || sampleFmt.indexOf('H') !== -1 || sampleFmt.indexOf(':') !== -1)) {
        durCell.setNumberFormat(sampleFmt);
      } else {
        durCell.setNumberFormat('[h]:mm:ss');
      }
    }
    
    logAuditAction('ADD_CNE', session.employeeId, 'Created Data ID: ' + dataId + ' (' + topic + ')', 'SUCCESS');
    return { success: true, message: 'CNE activity recorded successfully.', data: { dataId: dataId } };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 2. Secure CNE Activity Update with Concurrency Locking & Server-Side Roster Validation
 */
function handleUpdateCNE(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var dataId = (params.dataId || '').trim();
  if (!dataId) return { success: false, message: 'Data ID is required.' };
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy processing another request. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('Data');
    if (!sheet) return { success: false, message: 'Data sheet not found.' };
    
    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === dataId.toLowerCase()) {
        if (params.area !== undefined) sheet.getRange(r + 1, 2).setValue(sanitizeCellInput(params.area));
        if (params.fromDate !== undefined) sheet.getRange(r + 1, 3).setValue(params.fromDate);
        if (params.toDate !== undefined) sheet.getRange(r + 1, 4).setValue(params.toDate);
        if (params.duration !== undefined) {
          var updateDurNum = parseDurationToDayFraction(params.duration);
          var editDurCell = sheet.getRange(r + 1, 5);
          if (updateDurNum !== null) {
            editDurCell.setValue(updateDurNum);
            var editFmt = editDurCell.getNumberFormat();
            if (!editFmt || editFmt === '@' || editFmt === 'General' || (editFmt.indexOf('h') === -1 && editFmt.indexOf('H') === -1 && editFmt.indexOf(':') === -1)) {
              var sampleFmtEdit = sheet.getRange(2, 5).getNumberFormat();
              if (sampleFmtEdit && (sampleFmtEdit.indexOf('h') !== -1 || sampleFmtEdit.indexOf('H') !== -1 || sampleFmtEdit.indexOf(':') !== -1)) {
                editDurCell.setNumberFormat(sampleFmtEdit);
              } else {
                editDurCell.setNumberFormat('[h]:mm:ss');
              }
            }
          } else {
            editDurCell.setValue(sanitizeCellInput(params.duration));
          }
        }
        if (params.topic !== undefined) sheet.getRange(r + 1, 6).setValue(sanitizeCellInput(params.topic));
        
        // Existing values from sheet for safe partial-update fallback
        var existingRp = data[r][6] ? String(data[r][6]).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
        var existingExtRp = data[r][13] ? String(data[r][13]).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
        var existingStaff = data[r][8] ? String(data[r][8]).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
        var existingExtStaff = data[r][14] ? String(data[r][14]).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];

        var rpClean = existingRp;
        var extRpClean = existingExtRp;

        if (params.resourcePersonEmpId !== undefined || params.resourcePersonEmpIds !== undefined) {
          var rawRp = params.resourcePersonEmpIds !== undefined ? params.resourcePersonEmpIds : params.resourcePersonEmpId;
          var listRp = Array.isArray(rawRp) ? rawRp : (rawRp || '').split(',');
          var inputRp = [];
          for (var k = 0; k < listRp.length; k++) {
            var splitParts = String(listRp[k] || '').split(/[,;\\n]+/);
            for (var sp = 0; sp < splitParts.length; sp++) {
              var trimmed = splitParts[sp].trim();
              if (trimmed) inputRp.push(trimmed);
            }
          }
          var cleanRpMap = {};
          rpClean = [];
          var invalidRpIds = [];

          for (var i = 0; i < inputRp.length; i++) {
            var rpid = normalizeEmpId(inputRp[i]);
            if (!rpid) continue;
            if (rpid.toLowerCase().indexOf('ext:') === 0) continue;
            if (!cleanRpMap[rpid]) {
              cleanRpMap[rpid] = true;
              var rpOfficerCheck = findOfficerById(rpid);
              if (!rpOfficerCheck) {
                invalidRpIds.push(rpid);
              } else {
                rpClean.push(rpid);
              }
            }
          }

          if (invalidRpIds.length > 0) {
            return {
              success: false,
              message: 'Invalid Resource Person Employee ID(s) not found in roster: ' + invalidRpIds.join(', ')
            };
          }
        }

        if (params.externalResourcePersons !== undefined) {
          var extRp = Array.isArray(params.externalResourcePersons)
            ? params.externalResourcePersons
            : (params.externalResourcePersons || '').split(',');
          extRpClean = extRp.map(function(s) { return sanitizeCellInput(String(s).trim()); }).filter(Boolean);
        }

        if (params.resourcePersonEmpId !== undefined || params.resourcePersonEmpIds !== undefined || params.externalResourcePersons !== undefined) {
          if (rpClean.length === 0 && extRpClean.length === 0) {
            return { success: false, message: 'At least one Resource Person (Internal or External) is required.' };
          }
          sheet.getRange(r + 1, 7).setValue(rpClean.join(', '));
          sheet.getRange(r + 1, 14).setValue(extRpClean.join(', '));
        }
        
        if (params.modeOfTeaching !== undefined) sheet.getRange(r + 1, 8).setValue(sanitizeCellInput(params.modeOfTeaching));
        
        var staffClean = existingStaff;
        var extStaffClean = existingExtStaff;

        if (params.staffEmpIds !== undefined || params.staffEmpId !== undefined) {
          var rawStaff = params.staffEmpIds !== undefined ? params.staffEmpIds : params.staffEmpId;
          var listStaff = Array.isArray(rawStaff) ? rawStaff : (rawStaff || '').split(',');
          var inputStaff = [];
          for (var sk = 0; sk < listStaff.length; sk++) {
            var sParts = String(listStaff[sk] || '').split(/[,;\\n]+/);
            for (var ssp = 0; ssp < sParts.length; ssp++) {
              var sTrimmed = sParts[ssp].trim();
              if (sTrimmed) inputStaff.push(sTrimmed);
            }
          }
          var cleanMap = {};
          staffClean = [];
          var invalidStaffIds = [];
          
          for (var i = 0; i < inputStaff.length; i++) {
            var sid = normalizeEmpId(inputStaff[i]);
            if (!sid) continue;
            if (!cleanMap[sid]) {
              cleanMap[sid] = true;
              var officerCheck = findOfficerById(sid);
              if (!officerCheck) {
                invalidStaffIds.push(sid);
              } else {
                staffClean.push(sid);
              }
            }
          }
          
          if (invalidStaffIds.length > 0) {
            return {
              success: false,
              message: 'Invalid participant Employee ID(s) not found in master roster: ' + invalidStaffIds.join(', ')
            };
          }
        }

        if (params.externalStaffParticipants !== undefined) {
          var extStaff = Array.isArray(params.externalStaffParticipants)
            ? params.externalStaffParticipants
            : (params.externalStaffParticipants || '').split(',');
          extStaffClean = extStaff.map(function(s) { return sanitizeCellInput(String(s).trim()); }).filter(Boolean);
        }

        if (params.staffEmpIds !== undefined || params.staffEmpId !== undefined || params.externalStaffParticipants !== undefined) {
          sheet.getRange(r + 1, 9).setValue(staffClean.join(', '));
          sheet.getRange(r + 1, 10).setValue(staffClean.length + extStaffClean.length);
          sheet.getRange(r + 1, 15).setValue(extStaffClean.join(', '));
        }
        
        if (params.remarks !== undefined) sheet.getRange(r + 1, 11).setValue(sanitizeCellInput(params.remarks));
        if (params.cneType !== undefined) {
          var normType = normalizeCNEType(params.cneType);
          if (!normType) {
            return { success: false, errorCode: 'INVALID_CNE_TYPE', message: 'Type of CNE is invalid or missing. Must be either CENTRAL or DEPARTMENTAL.' };
          }
          var dataColMap = getHeaderMap(sheet);
          var cneTypeCol = (dataColMap['typeofcne'] !== undefined) ? (dataColMap['typeofcne'] + 1) : 16;
          sheet.getRange(r + 1, cneTypeCol).setValue(normType);
        }
        
        logAuditAction('UPDATE_CNE', session.employeeId, 'Updated Data ID: ' + dataId, 'SUCCESS');
        return { success: true, message: 'CNE record updated successfully.' };
      }
    }
    return { success: false, message: 'CNE record with ID ' + dataId + ' not found.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 3. Secure CNE Activity Delete with Concurrency Protection
 */
function handleDeleteCNE(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var dataId = (params.dataId || '').trim();
  if (!dataId) return { success: false, message: 'Data ID is required.' };
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('Data');
    if (!sheet) return { success: false, message: 'Data sheet not found.' };
    
    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === dataId.toLowerCase()) {
        sheet.deleteRow(r + 1);
        logAuditAction('DELETE_CNE', session.employeeId, 'Deleted Data ID: ' + dataId, 'SUCCESS');
        return { success: true, message: 'CNE record deleted successfully.' };
      }
    }
    return { success: false, message: 'Record not found.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 4 & 17. Upcoming Classes Management (Central & Departmental Scheduling)
 */
function handleGetUpcomingClasses(params) {
  var sheet = getOrCreateSheet('Upcoming Classes');
  var range = sheet.getDataRange();
  var data = range.getValues();
  if (data.length <= 1) return { success: true, data: [] };
  var displayValues = range.getDisplayValues();

  var colMap = getHeaderMap(sheet);
  var officerMap = getOfficerNameMap();
  var list = [];
  
  for (var r = 1; r < data.length; r++) {
    var id = String(data[r][colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 0)] || '').trim();
    if (!id) continue;
    
    var rawExtRp = colMap['externalresourcepersons'] !== undefined ? data[r][colMap['externalresourcepersons']] : (data[r][13] || '');
    var extRp = rawExtRp ? String(rawExtRp).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];

    var rawRp = String(data[r][colMap['resourcepersonempid'] !== undefined ? colMap['resourcepersonempid'] : 7] || '').trim();
    var rpIds = rawRp.split(/[,;\\n]+/).map(function(s) { return normalizeEmpId(s); }).filter(Boolean);
    var rpNames = rpIds.map(function(rpId) { return officerMap[rpId] || rpId; }).filter(Boolean);

    var rawDate = colMap['fromdate'] !== undefined ? data[r][colMap['fromdate']] : (colMap['date'] !== undefined ? data[r][colMap['date']] : data[r][3]);
    var rawToDate = colMap['todate'] !== undefined ? data[r][colMap['todate']] : (data[r][4] || rawDate);
    var rawStatus = colMap['status'] !== undefined ? data[r][colMap['status']] : data[r][11];
    var rawType = colMap['typeofcne'] !== undefined ? data[r][colMap['typeofcne']] : data[r][12];
    
    var durCol = colMap['duration'] !== undefined ? colMap['duration'] : 6;
    var rawDur = data[r][durCol];
    var dispDur = (displayValues && displayValues[r]) ? displayValues[r][durCol] : '';
    var duration = formatDurationValue(rawDur, dispDur) || '01:00:00';

    list.push({
      cneId: id,
      classId: id,
      topic: String(data[r][colMap['topic'] !== undefined ? colMap['topic'] : 1] || ''),
      area: String(data[r][colMap['area'] !== undefined ? colMap['area'] : 2] || ''),
      date: formatDateValue(rawDate),
      toDate: formatDateValue(rawToDate),
      time: String(data[r][colMap['time'] !== undefined ? colMap['time'] : 5] || ''),
      duration: duration,
      resourcePersonEmpId: rawRp,
      resourcePersonName: rpNames.join(', '),
      externalResourcePersons: extRp,
      modeOfTeaching: String(data[r][colMap['modeofteaching'] !== undefined ? colMap['modeofteaching'] : (colMap['mode'] !== undefined ? colMap['mode'] : data[r][8])] || 'Lecture Cum Discussion'),
      description: String(data[r][colMap['description'] !== undefined ? colMap['description'] : 9] || ''),
      maxParticipants: parseInt(data[r][colMap['maxparticipants'] !== undefined ? colMap['maxparticipants'] : 10], 10) || 50,
      status: normalizeCNEStatus(rawStatus),
      cneType: normalizeCNEType(rawType),
      proposedByEmpId: String(data[r][colMap['proposedby'] !== undefined ? colMap['proposedby'] : 14] || ''),
      adminRemarks: String(data[r][colMap['adminremarks'] !== undefined ? colMap['adminremarks'] : 15] || '')
    });
  }
  
  return { success: true, data: list };
}

/**
 * Helper: Parse duration string (HH:MM:SS or HH:MM or decimal hours) into total seconds.
 */
function parseDurationToSeconds(str) {
  if (!str) return null;
  var trimmed = String(str).trim();
  var parts = trimmed.split(':');
  if (parts.length >= 2 && parts.length <= 3) {
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var s = parts.length === 3 ? parseInt(parts[2], 10) : 0;
    if (isNaN(h) || isNaN(m) || isNaN(s) || m < 0 || m >= 60 || s < 0 || s >= 60 || h < 0) {
      return null;
    }
    return h * 3600 + m * 60 + s;
  }
  var num = parseFloat(trimmed);
  if (!isNaN(num) && num > 0) {
    return Math.round(num * 3600);
  }
  return null;
}

/**
 * Helper: Format total seconds into standard HH:MM:SS (e.g. 08:00:00).
 */
function formatSecondsToDuration(totalSeconds) {
  var s = Math.max(0, Math.round(totalSeconds));
  var hours = Math.floor(s / 3600);
  var minutes = Math.floor((s % 3600) / 60);
  var seconds = s % 60;
  var pad = function(n) { return (n < 10 ? '0' : '') + n; };
  return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
}

/**
 * Helper: Calculate distinct calendar days touched between fromDt and toDt inclusive.
 */
function getCalendarDaysTouched(fromDtStr, toDtStr) {
  if (!fromDtStr || !toDtStr) return 1;
  var d1 = new Date(fromDtStr);
  var d2 = new Date(toDtStr);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 1;
  var utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  var utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  var diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/**
 * Helper: Authoritative CNE duration validator.
 * Enforces minimum 00:05:00 (5 minutes) and maximum 8 hours × calendar days touched.
 */
function validateCneDuration(durationStr, fromDtStr, toDtStr) {
  var daysTouched = getCalendarDaysTouched(fromDtStr, toDtStr);
  var maxSeconds = daysTouched * 8 * 3600;
  var maxDurationStr = formatSecondsToDuration(maxSeconds);
  var minSeconds = 300; // 5 minutes (00:05:00)

  var sec = parseDurationToSeconds(durationStr);
  if (sec === null) {
    return {
      isValid: false,
      message: 'Invalid duration format. Please enter as HH:MM:SS (e.g. 01:30:00 or 08:00:00).',
      maxDurationStr: maxDurationStr
    };
  }

  if (sec < minSeconds || sec > maxSeconds) {
    return {
      isValid: false,
      message: 'Duration must be between 00:05:00 and ' + maxDurationStr + ' for this CNE.',
      maxDurationStr: maxDurationStr
    };
  }

  return { isValid: true, maxDurationStr: maxDurationStr };
}

function handleAddUpcomingClass(params, session) {
  if (!session) {
    return { success: false, errorCode: 'UNAUTHORIZED', message: 'Unauthorized session.' };
  }

  // Central scheduling is strictly for Central CNE and requires ADMIN role
  if (session.role !== 'ADMIN') {
    return {
      success: false,
      errorCode: 'FORBIDDEN',
      message: 'Permission denied. Only Administrators can schedule Central CNE programs.'
    };
  }

  var cneType = 'CENTRAL'; // Schedule New CNE workflow creates CENTRAL CNE only!
  var topic = sanitizeCellInput(params.topic);
  var area = sanitizeCellInput(params.area);
  var date = (params.date || '').trim();
  var toDate = (params.toDate || '').trim();

  if (!topic || !area || !date) {
    return { success: false, message: 'Topic, Area, and From Date & Time are required.' };
  }
  if (!toDate) {
    return { success: false, message: 'To Date & Time is required and cannot be blank.' };
  }

  // Strict Date & Time Validation: past dates not allowed, toDate >= date
  var dFrom = new Date(date);
  var dTo = new Date(toDate);
  if (isNaN(dFrom.getTime())) {
    return { success: false, message: 'Invalid From Date & Time format.' };
  }
  if (isNaN(dTo.getTime())) {
    return { success: false, message: 'Invalid To Date & Time format.' };
  }
  if (dTo < dFrom) {
    return { success: false, message: 'To Date & Time must be equal to or later than From Date & Time.' };
  }

  var todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  var checkFromDate = new Date(dFrom);
  checkFromDate.setHours(0, 0, 0, 0);
  if (checkFromDate < todayDate) {
    return { success: false, message: 'Past dates are not allowed. Please select today or a future date.' };
  }

  // Duration Validation
  var duration = (params.duration || '').trim();
  if (!duration) {
    return { success: false, message: 'Duration is required.' };
  }
  var durValidation = validateCneDuration(duration, date, toDate);
  if (!durValidation.isValid) {
    return { success: false, message: durValidation.message };
  }

  // Validate internal Resource Persons individually
  var rawRp = params.resourcePersonEmpIds !== undefined ? params.resourcePersonEmpIds : params.resourcePersonEmpId;
  var listRp = Array.isArray(rawRp) ? rawRp : (rawRp || '').split(',');
  var inputRp = [];
  for (var k = 0; k < listRp.length; k++) {
    var splitParts = String(listRp[k] || '').split(/[,;\\n]+/);
    for (var sp = 0; sp < splitParts.length; sp++) {
      var trimmed = splitParts[sp].trim();
      if (trimmed) inputRp.push(trimmed);
    }
  }
  var cleanRpMap = {};
  var rpClean = [];
  var invalidRpIds = [];

  for (var i = 0; i < inputRp.length; i++) {
    var rpid = normalizeEmpId(inputRp[i]);
    if (!rpid) continue;
    if (rpid.toLowerCase().indexOf('ext:') === 0) continue;
    if (!cleanRpMap[rpid]) {
      cleanRpMap[rpid] = true;
      var rpOfficerCheck = findOfficerById(rpid);
      if (!rpOfficerCheck) {
        invalidRpIds.push(rpid);
      } else {
        rpClean.push(rpid);
      }
    }
  }

  if (invalidRpIds.length > 0) {
    return {
      success: false,
      message: 'Invalid Resource Person Employee ID(s) not found in master roster: ' + invalidRpIds.join(', ')
    };
  }

  // External Resource Persons (names, no ID validation)
  var extRp = Array.isArray(params.externalResourcePersons)
    ? params.externalResourcePersons
    : (params.externalResourcePersons || '').split(',');
  var extRpClean = extRp.map(function(s) { return sanitizeCellInput(String(s).trim()); }).filter(Boolean);

  if (rpClean.length === 0 && extRpClean.length === 0) {
    return { success: false, message: 'At least one Resource Person (Internal or External) is required.' };
  }

  var status = normalizeCNEStatus(params.status || 'Scheduled');
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var sheet = getOrCreateSheet('Upcoming Classes');
    
    var curYear = new Date().getFullYear();
    var timestampSuffix = Date.now().toString().slice(-4);
    var randSuffix = ('000' + Math.floor(Math.random() * 1000)).slice(-3);
    var cneId = 'CLS-' + curYear + '-' + (cneType === 'DEPARTMENTAL' ? 'D-' : '') + timestampSuffix + randSuffix;
    
    var colMap = getHeaderMap(sheet);
    var maxCol = Math.max(sheet.getLastColumn(), 16);
    var rowData = [];
    for (var col = 0; col < maxCol; col++) rowData.push('');

    var setCell = function(key, fallbackCol, val) {
      var idx = colMap[key] !== undefined ? colMap[key] : fallbackCol;
      while (rowData.length <= idx) rowData.push('');
      rowData[idx] = val;
    };

    var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 0);
    while (rowData.length <= idCol) rowData.push('');
    rowData[idCol] = cneId;

    setCell('topic', 1, topic);
    setCell('area', 2, area);
    setCell('fromdate', 3, date);
    if (colMap['date'] !== undefined) rowData[colMap['date']] = date;
    setCell('todate', 4, toDate);
    setCell('time', 5, params.time || '');
    setCell('duration', 6, sanitizeCellInput(params.duration || '1:00:00'));
    setCell('resourcepersonempid', 7, rpClean.join(', '));
    setCell('modeofteaching', 8, sanitizeCellInput(params.modeOfTeaching || 'Lecture Cum Discussion'));
    if (colMap['mode'] !== undefined) rowData[colMap['mode']] = sanitizeCellInput(params.modeOfTeaching || 'Lecture Cum Discussion');
    setCell('description', 9, sanitizeCellInput(params.description || ''));
    setCell('maxparticipants', 10, parseInt(params.maxParticipants, 10) || 50);
    setCell('status', 11, status);
    setCell('typeofcne', 12, cneType);
    setCell('externalresourcepersons', 13, extRpClean.join(', '));
    setCell('proposedby', 14, session.employeeId || '');
    setCell('adminremarks', 15, sanitizeCellInput(params.adminRemarks || ''));

    sheet.appendRow(rowData);
    
    logAuditAction('ADD_UPCOMING_CLASS', session.employeeId, 'Scheduled ' + cneType + ' class: ' + cneId + ' (' + topic + ') Status: ' + status, 'SUCCESS');
    return { 
      success: true, 
      message: (cneType === 'DEPARTMENTAL' ? 'Departmental' : 'Central') + ' CNE class scheduled successfully.', 
      data: { cneId: cneId, classId: cneId, status: status, cneType: cneType } 
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Batch Schedule Departmental CNEs (Admin and Area Incharge)
 * Creates separate, independent records in Upcoming Classes for each schedule row.
 */
function handleAddDepartmentalSchedule(params, session) {
  if (!session) {
    return { success: false, errorCode: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' };
  }

  var rawClasses = params.schedules || params.classes;
  if (!rawClasses || !Array.isArray(rawClasses) || rawClasses.length === 0) {
    return { success: false, message: 'At least one departmental CNE schedule row is required.' };
  }

  var isAdmin = session.role === 'ADMIN';
  var isAreaIncharge = session.role === 'AREA_INCHARGE' || session.role === 'INCHARGE';
  if (!isAdmin && !isAreaIncharge) {
    return { success: false, errorCode: 'FORBIDDEN', message: 'Only an Administrator or designated Area Incharge can schedule Departmental CNEs.' };
  }

  var todayStr = new Date().toISOString().split('T')[0];
  var validatedList = [];

  for (var i = 0; i < rawClasses.length; i++) {
    var c = rawClasses[i];
    var topic = sanitizeCellInput(c.topic);
    var area = sanitizeCellInput(c.area);
    var date = (c.date || '').trim();
    var toDate = (c.toDate || date).trim();

    if (!topic || !area || !date) {
      return { success: false, message: 'Row ' + (i + 1) + ': Topic, Area, and From Date & Time are required.' };
    }
    if (!toDate) {
      return { success: false, message: 'Row ' + (i + 1) + ': To Date & Time is required and cannot be blank.' };
    }

    var dFrom = new Date(date);
    var dTo = new Date(toDate);
    if (isNaN(dFrom.getTime())) {
      return { success: false, message: 'Row ' + (i + 1) + ': Invalid From Date & Time format.' };
    }
    if (isNaN(dTo.getTime())) {
      return { success: false, message: 'Row ' + (i + 1) + ': Invalid To Date & Time format.' };
    }
    if (dTo < dFrom) {
      return { success: false, message: 'Row ' + (i + 1) + ': To Date & Time must be equal to or later than From Date & Time.' };
    }

    var todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    var checkFromDate = new Date(dFrom);
    checkFromDate.setHours(0, 0, 0, 0);
    if (checkFromDate < todayDate) {
      return { success: false, message: 'Row ' + (i + 1) + ': Scheduled date cannot be in the past.' };
    }

    var duration = (c.duration || '').trim();
    if (!duration) {
      return { success: false, message: 'Row ' + (i + 1) + ': Duration is required.' };
    }
    var durVal = validateCneDuration(duration, date, toDate);
    if (!durVal.isValid) {
      return { success: false, message: 'Row ' + (i + 1) + ': ' + durVal.message };
    }

    // Check authorization for this department
    var authErr = checkCNEAuthorized(session, area, 'DEPARTMENTAL');
    if (authErr) {
      return { success: false, errorCode: 'FORBIDDEN', message: 'Row ' + (i + 1) + ' (' + area + '): ' + authErr.message };
    }

    // Internal RP validation
    var rawRp = c.resourcePersonEmpIds !== undefined ? c.resourcePersonEmpIds : c.resourcePersonEmpId;
    var listRp = Array.isArray(rawRp) ? rawRp : (rawRp || '').split(',');
    var cleanRpMap = {};
    var rpClean = [];
    var invalidRpIds = [];

    for (var k = 0; k < listRp.length; k++) {
      var splitParts = String(listRp[k] || '').split(/[,;\\n]+/);
      for (var sp = 0; sp < splitParts.length; sp++) {
        var rpid = normalizeEmpId(splitParts[sp]);
        if (!rpid || rpid.toLowerCase().indexOf('ext:') === 0) continue;
        if (!cleanRpMap[rpid]) {
          cleanRpMap[rpid] = true;
          var officerCheck = findOfficerById(rpid);
          if (!officerCheck) {
            invalidRpIds.push(rpid);
          } else {
            rpClean.push(rpid);
          }
        }
      }
    }

    if (invalidRpIds.length > 0) {
      return { success: false, message: 'Row ' + (i + 1) + ': Invalid Resource Person Employee ID(s): ' + invalidRpIds.join(', ') };
    }

    // External RP
    var extRp = Array.isArray(c.externalResourcePersons)
      ? c.externalResourcePersons
      : (c.externalResourcePersons || '').split(',');
    var extRpClean = extRp.map(function(s) { return sanitizeCellInput(String(s).trim()); }).filter(Boolean);

    if (rpClean.length === 0 && extRpClean.length === 0) {
      return { success: false, message: 'Row ' + (i + 1) + ': At least one Resource Person (Internal or External) is required.' };
    }

    validatedList.push({
      topic: topic,
      area: area,
      date: date,
      toDate: toDate,
      time: sanitizeCellInput(c.time || ''),
      duration: sanitizeCellInput(duration),
      rpClean: rpClean,
      extRpClean: extRpClean,
      mode: sanitizeCellInput(c.modeOfTeaching || 'Lecture Cum Discussion'),
      description: sanitizeCellInput(c.description || ''),
      maxParticipants: parseInt(c.maxParticipants, 10) || 30,
      adminRemarks: sanitizeCellInput(c.adminRemarks || '')
    });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }

  try {
    var sheet = getOrCreateSheet('Upcoming Classes');

    var colMap = getHeaderMap(sheet);
    var curYear = new Date().getFullYear();
    var createdIds = [];

    for (var j = 0; j < validatedList.length; j++) {
      var item = validatedList[j];
      var timestampSuffix = Date.now().toString().slice(-4);
      var randSuffix = ('000' + Math.floor(Math.random() * 1000)).slice(-3) + j;
      var cneId = 'CLS-' + curYear + '-D-' + timestampSuffix + randSuffix;

      var rowData = [];
      var maxCol = Math.max(sheet.getLastColumn(), 16);
      for (var col = 0; col < maxCol; col++) rowData.push('');

      var setCell = function(key, fallbackCol, val) {
        var idx = colMap[key] !== undefined ? colMap[key] : fallbackCol;
        while (rowData.length <= idx) rowData.push('');
        rowData[idx] = val;
      };

      var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 0);
      while (rowData.length <= idCol) rowData.push('');
      rowData[idCol] = cneId;

      setCell('topic', 1, item.topic);
      setCell('area', 2, item.area);
      setCell('fromdate', 3, item.date);
      if (colMap['date'] !== undefined) rowData[colMap['date']] = item.date;
      setCell('todate', 4, item.toDate);
      setCell('time', 5, item.time);
      setCell('duration', 6, item.duration);
      setCell('resourcepersonempid', 7, item.rpClean.join(', '));
      setCell('modeofteaching', 8, item.mode);
      if (colMap['mode'] !== undefined) rowData[colMap['mode']] = item.mode;
      setCell('description', 9, item.description);
      setCell('maxparticipants', 10, item.maxParticipants);
      setCell('status', 11, 'Scheduled');
      setCell('typeofcne', 12, 'DEPARTMENTAL');
      setCell('externalresourcepersons', 13, item.extRpClean.join(', '));
      setCell('proposedby', 14, session.employeeId || '');
      setCell('adminremarks', 15, item.adminRemarks);

      sheet.appendRow(rowData);
      createdIds.push(cneId);
    }

    logAuditAction('ADD_DEPARTMENTAL_SCHEDULE', session.employeeId, 'Scheduled ' + createdIds.length + ' departmental CNE(s): ' + createdIds.join(', '), 'SUCCESS');

    return {
      success: true,
      message: 'Scheduled ' + createdIds.length + ' Departmental CNE session(s) successfully.',
      data: { createdClasses: createdIds, count: createdIds.length }
    };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateUpcomingClass(params, session) {
  if (!session) {
    return { success: false, errorCode: 'UNAUTHORIZED', message: 'Unauthorized session.' };
  }

  var cneId = String(params.cneId || params.classId || '').trim();
  if (!cneId) return { success: false, message: 'CNE ID is required.' };

  // Strict CNE ID immutability: Backend must reject any attempt to modify an existing CNE ID
  if (
    params.newClassId ||
    params.newCneId ||
    params.updatedClassId ||
    params.updatedCneId ||
    (params.id && String(params.id).trim().toLowerCase() !== cneId.toLowerCase()) ||
    (params.cneId && params.classId && String(params.cneId).trim().toLowerCase() !== String(params.classId).trim().toLowerCase())
  ) {
    return {
      success: false,
      errorCode: 'IMMUTABLE_CNE_ID',
      message: 'CNE ID is permanently immutable and cannot be modified.'
    };
  }
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE class not found.' };

  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('Upcoming Classes');
    if (!sheet) return { success: false, message: 'Upcoming Classes sheet not found.' };
    
    var data = sheet.getDataRange().getValues();
    var colMap = getHeaderMap(sheet);
    var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 0);

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idCol]).trim().toLowerCase() === cneId.toLowerCase()) {
        var rowNum = r + 1;
        var setColVal = function(key, fallbackCol, val) {
          var c = colMap[key] !== undefined ? colMap[key] : fallbackCol;
          sheet.getRange(rowNum, c + 1).setValue(val);
        };

        if (params.topic !== undefined) setColVal('topic', 1, sanitizeCellInput(params.topic));
        if (params.area !== undefined) setColVal('area', 2, sanitizeCellInput(params.area));

        var effDate = params.date !== undefined ? String(params.date).trim() : String(data[r][colMap['fromdate'] !== undefined ? colMap['fromdate'] : 3] || '');
        var effToDate = params.toDate !== undefined ? String(params.toDate).trim() : String(data[r][colMap['todate'] !== undefined ? colMap['todate'] : 4] || effDate);
        var effDuration = params.duration !== undefined ? String(params.duration).trim() : String(data[r][colMap['duration'] !== undefined ? colMap['duration'] : 6] || '');

        if (params.date !== undefined || params.toDate !== undefined) {
          if (!effDate) {
            return { success: false, message: 'From Date & Time is required and cannot be blank.' };
          }
          if (!effToDate) {
            return { success: false, message: 'To Date & Time is required and cannot be blank.' };
          }
          var dFrom = new Date(effDate);
          var dTo = new Date(effToDate);
          if (isNaN(dFrom.getTime()) || isNaN(dTo.getTime())) {
            return { success: false, message: 'Invalid Date & Time format.' };
          }
          if (dTo < dFrom) {
            return { success: false, message: 'To Date & Time must be equal to or later than From Date & Time.' };
          }
        }

        if (params.duration !== undefined || params.date !== undefined || params.toDate !== undefined) {
          if (effDuration) {
            var durVal = validateCneDuration(effDuration, effDate, effToDate);
            if (!durVal.isValid) {
              return { success: false, message: durVal.message };
            }
          }
        }

        if (params.date !== undefined) {
          setColVal('fromdate', 3, effDate);
          if (colMap['date'] !== undefined) sheet.getRange(rowNum, colMap['date'] + 1).setValue(effDate);
        }
        if (params.toDate !== undefined) setColVal('todate', 4, effToDate);
        if (params.time !== undefined) setColVal('time', 5, params.time);
        if (params.duration !== undefined) setColVal('duration', 6, effDuration);
        
        var existingRp = data[r][colMap['resourcepersonempid'] !== undefined ? colMap['resourcepersonempid'] : 7] 
          ? String(data[r][colMap['resourcepersonempid'] !== undefined ? colMap['resourcepersonempid'] : 7]).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
        var existingExtRp = data[r][colMap['externalresourcepersons'] !== undefined ? colMap['externalresourcepersons'] : 13]
          ? String(data[r][colMap['externalresourcepersons'] !== undefined ? colMap['externalresourcepersons'] : 13]).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
        var rpClean = existingRp;
        var extRpClean = existingExtRp;

        if (params.resourcePersonEmpId !== undefined || params.resourcePersonEmpIds !== undefined) {
          var rawRp = params.resourcePersonEmpIds !== undefined ? params.resourcePersonEmpIds : params.resourcePersonEmpId;
          var listRp = Array.isArray(rawRp) ? rawRp : (rawRp || '').split(',');
          var inputRp = [];
          for (var k = 0; k < listRp.length; k++) {
            var splitParts = String(listRp[k] || '').split(/[,;\\n]+/);
            for (var sp = 0; sp < splitParts.length; sp++) {
              var trimmed = splitParts[sp].trim();
              if (trimmed) inputRp.push(trimmed);
            }
          }
          var cleanRpMap = {};
          rpClean = [];
          var invalidRpIds = [];

          for (var i = 0; i < inputRp.length; i++) {
            var rpid = normalizeEmpId(inputRp[i]);
            if (!rpid) continue;
            if (rpid.toLowerCase().indexOf('ext:') === 0) continue;
            if (!cleanRpMap[rpid]) {
              cleanRpMap[rpid] = true;
              var rpOfficerCheck = findOfficerById(rpid);
              if (!rpOfficerCheck) {
                invalidRpIds.push(rpid);
              } else {
                rpClean.push(rpid);
              }
            }
          }

          if (invalidRpIds.length > 0) {
            return {
              success: false,
              message: 'Invalid Resource Person Employee ID(s) not found in master roster: ' + invalidRpIds.join(', ')
            };
          }
        }

        if (params.externalResourcePersons !== undefined) {
          var extRp = Array.isArray(params.externalResourcePersons)
            ? params.externalResourcePersons
            : (params.externalResourcePersons || '').split(',');
          extRpClean = extRp.map(function(s) { return sanitizeCellInput(String(s).trim()); }).filter(Boolean);
        }

        if (params.resourcePersonEmpId !== undefined || params.resourcePersonEmpIds !== undefined || params.externalResourcePersons !== undefined) {
          setColVal('resourcepersonempid', 7, rpClean.join(', '));
          setColVal('externalresourcepersons', 13, extRpClean.join(', '));
        }
        
        if (params.modeOfTeaching !== undefined) {
          setColVal('modeofteaching', 8, sanitizeCellInput(params.modeOfTeaching));
          if (colMap['mode'] !== undefined) sheet.getRange(rowNum, colMap['mode'] + 1).setValue(sanitizeCellInput(params.modeOfTeaching));
        }
        if (params.description !== undefined) setColVal('description', 9, sanitizeCellInput(params.description));
        if (params.maxParticipants !== undefined) setColVal('maxparticipants', 10, parseInt(params.maxParticipants, 10) || 50);
        
        if (params.status !== undefined) {
          setColVal('status', 11, normalizeCNEStatus(params.status));
        }
        if (params.cneType !== undefined) {
          var normType = normalizeCNEType(params.cneType);
          if (!normType) {
            return {
              success: false,
              errorCode: 'INVALID_CNE_TYPE',
              message: 'Type of CNE is invalid or missing. Must be either CENTRAL or DEPARTMENTAL.'
            };
          }
          setColVal('typeofcne', 12, normType);
        }
        if (params.adminRemarks !== undefined) setColVal('adminremarks', 15, sanitizeCellInput(params.adminRemarks));
        
        logAuditAction('UPDATE_UPCOMING_CLASS', session.employeeId, 'Updated class: ' + cneId, 'SUCCESS');
        return { success: true, message: 'Upcoming class updated successfully.' };
      }
    }
    return { success: false, message: 'Class not found.' };
  } finally {
    lock.releaseLock();
  }
}

function handleReviewUpcomingClass(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var cneId = String(params.cneId || params.classId || '').trim();
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  var rawStatus = (params.status || '').trim();
  var adminRemarks = sanitizeCellInput(params.adminRemarks || params.remarks || '');

  var newStatus = normalizeCNEStatus(rawStatus);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }

  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('Upcoming Classes');
    if (!sheet) return { success: false, message: 'Upcoming Classes sheet not found.' };

    var data = sheet.getDataRange().getValues();
    var colMap = getHeaderMap(sheet);
    var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 0);
    var statusCol = colMap['status'] !== undefined ? (colMap['status'] + 1) : 12;
    var remarksCol = colMap['adminremarks'] !== undefined ? (colMap['adminremarks'] + 1) : 16;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idCol]).trim().toLowerCase() === cneId.toLowerCase()) {
        sheet.getRange(r + 1, statusCol).setValue(newStatus);
        if (adminRemarks) sheet.getRange(r + 1, remarksCol).setValue(adminRemarks);
        logAuditAction('REVIEW_UPCOMING_CLASS', session.employeeId, 'CNE ID ' + cneId + ' set to ' + newStatus + ' with remarks: ' + adminRemarks, 'SUCCESS');
        return { success: true, message: 'Upcoming CNE class status updated to ' + newStatus + '.' };
      }
    }
    return { success: false, message: 'Upcoming CNE with ID ' + cneId + ' not found.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 5, 15 & 16. Upcoming Class Applications Management
 */
function handleApplyForClass(params, session) {
  if (!session) {
    return { success: false, errorCode: 'UNAUTHORIZED', message: 'Unauthorized session.' };
  }
  
  var cneId = String(params.cneId || params.classId || '').trim();
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy processing applications. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var classSheet = ss.getSheetByName('Upcoming Classes');
    if (!classSheet) return { success: false, message: 'Upcoming Classes sheet not found.' };
    
    // 1. Confirm Class Exists and is Scheduled
    var classData = classSheet.getDataRange().getValues();
    var colMap = getHeaderMap(classSheet);
    var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 0);
    var maxPCol = colMap['maxparticipants'] !== undefined ? colMap['maxparticipants'] : 10;
    var statusCol = colMap['status'] !== undefined ? colMap['status'] : 11;
    var targetClass = null;

    for (var c = 1; c < classData.length; c++) {
      if (String(classData[c][idCol]).trim().toLowerCase() === cneId.toLowerCase()) {
        targetClass = {
          cneId: String(classData[c][idCol]),
          classId: String(classData[c][idCol]),
          topic: String(classData[c][colMap['topic'] !== undefined ? colMap['topic'] : 1]),
          maxParticipants: parseInt(classData[c][maxPCol], 10) || 50,
          status: normalizeCNEStatus(classData[c][statusCol])
        };
        break;
      }
    }
    
    if (!targetClass) {
      return { success: false, message: 'CNE session with ID ' + cneId + ' not found.' };
    }
    
    if (targetClass.status !== 'Scheduled') {
      return { success: false, message: 'This class is currently ' + targetClass.status + ' and not accepting applications.' };
    }
    
    var appSheet = getOrCreateSheet('CNE Applications');
    var appColMap = getHeaderMap(appSheet);
    var appCneIdCol = appColMap['cneid'] !== undefined ? appColMap['cneid'] : (appColMap['classid'] !== undefined ? appColMap['classid'] : 1);
    var appEmpIdCol = appColMap['employeeid'] !== undefined ? appColMap['employeeid'] : 2;
    var appStatusCol = appColMap['status'] !== undefined ? appColMap['status'] : 5;
    
    var appData = appSheet.getDataRange().getValues();
    var empId = normalizeEmpId(session.employeeId);
    var activeAppCount = 0;
    
    // 2. Prevent duplicate applications and count active applications
    for (var r = 1; r < appData.length; r++) {
      var rowCneId = String(appData[r][appCneIdCol]).trim().toLowerCase();
      var rowEmpId = normalizeEmpId(appData[r][appEmpIdCol]);
      var rowStatus = String(appData[r][appStatusCol]).trim();
      
      if (rowCneId === cneId.toLowerCase()) {
        if (rowStatus !== 'Cancelled' && rowStatus !== 'Rejected') {
          activeAppCount++;
        }
        if (rowEmpId === empId && rowStatus !== 'Cancelled') {
          return { success: false, message: 'You have already applied for this class (Status: ' + rowStatus + ').' };
        }
      }
    }
    
    // 3. Respect Max Participants limit
    if (activeAppCount >= targetClass.maxParticipants) {
      return {
        success: false,
        message: 'This class has reached its maximum participant capacity (' + targetClass.maxParticipants + ').'
      };
    }
    
    var officer = findOfficerById(session.employeeId);
    var empName = officer ? officer.name : session.employeeId;
    var curYear = new Date().getFullYear();
    var timestampSuffix = Date.now().toString().slice(-5);
    var randSuffix = ('000' + Math.floor(Math.random() * 1000)).slice(-3);
    var appId = 'APP-' + curYear + '-' + timestampSuffix + randSuffix;
    
    appSheet.appendRow([
      appId,
      cneId,
      session.employeeId,
      empName,
      new Date().toISOString(),
      'Applied',
      sanitizeCellInput(params.remarks || '')
    ]);
    
    logAuditAction('APPLY_CLASS', session.employeeId, 'Applied for CNE: ' + cneId + ' (App ID: ' + appId + ')', 'SUCCESS');
    
    return {
      success: true,
      message: 'Application submitted successfully.',
      data: {
        applicationId: appId,
        cneId: cneId,
        classId: cneId,
        employeeId: session.employeeId,
        employeeName: empName,
        appliedAt: new Date().toISOString(),
        status: 'Applied',
        remarks: params.remarks || ''
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function handleGetMyApplications(params, session) {
  if (!session) {
    return { success: false, errorCode: 'UNAUTHORIZED', message: 'Unauthorized session.' };
  }
  
  var ss = getSpreadsheet('CNE');
  var sheet = ss.getSheetByName('CNE Applications');
  if (!sheet) return { success: true, data: [] };
  
  var data = sheet.getDataRange().getValues();
  var colMap = getHeaderMap(sheet);
  var idCol = colMap['applicationid'] !== undefined ? colMap['applicationid'] : 0;
  var cneIdCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 1);
  var empIdCol = colMap['employeeid'] !== undefined ? colMap['employeeid'] : 2;
  var nameCol = colMap['employeename'] !== undefined ? colMap['employeename'] : 3;
  var appliedAtCol = colMap['appliedat'] !== undefined ? colMap['appliedat'] : 4;
  var statusCol = colMap['status'] !== undefined ? colMap['status'] : 5;
  var remarksCol = colMap['remarks'] !== undefined ? colMap['remarks'] : 6;

  var empId = normalizeEmpId(session.employeeId);
  var list = [];
  
  for (var r = 1; r < data.length; r++) {
    if (normalizeEmpId(data[r][empIdCol]) === empId) {
      var cneId = String(data[r][cneIdCol]);
      list.push({
        applicationId: String(data[r][idCol]),
        cneId: cneId,
        classId: cneId,
        employeeId: String(data[r][empIdCol]),
        employeeName: String(data[r][nameCol]),
        appliedAt: formatDateValue(data[r][appliedAtCol]),
        status: String(data[r][statusCol]),
        remarks: String(data[r][remarksCol] || '')
      });
    }
  }
  
  return { success: true, data: list };
}

function handleGetAllApplications(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var ss = getSpreadsheet('CNE');
  var sheet = ss.getSheetByName('CNE Applications');
  if (!sheet) return { success: true, data: [] };
  
  var data = sheet.getDataRange().getValues();
  var colMap = getHeaderMap(sheet);
  var idCol = colMap['applicationid'] !== undefined ? colMap['applicationid'] : 0;
  var cneIdCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 1);
  var empIdCol = colMap['employeeid'] !== undefined ? colMap['employeeid'] : 2;
  var nameCol = colMap['employeename'] !== undefined ? colMap['employeename'] : 3;
  var appliedAtCol = colMap['appliedat'] !== undefined ? colMap['appliedat'] : 4;
  var statusCol = colMap['status'] !== undefined ? colMap['status'] : 5;
  var remarksCol = colMap['remarks'] !== undefined ? colMap['remarks'] : 6;

  var list = [];
  
  for (var r = 1; r < data.length; r++) {
    var id = String(data[r][idCol]).trim();
    if (!id) continue;
    var cneId = String(data[r][cneIdCol]);
    list.push({
      applicationId: id,
      cneId: cneId,
      classId: cneId,
      employeeId: String(data[r][empIdCol]),
      employeeName: String(data[r][nameCol]),
      appliedAt: formatDateValue(data[r][appliedAtCol]),
      status: String(data[r][statusCol]),
      remarks: String(data[r][remarksCol] || '')
    });
  }
  
  return { success: true, data: list };
}

function handleUpdateApplicationStatus(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var appId = (params.applicationId || '').trim();
  var newStatus = (params.status || 'Approved').trim();
  var allowedStatuses = ['Applied', 'Approved', 'Rejected', 'Cancelled'];
  
  if (allowedStatuses.indexOf(newStatus) === -1) {
    return {
      success: false,
      message: 'Invalid application status. Allowed values: ' + allowedStatuses.join(', ')
    };
  }
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('CNE Applications');
    if (!sheet) return { success: false, message: 'Applications sheet not found.' };
    
    var data = sheet.getDataRange().getValues();
    var colMap = getHeaderMap(sheet);
    var idCol = colMap['applicationid'] !== undefined ? colMap['applicationid'] : 0;
    var statusCol = colMap['status'] !== undefined ? (colMap['status'] + 1) : 6;
    var remarksCol = colMap['remarks'] !== undefined ? (colMap['remarks'] + 1) : 7;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idCol]).trim().toLowerCase() === appId.toLowerCase()) {
        sheet.getRange(r + 1, statusCol).setValue(newStatus);
        if (params.remarks !== undefined) sheet.getRange(r + 1, remarksCol).setValue(sanitizeCellInput(params.remarks));
        logAuditAction('UPDATE_APP_STATUS', session.employeeId, 'App ID: ' + appId + ' set to ' + newStatus, 'SUCCESS');
        return { success: true, message: 'Application status updated to ' + newStatus + '.' };
      }
    }
    return { success: false, message: 'Application not found.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 9 & 10. Gallery & Drive Image Storage (Isolated Public View, Strict Image MIME Validation & 5MB Limit)
 */
function handleGetGallery(params, session) {
  var sheet = getOrCreateSheet('Gallery');
  
  var isAdmin = session && String(session.role || '').toUpperCase() === 'ADMIN';
  var data = sheet.getDataRange().getValues();
  var list = [];
  
  for (var r = 1; r < data.length; r++) {
    var id = String(data[r][0] || '').trim();
    var status = String(data[r][8] || 'ACTIVE').toUpperCase().trim();
    if (!id || status === 'INACTIVE') continue;
    
    var item = {
      id: id,
      title: String(data[r][1] || ''),
      description: String(data[r][2] || ''),
      date: formatDateValue(data[r][3]),
      imageUrl: String(data[r][5] || ''),
      isActive: true
    };
    
    // Privacy protection: only expose management metadata to verified administrators
    if (isAdmin) {
      item.driveFileId = String(data[r][4] || '');
      item.uploadedBy = String(data[r][6] || '');
      item.uploadedAt = String(data[r][7] || '');
    }
    
    list.push(item);
  }
  
  return { success: true, data: list };
}

function handleUploadImage(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var base64Data = params.base64Image;
  var title = sanitizeCellInput(params.title || 'CNE Activity');
  var description = sanitizeCellInput(params.description || '');
  var date = params.date || new Date().toISOString().split('T')[0];
  
  if (!base64Data) return { success: false, message: 'Image data is required.' };
  
  var driveFolderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!driveFolderId || driveFolderId.trim() === '') {
    return {
      success: false,
      message: 'Google Drive upload error: Gallery Drive folder is not configured. Please configure DRIVE_FOLDER_ID in Script Properties.'
    };
  }
  
  var folder;
  try {
    folder = DriveApp.getFolderById(driveFolderId.trim());
  } catch (e) {
    return { success: false, message: 'Google Drive upload error: Invalid DRIVE_FOLDER_ID configured.' };
  }
  
  var contentType = 'image/jpeg';
  var rawBase64 = base64Data;
  if (base64Data.indexOf(';base64,') !== -1) {
    var parts = base64Data.split(';base64,');
    contentType = parts[0].replace('data:', '').toLowerCase().trim();
    rawBase64 = parts[1];
  }
  
  // Strict MIME Type Validation
  var allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimes.indexOf(contentType) === -1) {
    return { success: false, message: 'Invalid file format. Only JPEG, PNG, and WebP images are allowed.' };
  }
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, message: 'Server is busy uploading images. Please try again.' };
  }
  
  try {
    var decoded = Utilities.base64Decode(rawBase64);
    // 5MB maximum upload size check
    if (decoded.length > 5 * 1024 * 1024) {
      return { success: false, message: 'Image exceeds maximum allowed size of 5MB.' };
    }
    
    var ext = (contentType === 'image/png') ? '.png' : ((contentType === 'image/webp') ? '.webp' : '.jpg');
    var blob = Utilities.newBlob(decoded, contentType, 'CNE_' + new Date().getTime() + ext);
    var file = folder.createFile(blob);
    
    // Public view-only permission granted strictly for institutional CNE display in the portal
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var fileId = file.getId();
    var imageUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
    var curYear = new Date().getFullYear();
    var imageId = 'IMG-' + curYear + '-' + Date.now().toString().slice(-4) + ('000' + Math.floor(Math.random() * 1000)).slice(-3);
    
    var sheet = getOrCreateSheet('Gallery');
    
    sheet.appendRow([
      imageId,
      title,
      description,
      date,
      fileId,
      imageUrl,
      session.employeeId || '',
      new Date().toISOString(),
      'ACTIVE'
    ]);
    
    logAuditAction('UPLOAD_IMAGE', session.employeeId, 'Uploaded Image: ' + imageId + ' (' + title + ')', 'SUCCESS');
    
    return {
      success: true,
      message: 'Image uploaded successfully to Google Drive.',
      data: { id: imageId, imageUrl: imageUrl, fileId: fileId }
    };
  } catch (err) {
    return { success: false, message: 'Failed to upload photo to Google Drive: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateGalleryItem(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var id = (params.id || '').trim();
  if (!id) return { success: false, message: 'Item ID is required.' };
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('Gallery');
    if (!sheet) return { success: false, message: 'Gallery sheet not found.' };
    
    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === id.toLowerCase()) {
        if (params.title !== undefined) sheet.getRange(r + 1, 2).setValue(sanitizeCellInput(params.title));
        if (params.description !== undefined) sheet.getRange(r + 1, 3).setValue(sanitizeCellInput(params.description));
        if (params.date !== undefined) sheet.getRange(r + 1, 4).setValue(params.date);
        if (params.isActive !== undefined) sheet.getRange(r + 1, 9).setValue(params.isActive ? 'ACTIVE' : 'INACTIVE');
        
        logAuditAction('UPDATE_GALLERY', session.employeeId, 'Updated Gallery ID: ' + id, 'SUCCESS');
        return { success: true, message: 'Gallery item updated.' };
      }
    }
    return { success: false, message: 'Item not found.' };
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteGalleryItem(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var id = (params.id || '').trim();
  if (!id) return { success: false, message: 'Item ID is required.' };
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('Gallery');
    if (!sheet) return { success: false, message: 'Gallery sheet not found.' };
    
    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === id.toLowerCase()) {
        sheet.getRange(r + 1, 9).setValue('INACTIVE');
        logAuditAction('DELETE_GALLERY', session.employeeId, 'Deactivated Gallery Photo ID: ' + id, 'SUCCESS');
        return { success: true, message: 'Photo deactivated from gallery successfully.' };
      }
    }
    return { success: false, message: 'Gallery item not found.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 7. Secure Role Management (With Last Administrator Protection)
 */
function handleGetRoles(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var sheet = getOrCreateSheet('Role');
  var data = sheet.getDataRange().getValues();
  var colMap = getHeaderMap(sheet);
  var roles = [];
  
  for (var r = 1; r < data.length; r++) {
    var empId = String(data[r][colMap['employeeidno'] !== undefined ? colMap['employeeidno'] : 0] || '').trim();
    if (empId) {
      var rawRole = String(data[r][colMap['role'] !== undefined ? colMap['role'] : 3] || 'EMPLOYEE').toUpperCase().trim();
      var normalizedRole = 'EMPLOYEE';
      if (rawRole.indexOf('ADMIN') !== -1) {
        normalizedRole = 'ADMIN';
      } else if (rawRole.indexOf('INCHARGE') !== -1) {
        normalizedRole = 'AREA_INCHARGE';
      }
      var area = colMap['departmentarea'] !== undefined ? String(data[r][colMap['departmentarea']] || '').trim() : '';
      var assignedAreas = area ? area.split(/[,;\\n]+/).map(function(s) { return s.trim(); }).filter(Boolean) : [];

      roles.push({
        employeeId: empId,
        name: String(data[r][colMap['nameoftheofficers'] !== undefined ? colMap['nameoftheofficers'] : 1] || ''),
        designation: String(data[r][colMap['designation'] !== undefined ? colMap['designation'] : 2] || ''),
        role: normalizedRole,
        area: area,
        assignedAreas: assignedAreas
      });
    }
  }
  
  return { success: true, data: roles };
}

function handleUpdateRole(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var employeeId = normalizeEmpId(params.employeeId);
  if (!employeeId) return { success: false, message: 'Employee ID is required.' };
  
  var rawRole = String(params.role || 'EMPLOYEE').toUpperCase().trim();
  var targetRole = 'EMPLOYEE';
  if (rawRole.indexOf('ADMIN') !== -1) targetRole = 'ADMIN';
  else if (rawRole.indexOf('INCHARGE') !== -1) targetRole = 'AREA_INCHARGE';

  var rawArea = '';
  if (Array.isArray(params.assignedAreas)) {
    rawArea = params.assignedAreas.map(function(a) { return String(a).trim(); }).filter(Boolean).join(', ');
  } else if (params.area || params.department) {
    rawArea = String(params.area || params.department || '').trim();
  }
  var area = sanitizeCellInput(rawArea);
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var sheet = getOrCreateSheet('Role');
    var data = sheet.getDataRange().getValues();
    var colMap = getHeaderMap(sheet);
    var adminCount = 0;
    var targetRow = -1;
    var currentRole = 'EMPLOYEE';
    
    for (var r = 1; r < data.length; r++) {
      var rowEmpId = normalizeEmpId(data[r][colMap['employeeidno'] !== undefined ? colMap['employeeidno'] : 0]);
      var rVal = String(data[r][colMap['role'] !== undefined ? colMap['role'] : 3] || 'EMPLOYEE').toUpperCase().trim();
      if (rVal.indexOf('ADMIN') !== -1) {
        adminCount++;
      }
      if (rowEmpId === employeeId) {
        targetRow = r + 1;
        currentRole = rVal;
      }
    }
    
    // Prevent accidental removal of the last administrator
    if (currentRole.indexOf('ADMIN') !== -1 && targetRole !== 'ADMIN' && adminCount <= 1) {
      return {
        success: false,
        message: 'Cannot remove the last administrator account. Please assign another administrator first.'
      };
    }
    
    var roleCol = (colMap['role'] !== undefined ? colMap['role'] : 3) + 1;
    var areaCol = (colMap['departmentarea'] !== undefined ? colMap['departmentarea'] : 4) + 1;

    if (targetRow > 0) {
      sheet.getRange(targetRow, roleCol).setValue(targetRole);
      sheet.getRange(targetRow, areaCol).setValue(area);
    } else {
      var officer = findOfficerById(employeeId);
      var name = officer ? officer.name : (params.name || '');
      var desig = officer ? officer.designation : (params.designation || '');
      sheet.appendRow([employeeId, name, desig, targetRole, area]);
    }
    
    logAuditAction('UPDATE_ROLE', session.employeeId, 'Set role for ' + employeeId + ' -> ' + targetRole + (area ? ' (Area: ' + area + ')' : ''), 'SUCCESS');
    return { success: true, message: 'Role assigned successfully.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 11. News & Events Management (Public Read, Admin Write)
 */
function handleGetNewsEvents(params) {
  var sheet = getOrCreateSheet('News and Events');
  
  var data = sheet.getDataRange().getValues();
  var list = [];
  
  for (var r = 1; r < data.length; r++) {
    var id = String(data[r][0] || '').trim();
    var status = String(data[r][6] || 'ACTIVE').toUpperCase().trim();
    if (!id || status === 'INACTIVE') continue;
    
    list.push({
      id: id,
      title: String(data[r][1] || ''),
      category: String(data[r][2] || 'Circular'),
      date: formatDateValue(data[r][3]),
      summary: String(data[r][4] || ''),
      content: String(data[r][5] || ''),
      createdAt: formatDateValue(data[r][7])
    });
  }
  
  // Fallback institutional default news if sheet has no custom rows
  if (list.length === 0) {
    list = [
      {
        id: 'NEWS-INIT-01',
        title: 'Mandatory Continuing Nursing Education (CNE) Guidelines 2026',
        category: 'Circular',
        date: new Date().toISOString().split('T')[0],
        summary: 'All Nursing Officers are directed to complete minimum 30 verified CNE training hours for annual APAR compliance.',
        content: 'As per the directives of the Nursing Services Committee and AIIMS Rishikesh Academic Cell, all registered Nursing Officers must participate in accredited CNE programs.',
        createdAt: new Date().toISOString().split('T')[0]
      }
    ];
  }
  
  return { success: true, data: list };
}

function handleAddNewsEvent(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var title = sanitizeCellInput(params.title);
  var summary = sanitizeCellInput(params.summary);
  var content = sanitizeCellInput(params.content || params.summary);
  var category = sanitizeCellInput(params.category || 'Circular');
  var date = (params.date || new Date().toISOString().split('T')[0]).trim();
  
  if (!title || !summary) {
    return { success: false, message: 'Title and Summary are required.' };
  }
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var sheet = getOrCreateSheet('News and Events');
    
    var curYear = new Date().getFullYear();
    var eventId = 'NEWS-' + curYear + '-' + Date.now().toString().slice(-4) + ('000' + Math.floor(Math.random() * 1000)).slice(-3);
    
    sheet.appendRow([
      eventId,
      title,
      category,
      date,
      summary,
      content,
      'ACTIVE',
      new Date().toISOString(),
      session.employeeId || ''
    ]);
    
    logAuditAction('ADD_NEWS', session.employeeId, 'Published News: ' + eventId + ' (' + title + ')', 'SUCCESS');
    return { success: true, message: 'News and Event published successfully.', data: { id: eventId } };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateNewsEvent(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var id = (params.id || '').trim();
  if (!id) return { success: false, message: 'Event ID is required.' };
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('News and Events');
    if (!sheet) return { success: false, message: 'News and Events sheet not found.' };
    
    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === id.toLowerCase()) {
        if (params.title !== undefined) sheet.getRange(r + 1, 2).setValue(sanitizeCellInput(params.title));
        if (params.category !== undefined) sheet.getRange(r + 1, 3).setValue(sanitizeCellInput(params.category));
        if (params.date !== undefined) sheet.getRange(r + 1, 4).setValue(params.date);
        if (params.summary !== undefined) sheet.getRange(r + 1, 5).setValue(sanitizeCellInput(params.summary));
        if (params.content !== undefined) sheet.getRange(r + 1, 6).setValue(sanitizeCellInput(params.content));
        if (params.status !== undefined) sheet.getRange(r + 1, 7).setValue(params.status);
        
        logAuditAction('UPDATE_NEWS', session.employeeId, 'Updated News ID: ' + id, 'SUCCESS');
        return { success: true, message: 'News event updated successfully.' };
      }
    }
    return { success: false, message: 'News item not found.' };
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteNewsEvent(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var id = (params.id || '').trim();
  if (!id) return { success: false, message: 'Event ID is required.' };
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('News and Events');
    if (!sheet) return { success: false, message: 'News and Events sheet not found.' };
    
    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === id.toLowerCase()) {
        sheet.getRange(r + 1, 7).setValue('INACTIVE');
        logAuditAction('DELETE_NEWS', session.employeeId, 'Deactivated News ID: ' + id, 'SUCCESS');
        return { success: true, message: 'News event deactivated successfully.' };
      }
    }
    return { success: false, message: 'News item not found.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 12. Chairperson Message Management (Public Read, Admin Write)
 */
function handleGetChairpersonMessage(params) {
  var props = PropertiesService.getScriptProperties();
  var message = props.getProperty('CHAIRPERSON_MESSAGE');
  var name = props.getProperty('CHAIRPERSON_NAME') || 'Dr. Anita Rani Kansal';
  var designation = props.getProperty('CHAIRPERSON_DESIG') || 'Chief Nursing Officer (C.N.O) & Chairperson, CNE Committee';
  var photoUrl = props.getProperty('CHAIRPERSON_PHOTO') || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80';
  var driveFileId = props.getProperty('CHAIRPERSON_PHOTO_DRIVE_ID') || '';
  
  if (!message) {
    message = 'Clinical Nursing Education is the bedrock of patient safety and clinical excellence. At AIIMS Rishikesh, our CNE cell is committed to providing evidence-based, continuous professional development to empower nursing professionals across all clinical wards.';
  }
  
  return {
    success: true,
    data: {
      name: name,
      designation: designation,
      photoUrl: photoUrl,
      driveFileId: driveFileId,
      driveUrl: driveFileId ? ('https://lh3.googleusercontent.com/d/' + driveFileId) : photoUrl,
      message: message
    }
  };
}

function handleUpdateChairpersonMessage(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var props = PropertiesService.getScriptProperties();
  
  if (params.name) props.setProperty('CHAIRPERSON_NAME', sanitizeCellInput(params.name));
  if (params.designation) props.setProperty('CHAIRPERSON_DESIG', sanitizeCellInput(params.designation));
  if (params.message) props.setProperty('CHAIRPERSON_MESSAGE', sanitizeCellInput(params.message));
  
  var finalPhotoUrl = params.photoUrl || props.getProperty('CHAIRPERSON_PHOTO') || '';
  var driveFileId = null;
  var driveUrl = null;

  // Auto-Save image to Google Drive if base64 image data is provided (either in base64Image or photoUrl)
  var rawImage = params.base64Image || (params.photoUrl && params.photoUrl.indexOf('data:image') === 0 ? params.photoUrl : null);
  
  if (rawImage) {
    var driveFolderId = props.getProperty('DRIVE_FOLDER_ID');
    if (!driveFolderId || driveFolderId.trim() === '') {
      return {
        success: false,
        message: 'Google Drive upload error: CNO Photo Drive folder is not configured. Please configure DRIVE_FOLDER_ID in Script Properties.'
      };
    }

    var folder;
    try {
      folder = DriveApp.getFolderById(driveFolderId.trim());
    } catch (e) {
      return { success: false, message: 'Google Drive upload error: Invalid DRIVE_FOLDER_ID configured.' };
    }

    var contentType = 'image/jpeg';
    var rawBase64 = rawImage;
    if (rawImage.indexOf(';base64,') !== -1) {
      var parts = rawImage.split(';base64,');
      contentType = parts[0].replace('data:', '').toLowerCase().trim();
      rawBase64 = parts[1];
    }

    var allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.indexOf(contentType) === -1) {
      return { success: false, message: 'Invalid file format. Only JPEG, PNG, and WebP images are allowed.' };
    }

    try {
      var decoded = Utilities.base64Decode(rawBase64);
      // 5MB max check
      if (decoded.length > 5 * 1024 * 1024) {
        return { success: false, message: 'CNO image exceeds maximum allowed size of 5MB.' };
      }

      var ext = (contentType === 'image/png') ? '.png' : ((contentType === 'image/webp') ? '.webp' : '.jpg');
      var fileName = 'CNO_Dr_Anita_Rani_Kansal_' + new Date().getTime() + ext;
      var blob = Utilities.newBlob(decoded, contentType, fileName);
      var file = folder.createFile(blob);
      
      // Public view-only permission granted strictly for institutional CNE display in the portal
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      driveFileId = file.getId();
      driveUrl = 'https://lh3.googleusercontent.com/d/' + driveFileId;
      finalPhotoUrl = driveUrl;
      
      props.setProperty('CHAIRPERSON_PHOTO', finalPhotoUrl);
      props.setProperty('CHAIRPERSON_PHOTO_DRIVE_ID', driveFileId);
      props.setProperty('CHAIRPERSON_PHOTO_FILE_NAME', fileName);
    } catch (driveErr) {
      return { 
        success: false, 
        message: 'Failed to save CNO photo to Google Drive: ' + driveErr.message 
      };
    }
  } else if (params.photoUrl) {
    if (params.photoUrl.indexOf('data:') === 0 || params.photoUrl.length > 500) {
      return { success: false, message: 'Invalid photo URL. Base64 strings cannot be saved directly; please upload an image file.' };
    }
    props.setProperty('CHAIRPERSON_PHOTO', sanitizeCellInput(params.photoUrl));
    finalPhotoUrl = params.photoUrl;
  }
  
  logAuditAction('UPDATE_CHAIRPERSON_MSG', session.employeeId, 'Updated CNO profile & photo' + (driveFileId ? ' (Saved to Google Drive: ' + driveFileId + ')' : ''), 'SUCCESS');
  
  return { 
    success: true, 
    message: driveFileId 
      ? 'CNO photo successfully saved to Google Drive and leadership profile updated.' 
      : 'Chairperson leadership profile updated successfully.',
    data: {
      name: sanitizeCellInput(params.name || ''),
      designation: sanitizeCellInput(params.designation || ''),
      photoUrl: finalPhotoUrl,
      driveFileId: driveFileId,
      driveUrl: driveUrl
    }
  };
}

/**
 * 13. Institutional Quick Links (Public Read-Only)
 */
function handleGetQuickLinks(params) {
  var props = PropertiesService.getScriptProperties();
  var custom = props.getProperty('QUICK_LINKS_CUSTOM');
  if (custom) {
    try {
      var parsed = JSON.parse(custom);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { success: true, data: parsed };
      }
    } catch (e) {}
  }

  var defaultLinks = [
    {
      id: 'ql-upcoming',
      title: 'Upcoming CNE Schedule',
      description: 'Browse open classes, curriculum topics, venue allocations, and secure your registration.',
      iconName: 'Sparkles',
      target: 'upcoming',
      badge: 'Open for Enrollment',
      actionType: 'navigate'
    },
    {
      id: 'ql-calendar',
      title: 'CNE Interactive Calendar',
      description: 'View monthly training schedules, departmental rotations, and upcoming skill sessions.',
      iconName: 'Calendar',
      target: 'calendar',
      badge: 'Monthly View',
      actionType: 'navigate'
    },
    {
      id: 'ql-guidelines',
      title: 'CNE Guidelines & Policy',
      description: 'Institutional policy document outlining attendance requirements, credits, and speaker recognition.',
      iconName: 'ShieldCheck',
      target: 'guidelines',
      badge: 'Official Norms',
      actionType: 'modal',
      modalContent: {
        title: 'AIIMS Rishikesh CNE Guidelines & Attendance Norms',
        body: [
          '1. Minimum Attendance: All Nursing Officers (N.O) and Senior Nursing Officers (S.N.O) should aim to complete at least 20 documented CNE hours per academic year.',
          '2. Punctuality & Verification: Attendance is digitally signed and logged through the Area Incharge and verified against institutional roster data.',
          '3. Faculty / Resource Person Recognition: Serving as an approved resource person or instructor carries double CNE credits and is recognized as institutional academic leadership.',
          '4. Certificate of Completion: Certificates and annual summary records can be downloaded directly from the portal once logged in with verified credentials.',
          '5. Leave & Excusal: Prior written notification to the CNE Coordinator is required if unable to attend a class for which registration was confirmed.'
        ]
      }
    },
    {
      id: 'ql-main-portal',
      title: 'AIIMS Rishikesh Main Portal',
      description: 'Official institutional hospital & academic portal',
      iconName: 'Building',
      target: 'https://aiimsrishikesh.edu.in',
      badge: 'Portal',
      actionType: 'external',
      url: 'https://aiimsrishikesh.edu.in'
    },
    {
      id: 'ql-inc',
      title: 'Indian Nursing Council (INC)',
      description: 'National statutory body for nurses and nurse education',
      iconName: 'Award',
      target: 'https://indiannursingcouncil.org',
      badge: 'Council',
      actionType: 'external',
      url: 'https://indiannursingcouncil.org'
    }
  ];
  return { success: true, data: defaultLinks };
}

function handleAddQuickLink(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var title = sanitizeCellInput(params.title || '');
  if (!title) return { success: false, message: 'Link title is required.' };

  var currentLinksRes = handleGetQuickLinks({});
  var links = currentLinksRes.data || [];

  var newId = 'ql-' + Date.now();
  var newLink = {
    id: newId,
    title: title,
    description: sanitizeCellInput(params.description || ''),
    iconName: sanitizeCellInput(params.iconName || 'Link'),
    target: sanitizeCellInput(params.target || params.url || ''),
    badge: sanitizeCellInput(params.badge || ''),
    actionType: params.actionType || (params.target && params.target.startsWith('http') ? 'external' : 'navigate'),
    url: sanitizeCellInput(params.url || (params.target && params.target.startsWith('http') ? params.target : ''))
  };

  links.push(newLink);
  PropertiesService.getScriptProperties().setProperty('QUICK_LINKS_CUSTOM', JSON.stringify(links));
  logAuditAction('ADD_QUICK_LINK', session.employeeId, 'Added Quick Link: ' + title, 'SUCCESS');
  return { success: true, message: 'Quick Link added successfully.', data: { id: newId } };
}

function handleUpdateQuickLink(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var id = (params.id || '').trim();
  if (!id) return { success: false, message: 'Link ID is required.' };

  var currentLinksRes = handleGetQuickLinks({});
  var links = currentLinksRes.data || [];
  var found = false;

  for (var i = 0; i < links.length; i++) {
    if (links[i].id === id) {
      if (params.title !== undefined) links[i].title = sanitizeCellInput(params.title);
      if (params.description !== undefined) links[i].description = sanitizeCellInput(params.description);
      if (params.iconName !== undefined) links[i].iconName = sanitizeCellInput(params.iconName);
      if (params.target !== undefined) links[i].target = sanitizeCellInput(params.target);
      if (params.badge !== undefined) links[i].badge = sanitizeCellInput(params.badge);
      if (params.actionType !== undefined) links[i].actionType = params.actionType;
      if (params.url !== undefined) links[i].url = sanitizeCellInput(params.url);
      found = true;
      break;
    }
  }

  if (!found) return { success: false, message: 'Quick link not found.' };

  PropertiesService.getScriptProperties().setProperty('QUICK_LINKS_CUSTOM', JSON.stringify(links));
  logAuditAction('UPDATE_QUICK_LINK', session.employeeId, 'Updated Quick Link ID: ' + id, 'SUCCESS');
  return { success: true, message: 'Quick link updated successfully.' };
}

function handleDeleteQuickLink(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var id = (params.id || '').trim();
  if (!id) return { success: false, message: 'Link ID is required.' };

  var currentLinksRes = handleGetQuickLinks({});
  var links = currentLinksRes.data || [];
  var initialLen = links.length;
  links = links.filter(function(l) { return l.id !== id; });

  if (links.length === initialLen) return { success: false, message: 'Quick link not found.' };

  PropertiesService.getScriptProperties().setProperty('QUICK_LINKS_CUSTOM', JSON.stringify(links));
  logAuditAction('DELETE_QUICK_LINK', session.employeeId, 'Deleted Quick Link ID: ' + id, 'SUCCESS');
  return { success: true, message: 'Quick link removed successfully.' };
}

/**
 * 13a. Coordinator Desk (Public Read, Admin Write)
 */
function handleGetCoordinatorDesk(params) {
  var props = PropertiesService.getScriptProperties();
  var note = props.getProperty('COORDINATOR_NOTE') || 'Have questions regarding class credits, attendance verification, or training schedules?';
  var namesRaw = props.getProperty('COORDINATOR_NAMES');
  var coordinators = ['Ms. Ramya T', 'Ms. Suman Choudhary'];
  if (namesRaw) {
    try {
      var parsed = JSON.parse(namesRaw);
      if (Array.isArray(parsed) && parsed.length > 0) coordinators = parsed;
    } catch (e) {
      coordinators = namesRaw.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    }
  }
  var email = props.getProperty('COORDINATOR_EMAIL') || 'training.nur@aiimsrishikesh.edu.in';

  return {
    success: true,
    data: {
      note: note,
      coordinators: coordinators,
      email: email
    }
  };
}

function handleUpdateCoordinatorDesk(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var props = PropertiesService.getScriptProperties();
  if (params.note !== undefined) props.setProperty('COORDINATOR_NOTE', sanitizeCellInput(params.note));
  if (params.email !== undefined) props.setProperty('COORDINATOR_EMAIL', sanitizeCellInput(params.email));
  if (params.coordinators !== undefined) {
    var coords = Array.isArray(params.coordinators) 
      ? params.coordinators.map(function(c) { return sanitizeCellInput(c); }).filter(Boolean)
      : [sanitizeCellInput(params.coordinators)];
    props.setProperty('COORDINATOR_NAMES', JSON.stringify(coords));
  }

  logAuditAction('UPDATE_COORDINATOR_DESK', session.employeeId, 'Updated Coordinator Desk info', 'SUCCESS');
  return handleGetCoordinatorDesk(params);
}

/**
 * 13b. Institutional & User CNE Program Impact
 * Retrieves live impact metrics calculated strictly from the 'Data' tab.
 * - Unauthenticated (session is null): Returns institutional/global metrics across all completed classes.
 * - Authenticated (session exists): Returns personalized impact metrics for the authenticated user (RP or participant).
 * Uses server-side session identity exclusively; does not accept unverified client-supplied employee IDs.
 */
function handleGetProgramImpact(params, session) {
  var ss = getSpreadsheet('CNE');
  var dataSheet = ss.getSheetByName('Data');
  
  var isUserLoggedIn = Boolean(session && session.employeeId);
  var loggedInId = isUserLoggedIn ? normalizeEmpId(session.employeeId) : null;
  
  if (!dataSheet) {
    return {
      success: true,
      data: {
        totalCompletedClasses: 0,
        cneDuration: '00:00:00',
        totalDuration: '00:00:00',
        totalDurationSeconds: 0,
        uniqueStaffTrained: 0,
        uniqueWardsCount: 0,
        attendanceComplianceRate: 'N/A',
        scope: isUserLoggedIn ? 'user' : 'institutional'
      }
    };
  }
  
  var dataRange = dataSheet.getDataRange();
  var data = dataRange.getValues();
  if (data.length <= 1) {
    return {
      success: true,
      data: {
        totalCompletedClasses: 0,
        cneDuration: '00:00:00',
        totalDuration: '00:00:00',
        totalDurationSeconds: 0,
        uniqueStaffTrained: 0,
        uniqueWardsCount: 0,
        attendanceComplianceRate: 'N/A',
        scope: isUserLoggedIn ? 'user' : 'institutional'
      }
    };
  }
  
  var displayValues = dataRange.getDisplayValues();
  var completedClasses = 0;
  var totalDurationSeconds = 0;
  var uniqueStaffMap = {};
  var uniqueWardsMap = {};
  var userTrainedOthersMap = {};
  var anonymousStaffCount = 0;
  var anonymousStaffTrainedByRp = 0;
  
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var dataId = String(row[0] || '').trim();
    if (!dataId) continue;
    
    var area = String(row[1] || '').trim();
    var displayDur = (displayValues && displayValues[r]) ? displayValues[r][4] : '';
    var duration = formatDurationValue(row[4], displayDur);
    var durSec = parseDurationToSeconds(duration) || 0;
    var rpEmpId = normalizeEmpId(row[6]);
    var staffIdsRaw = String(row[8] || '').trim();
    var staffCount = parseInt(row[9], 10) || 0;
    
    var staffArray = staffIdsRaw.split(',').map(function(s) {
      return normalizeEmpId(s);
    }).filter(Boolean);
    
    if (staffCount === 0 && staffArray.length > 0) {
      staffCount = staffArray.length;
    }
    
    if (!isUserLoggedIn) {
      // INSTITUTIONAL: All valid completed classes in Data tab
      completedClasses++;
      totalDurationSeconds += durSec;
      if (area) {
        uniqueWardsMap[area.toLowerCase()] = true;
      }
      if (staffArray.length > 0) {
        for (var s = 0; s < staffArray.length; s++) {
          uniqueStaffMap[staffArray[s]] = true;
        }
      } else if (staffCount > 0) {
        anonymousStaffCount += staffCount;
      }
    } else {
      // USER-SPECIFIC: Only records associated with authenticated user
      var isResourcePerson = (rpEmpId === loggedInId);
      var isParticipant = (staffArray.indexOf(loggedInId) !== -1);
      
      if (isResourcePerson || isParticipant) {
        completedClasses++;
        totalDurationSeconds += durSec;
        if (area) {
          uniqueWardsMap[area.toLowerCase()] = true;
        }
        if (isResourcePerson) {
          if (staffArray.length > 0) {
            for (var sp = 0; sp < staffArray.length; sp++) {
              if (staffArray[sp] !== loggedInId) {
                userTrainedOthersMap[staffArray[sp]] = true;
              }
            }
          } else if (staffCount > 0) {
            anonymousStaffTrainedByRp += staffCount;
          }
        }
      }
    }
  }
  
  var totalStaff = 0;
  if (!isUserLoggedIn) {
    var uniqueCount = Object.keys(uniqueStaffMap).length;
    totalStaff = uniqueCount > 0 ? uniqueCount : anonymousStaffCount;
  } else {
    // For logged-in Resource Person, Officers Trained = unique participants trained by RP (excluding themselves)
    var trainedOthers = Object.keys(userTrainedOthersMap).length;
    if (trainedOthers === 0 && anonymousStaffTrainedByRp > 0) {
      trainedOthers = anonymousStaffTrainedByRp;
    }
    totalStaff = trainedOthers;
  }
  
  var totalWards = Object.keys(uniqueWardsMap).length;
  
  return {
    success: true,
    data: {
      totalCompletedClasses: completedClasses,
      cneDuration: formatSecondsToDuration(totalDurationSeconds),
      totalDuration: formatSecondsToDuration(totalDurationSeconds),
      totalDurationSeconds: totalDurationSeconds,
      uniqueStaffTrained: totalStaff,
      uniqueWardsCount: totalWards,
      attendanceComplianceRate: 'N/A', // Data sheet contains no verification/compliance percentage column
      scope: isUserLoggedIn ? 'user' : 'institutional'
    }
  };
}

/**
 * 14. Dashboard & Analytics Stats (Requires Authenticated Session)
 */
function handleGetDashboardStats(params, session) {
  if (!session) {
    return {
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required to access dashboard metrics.'
    };
  }
  
  var ss = getSpreadsheet('CNE');
  var dataSheet = ss.getSheetByName('Data');
  var upcomingSheet = ss.getSheetByName('Upcoming Classes');
  var areaSheet = ss.getSheetByName('Area');
  var appSheet = ss.getSheetByName('CNE Applications');
  
  var totalActivities = 0;
  var totalParticipants = 0;
  var totalMinutes = 0;
  var currentMonthCount = 0;
  var currentMonthStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM');
  
  var monthlyMap = {};
  var areaMap = {};
  var modeMap = {};
  
  if (dataSheet) {
    var dataRange = dataSheet.getDataRange();
    var data = dataRange.getValues();
    var displayValues = dataRange.getDisplayValues();
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (!row[0]) continue;
      
      totalActivities++;
      var area = String(row[1] || 'General').trim();
      var fromDate = formatDateValue(row[2]);
      var dispDur = (displayValues && displayValues[r]) ? displayValues[r][4] : '';
      var dur = formatDurationValue(row[4], dispDur);
      var mode = String(row[7] || 'Lecture').trim();
      var count = parseInt(row[9], 10) || 0;
      
      totalParticipants += count;
      
      var parts = dur.split(':');
      var hrs = parseInt(parts[0], 10) || 0;
      var mins = parseInt(parts[1], 10) || 0;
      var sessionMins = hrs * 60 + mins;
      totalMinutes += sessionMins;
      
      if (fromDate.indexOf(currentMonthStr) === 0) {
        currentMonthCount++;
      }
      
      var mKey = fromDate.substring(0, 7) || currentMonthStr;
      if (!monthlyMap[mKey]) monthlyMap[mKey] = { count: 0, minutes: 0 };
      monthlyMap[mKey].count++;
      monthlyMap[mKey].minutes += sessionMins;
      
      areaMap[area] = (areaMap[area] || 0) + 1;
      modeMap[mode] = (modeMap[mode] || 0) + 1;
    }
  }
  
  var upcomingCount = 0;
  if (upcomingSheet) {
    var uData = upcomingSheet.getDataRange().getValues();
    var uColMap = getHeaderMap(upcomingSheet);
    var uStatCol = uColMap['status'] !== undefined ? uColMap['status'] : 11;
    for (var u = 1; u < uData.length; u++) {
      if (normalizeCNEStatus(uData[u][uStatCol]) === 'Scheduled') upcomingCount++;
    }
  }
  
  var activeAreasCount = 0;
  if (areaSheet) {
    var aData = areaSheet.getDataRange().getValues();
    for (var a = 1; a < aData.length; a++) {
      if (String(aData[a][1] || 'ACTIVE').toUpperCase() === 'ACTIVE') activeAreasCount++;
    }
  }
  
  var pendingAppsCount = 0;
  if (appSheet) {
    var apData = appSheet.getDataRange().getValues();
    for (var p = 1; p < apData.length; p++) {
      if (String(apData[p][5] || 'Applied') === 'Applied') pendingAppsCount++;
    }
  }
  
  var monthlyBreakdown = Object.keys(monthlyMap).sort().map(function(k) {
    return { month: k, count: monthlyMap[k].count, hours: Math.round((monthlyMap[k].minutes / 60) * 10) / 10 };
  });
  
  var areaBreakdown = Object.keys(areaMap).map(function(k) {
    return { area: k, count: areaMap[k] };
  });
  
  var modeBreakdown = Object.keys(modeMap).map(function(k) {
    return { mode: k, count: modeMap[k] };
  });
  
  return {
    success: true,
    data: {
      totalActivities: totalActivities,
      currentMonthActivities: currentMonthCount,
      upcomingClassesCount: upcomingCount,
      totalParticipants: totalParticipants,
      activeAreasCount: activeAreasCount,
      pendingApplicationsCount: pendingAppsCount,
      totalTrainingHours: Math.round((totalMinutes / 60) * 10) / 10,
      monthlyBreakdown: monthlyBreakdown,
      areaBreakdown: areaBreakdown,
      modeBreakdown: modeBreakdown
    }
  };
}

/**
 * Format Date Helper (Asia/Kolkata consistent)
 */
function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var hours = val.getHours();
    var minutes = val.getMinutes();
    var seconds = val.getSeconds();
    if (hours !== 0 || minutes !== 0 || seconds !== 0) {
      return Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Kolkata', "yyyy-MM-dd'T'HH:mm");
    }
    return Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
  }
  return String(val).trim();
}

/**
 * Header Normalization Map Helper
 * Maps all headers to lowercase alphanumeric keys for resilient column lookups
 */
function getHeaderMap(sheet) {
  var map = {};
  if (!sheet) return map;
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return map;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var c = 0; c < headers.length; c++) {
    var key = String(headers[c] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key) {
      map[key] = c;
    }
  }
  return map;
}

/**
 * ============================================================================
 * AUTHORITATIVE CNE SPREADSHEET INITIALIZATION & HEADER ARCHITECTURE
 * ============================================================================
 */

/**
 * Authoritative Centralized CNE Spreadsheet Headers
 * Defines the standard header structure for all 13 required CNE tabs.
 */
var CNE_SHEET_HEADERS = {
  'Data': [
    'Data ID', 'Ward Name / Area', 'From Date', 'To Date', 'Duration',
    'Topic', 'Resource Person Emp Id', 'Mode of Teaching', 'Staff Emp ID', 'Staff Count', 'Remarks', 'CreatedAt', 'CreatedBy',
    'External Resource Persons', 'External Staff Participants', 'Type of CNE'
  ],
  'Area': ['Area', 'Status', 'CreatedAt'],
  'Role': ['Employee ID No.', 'Name of the Officers', 'Designation', 'Role', 'Department / Area'],
  'Upcoming Classes': [
    'CNE ID', 'Topic', 'Area', 'From Date', 'To Date', 'Time', 'Duration',
    'Resource Person Emp Id', 'Mode of Teaching', 'Description', 'Max Participants', 'Status',
    'Type of CNE', 'External Resource Persons', 'Proposed By', 'Admin Remarks'
  ],
  'CNE Applications': ['Application ID', 'CNE ID', 'Employee ID', 'Employee Name', 'Applied At', 'Status', 'Remarks'],
  'Gallery': ['Image ID', 'Title', 'Description', 'Date', 'Drive File ID', 'Image URL', 'Uploaded By', 'Uploaded At', 'Status'],
  'News and Events': ['Event ID', 'Title', 'Category', 'Date', 'Summary', 'Full Content', 'Status', 'CreatedAt', 'CreatedBy'],
  'User Credentials': ['Employee ID', 'Password Hash', 'Password Salt', 'Must Change Password', 'Created At', 'Updated At', 'Last Login At', 'Account Status'],
  'Audit Log': ['Timestamp', 'Action', 'Employee ID', 'Details', 'Status'],
  'CNE Post Test Questions': ['CNE ID', 'Question ID', 'Question Text', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option', 'Explanation', 'Is Finalized', 'Is Locked', 'Created At', 'Created By'],
  'CNE Post Test Responses': ['Response ID', 'CNE ID', 'Employee ID', 'Employee Name', 'Designation', 'Department', 'Score', 'Total Questions', 'Percentage', 'Source', 'Submitted At', 'Answers JSON', 'Status', 'Remarks'],
  'CNE_Reference': ['CNE ID', 'Topic', 'Reference Text / Clinical Guides', 'Updated At', 'Updated By'],
  'CNE_QR_Tokens': ['QR Token', 'CNE ID', 'Created At', 'Created By', 'Status'],
  'CNE_AI_Quota': ['CNE ID', 'Topic', 'Attempts Used', 'Max Quota', 'Last Attempt At', 'Last Generated By', 'Reservation Token', 'Reserved Until', 'Last Committed Token']
};

/**
 * Header alias normalization map to prevent duplicate or mismatched headers
 */
var CNE_HEADER_ALIASES = {
  'cneid': ['cneid', 'classid'],
  'classid': ['cneid', 'classid'],
  'typeofcne': ['typeofcne', 'cnetype', 'type'],
  'fromdate': ['fromdate', 'date'],
  'todate': ['todate'],
  'modeofteaching': ['modeofteaching', 'mode'],
  'areadepartment': ['areadepartment', 'departmentarea', 'area', 'department'],
  'departmentarea': ['departmentarea', 'areadepartment', 'area', 'department'],
  'questiontext': ['questiontext', 'question'],
  'correctoption': ['correctoption', 'correctanswer'],
  'isfinalized': ['isfinalized', 'selectedfinal'],
  'islocked': ['islocked'],
  'referencetextclinicalguides': ['referencetextclinicalguides', 'referencetext'],
  'referencetext': ['referencetext', 'referencetextclinicalguides'],
  'answersjson': ['answersjson', 'answers'],
  'source': ['source', 'participantsource'],
  'passwordsalt': ['passwordsalt', 'salt'],
  'lastloginat': ['lastloginat', 'lastlogin'],
  'cneaiquota': ['cneaiquota', 'aiquota', 'cnequota'],
  'attemptsused': ['attemptsused', 'attempts', 'generationattempts'],
  'maxquota': ['maxquota', 'maxattempts'],
  'lastattemptat': ['lastattemptat', 'lastattempt', 'attemptat'],
  'lastgeneratedby': ['lastgeneratedby', 'generatedby']
};

/**
 * Single Standardized Generic Sheet Helper:
 * Strictly NON-DESTRUCTIVE Sheet Tab & Header Resolver
 * If tab exists: leaves existing rows, structure, and formatting completely untouched.
 * If tab is missing: creates tab and writes initial bold headers.
 */
function getOrCreateSheet(sheetName, defaultHeaders) {
  var ss = getSpreadsheet('CNE');
  var sheet = ss.getSheetByName(sheetName);
  var headers = defaultHeaders || (typeof CNE_SHEET_HEADERS !== 'undefined' ? CNE_SHEET_HEADERS[sheetName] : null);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  } else if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

/**
 * Single Authoritative Sheet Initializer & Header Verifier (Idempotent & Non-Destructive)
 * Verifies all 13 required CNE tabs and their headers.
 * Never deletes or clears existing sheets or rows. Appends missing headers if needed.
 */
function setupAndVerifyCNESheets(executorEmpId) {
  var tabNames = [
    'Data',
    'Area',
    'Role',
    'Upcoming Classes',
    'CNE Applications',
    'Gallery',
    'News and Events',
    'User Credentials',
    'Audit Log',
    'CNE Post Test Questions',
    'CNE Post Test Responses',
    'CNE_Reference',
    'CNE_QR_Tokens',
    'CNE_AI_Quota'
  ];

  var auditReport = [];
  var ss = getSpreadsheet('CNE');

  for (var i = 0; i < tabNames.length; i++) {
    var tabName = tabNames[i];
    var expectedHeaders = CNE_SHEET_HEADERS[tabName] || [];
    var existingSheet = ss.getSheetByName(tabName);
    var isNew = !existingSheet;

    // Use the single generic helper getOrCreateSheet
    var sheet = getOrCreateSheet(tabName);

    if (isNew) {
      auditReport.push({ tab: tabName, status: 'Created new sheet with headers', rowCount: 1 });
    } else {
      var lastRow = sheet.getLastRow();
      if (lastRow === 0 && expectedHeaders.length > 0) {
        auditReport.push({ tab: tabName, status: 'Existing (Headers added to empty tab)', rowCount: 1 });
      } else {
        var lastCol = sheet.getLastColumn() || 1;
        var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        var existingKeys = existingHeaders.map(function(h) {
          return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        });

        // Non-destructive standardization: rename header 'Class ID' to 'CNE ID' in-place if present
        if (tabName === 'Upcoming Classes' || tabName === 'CNE Applications') {
          for (var c = 0; c < existingHeaders.length; c++) {
            var rawH = String(existingHeaders[c] || '').trim();
            if (rawH.toLowerCase().replace(/[^a-z0-9]/g, '') === 'classid') {
              sheet.getRange(1, c + 1).setValue('CNE ID');
              existingHeaders[c] = 'CNE ID';
              existingKeys[c] = 'cneid';
              auditReport.push({ tab: tabName, status: 'Migrated header "Class ID" to "CNE ID" (in-place)', rowCount: lastRow });
              break;
            }
          }
        }

        // Targeted surgical cleanup: ONLY for CNE_Reference sheet, physically delete legacy columns "Syllabus" and "Reference Links"
        if (tabName === 'CNE_Reference') {
          var deletedCols = [];
          // Scan from right to left (descending index) so earlier column indices remain stable during deletion
          for (var c = existingHeaders.length - 1; c >= 0; c--) {
            var rawH = String(existingHeaders[c] || '').trim();
            var normH = rawH.toLowerCase().replace(/[^a-z0-9]/g, '');
            // Detect headers named exactly "Syllabus" and "Reference Links" (case-insensitive / normalized)
            if (normH === 'syllabus' || normH === 'referencelinks' || normH === 'referencelink') {
              sheet.deleteColumn(c + 1);
              deletedCols.push(rawH);
            }
          }
          if (deletedCols.length > 0) {
            auditReport.push({
              tab: tabName,
              status: 'Surgically deleted legacy column(s): ' + deletedCols.reverse().join(', '),
              rowCount: sheet.getLastRow()
            });
            // Re-fetch headers and column count after physical column deletion
            lastCol = sheet.getLastColumn() || 1;
            existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
            existingKeys = existingHeaders.map(function(h) {
              return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            });
          }
        }

        var missingHeaders = [];
        for (var h = 0; h < expectedHeaders.length; h++) {
          var reqH = expectedHeaders[h];
          var reqKey = String(reqH).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          var matched = false;

          if (existingKeys.indexOf(reqKey) !== -1) {
            matched = true;
          } else if (CNE_HEADER_ALIASES && CNE_HEADER_ALIASES[reqKey]) {
            for (var a = 0; a < CNE_HEADER_ALIASES[reqKey].length; a++) {
              if (existingKeys.indexOf(CNE_HEADER_ALIASES[reqKey][a]) !== -1) {
                matched = true;
                break;
              }
            }
          }

          if (!matched) {
            missingHeaders.push(reqH);
          }
        }

        if (missingHeaders.length > 0) {
          sheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
          sheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setFontWeight('bold');
          auditReport.push({
            tab: tabName,
            status: 'Appended ' + missingHeaders.length + ' missing header(s): ' + missingHeaders.join(', '),
            rowCount: lastRow
          });
        } else {
          auditReport.push({ tab: tabName, status: 'Verified (All required headers present)', rowCount: lastRow });
        }
      }
    }
  }

  // Check Employee Master
  try {
    var offSS = getSpreadsheet('OFFICERS');
    var offSheet = offSS.getSheetByName('Rosters Master Data');
    if (offSheet) {
      auditReport.push({ tab: offSheet.getName(), status: 'Existing, verified (Master Roster)', rowCount: offSheet.getLastRow() });
    }
  } catch (e) {
    auditReport.push({ tab: 'Rosters Master Data', status: 'Separate Sheet / Unconfigured', error: e.message });
  }

  logAuditAction('SETUP_AND_VERIFY_SHEETS', executorEmpId || 'SYSTEM', 'Sheet verification executed', 'SUCCESS');

  return {
    success: true,
    message: 'Sheet initialization and verification completed safely. All existing data remained completely untouched.',
    auditReport: auditReport
  };
}

/**
 * 8 & 24. Auto-Initialize / Verify Sheets Action Handlers (Strictly NON-DESTRUCTIVE, Requires ADMIN)
 */
function handleSetupAndVerifyCNESheets(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  return setupAndVerifyCNESheets(session ? session.employeeId : 'ADMIN');
}

function handleInitializeSheets(params, session) {
  return handleSetupAndVerifyCNESheets(params, session);
}

/**
 * ============================================================================
 * PART 2: TOPIC REFERENCE, AI QUESTIONS, LOCKING, QR, POST-TEST & COMPLETION
 * ============================================================================
 */

function getCNEClassRecord(cneId) {
  if (!cneId) return null;
  var ss = getSpreadsheet('CNE');
  var sheet = ss.getSheetByName('Upcoming Classes');
  if (!sheet) return null;
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  
  var colMap = getHeaderMap(sheet);
  var cleanId = String(cneId).trim().toUpperCase();

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 0);
    var rowId = String(row[idCol] || '').trim().toUpperCase();
    if (rowId === cleanId) {
      var rawType = colMap['typeofcne'] !== undefined ? row[colMap['typeofcne']] : row[12];
      var rawStatus = colMap['status'] !== undefined ? row[colMap['status']] : row[11];
      var durVal = colMap['duration'] !== undefined ? row[colMap['duration']] : row[6];
      var maxP = colMap['maxparticipants'] !== undefined ? row[colMap['maxparticipants']] : row[10];

      return {
        rowIndex: r + 1,
        cneId: String(row[idCol] || '').trim(),
        topic: String((colMap['topic'] !== undefined ? row[colMap['topic']] : row[1]) || '').trim(),
        area: String((colMap['area'] !== undefined ? row[colMap['area']] : row[2]) || '').trim(),
        date: formatDateValue(colMap['fromdate'] !== undefined ? row[colMap['fromdate']] : (colMap['date'] !== undefined ? row[colMap['date']] : row[3])),
        toDate: formatDateValue(colMap['todate'] !== undefined ? row[colMap['todate']] : (row[4] || row[3])),
        time: String((colMap['time'] !== undefined ? row[colMap['time']] : row[5]) || '').trim(),
        duration: durVal ? Number(durVal) : 60,
        instructor: String((colMap['resourcepersonempid'] !== undefined ? row[colMap['resourcepersonempid']] : row[7]) || '').trim(),
        mode: String((colMap['modeofteaching'] !== undefined ? row[colMap['modeofteaching']] : (colMap['mode'] !== undefined ? row[colMap['mode']] : row[8])) || 'Offline').trim(),
        description: String((colMap['description'] !== undefined ? row[colMap['description']] : row[9]) || '').trim(),
        maxParticipants: maxP ? Number(maxP) : 50,
        status: normalizeCNEStatus(rawStatus),
        externalResourcePersons: String((colMap['externalresourcepersons'] !== undefined ? row[colMap['externalresourcepersons']] : row[13]) || '').trim(),
        proposedBy: String((colMap['proposedby'] !== undefined ? row[colMap['proposedby']] : row[14]) || '').trim(),
        adminRemarks: String((colMap['adminremarks'] !== undefined ? row[colMap['adminremarks']] : row[15]) || '').trim(),
        cneType: normalizeCNEType(rawType)
      };
    }
  }
  return null;
}

/**
 * Save CNE Topic and Reference Material
 * 5-Column Schema:
 * 1: CNE ID
 * 2: Topic
 * 3: Reference Text / Clinical Guides (holds complete educational content)
 * 4: Updated At
 * 5: Updated By
 */
function handleSaveReferenceMaterial(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) {
    return { success: false, message: 'CNE ID is required.' };
  }
  
  var record = getCNEClassRecord(cneId);
  if (!record) {
    return { success: false, message: 'CNE record not found for ID: ' + cneId };
  }
  
  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;
  
  // Unified educational content entered through the single large content box
  var unifiedContent = sanitizeCellInput(params.unifiedContent || params.referenceText || params.material || '');
  
  var sheet = getOrCreateSheet('CNE_Reference');
  var data = sheet.getDataRange().getValues();
  var colMap = getHeaderMap(sheet);
  var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : 0;
  var existingRow = -1;
  
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      existingRow = r + 1;
      break;
    }
  }
  
  var updatedAt = new Date().toISOString();
  var updatedBy = session.employeeId;
  
  // Exactly 5 columns: CNE ID, Topic, Reference Text / Clinical Guides, Updated At, Updated By
  var rowValues = [cneId, record.topic, unifiedContent, updatedAt, updatedBy];
  
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, 5).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  // Resolve employee name for frontend display response - never expose employee ID
  var officerMap = getOfficerNameMap();
  var officerName = 'Coordinator';
  if (session && session.employeeId) {
    var normEmpId = normalizeEmpId(session.employeeId);
    if (officerMap && officerMap[normEmpId]) {
      officerName = officerMap[normEmpId];
    } else if (session.name && String(session.name).trim() && String(session.name).trim().toUpperCase() !== String(session.employeeId).toUpperCase()) {
      officerName = String(session.name).trim();
    }
  }
  
  logAuditAction('SAVE_REFERENCE_MATERIAL', session.employeeId, 'Saved reference material for CNE: ' + cneId, 'SUCCESS');
  return {
    success: true,
    message: 'CNE learning material saved successfully.',
    data: {
      cneId: cneId,
      unifiedContent: unifiedContent,
      referenceText: unifiedContent,
      updatedAt: updatedAt,
      updatedBy: officerName
    }
  };
}

/**
 * Get CNE Topic and Reference Material
 * 5-Column Schema:
 * 1: CNE ID
 * 2: Topic
 * 3: Reference Text / Clinical Guides
 * 4: Updated At
 * 5: Updated By
 */
function handleGetReferenceMaterial(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var sheet = getOrCreateSheet('CNE_Reference');
  var data = sheet.getDataRange().getValues();
  var colMap = getHeaderMap(sheet);
  
  var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : 0;
  var topicCol = colMap['topic'] !== undefined ? colMap['topic'] : 1;
  var refCol = colMap['referencetextclinicalguides'] !== undefined ? colMap['referencetextclinicalguides'] : (colMap['referencetext'] !== undefined ? colMap['referencetext'] : 2);
  var updatedCol = colMap['updatedat'] !== undefined ? colMap['updatedat'] : 3;
  var byCol = colMap['updatedby'] !== undefined ? colMap['updatedby'] : 4;
  
  var officerMap = getOfficerNameMap();

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      var refText = String(data[r][refCol] || '');
      var updatedAt = String(data[r][updatedCol] || '');
      var rawUpdatedBy = String(data[r][byCol] || '').trim();
      
      // Resolve employee ID to Officer Name. NEVER expose employee ID as fallback
      var displayName = 'Coordinator';
      if (rawUpdatedBy) {
        var norm = normalizeEmpId(rawUpdatedBy);
        if (officerMap && officerMap[norm]) {
          displayName = officerMap[norm];
        }
      }

      return {
        success: true,
        data: {
          cneId: cneId,
          topic: String(data[r][topicCol] || ''),
          referenceText: refText,
          unifiedContent: refText,
          updatedAt: updatedAt,
          updatedBy: displayName
        }
      };
    }
  }
  
  var record = getCNEClassRecord(cneId);
  return {
    success: true,
    data: {
      cneId: cneId,
      topic: record ? record.topic : '',
      referenceText: record && record.description ? record.description : '',
      unifiedContent: record && record.description ? record.description : '',
      updatedAt: '',
      updatedBy: 'Coordinator'
    }
  };
}

/**
 * Authoritative Reservation Lifetime (10 minutes)
 */
var AI_QUOTA_RESERVATION_MS = 10 * 60 * 1000;

/**
 * Get CNE AI Generation Quota Status
 * Authoritative read from CNE_AI_Quota sheet
 */
function handleGetAiQuota(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found for ID: ' + cneId };
  
  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;
  
  var sheet = getOrCreateSheet('CNE_AI_Quota');
  var data = sheet.getDataRange().getValues();
  var attemptsUsed = 0;
  var maxQuota = 3;
  var lastAttemptAt = '';
  var lastGeneratedBy = '';
  
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      attemptsUsed = parseInt(data[r][2], 10) || 0;
      maxQuota = parseInt(data[r][3], 10) || 3;
      lastAttemptAt = String(data[r][4] || '');
      lastGeneratedBy = String(data[r][5] || '');
      break;
    }
  }
  
  return {
    success: true,
    data: {
      cneId: cneId,
      topic: record.topic,
      attemptsUsed: attemptsUsed,
      maxQuota: maxQuota,
      remaining: Math.max(0, maxQuota - attemptsUsed),
      canGenerate: attemptsUsed < maxQuota,
      lastAttemptAt: lastAttemptAt,
      lastGeneratedBy: lastGeneratedBy
    }
  };
}

/**
 * Atomically reserve one AI generation slot for a CNE
 * Uses LockService to ensure atomic concurrency control
 */
function handleReserveAiQuota(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found for ID: ' + cneId };
  
  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;
  
  if (isCNEQuestionsLocked(cneId)) {
    return {
      success: false,
      errorCode: 'QUESTIONS_LOCKED',
      message: 'Questions are locked because post-test submissions have already begun for this CNE.'
    };
  }
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Backend is busy processing another request. Please try again in a few seconds.' };
  }
  
  try {
    var sheet = getOrCreateSheet('CNE_AI_Quota');
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var attemptsUsed = 0;
    var maxQuota = 3;
    var existingToken = '';
    var reservedUntil = 0;
    var now = Date.now();
    
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0] || '').trim().toUpperCase() === cneId.toUpperCase()) {
        rowIndex = r + 1;
        attemptsUsed = parseInt(data[r][2], 10) || 0;
        maxQuota = parseInt(data[r][3], 10) || 3;
        existingToken = String(data[r][6] || '').trim();
        reservedUntil = parseInt(data[r][7], 10) || 0;
        break;
      }
    }
    
    // Check if there is an active unexpired reservation from another in-flight request
    var hasActiveReservation = existingToken && (reservedUntil > now);
    var effectiveAttempts = attemptsUsed + (hasActiveReservation ? 1 : 0);
    
    if (attemptsUsed >= maxQuota || effectiveAttempts >= maxQuota) {
      return {
        success: false,
        errorCode: 'QUOTA_EXHAUSTED',
        message: 'AI question generation quota reached for this CNE (3 of 3 successful attempts used).',
        data: {
          cneId: cneId,
          attemptsUsed: attemptsUsed,
          maxQuota: maxQuota,
          remaining: 0,
          canGenerate: false
        }
      };
    }
    
    // Create new reservation token (valid for 10 minutes)
    var reservationToken = Utilities.getUuid().replace(/-/g, '');
    var newReservedUntil = now + AI_QUOTA_RESERVATION_MS;
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 7, 1, 2).setValues([[reservationToken, String(newReservedUntil)]]);
    } else {
      sheet.appendRow([cneId, record.topic, 0, 3, '', '', reservationToken, String(newReservedUntil), '']);
    }
    
    return {
      success: true,
      data: {
        reservationToken: reservationToken,
        cneId: cneId,
        attemptsUsed: attemptsUsed,
        maxQuota: maxQuota,
        remaining: Math.max(0, maxQuota - attemptsUsed),
        canGenerate: true
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Atomically commit a successful AI generation attempt
 * Called ONLY AFTER Gemini returns exactly 10 valid questions
 */
function handleCommitAiQuota(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  var reservationToken = sanitizeCellInput(params.reservationToken);
  if (!cneId || !reservationToken) {
    return { success: false, message: 'CNE ID and reservation token are required.' };
  }
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found for ID: ' + cneId };
  
  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Backend is busy. Please try again.' };
  }
  
  try {
    var sheet = getOrCreateSheet('CNE_AI_Quota');
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var attemptsUsed = 0;
    var maxQuota = 3;
    var storedToken = '';
    var reservedUntil = 0;
    var lastCommittedToken = '';
    
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0] || '').trim().toUpperCase() === cneId.toUpperCase()) {
        rowIndex = r + 1;
        attemptsUsed = parseInt(data[r][2], 10) || 0;
        maxQuota = parseInt(data[r][3], 10) || 3;
        storedToken = String(data[r][6] || '').trim();
        reservedUntil = parseInt(data[r][7], 10) || 0;
        lastCommittedToken = String(data[r][8] || '').trim();
        break;
      }
    }
    
    // Idempotency: If this token was already committed, return success without incrementing attempts again
    if (rowIndex > 0 && lastCommittedToken === reservationToken) {
      return {
        success: true,
        alreadyCommitted: true,
        message: 'AI generation attempt was already successfully committed (' + attemptsUsed + '/' + maxQuota + ').',
        data: {
          cneId: cneId,
          attemptsUsed: attemptsUsed,
          maxQuota: maxQuota,
          remaining: Math.max(0, maxQuota - attemptsUsed),
          canGenerate: attemptsUsed < maxQuota
        }
      };
    }
    
    if (rowIndex === -1 || storedToken !== reservationToken) {
      return {
        success: false,
        errorCode: 'INVALID_RESERVATION',
        message: 'Invalid, expired, or already consumed reservation token.'
      };
    }
    
    var now = Date.now();
    if (reservedUntil < now) {
      return {
        success: false,
        errorCode: 'RESERVATION_EXPIRED',
        message: 'AI quota reservation token has expired. Please initiate a new generation request.'
      };
    }
    
    if (attemptsUsed >= maxQuota) {
      return {
        success: false,
        errorCode: 'QUOTA_EXHAUSTED',
        message: 'Maximum AI generation attempts already reached (' + maxQuota + '/' + maxQuota + ').'
      };
    }
    
    var newAttempts = attemptsUsed + 1;
    var nowIso = new Date().toISOString();
    
    // Update Attempts Used (col 3), Max Quota (col 4), Last Attempt At (col 5), Last Generated By (col 6),
    // clear Reservation Token (col 7), clear Reserved Until (col 8), and record Last Committed Token (col 9)
    sheet.getRange(rowIndex, 3, 1, 7).setValues([[newAttempts, maxQuota, nowIso, session.employeeId, '', '0', reservationToken]]);
    
    logAuditAction('AI_QUESTION_GENERATION_SUCCESS', session.employeeId, 'Generated 10 clinical MCQs (Attempt ' + newAttempts + '/' + maxQuota + ') for CNE: ' + cneId, 'SUCCESS');
    
    return {
      success: true,
      message: 'AI generation attempt successfully committed (' + newAttempts + '/' + maxQuota + ').',
      data: {
        cneId: cneId,
        attemptsUsed: newAttempts,
        maxQuota: maxQuota,
        remaining: Math.max(0, maxQuota - newAttempts),
        canGenerate: newAttempts < maxQuota
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Release an active reservation when Gemini generation fails or is aborted
 * Attempt remains unconsumed
 */
function handleReleaseAiQuota(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  var reservationToken = sanitizeCellInput(params.reservationToken);
  if (!cneId || !reservationToken) return { success: false, errorCode: 'INVALID_RESERVATION', message: 'CNE ID and reservation token are required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found for ID: ' + cneId };
  
  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy.' };
  }
  
  try {
    var sheet = getOrCreateSheet('CNE_AI_Quota');
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var storedToken = '';
    
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0] || '').trim().toUpperCase() === cneId.toUpperCase()) {
        rowIndex = r + 1;
        storedToken = String(data[r][6] || '').trim();
        break;
      }
    }
    
    if (rowIndex === -1) {
      return {
        success: false,
        errorCode: 'INVALID_RESERVATION',
        message: 'No quota reservation record found for this CNE.'
      };
    }
    
    if (!storedToken || storedToken !== reservationToken) {
      return {
        success: false,
        errorCode: 'INVALID_RESERVATION',
        message: 'Reservation token is invalid, unknown, or does not match the active reservation for this CNE.'
      };
    }
    
    // ONLY when the token matches, clear the reservation token and reservation expiry
    sheet.getRange(rowIndex, 7, 1, 2).setValues([['', '0']]);
    return { success: true, message: 'Reservation released.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Authoritatively validate an AI generation quota reservation before Express invokes Gemini
 * Does NOT consume quota.
 * Does NOT increment attempts used.
 * Does NOT release reservation.
 */
function handleValidateAiQuotaReservation(params, session) {
  if (!session) {
    return {
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in.'
    };
  }

  var cneId = sanitizeCellInput(params.cneId);
  var reservationToken = sanitizeCellInput(params.reservationToken);

  if (!cneId) {
    return { success: false, errorCode: 'CNE_ID_REQUIRED', message: 'CNE ID is required.' };
  }
  if (!reservationToken) {
    return { success: false, errorCode: 'RESERVATION_TOKEN_REQUIRED', message: 'Reservation token is required.' };
  }

  var record = getCNEClassRecord(cneId);
  if (!record) {
    return { success: false, errorCode: 'CNE_NOT_FOUND', message: 'CNE record not found for ID: ' + cneId };
  }

  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, errorCode: 'SERVER_BUSY', message: 'Server is busy. Please try again.' };
  }

  try {
    var sheet = getOrCreateSheet('CNE_AI_Quota');
    var data = sheet.getDataRange().getValues();
    var storedToken = '';
    var reservedUntil = 0;
    var attemptsUsed = 0;
    var maxQuota = 3;
    var found = false;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0] || '').trim().toUpperCase() === cneId.toUpperCase()) {
        found = true;
        attemptsUsed = parseInt(data[r][2], 10) || 0;
        maxQuota = parseInt(data[r][3], 10) || 3;
        storedToken = String(data[r][6] || '').trim();
        reservedUntil = parseInt(data[r][7], 10) || 0;
        break;
      }
    }

    if (!found || storedToken !== reservationToken) {
      return {
        success: false,
        errorCode: 'INVALID_RESERVATION',
        message: 'Invalid or unknown reservation token for this CNE.'
      };
    }

    var now = Date.now();
    if (reservedUntil < now) {
      return {
        success: false,
        errorCode: 'RESERVATION_EXPIRED',
        message: 'AI quota reservation token has expired. Please initiate a new generation request.'
      };
    }

    if (attemptsUsed >= maxQuota) {
      return {
        success: false,
        errorCode: 'QUOTA_EXHAUSTED',
        message: 'Maximum AI generation attempts already reached (' + maxQuota + '/' + maxQuota + ').'
      };
    }

    return {
      success: true,
      authorized: true,
      data: {
        cneId: cneId,
        topic: record.topic,
        authorizedEmployeeId: session.employeeId,
        role: session.role,
        reservationToken: reservationToken,
        remaining: Math.max(0, maxQuota - attemptsUsed)
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Resolve Questions Sheet
 * Prefers 'CNE Post Test Questions' tab; falls back to 'CNE_Questions' if already present.
 */
function getQuestionsSheet() {
  var ss = getSpreadsheet('CNE');
  var sheet = ss.getSheetByName('CNE Post Test Questions') || ss.getSheetByName('CNE_Questions');
  if (!sheet) {
    sheet = getOrCreateSheet('CNE Post Test Questions');
  }
  return sheet;
}

/**
 * Helper: Resolve Responses Sheet
 * Prefers 'CNE Post Test Responses' tab; falls back to 'CNE_Participants' if already present.
 */
function getResponsesSheet() {
  var ss = getSpreadsheet('CNE');
  var sheet = ss.getSheetByName('CNE Post Test Responses') || ss.getSheetByName('CNE_Participants');
  if (!sheet) {
    sheet = getOrCreateSheet('CNE Post Test Responses');
  }
  return sheet;
}

/**
 * Helper: Resolve QR Tokens Sheet
 */
function getQRTokensSheet() {
  return getOrCreateSheet('CNE_QR_Tokens');
}

/**
 * Check if Question Set is Locked
 * A question set is permanently locked once the FIRST participant post-test submission occurs.
 */
function isCNEQuestionsLocked(cneId) {
  if (!cneId) return false;
  var partSheet = getResponsesSheet();
  if (partSheet && partSheet.getLastRow() > 1) {
    var pData = partSheet.getDataRange().getValues();
    for (var p = 1; p < pData.length; p++) {
      var rowCneId = String(pData[p][1] || '').trim().toUpperCase();
      var source = String(pData[p][9] || pData[p][6] || '').trim().toUpperCase();
      if (rowCneId === String(cneId).trim().toUpperCase() && source === 'POST_TEST') {
        return true; // At least one participant post-test submission exists
      }
    }
  }
  
  var qSheet = getQuestionsSheet();
  if (qSheet && qSheet.getLastRow() > 1) {
    var qData = qSheet.getDataRange().getValues();
    for (var q = 1; q < qData.length; q++) {
      var qCneId = String(qData[q][0] || '').trim().toUpperCase();
      var isLockCol = String(qData[q][10] || '').trim().toUpperCase();
      if (qCneId === String(cneId).trim().toUpperCase() && isLockCol === 'YES') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Save & Finalize Questions for CNE
 */
function handleSaveCNEQuestions(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;
  
  if (isCNEQuestionsLocked(cneId)) {
    return {
      success: false,
      errorCode: 'QUESTIONS_LOCKED',
      message: 'Questions are permanently locked because post-test submissions have already begun and cannot be modified.'
    };
  }
  
  var rawQuestions = params.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length < 5) {
    return {
      success: false,
      errorCode: 'MINIMUM_QUESTIONS_REQUIRED',
      message: 'Validation failed: A minimum of 5 questions is required to save the question set.'
    };
  }
  
  // Strict Pre-Validation before deleting or modifying ANY existing questions:
  // 1. minimum 5 questions (checked above)
  // 2. question text present
  // 3. four options present
  // 4. valid correct answer
  // 5. unique question IDs
  var seenIds = {};
  var validatedRows = [];
  var finalizedCount = 0;
  var now = new Date().toISOString();

  for (var i = 0; i < rawQuestions.length; i++) {
    var q = rawQuestions[i];
    var qNum = i + 1;
    if (!q || typeof q !== 'object') {
      return { success: false, message: 'Question ' + qNum + ': Invalid question data format.' };
    }

    var qId = sanitizeCellInput(q.id || ('q' + qNum)).trim();
    if (!qId) {
      return { success: false, message: 'Question ' + qNum + ': Question ID is required.' };
    }
    if (seenIds[qId.toLowerCase()]) {
      return { success: false, message: 'Validation failed: Duplicate question ID detected: "' + qId + '". Question IDs must be unique.' };
    }
    seenIds[qId.toLowerCase()] = true;

    var qText = sanitizeCellInput(q.question || '').trim();
    if (!qText) {
      return { success: false, message: 'Question ' + qNum + ': Question text is required.' };
    }

    var opts = q.options || {};
    var optA = sanitizeCellInput(opts.A !== undefined ? opts.A : (opts.a || '')).trim();
    var optB = sanitizeCellInput(opts.B !== undefined ? opts.B : (opts.b || '')).trim();
    var optC = sanitizeCellInput(opts.C !== undefined ? opts.C : (opts.c || '')).trim();
    var optD = sanitizeCellInput(opts.D !== undefined ? opts.D : (opts.d || '')).trim();

    if (!optA || !optB || !optC || !optD) {
      return { success: false, message: 'Question ' + qNum + ': All four options (Option A, Option B, Option C, Option D) must be present and non-empty.' };
    }

    var rawCorrect = String(q.correctOption || '').trim().toUpperCase();
    if (['A', 'B', 'C', 'D'].indexOf(rawCorrect) === -1) {
      return { success: false, message: 'Question ' + qNum + ': A valid correct option (must be A, B, C, or D) is required.' };
    }

    var expl = sanitizeCellInput(q.explanation || '').trim();
    var isFin = (q.isFinalized === true || String(q.isFinalized).toUpperCase() === 'YES') ? 'YES' : 'NO';
    if (isFin === 'YES') finalizedCount++;

    validatedRows.push([
      cneId, qId, qText, optA, optB, optC, optD, rawCorrect, expl, isFin, 'NO', now, session.employeeId
    ]);
  }

  // Concurrency lock for writing questions
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }

  try {
    // Re-verify locked state under lock
    if (isCNEQuestionsLocked(cneId)) {
      return {
        success: false,
        errorCode: 'QUESTIONS_LOCKED',
        message: 'Questions are permanently locked because post-test submissions have begun.'
      };
    }

    var sheet = getQuestionsSheet();
    // Only delete existing questions AFTER complete validation has succeeded
    var data = sheet.getDataRange().getValues();
    for (var r = data.length - 1; r >= 1; r--) {
      if (String(data[r][0] || '').trim().toUpperCase() === cneId.toUpperCase()) {
        sheet.deleteRow(r + 1);
      }
    }

    if (validatedRows.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, validatedRows.length, 13).setValues(validatedRows);
    }

    logAuditAction('SAVE_QUESTIONS', session.employeeId, 'Saved ' + validatedRows.length + ' questions (' + finalizedCount + ' finalized) for CNE: ' + cneId, 'SUCCESS');

    return {
      success: true,
      message: 'Question set validated and saved successfully.',
      totalQuestions: validatedRows.length,
      finalizedCount: finalizedCount,
      readyForPostTest: finalizedCount >= 5
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Get Questions for Admin/Incharge (Includes answer keys and explanations)
 */
function handleGetCNEQuestions(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;
  
  var isLocked = isCNEQuestionsLocked(cneId);
  var sheet = getQuestionsSheet();
  var data = sheet.getDataRange().getValues();
  var questions = [];
  var finalizedCount = 0;
  
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      var isFin = String(data[r][9] || 'NO').toUpperCase() === 'YES';
      if (isFin) finalizedCount++;
      questions.push({
        id: String(data[r][1] || ''),
        question: String(data[r][2] || ''),
        options: {
          A: String(data[r][3] || ''),
          B: String(data[r][4] || ''),
          C: String(data[r][5] || ''),
          D: String(data[r][6] || '')
        },
        correctOption: String(data[r][7] || 'A'),
        explanation: String(data[r][8] || ''),
        isFinalized: isFin,
        isLocked: isLocked || String(data[r][10] || 'NO').toUpperCase() === 'YES'
      });
    }
  }
  
  return {
    success: true,
    data: questions,
    isLocked: isLocked,
    finalizedCount: finalizedCount,
    readyForPostTest: finalizedCount >= 5
  };
}

/**
 * Get Secure QR Token for CNE Post-Test
 * Rejects if fewer than 5 questions are finalized
 */
function handleGetQRToken(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;
  
  var sheet = getQuestionsSheet();
  var data = sheet.getDataRange().getValues();
  var finalizedCount = 0;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0] || '').trim().toUpperCase() === cneId.toUpperCase() &&
        String(data[r][9] || 'NO').toUpperCase() === 'YES') {
      finalizedCount++;
    }
  }
  
  if (finalizedCount < 5) {
    return {
      success: false,
      errorCode: 'INSUFFICIENT_QUESTIONS',
      message: 'At least 5 questions must be finalized before QR Code and Post-Test can be generated. Currently finalized: ' + finalizedCount
    };
  }
  
  var qrSheet = getQRTokensSheet();
  var qrData = qrSheet.getDataRange().getValues();
  var existingToken = null;
  
  for (var q = 1; q < qrData.length; q++) {
    if (String(qrData[q][1] || '').trim().toUpperCase() === cneId.toUpperCase() &&
        String(qrData[q][4] || 'ACTIVE').toUpperCase() === 'ACTIVE') {
      existingToken = String(qrData[q][0] || '');
      break;
    }
  }
  
  var qrToken = existingToken;
  if (!qrToken) {
    qrToken = Utilities.getUuid().replace(/-/g, '');
    qrSheet.appendRow([qrToken, cneId, new Date().toISOString(), session.employeeId, 'ACTIVE']);
  }
  
  logAuditAction('GENERATE_QR', session.employeeId, 'Generated secure QR token for CNE: ' + cneId, 'SUCCESS');
  
  return {
    success: true,
    data: {
      qrToken: qrToken,
      cneId: cneId,
      topic: record.topic,
      area: record.area,
      finalizedCount: finalizedCount
    }
  };
}

/**
 * Resolve QR Token to CNE Session Details (Public for participants)
 * Resolves CNE ID authoritatively on the server from the opaque token.
 * Prevents CNE enumeration and strips all answers/explanations.
 */
function handleResolveQRToken(params) {
  var token = sanitizeCellInput(params.qrToken || params.token);
  if (!token) return { success: false, message: 'QR Token is required.' };
  
  var qrSheet = getQRTokensSheet();
  var qrData = qrSheet.getDataRange().getValues();
  var matchedCneId = null;
  
  for (var q = 1; q < qrData.length; q++) {
    if (String(qrData[q][0] || '').trim() === token &&
        String(qrData[q][4] || 'ACTIVE').toUpperCase() === 'ACTIVE') {
      matchedCneId = String(qrData[q][1] || '').trim();
      break;
    }
  }
  
  if (!matchedCneId) return { success: false, message: 'Invalid or expired CNE QR Token.' };
  
  var record = getCNEClassRecord(matchedCneId);
  if (!record) return { success: false, message: 'CNE session not found for this QR token.' };
  
  var isLocked = isCNEQuestionsLocked(matchedCneId);
  
  // Read finalized questions for public participant view (NO answers, NO explanations)
  var qSheet = getQuestionsSheet();
  var qData = qSheet.getDataRange().getValues();
  var sanitizedQuestions = [];
  
  for (var r = 1; r < qData.length; r++) {
    if (String(qData[r][0] || '').trim().toUpperCase() === matchedCneId.toUpperCase() &&
        String(qData[r][9] || 'NO').toUpperCase() === 'YES') {
      sanitizedQuestions.push({
        id: String(qData[r][1] || ''),
        question: String(qData[r][2] || ''),
        options: {
          A: String(qData[r][3] || ''),
          B: String(qData[r][4] || ''),
          C: String(qData[r][5] || ''),
          D: String(qData[r][6] || '')
        }
      });
    }
  }
  
  // Check already submitted if employeeId provided
  var alreadySubmitted = false;
  var empId = normalizeEmpId(params.employeeId);
  if (empId) {
    var partSheet = getResponsesSheet();
    if (partSheet && partSheet.getLastRow() > 1) {
      var pData = partSheet.getDataRange().getValues();
      for (var p = 1; p < pData.length; p++) {
        var pCne = String(pData[p][1] || '').trim().toUpperCase();
        var pEmp = normalizeEmpId(pData[p][2]);
        var pSrc = String(pData[p][9] || pData[p][6] || '').trim().toUpperCase();
        if (pCne === matchedCneId.toUpperCase() && pEmp === empId && pSrc === 'POST_TEST') {
          alreadySubmitted = true;
          break;
        }
      }
    }
  }
  
  return {
    success: true,
    data: {
      qrToken: token,
      cneId: record.cneId,
      topic: record.topic,
      area: record.area,
      date: record.date,
      time: record.time,
      duration: record.duration,
      instructor: record.instructor,
      mode: record.mode,
      status: record.status,
      cneType: record.cneType,
      isLocked: isLocked,
      questions: sanitizedQuestions,
      alreadySubmitted: alreadySubmitted
    }
  };
}

/**
 * Get Post-Test Questions for Participant
 * Public post-test access MUST require a valid opaque QR token.
 * Does NOT allow public access using CNE ID alone.
 * Legacy QRT token fallback parsing is completely removed.
 * Token must be resolved through CNE_QR_Tokens.
 * Strips correctOption and explanation!
 * Checks if participant has already submitted.
 */
function handleGetPostTestQuestions(params, session) {
  var token = sanitizeCellInput(params.qrToken || params.token);
  var cneId = null;
  
  if (token) {
    var qrSheet = getQRTokensSheet();
    if (qrSheet && qrSheet.getLastRow() > 1) {
      var qrData = qrSheet.getDataRange().getValues();
      for (var q = 1; q < qrData.length; q++) {
        var rowTok = String(qrData[q][0] || '').trim();
        var rowStatus = String(qrData[q][4] || 'ACTIVE').trim().toUpperCase();
        if (rowTok === token && rowStatus === 'ACTIVE') {
          cneId = String(qrData[q][1] || '').trim();
          break;
        }
      }
    }
  }
  
  // Public post-test access MUST require a valid opaque QR token resolved through CNE_QR_Tokens.
  // Direct CNE ID lookup is ONLY permitted if caller has authenticated session as ADMIN or AREA_INCHARGE.
  if (!cneId) {
    if (session && (session.role === 'ADMIN' || session.role === 'AREA_INCHARGE')) {
      cneId = sanitizeCellInput(params.cneId);
    }
  }
  
  if (!cneId) {
    return {
      success: false,
      errorCode: 'INVALID_OR_MISSING_QR_TOKEN',
      message: 'A valid opaque QR token is required for post-test access. Public access using CNE ID alone is not permitted.'
    };
  }
  
  var empId = normalizeEmpId(params.employeeId || (session ? session.employeeId : ''));
  if (!empId) return { success: false, message: 'Employee ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  // Check if participant has already submitted in CNE Post Test Responses
  var partSheet = getResponsesSheet();
  if (partSheet && partSheet.getLastRow() > 1) {
    var pData = partSheet.getDataRange().getValues();
    for (var p = 1; p < pData.length; p++) {
      var pCne = String(pData[p][1] || '').trim().toUpperCase();
      var pEmp = normalizeEmpId(pData[p][2]);
      var pSrc = String(pData[p][9] || '').trim().toUpperCase();
      
      if (pCne === cneId.toUpperCase() && pEmp === empId && pSrc === 'POST_TEST') {
        var scoreVal = (pData[p][6] !== '' && !isNaN(Number(pData[p][6]))) ? Number(pData[p][6]) : 0;
        var totalVal = (pData[p][7] !== '' && !isNaN(Number(pData[p][7]))) ? Number(pData[p][7]) : 0;
        var pctVal = (pData[p][8] !== '' && !isNaN(Number(pData[p][8]))) ? Number(pData[p][8]) : 0;
        return {
          success: true,
          data: {
            alreadySubmitted: true,
            submission: {
              participantId: String(pData[p][0] || ''),
              cneId: cneId,
              employeeId: empId,
              name: String(pData[p][3] || ''),
              designation: String(pData[p][4] || ''),
              department: String(pData[p][5] || ''),
              score: scoreVal,
              totalQuestions: totalVal,
              percentage: pctVal,
              status: String(pData[p][12] || ''),
              submittedAt: String(pData[p][10] || '')
            }
          }
        };
      }
    }
  }
  
  // Read finalized questions from CNE Post Test Questions
  var qSheet = getQuestionsSheet();
  var qData = qSheet.getDataRange().getValues();
  var sanitizedQuestions = [];
  
  for (var r = 1; r < qData.length; r++) {
    if (String(qData[r][0] || '').trim().toUpperCase() === cneId.toUpperCase() &&
        String(qData[r][9] || 'NO').toUpperCase() === 'YES') {
      sanitizedQuestions.push({
        id: String(qData[r][1] || ''),
        question: String(qData[r][2] || ''),
        options: {
          A: String(qData[r][3] || ''),
          B: String(qData[r][4] || ''),
          C: String(qData[r][5] || ''),
          D: String(qData[r][6] || '')
        }
        // NOTE: Correct Answer and Explanation are STRICTLY NOT sent before submission!
      });
    }
  }
  
  if (sanitizedQuestions.length < 5) {
    return {
      success: false,
      errorCode: 'POST_TEST_NOT_READY',
      message: 'Post-test is not ready yet. Questions have not been finalized by the coordinator.'
    };
  }
  
  return {
    success: true,
    data: {
      alreadySubmitted: false,
      cneId: cneId,
      topic: record.topic,
      area: record.area,
      questions: sanitizedQuestions
    }
  };
}

/**
 * Submit Participant Post-Test
 * Protected by LockService for strict concurrency:
 * duplicate check -> question retrieval -> scoring -> response write -> question locking.
 * Enforces:
 * 1. Opaque QR token resolution via CNE_QR_Tokens (no CNE ID only access)
 * 2. Authoritative employee validation against Rosters Master Data
 * 3. Server-side scoring (never trust browser score)
 * 4. Rejection of duplicate submissions per employee per CNE
 * 5. A failed submission does NOT lock questions.
 * 6. Only the first successful submission locks the question set.
 * 7. Returns correct answers and explanations ONLY after successful submission
 */
function handleSubmitPostTest(params, session) {
  var token = sanitizeCellInput(params.qrToken || params.token);
  var cneId = null;
  
  if (token) {
    var qrSheet = getQRTokensSheet();
    if (qrSheet && qrSheet.getLastRow() > 1) {
      var qrData = qrSheet.getDataRange().getValues();
      for (var q = 1; q < qrData.length; q++) {
        var rowTok = String(qrData[q][0] || '').trim();
        var rowStatus = String(qrData[q][4] || 'ACTIVE').trim().toUpperCase();
        if (rowTok === token && rowStatus === 'ACTIVE') {
          cneId = String(qrData[q][1] || '').trim();
          break;
        }
      }
    }
  }
  
  // Public post-test submission MUST require a valid opaque QR token resolved through CNE_QR_Tokens.
  // Direct CNE ID lookup is ONLY permitted if caller has authenticated session as ADMIN or AREA_INCHARGE.
  if (!cneId) {
    if (session && (session.role === 'ADMIN' || session.role === 'AREA_INCHARGE')) {
      cneId = sanitizeCellInput(params.cneId);
    }
  }
  
  if (!cneId) {
    return {
      success: false,
      errorCode: 'INVALID_OR_MISSING_QR_TOKEN',
      message: 'A valid opaque QR token is required for post-test submission. Submission using CNE ID alone is not permitted.'
    };
  }
  
  var empId = normalizeEmpId(params.employeeId || (session ? session.employeeId : ''));
  if (!empId) {
    return { success: false, message: 'Employee ID is required.' };
  }
  
  var answers = params.answers;
  if (!answers || typeof answers !== 'object') {
    return { success: false, message: 'Answers object is required.' };
  }
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  // Authoritative Employee Validation from Rosters Master Data
  var officer = findOfficerById(empId);
  if (!officer || !officer.name) {
    return {
      success: false,
      errorCode: 'INVALID_EMPLOYEE_ID',
      message: 'Employee ID ' + empId + ' not found in institutional employee roster.'
    };
  }
  
  // Concurrency Protection via Apps Script LockService
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, message: 'Server is busy processing submissions. Please try again.' };
  }
  
  try {
    var partSheet = getResponsesSheet();
    
    // Step 1: Server-Side Duplicate Check under Lock (One submission per employee per CNE)
    if (partSheet && partSheet.getLastRow() > 1) {
      var pData = partSheet.getDataRange().getValues();
      for (var p = 1; p < pData.length; p++) {
        var pCne = String(pData[p][1] || '').trim().toUpperCase();
        var pEmp = normalizeEmpId(pData[p][2]);
        var pSrc = String(pData[p][9] || '').trim().toUpperCase();
        
        if (pCne === cneId.toUpperCase() && pEmp === empId && pSrc === 'POST_TEST') {
          return {
            success: false,
            errorCode: 'ALREADY_SUBMITTED',
            message: 'You have already submitted the post-test for this CNE.'
          };
        }
      }
    }
    
    // Step 2: Question Retrieval (Fetch True Answer Keys)
    var qSheet = getQuestionsSheet();
    var qData = qSheet.getDataRange().getValues();
    var answerKeys = [];
    var questionRowsToLock = [];
    
    for (var r = 1; r < qData.length; r++) {
      if (String(qData[r][0] || '').trim().toUpperCase() === cneId.toUpperCase() &&
          String(qData[r][9] || 'NO').toUpperCase() === 'YES') {
        answerKeys.push({
          id: String(qData[r][1] || ''),
          question: String(qData[r][2] || ''),
          correctOption: String(qData[r][7] || 'A').toUpperCase(),
          explanation: String(qData[r][8] || '')
        });
        questionRowsToLock.push(r + 1);
      }
    }
    
    if (answerKeys.length < 5) {
      return { success: false, message: 'Cannot submit: CNE post-test does not have at least 5 finalized questions.' };
    }
    
    // Step 3: Server-Side Scoring
    var score = 0;
    var total = answerKeys.length;
    var detailedReview = [];
    
    for (var i = 0; i < answerKeys.length; i++) {
      var item = answerKeys[i];
      var submittedAns = String(answers[item.id] || '').trim().toUpperCase();
      var isCorrect = (submittedAns === item.correctOption);
      if (isCorrect) score++;
      
      detailedReview.push({
        questionId: item.id,
        question: item.question,
        userAnswer: submittedAns,
        correctAnswer: item.correctOption,
        isCorrect: isCorrect,
        explanation: item.explanation
      });
    }
    
    var percentage = Math.round((score / total) * 100);
    var passed = percentage >= 50;
    var status = passed ? 'PASSED' : 'NEEDS_IMPROVEMENT';
    var now = new Date().toISOString();
    var participantId = 'RESP-' + Date.now();
    
    // Step 4: Response Write to CNE Post Test Responses
    partSheet.appendRow([
      participantId,
      cneId,
      empId,
      officer.name,
      officer.designation || 'Nursing Officer',
      officer.department || record.area,
      score,
      total,
      percentage,
      'POST_TEST',
      now,
      JSON.stringify(answers),
      status,
      ''
    ]);
    
    // Step 5: Question Locking - ONLY on successful response write!
    // A failed submission never reaches this point and does NOT lock questions.
    for (var k = 0; k < questionRowsToLock.length; k++) {
      qSheet.getRange(questionRowsToLock[k], 11).setValue('YES');
    }
    
    logAuditAction('SUBMIT_POST_TEST', empId, 'CNE: ' + cneId + ', Score: ' + score + '/' + total + ' (' + percentage + '%)', 'SUCCESS');
    
    return {
      success: true,
      message: 'Post-test submitted successfully!',
      data: {
        participantId: participantId,
        cneId: cneId,
        score: score,
        totalQuestions: total,
        percentage: percentage,
        passed: passed,
        status: status,
        submittedAt: now,
        review: detailedReview
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Add Manual Participant (Admin or Area Incharge)
 * Manual attendees receive Participant Source = MANUAL.
 * They have no score and are NOT treated as failed or assigned 0%.
 */
function handleAddManualParticipant(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;
  
  var empId = normalizeEmpId(params.employeeId);
  var manualName = sanitizeCellInput(params.name || '');
  var designation = sanitizeCellInput(params.designation || 'Staff Nurse');
  var department = sanitizeCellInput(params.department || record.area);
  var remarks = sanitizeCellInput(params.remarks || 'Manual Attendance Recorded');
  
  if (!empId && !manualName) {
    return { success: false, message: 'Employee ID or Participant Name is required.' };
  }
  
  if (empId) {
    var officer = findOfficerById(empId);
    if (officer) {
      manualName = officer.name;
      designation = officer.designation || designation;
      department = officer.department || department;
    }
  }
  
  var partSheet = getResponsesSheet();
  
  var pData = partSheet.getDataRange().getValues();
  for (var p = 1; p < pData.length; p++) {
    if (String(pData[p][1] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      if (empId && normalizeEmpId(pData[p][2]) === empId) {
        return { success: false, errorCode: 'DUPLICATE_PARTICIPANT', message: 'Employee ID ' + empId + ' is already recorded as a participant for this CNE.' };
      }
      if (!empId && String(pData[p][3] || '').trim().toLowerCase() === manualName.toLowerCase()) {
        return { success: false, errorCode: 'DUPLICATE_PARTICIPANT', message: 'Participant ' + manualName + ' is already recorded for this CNE.' };
      }
    }
  }
  
  var participantId = 'MAN-' + Date.now();
  var now = new Date().toISOString();
  
  partSheet.appendRow([
    participantId,
    cneId,
    empId,
    manualName,
    designation,
    department,
    '',
    '',
    '',
    'MANUAL',
    now,
    '',
    'ATTENDED',
    remarks
  ]);
  
  logAuditAction('ADD_MANUAL_PARTICIPANT', session.employeeId, 'Added participant ' + (empId || manualName) + ' to CNE: ' + cneId, 'SUCCESS');
  return { success: true, message: 'Participant added successfully.' };
}

/**
 * Get All Participants for CNE & Calculate Pure Average Score
 * Note: Average Score is computed EXCLUSIVELY from POST_TEST participants!
 * If no post-test submissions exist, averageScore is null (never 0).
 */
function handleGetCNEParticipants(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  var partSheet = getResponsesSheet();
  var data = partSheet.getDataRange().getValues();
  var participants = [];
  var postTestCount = 0;
  var manualCount = 0;
  var totalScorePercent = 0;
  
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][1] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      var pType = String(data[r][9] || 'POST_TEST').trim().toUpperCase();
      
      var scoreVal = null;
      var totalVal = null;
      var pct = null;
      
      if (pType === 'POST_TEST') {
        postTestCount++;
        var scoreRaw = data[r][6];
        scoreVal = (scoreRaw !== '' && scoreRaw !== null && scoreRaw !== undefined && !isNaN(Number(scoreRaw))) ? Number(scoreRaw) : null;
        
        var totalRaw = data[r][7];
        totalVal = (totalRaw !== '' && totalRaw !== null && totalRaw !== undefined && !isNaN(Number(totalRaw))) ? Number(totalRaw) : null;
        
        var pctRaw = data[r][8];
        pct = (pctRaw !== '' && pctRaw !== null && pctRaw !== undefined && !isNaN(Number(pctRaw))) ? Number(pctRaw) : null;
        
        if (pct !== null) {
          totalScorePercent += pct;
        }
      } else {
        manualCount++;
      }
      
      participants.push({
        id: String(data[r][0] || ''),
        cneId: cneId,
        employeeId: String(data[r][2] || ''),
        name: String(data[r][3] || ''),
        designation: String(data[r][4] || 'Nursing Officer'),
        department: String(data[r][5] || record.area),
        participantType: pType,
        score: scoreVal,
        totalQuestions: totalVal,
        percentage: pct,
        source: pType,
        submittedAt: String(data[r][10] || ''),
        answersJson: String(data[r][11] || ''),
        status: String(data[r][12] || 'ATTENDED'),
        remarks: String(data[r][13] || '')
      });
    }
  }
  
  // Average must be calculated ONLY from POST_TEST percentage values.
  // If there are zero POST_TEST participants: averageScore = null (Never return 0)
  var avgScore = postTestCount > 0 ? Math.round((totalScorePercent / postTestCount) * 10) / 10 : null;
  
  return {
    success: true,
    data: {
      cneId: cneId,
      topic: record.topic,
      area: record.area,
      status: record.status,
      totalParticipants: participants.length,
      postTestCount: postTestCount,
      manualCount: manualCount,
      averageScore: avgScore,
      participants: participants
    }
  };
}

/**
 * Helper: Find Existing Data Master Record for CNE ID
 * Checks both direct Data ID match and CNE ID reference in Remarks
 */
function findExistingDataMasterRecord(ss, cneId) {
  if (!cneId) return null;
  var dataSheet = ss.getSheetByName('Data');
  if (!dataSheet || dataSheet.getLastRow() <= 1) return null;
  
  var dData = dataSheet.getDataRange().getValues();
  var dColMap = getHeaderMap(dataSheet);
  var remarksIdx = dColMap['remarks'] !== undefined ? dColMap['remarks'] : 10;
  var dataIdIdx = dColMap['dataid'] !== undefined ? dColMap['dataid'] : 0;
  var cleanTargetCne = String(cneId).trim().toUpperCase();
  
  for (var r = 1; r < dData.length; r++) {
    var rowDataId = String(dData[r][dataIdIdx] || '').trim().toUpperCase();
    var rowRemarks = String(dData[r][remarksIdx] || '').trim();
    
    // Check 1: Data ID directly matches CNE ID
    if (rowDataId === cleanTargetCne) {
      return {
        rowIndex: r + 1,
        dataId: String(dData[r][dataIdIdx] || '').trim()
      };
    }
    
    // Check 2: Authoritative CNE ID tag in Remarks
    if (rowRemarks) {
      var upperRemarks = rowRemarks.toUpperCase();
      if (
        upperRemarks.indexOf('[CNE ID: ' + cleanTargetCne + ']') !== -1 ||
        upperRemarks.indexOf('[CNE: ' + cleanTargetCne + ']') !== -1 ||
        upperRemarks.indexOf('CNE ID: ' + cleanTargetCne) !== -1
      ) {
        return {
          rowIndex: r + 1,
          dataId: String(dData[r][dataIdIdx] || '').trim()
        };
      }
    }
  }
  return null;
}

/**
 * Finalize CNE Session and Synchronize to Institutional Records
 * Atomic & Duplicate-Safe via ScriptLock
 */
function handleFinalizeCNE(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  // 1. Resolve CNE
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  // 2. Validate CNE type
  var cneType = normalizeCNEType(record.cneType);
  if (!cneType) {
    return {
      success: false,
      errorCode: 'INVALID_CNE_TYPE',
      message: 'Cannot finalize CNE: Session record has an invalid or missing Type of CNE (must be CENTRAL or DEPARTMENTAL).'
    };
  }

  // 3. Validate current authorization
  var authErr = checkCNEAuthorized(session, record.area, cneType);
  if (authErr) return authErr;
  
  // 4. Acquire ScriptLock
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, errorCode: 'SERVER_BUSY', message: 'Server is busy processing another operation. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var upcomingSheet = ss.getSheetByName('Upcoming Classes');
    if (!upcomingSheet) {
      return { success: false, message: 'Upcoming Classes sheet not found.' };
    }
    
    // 5. Re-read the authoritative Upcoming Classes row while holding the lock
    var liveRecord = getCNEClassRecord(cneId);
    if (!liveRecord) {
      return { success: false, message: 'CNE record not found upon re-reading Upcoming Classes.' };
    }
    
    // Check Data Master for an existing finalized record for THIS CNE ID
    var existingDataMasterRecord = findExistingDataMasterRecord(ss, cneId);
    
    // 6. Confirm the CNE is not already Completed
    if (normalizeCNEStatus(liveRecord.status) === 'Completed') {
      return {
        success: true,
        alreadyFinalized: true,
        message: 'This CNE has already been marked as Completed.',
        data: {
          dataId: existingDataMasterRecord ? existingDataMasterRecord.dataId : ''
        },
        dataId: existingDataMasterRecord ? existingDataMasterRecord.dataId : ''
      };
    }
    
    // 7 & 8. If an existing Data Master record for this CNE already exists:
    // (Retry scenario where Data Master append succeeded, but status update was interrupted)
    if (existingDataMasterRecord) {
      // Do NOT append another record.
      // Ensure Upcoming Classes status is marked Completed to complete the synchronization.
      var upColMap = getHeaderMap(upcomingSheet);
      var statusCol = upColMap['status'] !== undefined ? (upColMap['status'] + 1) : 12;
      var remarksCol = upColMap['adminremarks'] !== undefined ? (upColMap['adminremarks'] + 1) : 16;
      
      upcomingSheet.getRange(liveRecord.rowIndex, statusCol).setValue('Completed');
      if (params.remarks) {
        upcomingSheet.getRange(liveRecord.rowIndex, remarksCol).setValue(sanitizeCellInput(params.remarks));
      }
      
      logAuditAction('FINALIZE_CNE', session.employeeId, 'Recovered finalization retry for CNE: ' + cneId + ' -> Existing Data Master ID: ' + existingDataMasterRecord.dataId, 'SUCCESS');
      
      return {
        success: true,
        alreadyFinalized: true,
        message: 'CNE is already synchronized with institutional records.',
        data: {
          dataId: existingDataMasterRecord.dataId
        },
        dataId: existingDataMasterRecord.dataId
      };
    }
    
    // 9. Read participant records using the corrected schema
    var partSheet = getResponsesSheet();
    var internalEmpIds = [];
    var externalParticipants = [];
    var postTestScores = [];
    
    if (partSheet && partSheet.getLastRow() > 1) {
      var pData = partSheet.getDataRange().getValues();
      for (var p = 1; p < pData.length; p++) {
        if (String(pData[p][1] || '').trim().toUpperCase() === cneId.toUpperCase()) {
          var emp = normalizeEmpId(pData[p][2]);
          var pName = String(pData[p][3] || '').trim();
          var pSrc = String(pData[p][9] || '').trim().toUpperCase();
          var pctRaw = pData[p][8];
          
          if (emp) {
            internalEmpIds.push(emp);
          } else if (pName) {
            externalParticipants.push(pName);
          }
          
          // 10. Calculate average ONLY from POST_TEST percentages
          // MANUAL participants must never contribute 0% or any score
          if (pSrc === 'POST_TEST' && pctRaw !== '' && pctRaw !== null && pctRaw !== undefined && !isNaN(Number(pctRaw))) {
            postTestScores.push(Number(pctRaw));
          }
        }
      }
    }
    
    var avg = postTestScores.length > 0 ? Math.round((postTestScores.reduce(function(a, b) { return a + b; }, 0) / postTestScores.length) * 10) / 10 : null;
    
    // 11. Create exactly one official Data Master record
    var curYear = new Date().getFullYear();
    var dataSheet = getOrCreateSheet('Data');
    var dData = dataSheet.getDataRange().getValues();
    var nextNum = 1;
    for (var dr = 1; dr < dData.length; dr++) {
      var rowId = String(dData[dr][0] || '');
      if (rowId.indexOf('CNE-' + curYear + '-') === 0) {
        var numPart = parseInt(rowId.split('-')[2], 10);
        if (!isNaN(numPart) && numPart >= nextNum) {
          nextNum = numPart + 1;
        }
      }
    }
    var officialDataId = 'CNE-' + curYear + '-' + ('00000' + nextNum).slice(-6);
    
    // Retain source CNE ID reference in Remarks for reliable future duplicate detection
    var remarksSummary = 'Finalized CNE Session [CNE ID: ' + cneId + ']. Total Attendees: ' + (internalEmpIds.length + externalParticipants.length) + (avg !== null ? ' (Avg Post-Test Score: ' + avg + '%)' : '') + (params.remarks ? '. ' + sanitizeCellInput(params.remarks) : '');
    
    var dataColMap = getHeaderMap(dataSheet);
    var maxDataCol = Math.max(dataSheet.getLastColumn(), 16);
    var rowVals = [];
    for (var cIdx = 0; cIdx < maxDataCol; cIdx++) rowVals.push('');
    
    var setDataCell = function(key, fallbackCol, val) {
      var c = dataColMap[key] !== undefined ? dataColMap[key] : fallbackCol;
      while (rowVals.length <= c) rowVals.push('');
      rowVals[c] = val;
    };
    
    setDataCell('dataid', 0, officialDataId);
    setDataCell('wardnamearea', 1, liveRecord.area);
    setDataCell('fromdate', 2, liveRecord.date);
    setDataCell('todate', 3, liveRecord.toDate || liveRecord.date);
    setDataCell('duration', 4, liveRecord.duration);
    setDataCell('topic', 5, liveRecord.topic);
    setDataCell('resourcepersonempid', 6, liveRecord.instructor);
    setDataCell('modeofteaching', 7, liveRecord.mode || 'Lecture / Discussion');
    setDataCell('staffempid', 8, internalEmpIds.join(', '));
    setDataCell('staffcount', 9, internalEmpIds.length + externalParticipants.length);
    setDataCell('remarks', 10, remarksSummary);
    setDataCell('createdat', 11, new Date().toISOString());
    setDataCell('createdby', 12, session.employeeId);
    setDataCell('externalresourcepersons', 13, liveRecord.externalResourcePersons || '');
    setDataCell('externalstaffparticipants', 14, externalParticipants.join(', '));
    setDataCell('typeofcne', 15, cneType);
    
    // 12. Append the Data Master record successfully
    try {
      dataSheet.appendRow(rowVals);
    } catch (appendErr) {
      // IMPORTANT:
      // If Data Master append fails:
      // - do NOT mark Upcoming Classes Completed
      // - return failure
      // - preserve the CNE as Scheduled
      // - do not create a partial finalization state
      return {
        success: false,
        errorCode: 'DATA_MASTER_APPEND_FAILED',
        message: 'Failed to synchronize with Data Master: ' + appendErr.message + '. CNE status preserved as Scheduled.'
      };
    }
    
    // 13. ONLY AFTER successful Data Master append, mark Upcoming Classes status = Completed
    var upColMapFinal = getHeaderMap(upcomingSheet);
    var finalStatusCol = upColMapFinal['status'] !== undefined ? (upColMapFinal['status'] + 1) : 12;
    var finalRemarksCol = upColMapFinal['adminremarks'] !== undefined ? (upColMapFinal['adminremarks'] + 1) : 16;
    
    upcomingSheet.getRange(liveRecord.rowIndex, finalStatusCol).setValue('Completed');
    
    // 14. Write remarks if supplied
    if (params.remarks) {
      upcomingSheet.getRange(liveRecord.rowIndex, finalRemarksCol).setValue(sanitizeCellInput(params.remarks));
    }
    
    // 15. Write audit log
    logAuditAction('FINALIZE_CNE', session.employeeId, 'Finalized CNE: ' + cneId + ' -> Synced to Data Master as: ' + officialDataId, 'SUCCESS');
    
    return {
      success: true,
      message: 'CNE finalized successfully and synchronized with institutional records.',
      data: {
        dataId: officialDataId
      },
      dataId: officialDataId
    };
  } finally {
    // 16. Release the lock in finally
    lock.releaseLock();
  }
}

/**
 * Cancel CNE Session
 */
function handleCancelCNE(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  var authErr = checkCNEAuthorized(session, record.area, record.cneType);
  if (authErr) return authErr;
  
  var reason = sanitizeCellInput(params.remarks || 'Cancelled by coordinator');
  var ss = getSpreadsheet('CNE');
  var upcomingSheet = ss.getSheetByName('Upcoming Classes');
  if (upcomingSheet) {
    var upColMap = getHeaderMap(upcomingSheet);
    var statusCol = upColMap['status'] !== undefined ? (upColMap['status'] + 1) : 11;
    var remarksCol = upColMap['adminremarks'] !== undefined ? (upColMap['adminremarks'] + 1) : 15;
    upcomingSheet.getRange(record.rowIndex, statusCol).setValue('Canceled');
    upcomingSheet.getRange(record.rowIndex, remarksCol).setValue(reason);
  }
  
  logAuditAction('CANCEL_CNE', session.employeeId, 'Cancelled CNE: ' + cneId + '. Reason: ' + reason, 'SUCCESS');
  return { success: true, message: 'CNE cancelled successfully.' };
}

/**
 * Standalone Migration Utility: Rename 'Class ID' header to 'CNE ID' in 'Upcoming Classes'.
 * Strictly non-destructive: updates row 1 column header only, preserves all data rows and IDs.
 */
function migrateUpcomingClassesHeaderToCNEId() {
  var ss = getSpreadsheet('CNE');
  var sheet = ss.getSheetByName('Upcoming Classes');
  if (!sheet) {
    Logger.log('Upcoming Classes sheet not found.');
    return { success: false, message: 'Upcoming Classes sheet not found.' };
  }
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    return { success: false, message: 'Upcoming Classes sheet has no columns.' };
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var migrated = false;
  for (var c = 0; c < headers.length; c++) {
    var key = String(headers[c] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key === 'classid') {
      sheet.getRange(1, c + 1).setValue('CNE ID');
      migrated = true;
      Logger.log('Successfully renamed column ' + (c + 1) + ' from "Class ID" to "CNE ID".');
      break;
    }
  }
  return {
    success: true,
    migrated: migrated,
    message: migrated ? 'Successfully renamed "Class ID" header to "CNE ID".' : 'Header is already "CNE ID" or "Class ID" was not found.'
  };
}

/**
 * Standalone Migration Utility: Rename 'Class ID' header to 'CNE ID' in 'CNE Applications'.
 * Strictly non-destructive: updates row 1 column header only in-place, preserves all data rows and IDs.
 */
function migrateCNEApplicationsHeaderToCNEId() {
  var ss = getSpreadsheet('CNE');
  var sheet = ss.getSheetByName('CNE Applications');
  if (!sheet) {
    Logger.log('CNE Applications sheet not found.');
    return { success: false, message: 'CNE Applications sheet not found.' };
  }
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    return { success: false, message: 'CNE Applications sheet has no columns.' };
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var migrated = false;
  for (var c = 0; c < headers.length; c++) {
    var key = String(headers[c] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key === 'classid') {
      sheet.getRange(1, c + 1).setValue('CNE ID');
      migrated = true;
      Logger.log('Successfully renamed column ' + (c + 1) + ' from "Class ID" to "CNE ID" in CNE Applications.');
      break;
    }
  }
  return {
    success: true,
    migrated: migrated,
    message: migrated ? 'Successfully renamed "Class ID" header to "CNE ID" in CNE Applications.' : 'Header is already "CNE ID" or "Class ID" was not found in CNE Applications.'
  };
}

/**
 * ============================================================================
 * ONE-CLICK SPREADSHEET INITIALIZER (RUN DIRECTLY FROM APPS SCRIPT EDITOR)
 * Function Name: setupNewCNESpreadsheet
 * 
 * Safely initializes a new or existing Google Spreadsheet for CNE System:
 * - Bootstraps all 9 required CNE tabs with bold headers
 * - Leaves 'Rosters Master Data' roster completely untouched if present
 * - Auto-generates cryptographic security keys in Script Properties
 * - Auto-provisions initial ADMIN role if INITIAL_ADMIN_EMPLOYEE_ID is set
 * ============================================================================
 */
function setupNewCNESpreadsheet() {
  Logger.log('>>> Starting setupNewCNESpreadsheet execution...');
  
  // 1. Ensure security properties (SESSION_SECRET & PASSWORD_PEPPER)
  setupSecurityProperties();
  
  // 2. Initialize all CNE tabs safely via authoritative function
  var result = setupAndVerifyCNESheets('SCRIPT_OWNER');
  Logger.log('>>> Initialization Result: ' + result.message);
  
  if (result.auditReport && result.auditReport.length > 0) {
    for (var i = 0; i < result.auditReport.length; i++) {
      var r = result.auditReport[i];
      Logger.log('  • Tab: ' + r.tab + ' -> ' + r.status + ' (Rows: ' + (r.rowCount || 0) + ')');
    }
  }
  
  // 3. First Administrator Setup Safety (Strict verification against Rosters Master Data)
  var props = PropertiesService.getScriptProperties();
  var initialAdminId = props.getProperty('INITIAL_ADMIN_EMPLOYEE_ID');
  if (!initialAdminId || initialAdminId.trim() === '') {
    Logger.log('>>> First Admin Setup: INITIAL_ADMIN_EMPLOYEE_ID is not configured in Script Properties. Skipping admin creation.');
  } else {
    var normInitialId = normalizeEmpId(initialAdminId);
    try {
      var ss = getSpreadsheet('CNE');
      var roleSheet = ss.getSheetByName('Role');
      if (!roleSheet) {
        Logger.log('>>> First Admin Setup: "Role" sheet not found in CNE database.');
      } else {
        var roleData = roleSheet.getDataRange().getValues();
        var adminExists = false;
        for (var j = 1; j < roleData.length; j++) {
          var rRole = String(roleData[j][3] || '').toUpperCase().trim();
          if (rRole === 'ADMIN') {
            adminExists = true;
            break;
          }
        }
        if (adminExists) {
          Logger.log('>>> First Admin Setup: An administrator already exists in Role sheet. Doing nothing and preserving configuration.');
        } else {
          var officer = findOfficerById(normInitialId);
          if (!officer || !officer.name) {
            Logger.log('>>> First Admin Setup: Employee ID "' + normInitialId + '" does not exist in authoritative Rosters Master Data. Administrator NOT created (no fake administrator permitted).');
          } else {
            roleSheet.appendRow([normInitialId, officer.name, officer.designation || 'Nursing Officer', 'ADMIN']);
            Logger.log('>>> First Admin Setup: First administrator created successfully for: ' + normInitialId + ' (' + officer.name + ')');
            logAuditAction('INITIAL_ADMIN_PROVISIONED', normInitialId, 'First administrator created for ' + normInitialId, 'SUCCESS');
          }
        }
      }
    } catch (e) {
      Logger.log('>>> Note regarding initial admin seeding: ' + e.message);
    }
  }
  
  Logger.log('>>> setupNewCNESpreadsheet COMPLETED SUCCESSFULLY.');
}

`;

export const GOOGLE_APPS_SCRIPT_CODE = APPS_SCRIPT_SOURCE_CODE;
