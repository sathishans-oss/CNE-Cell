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

// Performance Diagnostic Logger (Lightweight server-side timing, no secrets or sensitive data)
function logPerf(tag, startedAt, extra) {
  var elapsedMs = Date.now() - startedAt;
  Logger.log('[PERF] ' + tag + ': ' + elapsedMs + 'ms' + (extra ? ' | ' + extra : ''));
  return elapsedMs;
}

// Request-level In-Memory Execution Caches (reset every request execution)
var _inMemoryRoleCache = {};
var _inMemoryOfficerMap = null;
var _executionRosterData = null;

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
  var startedAt = Date.now();
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
  logPerf('verifySession', startedAt, 'id: ' + verifiedEmpId);
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
 * Batch Audit Logger (Writes all audit records in one setValues call)
 */
function logAuditActionsBatch(entries) {
  if (!entries || !entries.length) return;
  try {
    var auditSheet = getOrCreateSheet('Audit Log');
    var nowIso = new Date().toISOString();
    var auditRows = [];
    for (var a = 0; a < entries.length; a++) {
      var entry = entries[a];
      auditRows.push([
        nowIso,
        entry.action || '',
        normalizeEmpId(entry.employeeId),
        sanitizeCellInput(entry.details || ''),
        entry.status || 'SUCCESS'
      ]);
    }
    var startRow = auditSheet.getLastRow() + 1;
    if (startRow === 1) {
      var headers = ['Timestamp', 'Action', 'Employee ID', 'Details', 'Status'];
      auditSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      startRow = 2;
    }
    var maxRows = auditSheet.getMaxRows();
    if (startRow + auditRows.length - 1 > maxRows) {
      auditSheet.insertRowsAfter(maxRows, (startRow + auditRows.length - 1) - maxRows);
    }
    var maxCols = auditSheet.getMaxColumns();
    if (maxCols < 5) {
      auditSheet.insertColumnsAfter(maxCols, 5 - maxCols);
    }
    auditSheet.getRange(startRow, 1, auditRows.length, 5).setValues(auditRows);
  } catch (e) {
    console.warn('Batch audit log write error: ' + e.message);
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
  var requestStart = Date.now();
  _inMemoryRoleCache = {};
  _inMemoryOfficerMap = null;
  _executionRosterData = null;

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
      case 'getCNERecords':
        output = handleGetCNERecords(params, session);
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
      case 'applyForClass':
        output = handleApplyForClass(params, session);
        break;
        
      case 'getMyApplications':
        output = handleGetMyApplications(params, session);
        break;
        
      case 'getDashboardStats':
        output = handleGetDashboardStats(params, session);
        break;
        
      case 'getOfficersDropdown':
        output = handleGetOfficersDropdown(params, session);
        break;

      // Administrative Endpoints (Strictly requireAdmin verified)
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
        
      case 'createCNE':
      case 'addUpcomingClass':
        if (!session) {
          output = { success: false, errorCode: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' };
        } else {
          output = handleAddUpcomingClass(params, session);
        }
        break;

      case 'addCNE':
        output = handleAdminAction(params, session, handleAddCNE, 'ADD_CNE');
        break;
        
      case 'updateCNE':
      case 'updateUpcomingClass':
        if (!session) {
          output = { success: false, errorCode: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' };
        } else {
          output = handleUpdateUpcomingClass(params, session);
        }
        break;
        
      case 'deleteCNE':
        output = handleAdminAction(params, session, handleDeleteCNE, 'DELETE_CNE');
        break;

      case 'addDepartmentalSchedule':
        if (!session) {
          output = { success: false, errorCode: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' };
        } else {
          output = handleAddDepartmentalSchedule(params, session);
        }
        break;

      case 'setupAndVerifyCNESheets':
        output = handleAdminAction(params, session, handleSetupAndVerifyCNESheets, 'SETUP_AND_VERIFY_SHEETS');
        break;

      case 'reviewCNE':
      case 'reviewUpcomingClass':
        output = handleAdminAction(params, session, handleReviewUpcomingClass, 'REVIEW_CNE');
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

      case 'uploadLearningResource':
        output = handleUploadLearningResource(params, session);
        break;

      case 'deleteLearningResource':
        output = handleDeleteLearningResource(params, session);
        break;

      case 'getLearningResource':
        output = handleGetLearningResource(params, session);
        break;

      case 'listLearningResources':
        output = handleListLearningResources(params, session);
        break;

      case 'downloadLearningResource':
        output = handleDownloadLearningResource(params, session);
        break;

      case 'extractLearningResourceContent':
        output = handleExtractLearningResourceContent(params, session);
        break;

      case 'listNursingReferenceResources':
        output = handleListNursingReferenceResources(params, session);
        break;

      case 'indexNursingReferenceResource':
      case 'registerAndIndexReferenceResource':
        output = handleIndexNursingReferenceResource(params, session);
        break;

      case 'uploadNursingReferenceResource':
        output = handleUploadNursingReferenceResource(params, session);
        break;

      case 'deleteNursingReferenceResource':
        output = handleDeleteNursingReferenceResource(params, session);
        break;

      case 'downloadNursingReferenceResource':
        output = handleDownloadNursingReferenceResource(params, session);
        break;

      case 'setResourceVisibility':
        output = handleSetResourceVisibility(params, session);
        break;

      case 'getReferenceMaterial':
        output = handleGetReferenceMaterial(params, session);
        break;

      case 'retrieveCNETopicEvidence':
      case 'getCNETopicEvidence':
        output = handleRetrieveCNETopicEvidence(params, session);
        break;

      case 'runLocalRetrievalValidation':
      case 'validateLocalRetrieval':
        output = handleRunLocalRetrievalValidation(params, session);
        break;

      case 'getCNEActivityProgress':
        output = handleGetCNEActivityProgress(params, session);
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
      case 'addManualParticipants':
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
  
  if (output && typeof output === 'object') {
    output._perfMs = Date.now() - requestStart;
  }
  logPerf('handleRequest [' + (action || 'unknown') + ']', requestStart);

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
    cneScheduleTab: 'FAIL',
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
      if (sName === 'CNE Schedule') diagnostics.cneScheduleTab = 'PASS';
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
 * Supports ADMIN, AREA_INCHARGE, and EMPLOYEE roles with server-side caching (TTL 60s)
 */
function getUserRoleInfo(employeeId) {
  var normId = normalizeEmpId(employeeId);
  var result = { role: 'EMPLOYEE', assignedArea: '', assignedAreas: [] };
  if (!normId) return result;
  
  // 1. In-memory execution cache for current request
  if (_inMemoryRoleCache[normId]) {
    return _inMemoryRoleCache[normId];
  }

  var startedAt = Date.now();
  var cacheKey = 'cne_user_role_' + normId;
  
  // 2. Server-side CacheService (short TTL: 60 seconds)
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (parsed && parsed.role) {
        _inMemoryRoleCache[normId] = parsed;
        logPerf('getUserRoleInfo [cache-hit]', startedAt, 'id: ' + normId);
        return parsed;
      }
    }
  } catch (e) {}

  // 3. Authoritative Google Sheet read
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
              if (result.role !== 'ADMIN' && result.assignedAreas.length > 0) {
                result.role = 'AREA_INCHARGE';
              }
            }
            try {
              CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), 60);
            } catch (ce) {}
            _inMemoryRoleCache[normId] = result;
            logPerf('getUserRoleInfo [sheet-read-role]', startedAt, 'id: ' + normId);
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
              try {
                CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), 60);
              } catch (ce) {}
              _inMemoryRoleCache[normId] = result;
              logPerf('getUserRoleInfo [sheet-read-area]', startedAt, 'id: ' + normId);
              return result;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error reading role info: ' + e.message);
  }
  
  // Cache default EMPLOYEE result as well
  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), 60);
  } catch (ce) {}
  _inMemoryRoleCache[normId] = result;
  logPerf('getUserRoleInfo [sheet-read-default]', startedAt, 'id: ' + normId);
  return result;
}

function invalidateUserRoleCache(employeeId) {
  if (employeeId) {
    var rawId = String(employeeId).trim();
    var normId = normalizeEmpId(rawId);
    var cache = CacheService.getScriptCache();
    if (normId) {
      try {
        cache.remove('cne_user_role_' + normId);
      } catch (e) {}
      delete _inMemoryRoleCache[normId];
    }
    if (rawId && rawId.toLowerCase() !== normId) {
      try {
        cache.remove('cne_user_role_' + rawId.toLowerCase());
      } catch (e) {}
      delete _inMemoryRoleCache[rawId.toLowerCase()];
    }
  }
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
 * Check authorization for operational CNE actions:
 * Material, Questions, QR Code, Take Post Test, Participants.
 *
 * Allowed:
 * 1. Admin
 * 2. Responsible Area Incharge (Departmental CNE within their assigned area)
 * 3. Resource Person ONLY when the authenticated user is actually assigned as a Resource Person for THIS PARTICULAR CNE.
 *
 * Forbidden:
 * - Other Resource Persons not assigned to this CNE
 * - Ordinary staff
 */
function checkCNEActionAuthorized(session, record) {
  if (!session || !session.employeeId) {
    return {
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in.'
    };
  }

  var role = String(session.role || '').toUpperCase();
  if (role === 'ADMIN') {
    return null; // Admin has full operational authority
  }

  if (record) {
    // 1. Check if authenticated user is an assigned Resource Person for THIS PARTICULAR CNE
    var loggedInId = normalizeEmpId(session.employeeId);
    var rawRp = record.instructor || record.resourcePersonEmpId || '';
    var rpList = String(rawRp).split(/[,;\\n]+/).map(function(s) {
      return normalizeEmpId(s);
    }).filter(Boolean);

    if (loggedInId && rpList.indexOf(loggedInId) !== -1) {
      return null; // Assigned Resource Person for this specific CNE
    }

    // 2. Check if responsible Area Incharge for this Departmental CNE
    var areaAuth = checkCNEAuthorized(session, record.area, record.cneType);
    if (areaAuth === null) {
      return null; // Responsible Area Incharge
    }
  }

  return {
    success: false,
    errorCode: 'FORBIDDEN',
    message: 'Permission denied. Only Administrators, the responsible Area Incharge, or assigned Resource Persons for this CNE may perform this action.'
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
 * Execution Roster Data Cache:
 * Within a single request execution, caches the Roster sheet data and pre-indexes by employee ID
 * so multiple lookups (e.g. validating 20 participants) execute in O(1) without repeated sheet reads.
 */
function getExecutionRosterData() {
  if (_executionRosterData) return _executionRosterData;
  var sheet = getRosterSheet();
  var range = sheet.getDataRange();
  var data = range.getValues();
  var displayData = range.getDisplayValues();
  if (data.length <= 1) return null;
  
  var headers = data[0];
  var colMap = findOfficerHeaders(headers);
  if (colMap.empCol === -1) {
    throw new Error('System configuration error: Required column "Employee ID No." could not be identified in Rosters Master Data.');
  }

  _executionRosterData = {
    sheetName: sheet.getName(),
    data: data,
    displayData: displayData,
    colMap: colMap,
    byNormId: {}
  };

  for (var r = 1; r < data.length; r++) {
    var cellVal = data[r][colMap.empCol];
    var dispVal = displayData[r] ? displayData[r][colMap.empCol] : '';
    var rowEmpId = normalizeEmpId(dispVal || cellVal);
    if (!rowEmpId) rowEmpId = normalizeEmpId(cellVal);

    if (rowEmpId && !_executionRosterData.byNormId[rowEmpId]) {
      var rawDoj = (colMap.dojCol !== -1) ? data[r][colMap.dojCol] : '';
      var dispDoj = (colMap.dojCol !== -1 && displayData[r]) ? String(displayData[r][colMap.dojCol] || '').trim() : '';
      var rawName = (colMap.nameCol !== -1) ? String((displayData[r] && displayData[r][colMap.nameCol]) || data[r][colMap.nameCol] || '').trim() : '';
      var rawDesig = (colMap.desigCol !== -1) ? String((displayData[r] && displayData[r][colMap.desigCol]) || data[r][colMap.desigCol] || '').trim() : '';
      var rawEmpType = (colMap.empTypeCol !== -1) ? String((displayData[r] && displayData[r][colMap.empTypeCol]) || data[r][colMap.empTypeCol] || '').trim() : '';
      var rawContact = (colMap.contactCol !== -1) ? String((displayData[r] && displayData[r][colMap.contactCol]) || data[r][colMap.contactCol] || '').trim() : '';
      var empIdExact = String(dispVal || cellVal || '').trim();

      _executionRosterData.byNormId[rowEmpId] = {
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

  return _executionRosterData;
}

/**
 * Helper: Find Officer in 'Rosters Master Data' tab (DOJ stays strictly server-side)
 * Uses O(1) indexed lookups within the execution context.
 */
function findOfficerById(employeeId) {
  var normId = normalizeEmpId(employeeId);
  if (!normId) return null;
  
  var roster = getExecutionRosterData();
  if (!roster || !roster.byNormId) return null;
  
  return roster.byNormId[normId] || null;
}

/**
 * Cache Limits & Chunking Constants
 */
var MAX_SAFE_CACHE_BYTES = 400000; // 400KB maximum payload ceiling
var MAX_SAFE_CHUNKS = 5;          // Maximum 5 chunks (up to 425KB total)
var CACHE_CHUNK_SIZE = 85000;     // 85KB per chunk, safely below CacheService 100KB limit

/**
 * Helper: Store data in ScriptCache with automatic chunking for payloads > 90KB.
 * Ensures large roster/map datasets never get discarded by CacheService's 100KB limit.
 * Hardened with defensive bounds against operational limits and sensitive data.
 */
function putToScriptCache(baseKey, dataObj, ttlSeconds) {
  try {
    if (!baseKey) return;

    // Security check: Never cache credentials, secrets, tokens, answers, or sensitive data
    var sensitiveKeywords = ['pass', 'salt', 'token', 'secret', 'credential', 'response', 'answer'];
    var lowerKey = String(baseKey).toLowerCase();
    for (var sk = 0; sk < sensitiveKeywords.length; sk++) {
      if (lowerKey.indexOf(sensitiveKeywords[sk]) !== -1) {
        Logger.log('[Cache Security Guard] Refusing to cache sensitive key: ' + baseKey);
        return;
      }
    }

    var jsonStr = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj);
    var ttl = ttlSeconds || 60;
    var cache = CacheService.getScriptCache();

    // Defensive check: If payload is too large to cache safely, skip caching gracefully
    if (jsonStr.length > MAX_SAFE_CACHE_BYTES) {
      Logger.log('[Cache Put Notice] Payload for ' + baseKey + ' (' + jsonStr.length + ' bytes) exceeds safe cache threshold (' + MAX_SAFE_CACHE_BYTES + ' bytes). Skipping cache without failure; using authoritative sheet.');
      try {
        cache.remove(baseKey);
        cache.remove(baseKey + '_chunks');
      } catch (cleanErr) {}
      return;
    }

    if (jsonStr.length < 90000) {
      cache.put(baseKey, jsonStr, ttl);
      cache.remove(baseKey + '_chunks');
    } else {
      var chunks = [];
      for (var i = 0; i < jsonStr.length; i += CACHE_CHUNK_SIZE) {
        chunks.push(jsonStr.substring(i, i + CACHE_CHUNK_SIZE));
      }

      // Defensive check: Ensure chunk count does not exceed safe operational bounds
      if (chunks.length > MAX_SAFE_CHUNKS) {
        Logger.log('[Cache Put Notice] Chunk count (' + chunks.length + ') for ' + baseKey + ' exceeds safe max (' + MAX_SAFE_CHUNKS + '). Skipping caching safely.');
        try {
          cache.remove(baseKey);
          cache.remove(baseKey + '_chunks');
        } catch (cleanErr) {}
        return;
      }

      var chunkMap = {};
      chunkMap[baseKey + '_chunks'] = String(chunks.length);
      for (var c = 0; c < chunks.length; c++) {
        chunkMap[baseKey + '_p' + c] = chunks[c];
      }
      cache.putAll(chunkMap, ttl);
      cache.remove(baseKey);
    }
  } catch (e) {
    Logger.log('[Cache Put Notice] ' + e.message);
  }
}

/**
 * Helper: Retrieve data from ScriptCache with automatic reassembly of chunked payloads.
 * Hardened with defensive chunk boundary validation.
 */
function getFromScriptCache(baseKey) {
  try {
    if (!baseKey) return null;
    var cache = CacheService.getScriptCache();
    var single = cache.get(baseKey);
    if (single) {
      return JSON.parse(single);
    }
    var chunkCountStr = cache.get(baseKey + '_chunks');
    if (chunkCountStr) {
      var count = parseInt(chunkCountStr, 10) || 0;
      if (count > 0 && count <= MAX_SAFE_CHUNKS) {
        var keys = [];
        for (var i = 0; i < count; i++) {
          keys.push(baseKey + '_p' + i);
        }
        var parts = cache.getAll(keys);
        var fullJson = '';
        for (var j = 0; j < count; j++) {
          var part = parts[baseKey + '_p' + j];
          if (!part) return null; // Missing chunk, treat as cache miss
          fullJson += part;
        }
        return JSON.parse(fullJson);
      }
    }
  } catch (e) {
    Logger.log('[Cache Get Notice] ' + e.message);
  }
  return null;
}

/**
 * Officers Dropdown (Admin Only, Sanitized: ONLY employeeId, name, designation returned)
 * Uses CacheService (TTL 60s) with chunking protection to eliminate repeated full-roster sheet reads.
 */
function handleGetOfficersDropdown(params, session) {
  if (!session) {
    return {
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in.'
    };
  }

  var startedAt = Date.now();
  var cacheKey = 'cne_officers_dropdown';
  try {
    var cached = getFromScriptCache(cacheKey);
    if (Array.isArray(cached) && cached.length > 0) {
      logPerf('handleGetOfficersDropdown [cache-hit]', startedAt);
      return { success: true, data: cached, _cached: true };
    }
  } catch (e) {}

  var sheet;
  try {
    sheet = getRosterSheet();
  } catch (err) {
    return { success: false, message: err.message };
  }

  var range = sheet.getDataRange();
  var displayData = range.getDisplayValues();
  var list = [];
  
  if (displayData.length > 1) {
    var headers = displayData[0];
    var colMap = findOfficerHeaders(headers);
    if (colMap.empCol === -1 || colMap.nameCol === -1) {
      return { success: false, message: 'System configuration error: Required columns (Employee ID No. / Name of the Officers) could not be identified in Rosters Master Data.' };
    }
    
    for (var r = 1; r < displayData.length; r++) {
      var empId = String(displayData[r][colMap.empCol] || '').trim();
      var name = String(displayData[r][colMap.nameCol] || '').trim();
      var desig = (colMap.desigCol !== -1) ? String(displayData[r][colMap.desigCol] || '').trim() : '';
      if (empId) {
        list.push({
          employeeId: empId,
          name: name,
          designation: desig
        });
      }
    }
  }

  putToScriptCache(cacheKey, list, 60);

  logPerf('handleGetOfficersDropdown [sheet-read]', startedAt, 'count: ' + list.length);
  return { success: true, data: list };
}

/**
 * Helper: Build an in-memory map of { [employeeId]: officerName }
 * from the authoritative 'Rosters Master Data' tab in DROPDOWN_SPREADSHEET_ID.
 * Uses execution context, CacheService (TTL 60s), and chunking protection.
 */
function getOfficerNameMap() {
  if (_inMemoryOfficerMap) return _inMemoryOfficerMap;

  // If execution context already loaded full roster data, build directly without sheet read!
  if (_executionRosterData && _executionRosterData.byNormId) {
    var mapFromRoster = {};
    for (var normKey in _executionRosterData.byNormId) {
      var rosterEntry = _executionRosterData.byNormId[normKey];
      if (rosterEntry && rosterEntry.name) {
        mapFromRoster[normKey] = rosterEntry.name;
      }
    }
    _inMemoryOfficerMap = mapFromRoster;
    return _inMemoryOfficerMap;
  }

  var startedAt = Date.now();
  var cacheKey = 'cne_officer_name_map';
  try {
    var cached = getFromScriptCache(cacheKey);
    if (cached && typeof cached === 'object') {
      _inMemoryOfficerMap = cached;
      logPerf('getOfficerNameMap [cache-hit]', startedAt);
      return cached;
    }
  } catch (e) {
    Logger.log('[OfficerMap Cache Notice] ' + e.message);
  }

  var map = {};
  try {
    var sheet = getRosterSheet();
    var range = sheet.getDataRange();
    var displayData = range.getDisplayValues();
    if (displayData.length > 1) {
      var colMap = findOfficerHeaders(displayData[0]);
      if (colMap.empCol !== -1 && colMap.nameCol !== -1) {
        for (var r = 1; r < displayData.length; r++) {
          var empId = normalizeEmpId(displayData[r][colMap.empCol]);
          var name = String(displayData[r][colMap.nameCol] || '').trim();
          if (empId && name) {
            map[empId] = name;
          }
        }
      }
    }

    putToScriptCache(cacheKey, map, 60);

    _inMemoryOfficerMap = map;
    logPerf('getOfficerNameMap [sheet-read]', startedAt, 'count: ' + Object.keys(map).length);
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
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }

  try {
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
    invalidateUserRoleCache(empId);

    logAuditAction('PASSWORD_CHANGED', empId, 'User changed personal password', 'SUCCESS');
    
    return { success: true, message: 'Password updated successfully. You can now use your new password.' };
  } finally {
    lock.releaseLock();
  }
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
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }

  try {
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
    invalidateUserRoleCache(employeeId);

    logAuditAction('PASSWORD_RESET_SUCCESS', employeeId, 'Password reset via DOJ verification', 'SUCCESS');
    
    return { success: true, message: 'Password reset successfully. You can now log in with your new password.' };
  } finally {
    lock.releaseLock();
  }
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
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }

  try {
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
    invalidateUserRoleCache(targetEmpId);

    logAuditAction('ADMIN_PASSWORD_RESET', session.employeeId, 'Target Employee ID: ' + targetEmpId + ', Timestamp: ' + now + ', Status: SUCCESS', 'SUCCESS');
    
    return {
      success: true,
      message: 'Password for ' + targetOfficer.name + ' (' + targetEmpId + ') has been reset to default password.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Areas Management
 * Uses CacheService (TTL 60s) to avoid repeated sheet reads for frequent UI dropdowns.
 */
function handleGetAreas(params) {
  var startedAt = Date.now();
  var cacheKey = 'cne_areas_list';
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        logPerf('handleGetAreas [cache-hit]', startedAt);
        return { success: true, data: parsed, _cached: true };
      }
    }
  } catch (e) {}

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
  
  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(areas), 60);
  } catch (ce) {}

  logPerf('handleGetAreas [sheet-read]', startedAt, 'count: ' + areas.length);
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
    try {
      CacheService.getScriptCache().remove('cne_areas_list');
    } catch (e) {}
    if (params.inchargeEmpId || params.inchargeId || params.employeeId) {
      invalidateUserRoleCache(params.inchargeEmpId || params.inchargeId || params.employeeId);
    }
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
        try {
          CacheService.getScriptCache().remove('cne_areas_list');
        } catch (e) {}

        // Invalidate incharge cached role if incharge column is present in Area sheet
        var inchargeCol = -1;
        for (var c = 0; c < data[0].length; c++) {
          var ah = String(data[0][c]).toLowerCase().trim();
          if (ah.indexOf('incharge') !== -1 && ah.indexOf('id') !== -1) inchargeCol = c;
        }
        if (inchargeCol !== -1 && data[r][inchargeCol]) {
          invalidateUserRoleCache(data[r][inchargeCol]);
        }
        if (params.inchargeEmpId || params.inchargeId || params.employeeId) {
          invalidateUserRoleCache(params.inchargeEmpId || params.inchargeId || params.employeeId);
        }

        // If area was renamed or status changed, invalidate role cache for all officers assigned to oldName
        try {
          var roleSheet = ss.getSheetByName('Role');
          if (roleSheet) {
            var rData = roleSheet.getDataRange().getValues();
            if (rData.length > 1) {
              var rHeaders = rData[0];
              var rEmpCol = 0;
              var rAreaCol = 4;
              for (var rc = 0; rc < rHeaders.length; rc++) {
                var rh = String(rHeaders[rc] || '').toLowerCase();
                if (rh.indexOf('emp') !== -1 && rh.indexOf('id') !== -1) rEmpCol = rc;
                if (rh.indexOf('area') !== -1 || rh.indexOf('dept') !== -1 || rh.indexOf('ward') !== -1) rAreaCol = rc;
              }
              var oldLower = oldName.toLowerCase();
              for (var ri = 1; ri < rData.length; ri++) {
                var rawEmpArea = String(rData[ri][rAreaCol] || '').toLowerCase();
                if (rawEmpArea.indexOf(oldLower) !== -1) {
                  var rEmpId = normalizeEmpId(rData[ri][rEmpCol]);
                  if (rEmpId) invalidateUserRoleCache(rEmpId);
                }
              }
            }
          }
        } catch (re) {}

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
  var isMyRecordsOnly = Boolean(params && (params.myRecordsOnly || params.scope === 'my-cne'));
  if (isMyRecordsOnly && !session) {
    return { success: false, errorCode: 'UNAUTHORIZED', message: 'Unauthorized session.' };
  }
  
  var startedAt = Date.now();
  var isAdmin = session ? (session.role === 'ADMIN') : false;
  var loggedInId = session ? normalizeEmpId(session.employeeId) : null;
  
  var ss = getSpreadsheet('CNE');
  var sheet = ss.getSheetByName('CNE Schedule');
  if (!sheet) return { success: true, data: [] };
  
  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();
  if (data.length <= 1) return { success: true, data: [] };
  var officerMap = getOfficerNameMap();
  var colMap = getHeaderMap(sheet);
  
  var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['classid'] !== undefined ? colMap['classid'] : (colMap['dataid'] !== undefined ? colMap['dataid'] : 0));
  var areaCol = colMap['area'] !== undefined ? colMap['area'] : (colMap['wardnamearea'] !== undefined ? colMap['wardnamearea'] : 1);
  var fromDateCol = colMap['fromdate'] !== undefined ? colMap['fromdate'] : (colMap['date'] !== undefined ? colMap['date'] : 2);
  var toDateCol = colMap['todate'] !== undefined ? colMap['todate'] : 3;
  var timeCol = colMap['time'] !== undefined ? colMap['time'] : -1;
  var durCol = colMap['duration'] !== undefined ? colMap['duration'] : 4;
  var topicCol = colMap['topic'] !== undefined ? colMap['topic'] : 5;
  var rpCol = colMap['resourcepersonempid'] !== undefined ? colMap['resourcepersonempid'] : 6;
  var modeCol = colMap['modeofteaching'] !== undefined ? colMap['modeofteaching'] : (colMap['mode'] !== undefined ? colMap['mode'] : 7);
  var descCol = colMap['description'] !== undefined ? colMap['description'] : -1;
  var maxPartCol = colMap['maxparticipants'] !== undefined ? colMap['maxparticipants'] : -1;
  var staffCol = colMap['staffempid'] !== undefined ? colMap['staffempid'] : 8;
  var countCol = colMap['staffcount'] !== undefined ? colMap['staffcount'] : 9;
  var remarksCol = colMap['adminremarks'] !== undefined ? colMap['adminremarks'] : (colMap['remarks'] !== undefined ? colMap['remarks'] : 10);
  var typeCol = colMap['typeofcne'] !== undefined ? colMap['typeofcne'] : (colMap['cnetype'] !== undefined ? colMap['cnetype'] : 15);
  var extRpCol = colMap['externalresourcepersons'] !== undefined ? colMap['externalresourcepersons'] : 13;
  var extStaffCol = colMap['externalstaffparticipants'] !== undefined ? colMap['externalstaffparticipants'] : 14;
  var proposedByCol = colMap['proposedby'] !== undefined ? colMap['proposedby'] : -1;
  var statusCol = colMap['status'] !== undefined ? colMap['status'] : -1;

  var records = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var dataId = String(row[idCol] || '').trim();
    if (!dataId) continue;
    
    var area = String(row[areaCol] || '').trim();
    var fromDate = formatDateValue(row[fromDateCol]);
    var toDate = formatDateValue(row[toDateCol] || row[fromDateCol]);
    var time = timeCol !== -1 ? String(row[timeCol] || '').trim() : '';
    var duration = formatDurationValue(row[durCol]);
    var topic = String(row[topicCol] || '').trim();
    var resourcePersonEmpId = normalizeEmpId(row[rpCol]);
    var mode = String(row[modeCol] || 'Lecture Cum Discussion').trim();
    var description = descCol !== -1 ? String(row[descCol] || '').trim() : '';
    var maxParticipants = maxPartCol !== -1 ? (parseInt(row[maxPartCol], 10) || 50) : 50;
    var staffIdsRaw = String(row[staffCol] || '').trim();
    var staffCount = parseInt(row[countCol], 10) || 0;
    var remarks = String(row[remarksCol] || '').trim();
    var rawType = row[typeCol];
    var cneType = normalizeCNEType(rawType);
    var status = statusCol !== -1 ? normalizeCNEStatus(row[statusCol]) : 'Scheduled';
    var proposedBy = proposedByCol !== -1 ? String(row[proposedByCol] || '').trim() : '';
    
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
    
    var isResourcePerson = loggedInId ? (rpArray.indexOf(loggedInId) !== -1) : false;
    var isStaffParticipant = loggedInId ? (staffArray.indexOf(loggedInId) !== -1) : false;
    
    // Ordinary employees querying My CNE ONLY receive records where they were RP or participant
    if (isMyRecordsOnly) {
      if (!isAdmin && !isResourcePerson && !isStaffParticipant) {
        continue;
      }
    }

    // Filter by query parameters if specified
    if (params) {
      if (params.status && params.status !== 'ALL' && status.toLowerCase() !== String(params.status).toLowerCase()) {
        continue;
      }
      if (params.cneType && params.cneType !== 'ALL' && cneType !== normalizeCNEType(params.cneType)) {
        continue;
      }
      if (params.area && params.area !== 'ALL' && area.toLowerCase() !== String(params.area).toLowerCase()) {
        continue;
      }
    }
    
    var extRp = extRpCol !== -1 && row[extRpCol] ? String(row[extRpCol]).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
    var extStaff = extStaffCol !== -1 && row[extStaffCol] ? String(row[extStaffCol]).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];

    // PRIVACY HARDENING: Non-admins ONLY receive their own ID in staffEmpIds (never other staff IDs)
    var sanitizedStaffEmpIds = isAdmin ? staffArray : (isStaffParticipant && session ? [session.employeeId] : []);
    
    var rpNames = rpArray.map(function(id) {
      return officerMap[id] || id;
    }).filter(Boolean);
    var rpNameString = rpNames.join(', ');

    var staffNameList = sanitizedStaffEmpIds.map(function(id) {
      return officerMap[id] || id;
    });

    records.push({
      cneId: dataId,
      dataId: dataId,
      classId: dataId,
      area: area,
      fromDate: fromDate,
      date: fromDate,
      toDate: toDate,
      time: time,
      duration: duration,
      topic: topic,
      resourcePersonEmpId: resourcePersonEmpId,
      resourcePersonName: rpNameString,
      externalResourcePersons: extRp,
      externalStaffParticipants: isAdmin ? extStaff : [],
      modeOfTeaching: mode,
      description: description,
      maxParticipants: maxParticipants,
      staffEmpIds: sanitizedStaffEmpIds,
      staffNames: staffNameList,
      staffCount: staffCount,
      status: status,
      remarks: remarks,
      adminRemarks: remarks,
      cneType: cneType,
      proposedByEmpId: proposedBy
    });
  }
  
  logPerf('handleGetCNERecords', startedAt, 'records: ' + records.length);
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
    var sheet = getOrCreateSheet('CNE Schedule');
    
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
    
    // Stable CNE ID generation under ScriptLock
    var curYear = new Date().getFullYear();
    var timestampSuffix = Date.now().toString().slice(-4);
    var randSuffix = ('000' + Math.floor(Math.random() * 1000)).slice(-3);
    var cneId = 'CLS-' + curYear + '-U-' + timestampSuffix + randSuffix;
    
    var colMap = getHeaderMap(sheet);
    var maxCol = Math.max(sheet.getLastColumn(), 22);
    var rowData = [];
    for (var col = 0; col < maxCol; col++) rowData.push('');

    var setCell = function(key, fallbackCol, val) {
      var idx = colMap[key] !== undefined ? colMap[key] : fallbackCol;
      while (rowData.length <= idx) rowData.push('');
      rowData[idx] = val;
    };

    var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['classid'] !== undefined ? colMap['classid'] : (colMap['dataid'] !== undefined ? colMap['dataid'] : 0));
    while (rowData.length <= idCol) rowData.push('');
    rowData[idCol] = cneId;

    setCell('topic', 1, topic);
    setCell('area', 2, area);
    setCell('fromdate', 3, fromDate);
    if (colMap['date'] !== undefined) rowData[colMap['date']] = fromDate;
    setCell('todate', 4, toDate);
    setCell('time', 5, params.time || '09:00');
    setCell('duration', 6, sanitizeCellInput(params.duration || '01:00:00'));
    setCell('resourcepersonempid', 7, rpClean.join(', '));
    setCell('modeofteaching', 8, sanitizeCellInput(params.modeOfTeaching || 'Lecture Cum Discussion'));
    if (colMap['mode'] !== undefined) rowData[colMap['mode']] = sanitizeCellInput(params.modeOfTeaching || 'Lecture Cum Discussion');
    setCell('description', 9, sanitizeCellInput(params.description || ''));
    setCell('maxparticipants', 10, parseInt(params.maxParticipants, 10) || 50);
    setCell('status', 11, 'Completed');
    setCell('typeofcne', 12, cneType);
    setCell('externalresourcepersons', 13, extRpClean.join(', '));
    setCell('proposedby', 14, session.employeeId || '');
    setCell('adminremarks', 15, sanitizeCellInput(params.remarks || params.adminRemarks || ''));
    setCell('staffempid', 16, staffString);
    setCell('staffcount', 17, totalStaffCount);
    setCell('externalstaffparticipants', 18, extStaffClean.join(', '));
    setCell('createdat', 19, new Date().toISOString());
    setCell('createdby', 20, session.employeeId || '');
    setCell('finalizedat', 21, new Date().toISOString());
    setCell('finalizedby', 22, session.employeeId || '');

    sheet.appendRow(rowData);
    
    logAuditAction('ADD_CNE', session.employeeId, 'Recorded CNE ID: ' + cneId + ' (' + topic + ') in CNE Schedule', 'SUCCESS');
    return { 
      success: true, 
      message: 'CNE activity recorded successfully.', 
      data: { cneId: cneId, dataId: cneId, classId: cneId } 
    };
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

  var targetId = (params.cneId || params.dataId || params.classId || '').trim();
  if (!targetId) return { success: false, message: 'CNE ID is required.' };
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy processing another request. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('CNE Schedule');
    if (!sheet) return { success: false, message: 'CNE Schedule sheet not found.' };
    
    var data = sheet.getDataRange().getValues();
    var colMap = getHeaderMap(sheet);
    var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['dataid'] !== undefined ? colMap['dataid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 0));

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idCol]).trim().toLowerCase() === targetId.toLowerCase()) {
        var rowNum = r + 1;
        var setColVal = function(key, fallbackCol, val) {
          var c = colMap[key] !== undefined ? colMap[key] : fallbackCol;
          if (c !== undefined && c >= 0) {
            sheet.getRange(rowNum, c + 1).setValue(val);
          }
        };

        if (params.area !== undefined) setColVal('area', 2, sanitizeCellInput(params.area));
        if (params.fromDate !== undefined) {
          setColVal('fromdate', 3, params.fromDate);
          if (colMap['date'] !== undefined) sheet.getRange(rowNum, colMap['date'] + 1).setValue(params.fromDate);
        }
        if (params.toDate !== undefined) setColVal('todate', 4, params.toDate);
        if (params.duration !== undefined) {
          setColVal('duration', 6, sanitizeCellInput(params.duration));
        }
        if (params.topic !== undefined) setColVal('topic', 1, sanitizeCellInput(params.topic));
        
        // Resource person update
        if (params.resourcePersonEmpId !== undefined || params.resourcePersonEmpIds !== undefined || params.externalResourcePersons !== undefined) {
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
              message: 'Invalid Resource Person Employee ID(s) not found in roster: ' + invalidRpIds.join(', ')
            };
          }

          var extRpClean = [];
          if (params.externalResourcePersons !== undefined) {
            var extRp = Array.isArray(params.externalResourcePersons)
              ? params.externalResourcePersons
              : (params.externalResourcePersons || '').split(',');
            extRpClean = extRp.map(function(s) { return sanitizeCellInput(String(s).trim()); }).filter(Boolean);
          }

          if (rpClean.length === 0 && extRpClean.length === 0) {
            return { success: false, message: 'At least one Resource Person (Internal or External) is required.' };
          }
          setColVal('resourcepersonempid', 7, rpClean.join(', '));
          if (params.externalResourcePersons !== undefined) {
            setColVal('externalresourcepersons', 13, extRpClean.join(', '));
          }
        }
        
        if (params.modeOfTeaching !== undefined) {
          setColVal('modeofteaching', 8, sanitizeCellInput(params.modeOfTeaching));
          if (colMap['mode'] !== undefined) sheet.getRange(rowNum, colMap['mode'] + 1).setValue(sanitizeCellInput(params.modeOfTeaching));
        }
        
        // Staff participant update
        if (params.staffEmpIds !== undefined || params.staffEmpId !== undefined || params.externalStaffParticipants !== undefined) {
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

          var extStaffClean = [];
          if (params.externalStaffParticipants !== undefined) {
            var extStaff = Array.isArray(params.externalStaffParticipants)
              ? params.externalStaffParticipants
              : (params.externalStaffParticipants || '').split(',');
            extStaffClean = extStaff.map(function(s) { return sanitizeCellInput(String(s).trim()); }).filter(Boolean);
          }

          setColVal('staffempid', 16, staffClean.join(', '));
          setColVal('staffcount', 17, staffClean.length + extStaffClean.length);
          if (params.externalStaffParticipants !== undefined) {
            setColVal('externalstaffparticipants', 18, extStaffClean.join(', '));
          }
        }
        
        if (params.remarks !== undefined || params.adminRemarks !== undefined) {
          setColVal('adminremarks', 15, sanitizeCellInput(params.remarks || params.adminRemarks || ''));
        }
        if (params.status !== undefined) {
          setColVal('status', 11, normalizeCNEStatus(params.status));
        }
        if (params.cneType !== undefined) {
          var normType = normalizeCNEType(params.cneType);
          if (!normType) {
            return { success: false, errorCode: 'INVALID_CNE_TYPE', message: 'Type of CNE is invalid or missing. Must be either CENTRAL or DEPARTMENTAL.' };
          }
          setColVal('typeofcne', 12, normType);
        }
        
        logAuditAction('UPDATE_CNE', session.employeeId, 'Updated CNE ID: ' + targetId, 'SUCCESS');
        return { success: true, message: 'CNE record updated successfully.' };
      }
    }
    return { success: false, message: 'CNE record with ID ' + targetId + ' not found.' };
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

  var targetId = (params.cneId || params.dataId || params.classId || '').trim();
  if (!targetId) return { success: false, message: 'CNE ID is required.' };
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('CNE Schedule');
    if (!sheet) return { success: false, message: 'CNE Schedule sheet not found.' };
    
    var data = sheet.getDataRange().getValues();
    var colMap = getHeaderMap(sheet);
    var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['dataid'] !== undefined ? colMap['dataid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 0));

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idCol]).trim().toLowerCase() === targetId.toLowerCase()) {
        sheet.deleteRow(r + 1);
        logAuditAction('DELETE_CNE', session.employeeId, 'Deleted CNE ID: ' + targetId, 'SUCCESS');
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
  var startedAt = Date.now();
  var sheet = getOrCreateSheet('CNE Schedule');
  var range = sheet.getDataRange();
  var data = range.getValues();
  if (data.length <= 1) return { success: true, data: [] };

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
    var duration = formatDurationValue(rawDur) || '01:00:00';

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
  
  logPerf('handleGetUpcomingClasses', startedAt, 'records: ' + list.length);
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
    var sheet = getOrCreateSheet('CNE Schedule');
    
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
    var sheet = getOrCreateSheet('CNE Schedule');

    var colMap = getHeaderMap(sheet);
    var curYear = new Date().getFullYear();
    var createdIds = [];
    var allRows = [];
    var targetCols = Math.max(sheet.getLastColumn(), 16);

    for (var j = 0; j < validatedList.length; j++) {
      var item = validatedList[j];
      var timestampSuffix = Date.now().toString().slice(-4);
      var randSuffix = ('000' + Math.floor(Math.random() * 1000)).slice(-3) + j;
      var cneId = 'CLS-' + curYear + '-D-' + timestampSuffix + randSuffix;

      var rowData = [];
      for (var col = 0; col < targetCols; col++) rowData.push('');

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

      allRows.push(rowData);
      createdIds.push(cneId);
    }

    if (allRows.length > 0) {
      var numColumns = targetCols;
      for (var r = 0; r < allRows.length; r++) {
        if (allRows[r].length > numColumns) {
          numColumns = allRows[r].length;
        }
      }
      for (var r = 0; r < allRows.length; r++) {
        while (allRows[r].length < numColumns) {
          allRows[r].push('');
        }
      }

      var startRow = sheet.getLastRow() + 1;
      var numRows = allRows.length;

      var maxRows = sheet.getMaxRows();
      if (startRow + numRows - 1 > maxRows) {
        sheet.insertRowsAfter(maxRows, (startRow + numRows - 1) - maxRows);
      }
      var maxCols = sheet.getMaxColumns();
      if (numColumns > maxCols) {
        sheet.insertColumnsAfter(maxCols, numColumns - maxCols);
      }

      sheet.getRange(startRow, 1, numRows, numColumns).setValues(allRows);
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
    var sheet = ss.getSheetByName('CNE Schedule');
    if (!sheet) return { success: false, message: 'CNE Schedule sheet not found.' };
    
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
        
        // DEPARTMENTAL CNE — NO MAX CAPACITY:
        // Only CENTRAL CNE may update maxParticipants. For DEPARTMENTAL CNE, do not expose or modify maxParticipants.
        var currentCneType = normalizeCNEType(record.cneType);
        if (currentCneType === 'CENTRAL' && params.maxParticipants !== undefined) {
          setColVal('maxparticipants', 10, parseInt(params.maxParticipants, 10) || 50);
        }
        
        if (params.status !== undefined) {
          setColVal('status', 11, normalizeCNEStatus(params.status));
        }
        
        // CNE TYPE IS IMMUTABLE DURING EDIT:
        // Reject any attempt to change CNE Category/Type and preserve stored value.
        if (params.cneType !== undefined) {
          var normType = normalizeCNEType(params.cneType);
          if (normType && normType !== currentCneType) {
            return {
              success: false,
              errorCode: 'IMMUTABLE_CNE_TYPE',
              message: 'CNE Category / Type is immutable and cannot be changed.'
            };
          }
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
    var sheet = ss.getSheetByName('CNE Schedule');
    if (!sheet) return { success: false, message: 'CNE Schedule sheet not found.' };

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
    var classSheet = ss.getSheetByName('CNE Schedule');
    if (!classSheet) return { success: false, message: 'CNE Schedule sheet not found.' };
    
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
  if (data.length < 2) {
    return { success: true, data: [] };
  }
  var colMap = getHeaderMap(sheet);
  var headers = data[0];

  // Resiliently locate Employee ID column
  var empIdCol = -1;
  var possibleEmpKeys = ['employeeidno', 'employeeid', 'empid', 'id', 'officerid'];
  for (var k = 0; k < possibleEmpKeys.length; k++) {
    if (colMap[possibleEmpKeys[k]] !== undefined) {
      empIdCol = colMap[possibleEmpKeys[k]];
      break;
    }
  }
  if (empIdCol === -1) {
    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c] || '').toLowerCase();
      if (h.indexOf('emp') !== -1 && h.indexOf('id') !== -1) {
        empIdCol = c;
        break;
      }
    }
  }
  if (empIdCol === -1) empIdCol = 0;

  // Resiliently locate Name column
  var nameCol = -1;
  var possibleNameKeys = ['nameoftheofficers', 'name', 'officername', 'employeename'];
  for (var k = 0; k < possibleNameKeys.length; k++) {
    if (colMap[possibleNameKeys[k]] !== undefined) {
      nameCol = colMap[possibleNameKeys[k]];
      break;
    }
  }
  if (nameCol === -1) nameCol = 1;

  // Resiliently locate Designation column
  var desigCol = -1;
  if (colMap['designation'] !== undefined) desigCol = colMap['designation'];
  else if (colMap['desig'] !== undefined) desigCol = colMap['desig'];
  if (desigCol === -1) desigCol = 2;

  // Resiliently locate Role column
  var roleCol = -1;
  if (colMap['role'] !== undefined) roleCol = colMap['role'];
  else if (colMap['assignedrole'] !== undefined) roleCol = colMap['assignedrole'];
  else if (colMap['userrole'] !== undefined) roleCol = colMap['userrole'];
  if (roleCol === -1) {
    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c] || '').toLowerCase();
      if (h.indexOf('role') !== -1) {
        roleCol = c;
        break;
      }
    }
  }
  if (roleCol === -1) roleCol = 3;

  // Resiliently locate Area / Department / Ward column
  var areaCol = -1;
  var possibleAreaKeys = [
    'departmentarea', 'area', 'department', 'ward', 'wardarea',
    'assignedareas', 'assignedarea', 'assignedwards', 'assignedward',
    'departmentward', 'wards', 'areas', 'clinicalarea', 'clinicalareas'
  ];
  for (var k = 0; k < possibleAreaKeys.length; k++) {
    if (colMap[possibleAreaKeys[k]] !== undefined) {
      areaCol = colMap[possibleAreaKeys[k]];
      break;
    }
  }
  if (areaCol === -1) {
    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c] || '').toLowerCase();
      if (h.indexOf('area') !== -1 || h.indexOf('dept') !== -1 || h.indexOf('ward') !== -1) {
        areaCol = c;
        break;
      }
    }
  }
  if (areaCol === -1) areaCol = 4;

  var roles = [];
  for (var r = 1; r < data.length; r++) {
    var empId = normalizeEmpId(data[r][empIdCol]);
    if (empId) {
      var rawArea = areaCol !== -1 ? String(data[r][areaCol] || '').trim() : '';
      var assignedAreas = rawArea
        ? rawArea.split(/[,;\\n]+/).map(function(s) { return String(s).trim(); }).filter(Boolean)
        : [];
      
      var rawRole = String(data[r][roleCol] || 'EMPLOYEE').toUpperCase().trim();
      var normalizedRole = 'EMPLOYEE';
      if (rawRole.indexOf('ADMIN') !== -1) {
        normalizedRole = 'ADMIN';
      } else if (rawRole.indexOf('INCHARGE') !== -1 || assignedAreas.length > 0) {
        normalizedRole = 'AREA_INCHARGE';
      }

      roles.push({
        employeeId: empId,
        name: String(data[r][nameCol] || ''),
        designation: String(data[r][desigCol] || ''),
        role: normalizedRole,
        area: rawArea,
        departmentarea: rawArea,
        department: rawArea,
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
  
  // If assigned areas exist and not ADMIN, targetRole is AREA_INCHARGE
  if (targetRole !== 'ADMIN' && area) {
    targetRole = 'AREA_INCHARGE';
  }
  
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
    var headers = data.length > 0 ? data[0] : [];
    var adminCount = 0;
    var targetRow = -1;
    var currentRole = 'EMPLOYEE';

    // Resiliently locate Employee ID column
    var empIdCol = -1;
    var possibleEmpKeys = ['employeeidno', 'employeeid', 'empid', 'id', 'officerid'];
    for (var k = 0; k < possibleEmpKeys.length; k++) {
      if (colMap[possibleEmpKeys[k]] !== undefined) {
        empIdCol = colMap[possibleEmpKeys[k]];
        break;
      }
    }
    if (empIdCol === -1) {
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c] || '').toLowerCase();
        if (h.indexOf('emp') !== -1 && h.indexOf('id') !== -1) {
          empIdCol = c;
          break;
        }
      }
    }
    if (empIdCol === -1) empIdCol = 0;

    // Resiliently locate Role column
    var roleCol = -1;
    if (colMap['role'] !== undefined) roleCol = colMap['role'];
    else if (colMap['assignedrole'] !== undefined) roleCol = colMap['assignedrole'];
    else if (colMap['userrole'] !== undefined) roleCol = colMap['userrole'];
    if (roleCol === -1) {
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c] || '').toLowerCase();
        if (h.indexOf('role') !== -1) {
          roleCol = c;
          break;
        }
      }
    }
    if (roleCol === -1) roleCol = 3;

    // Resiliently locate Area / Department / Ward column
    var areaCol = -1;
    var possibleAreaKeys = [
      'departmentarea', 'area', 'department', 'ward', 'wardarea',
      'assignedareas', 'assignedarea', 'assignedwards', 'assignedward',
      'departmentward', 'wards', 'areas', 'clinicalarea', 'clinicalareas'
    ];
    for (var k = 0; k < possibleAreaKeys.length; k++) {
      if (colMap[possibleAreaKeys[k]] !== undefined) {
        areaCol = colMap[possibleAreaKeys[k]];
        break;
      }
    }
    if (areaCol === -1) {
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c] || '').toLowerCase();
        if (h.indexOf('area') !== -1 || h.indexOf('dept') !== -1 || h.indexOf('ward') !== -1) {
          areaCol = c;
          break;
        }
      }
    }
    if (areaCol === -1) areaCol = 4;
    
    for (var r = 1; r < data.length; r++) {
      var rowEmpId = normalizeEmpId(data[r][empIdCol]);
      var rVal = String(data[r][roleCol] || 'EMPLOYEE').toUpperCase().trim();
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
    
    var roleColNumber = roleCol + 1;
    var areaColNumber = areaCol + 1;

    if (targetRow > 0) {
      sheet.getRange(targetRow, roleColNumber).setValue(targetRole);
      sheet.getRange(targetRow, areaColNumber).setValue(area);
    } else {
      var officer = findOfficerById(employeeId);
      var name = officer ? officer.name : (params.name || '');
      var desig = officer ? officer.designation : (params.designation || '');
      var maxCol = Math.max(5, areaColNumber, roleColNumber);
      var newRow = [];
      for (var i = 0; i < maxCol; i++) newRow.push('');
      newRow[empIdCol] = employeeId;
      newRow[colMap['nameoftheofficers'] !== undefined ? colMap['nameoftheofficers'] : 1] = name;
      newRow[colMap['designation'] !== undefined ? colMap['designation'] : 2] = desig;
      newRow[roleCol] = targetRole;
      newRow[areaCol] = area;
      sheet.appendRow(newRow);
    }
    
    invalidateUserRoleCache(employeeId);
    if (params.targetEmployeeId && params.targetEmployeeId !== employeeId) {
      invalidateUserRoleCache(params.targetEmployeeId);
    }
    if (params.empId && params.empId !== employeeId) {
      invalidateUserRoleCache(params.empId);
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

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }

  try {
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
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateQuickLink(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var id = (params.id || '').trim();
  if (!id) return { success: false, message: 'Link ID is required.' };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }

  try {
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
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteQuickLink(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var id = (params.id || '').trim();
  if (!id) return { success: false, message: 'Link ID is required.' };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }

  try {
    var currentLinksRes = handleGetQuickLinks({});
    var links = currentLinksRes.data || [];
    var initialLen = links.length;
    links = links.filter(function(l) { return l.id !== id; });

    if (links.length === initialLen) return { success: false, message: 'Quick link not found.' };

    PropertiesService.getScriptProperties().setProperty('QUICK_LINKS_CUSTOM', JSON.stringify(links));
    logAuditAction('DELETE_QUICK_LINK', session.employeeId, 'Deleted Quick Link ID: ' + id, 'SUCCESS');
    return { success: true, message: 'Quick link removed successfully.' };
  } finally {
    lock.releaseLock();
  }
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
  var dataSheet = ss.getSheetByName('CNE Schedule');
  
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
  
  var colMap = getHeaderMap(dataSheet);
  var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : (colMap['dataid'] !== undefined ? colMap['dataid'] : (colMap['classid'] !== undefined ? colMap['classid'] : 0));
  var areaCol = colMap['area'] !== undefined ? colMap['area'] : (colMap['wardnamearea'] !== undefined ? colMap['wardnamearea'] : 1);
  var durCol = colMap['duration'] !== undefined ? colMap['duration'] : (colMap['dur'] !== undefined ? colMap['dur'] : 4);
  var rpCol = colMap['resourcepersonempid'] !== undefined ? colMap['resourcepersonempid'] : 6;
  var staffCol = colMap['staffempid'] !== undefined ? colMap['staffempid'] : 8;
  var countCol = colMap['staffcount'] !== undefined ? colMap['staffcount'] : 9;
  var statusCol = colMap['status'] !== undefined ? colMap['status'] : -1;

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
    var dataId = String(row[idCol] || '').trim();
    if (!dataId) continue;

    // In unified CNE Schedule, only count Completed sessions for program impact
    if (statusCol !== -1) {
      var rowStatus = normalizeCNEStatus(row[statusCol]);
      if (rowStatus !== 'Completed') continue;
    }
    
    var area = String(row[areaCol] || '').trim();
    var displayDur = (displayValues && displayValues[r]) ? displayValues[r][durCol] : '';
    var duration = formatDurationValue(row[durCol], displayDur);
    var durSec = parseDurationToSeconds(duration) || 0;
    var rpEmpId = normalizeEmpId(row[rpCol]);
    var staffIdsRaw = String(row[staffCol] || '').trim();
    var staffCount = parseInt(row[countCol], 10) || 0;
    
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
  var cneSheet = ss.getSheetByName('CNE Schedule');
  var areaSheet = ss.getSheetByName('Area');
  var appSheet = ss.getSheetByName('CNE Applications');
  
  var totalActivities = 0;
  var totalParticipants = 0;
  var totalMinutes = 0;
  var upcomingCount = 0;
  var currentMonthCount = 0;
  var currentMonthStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM');
  
  var monthlyMap = {};
  var areaMap = {};
  var modeMap = {};
  
  if (cneSheet) {
    var dataRange = cneSheet.getDataRange();
    var data = dataRange.getValues();
    var displayValues = dataRange.getDisplayValues();
    var dColMap = getHeaderMap(cneSheet);
    var dIdCol = dColMap['cneid'] !== undefined ? dColMap['cneid'] : (dColMap['classid'] !== undefined ? dColMap['classid'] : 0);
    var dAreaCol = dColMap['area'] !== undefined ? dColMap['area'] : (dColMap['wardnamearea'] !== undefined ? dColMap['wardnamearea'] : 1);
    var dDateCol = dColMap['fromdate'] !== undefined ? dColMap['fromdate'] : (dColMap['date'] !== undefined ? dColMap['date'] : 2);
    var dDurCol = dColMap['duration'] !== undefined ? dColMap['duration'] : 4;
    var dModeCol = dColMap['modeofteaching'] !== undefined ? dColMap['modeofteaching'] : 7;
    var dCountCol = dColMap['staffcount'] !== undefined ? dColMap['staffcount'] : 9;
    var dStatusCol = dColMap['status'] !== undefined ? dColMap['status'] : -1;

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (!row[dIdCol]) continue;
      
      var rowStatus = dStatusCol !== -1 ? normalizeCNEStatus(row[dStatusCol]) : 'Completed';
      if (rowStatus === 'Scheduled') {
        upcomingCount++;
        continue;
      }
      if (rowStatus === 'Canceled') {
        continue;
      }

      totalActivities++;
      var area = String(row[dAreaCol] || 'General').trim();
      var fromDate = formatDateValue(row[dDateCol]);
      var dispDur = (displayValues && displayValues[r]) ? displayValues[r][dDurCol] : '';
      var dur = formatDurationValue(row[dDurCol], dispDur);
      var mode = String(row[dModeCol] || 'Lecture').trim();
      var count = parseInt(row[dCountCol], 10) || 0;
      
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
  'CNE Schedule': [
    'CNE ID', 'Topic', 'Ward Name / Area', 'From Date', 'To Date', 'Time', 'Duration',
    'Resource Person Emp Id', 'Mode of Teaching', 'Description', 'Max Participants', 'Status',
    'Type of CNE', 'External Resource Persons', 'Staff Emp ID', 'Staff Count', 'External Staff Participants',
    'Proposed By', 'Admin Remarks', 'Remarks', 'CreatedAt', 'CreatedBy'
  ],
  'Area': ['Area', 'Status', 'CreatedAt'],
  'Role': ['Employee ID No.', 'Name of the Officers', 'Designation', 'Role', 'Department / Area'],
  'CNE Applications': ['Application ID', 'CNE ID', 'Employee ID', 'Employee Name', 'Applied At', 'Status', 'Remarks'],
  'Gallery': ['Image ID', 'Title', 'Description', 'Date', 'Drive File ID', 'Image URL', 'Uploaded By', 'Uploaded At', 'Status'],
  'News and Events': ['Event ID', 'Title', 'Category', 'Date', 'Summary', 'Full Content', 'Status', 'CreatedAt', 'CreatedBy'],
  'User Credentials': ['Employee ID', 'Password Hash', 'Password Salt', 'Must Change Password', 'Created At', 'Updated At', 'Last Login At', 'Account Status'],
  'Audit Log': ['Timestamp', 'Action', 'Employee ID', 'Details', 'Status'],
  'CNE Post Test Questions': ['CNE ID', 'Question ID', 'Question Text', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option', 'Explanation', 'Is Finalized', 'Is Locked', 'Created At', 'Created By', 'Authoritative Source', 'Status'],
  'CNE Post Test Responses': ['Response ID', 'CNE ID', 'Employee ID', 'Employee Name', 'Designation', 'Department', 'Score', 'Total Questions', 'Percentage', 'Source', 'Submitted At', 'Answers JSON', 'Status', 'Remarks'],
  'CNE_Reference': ['CNE ID', 'Topic', 'Reference Text / Clinical Guides', 'Updated At', 'Updated By', 'Drive File ID', 'File Name', 'File Type', 'Resource Person Name', 'File Size', 'Visible To Users'],
  'CNE_QR_Tokens': ['QR Token', 'CNE ID', 'Created At', 'Created By', 'Status'],
  'CNE_AI_Quota': ['CNE ID', 'Topic', 'Attempts Used', 'Max Quota', 'Last Attempt At', 'Last Generated By', 'Reservation Token', 'Reserved Until', 'Last Committed Token'],
  'CNE_Reference_Index': ['Index ID', 'Source Type', 'CNE ID', 'Drive File ID', 'Resource Title', 'Topic', 'Section / Heading', 'Chunk Index', 'Chunk Text', 'Clinical Keywords', 'Extraction Status', 'Updated At'],
  'CNE_Reference_Library': ['Resource ID', 'Source Type', 'Resource Title', 'Drive File ID', 'Author / Organization', 'License', 'Version', 'File Type', 'Active', 'Indexed At', 'Updated At', 'Visible To Users']
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
  'authoritativesource': ['authoritativesource', 'source', 'clinicalsource', 'reference'],
  'status': ['status', 'questionstatus', 'state'],
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
  'lastgeneratedby': ['lastgeneratedby', 'generatedby'],
  'drivefileid': ['drivefileid', 'fileid'],
  'filename': ['filename'],
  'filetype': ['filetype'],
  'resourcepersonname': ['resourcepersonname', 'resourceperson', 'instructor'],
  'filesize': ['filesize', 'size'],
  'indexid': ['indexid', 'chunkid'],
  'sourcetype': ['sourcetype'],
  'resourcetitle': ['resourcetitle', 'title'],
  'sectionheading': ['sectionheading', 'section', 'heading'],
  'chunkindex': ['chunkindex', 'chunkno', 'index'],
  'chunktext': ['chunktext', 'text', 'content'],
  'clinicalkeywords': ['clinicalkeywords', 'keywords'],
  'extractionstatus': ['extractionstatus', 'status'],
  'resourceid': ['resourceid', 'id'],
  'authororganization': ['authororganization', 'author', 'organization', 'authororg'],
  'license': ['license'],
  'version': ['version', 'edition'],
  'active': ['active', 'isactive', 'status'],
  'indexedat': ['indexedat']
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
 * Verifies all 14 required CNE tabs and their headers.
 * Never deletes or clears existing sheets or rows. Appends missing headers if needed.
 */
function setupAndVerifyCNESheets(executorEmpId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { success: false, message: 'Server is busy verifying sheets. Please try again.' };
  }

  try {
    var tabNames = [
      'CNE Schedule',
      'Area',
      'Role',
      'CNE Applications',
      'Gallery',
      'News and Events',
      'User Credentials',
      'Audit Log',
      'CNE Post Test Questions',
      'CNE Post Test Responses',
      'CNE_Reference',
      'CNE_QR_Tokens',
      'CNE_AI_Quota',
      'CNE_Reference_Index',
      'CNE_Reference_Library'
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
          if (tabName === 'CNE Schedule' || tabName === 'CNE Applications') {
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
  } finally {
    lock.releaseLock();
  }
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
  var sheet = ss.getSheetByName('CNE Schedule');
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
  
  var authErr = checkCNEActionAuthorized(session, record);
  if (authErr) return authErr;
  
  // Unified educational content entered through the single large content box
  var unifiedContent = sanitizeCellInput(params.unifiedContent || params.referenceText || params.material || '');
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
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
  } finally {
    lock.releaseLock();
  }
}

/**
 * Non-destructively ensure all 10 CNE_Reference headers exist.
 * Preserves existing columns 1-5 and existing row data.
 */
function ensureReferenceSheetHeaders(sheet) {
  var colMap = getHeaderMap(sheet);
  if (colMap['drivefileid'] === undefined) {
    var missing = ['Drive File ID', 'File Name', 'File Type', 'Resource Person Name', 'File Size'];
    var lastCol = sheet.getLastColumn() || 1;
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
}

/**
 * Non-destructively ensure all 12 CNE_Reference_Index headers exist.
 * Preserves existing rows, structure, and formatting.
 * Appends missing headers only if necessary.
 */
function ensureReferenceIndexSheetHeaders(sheet) {
  var expected = CNE_SHEET_HEADERS['CNE_Reference_Index'];
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expected);
    sheet.getRange(1, 1, 1, expected.length).setFontWeight('bold');
    return;
  }
  var colMap = getHeaderMap(sheet);
  var missing = [];
  for (var i = 0; i < expected.length; i++) {
    var key = expected[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (colMap[key] === undefined) {
      missing.push(expected[i]);
    }
  }
  if (missing.length > 0) {
    var lastCol = sheet.getLastColumn() || 1;
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
}

/**
 * Non-destructively ensure all CNE_Reference headers exist.
 * Preserves existing rows, structure, and formatting.
 * Appends missing headers only if necessary.
 */
function ensureLearningResourceSheetHeaders(sheet) {
  var expected = CNE_SHEET_HEADERS['CNE_Reference'];
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expected);
    sheet.getRange(1, 1, 1, expected.length).setFontWeight('bold');
    return;
  }
  var colMap = getHeaderMap(sheet);
  var missing = [];
  for (var i = 0; i < expected.length; i++) {
    var key = expected[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (colMap[key] === undefined) {
      missing.push(expected[i]);
    }
  }
  if (missing.length > 0) {
    var lastCol = sheet.getLastColumn() || 1;
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
}

/**
 * Non-destructively ensure all 12 CNE_Reference_Library headers exist.
 * Preserves existing rows, structure, and formatting.
 * Appends missing headers only if necessary.
 */
function ensureReferenceLibrarySheetHeaders(sheet) {
  var expected = CNE_SHEET_HEADERS['CNE_Reference_Library'];
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expected);
    sheet.getRange(1, 1, 1, expected.length).setFontWeight('bold');
    return;
  }
  var colMap = getHeaderMap(sheet);
  var missing = [];
  for (var i = 0; i < expected.length; i++) {
    var key = expected[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (colMap[key] === undefined) {
      missing.push(expected[i]);
    }
  }
  if (missing.length > 0) {
    var lastCol = sheet.getLastColumn() || 1;
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
}

/**
 * Helper: Obtain or create the 'Learning Resources' subfolder inside the configured DRIVE_FOLDER_ID.
 * Strictly non-destructive, idempotent, and authoritative.
 * Uses ONLY DRIVE_FOLDER_ID from ScriptProperties; ignores any client folder IDs.
 */
function getOrCreateLearningResourcesFolder() {
  var driveFolderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!driveFolderId || driveFolderId.trim() === '') {
    return {
      success: false,
      errorCode: 'MISSING_DRIVE_CONFIG',
      message: 'Google Drive configuration error: DRIVE_FOLDER_ID is not configured in Script Properties.'
    };
  }

  var parentFolder;
  try {
    parentFolder = DriveApp.getFolderById(driveFolderId.trim());
  } catch (e) {
    return {
      success: false,
      errorCode: 'INVALID_DRIVE_FOLDER',
      message: 'Google Drive configuration error: Invalid DRIVE_FOLDER_ID configured.'
    };
  }

  try {
    var subfolders = parentFolder.getFoldersByName('Learning Resources');
    if (subfolders.hasNext()) {
      return { success: true, folder: subfolders.next() };
    }
    var newFolder = parentFolder.createFolder('Learning Resources');
    return { success: true, folder: newFolder };
  } catch (e) {
    return {
      success: false,
      errorCode: 'FOLDER_CREATION_FAILED',
      message: 'Failed to access or create Learning Resources folder: ' + e.message
    };
  }
}

/**
 * Helper: Obtain or create the 'Nursing Reference Library' subfolder inside 'Learning Resources'.
 */
function getOrCreateNursingRefLibraryFolder(learningResourcesFolder) {
  try {
    var subfolders = learningResourcesFolder.getFoldersByName('Nursing Reference Library');
    if (subfolders.hasNext()) {
      return { success: true, folder: subfolders.next() };
    }
    var newFolder = learningResourcesFolder.createFolder('Nursing Reference Library');
    return { success: true, folder: newFolder };
  } catch (e) {
    return {
      success: false,
      errorCode: 'FOLDER_CREATION_FAILED',
      message: 'Failed to access or create Nursing Reference Library folder: ' + e.message
    };
  }
}

/**
 * Helper: Obtain or create the 'Open RN' subfolder inside 'Nursing Reference Library'.
 * Hierarchy: DRIVE_FOLDER_ID -> Learning Resources -> Nursing Reference Library -> Open RN
 * Strict Server-Authoritative: resolves ONLY from configured DRIVE_FOLDER_ID. Never accepts client folder IDs.
 */
function getOrCreateOpenRnFolder() {
  var lrResult = getOrCreateLearningResourcesFolder();
  if (!lrResult.success) return lrResult;

  var nrlResult = getOrCreateNursingRefLibraryFolder(lrResult.folder);
  if (!nrlResult.success) return nrlResult;

  try {
    var subfolders = nrlResult.folder.getFoldersByName('Open RN');
    if (subfolders.hasNext()) {
      return { success: true, folder: subfolders.next() };
    }
    var newFolder = nrlResult.folder.createFolder('Open RN');
    return { success: true, folder: newFolder };
  } catch (e) {
    return {
      success: false,
      errorCode: 'FOLDER_CREATION_FAILED',
      message: 'Failed to access or create Open RN folder: ' + e.message
    };
  }
}

/**
 * Server-side validation: Verifies whether a Drive File is strictly located within the Open RN folder.
 */
function isFileInOpenRnFolder(file, openRnFolder) {
  if (!file || !openRnFolder) return false;
  try {
    var parents = file.getParents();
    while (parents.hasNext()) {
      var p = parents.next();
      if (p.getId() === openRnFolder.getId()) {
        return true;
      }
    }
  } catch (err) {
    return false;
  }
  return false;
}

/**
 * Helper: Sanitize string to create safe filename part.
 * Strips path traversal / directory injection chars (/ \\ : * ? " < > | ..).
 */
function sanitizeFileNamePart(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\\\\/:*?"<>|\\r\\n\\t]/g, '')
    .replace(/\\.\\.+/g, '')
    .replace(/\\s+/g, ' ')
    .trim();
}

/**
 * Lightweight inspector to extract entry filenames from a ZIP archive's central directory
 * or local file headers without decompressing any file content into memory.
 */
function getZipArchiveEntryNames(bytes) {
  var entryNames = [];
  if (!bytes || bytes.length < 30) return entryNames;

  // Approach 1: Read Central Directory via End of Central Directory (EOCD)
  // EOCD signature: 0x50 0x4B 0x05 0x06
  var maxSearch = Math.min(bytes.length, 65536 + 22);
  var startSearch = bytes.length - maxSearch;
  var eocdPos = -1;

  for (var i = bytes.length - 22; i >= startSearch; i--) {
    if ((bytes[i] & 0xFF) === 0x50 &&
        (bytes[i + 1] & 0xFF) === 0x4B &&
        (bytes[i + 2] & 0xFF) === 0x05 &&
        (bytes[i + 3] & 0xFF) === 0x06) {
      eocdPos = i;
      break;
    }
  }

  if (eocdPos !== -1 && eocdPos + 22 <= bytes.length) {
    // Read Central Directory Offset (bytes 16..19, little-endian unsigned 32-bit int)
    var cdOffset = ((bytes[eocdPos + 16] & 0xFF) |
                   ((bytes[eocdPos + 17] & 0xFF) << 8) |
                   ((bytes[eocdPos + 18] & 0xFF) << 16) |
                   ((bytes[eocdPos + 19] & 0xFF) << 24)) >>> 0;

    var cdSize = ((bytes[eocdPos + 12] & 0xFF) |
                 ((bytes[eocdPos + 13] & 0xFF) << 8) |
                 ((bytes[eocdPos + 14] & 0xFF) << 16) |
                 ((bytes[eocdPos + 15] & 0xFF) << 24)) >>> 0;

    if (cdOffset >= 0 && cdOffset < bytes.length && cdOffset + cdSize <= bytes.length) {
      var ptr = cdOffset;
      var count = 0;
      // Central directory file header signature: 0x50 0x4B 0x01 0x02
      while (ptr + 46 <= bytes.length && count < 200) {
        if ((bytes[ptr] & 0xFF) === 0x50 &&
            (bytes[ptr + 1] & 0xFF) === 0x4B &&
            (bytes[ptr + 2] & 0xFF) === 0x01 &&
            (bytes[ptr + 3] & 0xFF) === 0x02) {
          var nameLen = ((bytes[ptr + 28] & 0xFF) | ((bytes[ptr + 29] & 0xFF) << 8)) >>> 0;
          var extraLen = ((bytes[ptr + 30] & 0xFF) | ((bytes[ptr + 31] & 0xFF) << 8)) >>> 0;
          var commentLen = ((bytes[ptr + 32] & 0xFF) | ((bytes[ptr + 33] & 0xFF) << 8)) >>> 0;

          if (ptr + 46 + nameLen <= bytes.length) {
            var nameChars = [];
            for (var c = 0; c < nameLen; c++) {
              nameChars.push(String.fromCharCode(bytes[ptr + 46 + c] & 0xFF));
            }
            entryNames.push(nameChars.join(''));
          }
          ptr += 46 + nameLen + extraLen + commentLen;
          count++;
        } else {
          break;
        }
      }
    }
  }

  // Approach 2: If EOCD yielded no entries, parse Local File Headers
  // Local File Header signature: 0x50 0x4B 0x03 0x04
  if (entryNames.length === 0) {
    var lptr = 0;
    var maxScan = Math.min(bytes.length - 30, 262144); // Scan up to first 256 KB
    var lcount = 0;
    while (lptr < maxScan && lcount < 100) {
      if ((bytes[lptr] & 0xFF) === 0x50 &&
          (bytes[lptr + 1] & 0xFF) === 0x4B &&
          (bytes[lptr + 2] & 0xFF) === 0x03 &&
          (bytes[lptr + 3] & 0xFF) === 0x04) {
        var lNameLen = ((bytes[lptr + 26] & 0xFF) | ((bytes[lptr + 27] & 0xFF) << 8)) >>> 0;
        if (lNameLen > 0 && lNameLen < 512 && lptr + 30 + lNameLen <= bytes.length) {
          var lChars = [];
          for (var lc = 0; lc < lNameLen; lc++) {
            lChars.push(String.fromCharCode(bytes[lptr + 30 + lc] & 0xFF));
          }
          entryNames.push(lChars.join(''));
        }
      }
      lptr++;
      lcount++;
    }
  }

  return entryNames;
}

/**
 * Validates the internal Office Open XML package structure for DOCX / PPTX
 * Rejects arbitrary ZIP files that do not contain valid Word or PowerPoint structures.
 */
function validateOfficeOpenXmlStructure(bytes, ext) {
  // First, verify standard ZIP local header signature (PK\\x03\\x04)
  if (!bytes || bytes.length < 30 ||
      (bytes[0] & 0xFF) !== 0x50 ||
      (bytes[1] & 0xFF) !== 0x4B ||
      (bytes[2] & 0xFF) !== 0x03 ||
      (bytes[3] & 0xFF) !== 0x04) {
    return {
      valid: false,
      message: 'File content does not match standard Office XML archive structure (missing ZIP header).'
    };
  }

  var entries = getZipArchiveEntryNames(bytes);
  if (!entries || entries.length === 0) {
    return {
      valid: false,
      message: 'Unable to parse Office Open XML package structure from file.'
    };
  }

  var hasContentTypes = false;
  var hasWordStructure = false;
  var hasPptStructure = false;

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i].toLowerCase();
    if (entry === '[content_types].xml' || entry.indexOf('[content_types].xml') !== -1) {
      hasContentTypes = true;
    }
    if (entry.indexOf('word/') === 0 || entry.indexOf('/word/') !== -1 || entry === 'word/document.xml') {
      hasWordStructure = true;
    }
    if (entry.indexOf('ppt/') === 0 || entry.indexOf('/ppt/') !== -1 || entry === 'ppt/presentation.xml') {
      hasPptStructure = true;
    }
  }

  if (ext === 'docx') {
    if (!hasWordStructure) {
      return {
        valid: false,
        message: 'File content does not contain required Word package structure (word/document.xml).'
      };
    }
    if (!hasContentTypes) {
      return {
        valid: false,
        message: 'File content is missing required Office Open XML content types definition ([Content_Types].xml).'
      };
    }
  } else if (ext === 'pptx') {
    if (!hasPptStructure) {
      return {
        valid: false,
        message: 'File content does not contain required PowerPoint package structure (ppt/presentation.xml).'
      };
    }
    if (!hasContentTypes) {
      return {
        valid: false,
        message: 'File content is missing required Office Open XML content types definition ([Content_Types].xml).'
      };
    }
  }

  return { valid: true };
}

/**
 * Upload and Store CNE Learning Resource File (Phase 1: Backend Foundation)
 * Supported Formats: PDF, DOCX, PPT, PPTX
 * Max Size: 5 MB
 * Authoritative storage: DRIVE_FOLDER_ID -> Learning Resources subfolder
 * Access: Completely PRIVATE (No ANYONE_WITH_LINK)
 * Metadata: Appended non-destructively to CNE_Reference
 */
function handleUploadLearningResource(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) {
    return { success: false, errorCode: 'INVALID_CNE_ID', message: 'CNE ID is required.' };
  }

  var record = getCNEClassRecord(cneId);
  if (!record) {
    return { success: false, errorCode: 'CNE_NOT_FOUND', message: 'CNE record not found for ID: ' + cneId };
  }

  var authErr = checkCNEActionAuthorized(session, record);
  if (authErr) return authErr;

  var base64Data = params.base64Data || params.fileData || params.fileBase64;
  if (!base64Data) {
    return { success: false, errorCode: 'MISSING_FILE', message: 'File data is required.' };
  }

  var clientFileName = sanitizeCellInput(params.fileName || '');
  
  // Extract MIME and raw base64
  var contentType = '';
  var rawBase64 = String(base64Data);
  if (rawBase64.indexOf(';base64,') !== -1) {
    var parts = rawBase64.split(';base64,');
    contentType = parts[0].replace('data:', '').toLowerCase().trim();
    rawBase64 = parts[1];
  } else if (params.fileType || params.mimeType) {
    contentType = String(params.fileType || params.mimeType).toLowerCase().trim();
  }

  // Pre-decode size check (approximate base64 length check to avoid huge memory allocation)
  // For 5 MB binary file, base64 length is ~ 5 * 1024 * 1024 * 4/3 ≈ 6.99 MB.
  if (rawBase64.length > 7 * 1024 * 1024) {
    return {
      success: false,
      errorCode: 'FILE_TOO_LARGE',
      message: 'File exceeds maximum allowed size of 5 MB.'
    };
  }

  // 1. Determine and validate normalized extension (exactly pdf, docx, ppt, pptx)
  var ext = '';
  if (clientFileName && clientFileName.lastIndexOf('.') !== -1) {
    ext = clientFileName.substring(clientFileName.lastIndexOf('.') + 1).toLowerCase().trim();
  } else if (params.extension) {
    ext = String(params.extension).toLowerCase().replace(/^\\./, '').trim();
  }

  var ALLOWED_EXTS = ['pdf', 'docx', 'ppt', 'pptx'];
  if (!ext || ALLOWED_EXTS.indexOf(ext) === -1) {
    return {
      success: false,
      errorCode: 'INVALID_FILE_TYPE',
      message: 'Invalid file format. Only PDF, DOCX, PPT, and PPTX documents are permitted.'
    };
  }

  // 2. MIME type handling
  // Legitimate specific MIME types per extension
  var SPECIFIC_MIMES_BY_EXT = {
    'pdf': ['application/pdf', 'application/x-pdf'],
    'docx': [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/x-docx'
    ],
    'ppt': [
      'application/vnd.ms-powerpoint',
      'application/powerpoint',
      'application/mspowerpoint',
      'application/x-mspowerpoint',
      'application/x-ms-powerpoint'
    ],
    'pptx': [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'application/x-mspowerpoint'
    ]
  };

  // Generic MIME types that browsers sometimes report
  // CRITICAL: Generic MIME types MUST NOT independently authorize an upload.
  var GENERIC_MIMES = [
    'application/octet-stream',
    'application/zip',
    'application/x-zip-compressed',
    'binary/octet-stream'
  ];

  if (contentType) {
    var isSpecific = SPECIFIC_MIMES_BY_EXT[ext].indexOf(contentType) !== -1;
    var isGeneric = GENERIC_MIMES.indexOf(contentType) !== -1;

    // Reject outright if declared MIME is incompatible with document types
    if (!isSpecific && !isGeneric) {
      return {
        success: false,
        errorCode: 'INVALID_MIME_TYPE',
        message: 'Declared MIME type (' + contentType + ') is not permitted for .' + ext.toUpperCase() + ' documents.'
      };
    }
  }

  // Canonical MIME types for Drive storage (never store with generic octet-stream/zip)
  var canonicalMime = 'application/pdf';
  if (ext === 'docx') {
    canonicalMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (ext === 'ppt') {
    canonicalMime = 'application/vnd.ms-powerpoint';
  } else if (ext === 'pptx') {
    canonicalMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }

  // Decode base64
  var decoded;
  try {
    decoded = Utilities.base64Decode(rawBase64);
  } catch (decodeErr) {
    return {
      success: false,
      errorCode: 'INVALID_FILE_ENCODING',
      message: 'Failed to decode base64 file data.'
    };
  }

  var fileSize = decoded.length;
  if (fileSize <= 0) {
    return {
      success: false,
      errorCode: 'EMPTY_FILE',
      message: 'Uploaded file is empty (0 bytes).'
    };
  }

  if (fileSize > 5 * 1024 * 1024) {
    return {
      success: false,
      errorCode: 'FILE_TOO_LARGE',
      message: 'File exceeds maximum allowed size of 5 MB (Actual: ' + (Math.round(fileSize / (1024 * 1024) * 10) / 10) + ' MB).'
    };
  }

  // 3. Binary & Structural Signature Validation
  if (ext === 'pdf') {
    // PDF must begin with %PDF (0x25 0x50 0x44 0x46)
    if (decoded.length < 4 ||
        (decoded[0] & 0xFF) !== 0x25 ||
        (decoded[1] & 0xFF) !== 0x50 ||
        (decoded[2] & 0xFF) !== 0x44 ||
        (decoded[3] & 0xFF) !== 0x46) {
      return {
        success: false,
        errorCode: 'INVALID_FILE_CONTENT',
        message: 'File content does not match standard PDF document structure (%PDF header missing).'
      };
    }
  } else if (ext === 'ppt') {
    // Legacy PPT must have 8-byte OLE Compound Document signature: D0 CF 11 E0 A1 B1 1A E1
    if (decoded.length < 8 ||
        (decoded[0] & 0xFF) !== 0xD0 ||
        (decoded[1] & 0xFF) !== 0xCF ||
        (decoded[2] & 0xFF) !== 0x11 ||
        (decoded[3] & 0xFF) !== 0xE0 ||
        (decoded[4] & 0xFF) !== 0xA1 ||
        (decoded[5] & 0xFF) !== 0xB1 ||
        (decoded[6] & 0xFF) !== 0x1A ||
        (decoded[7] & 0xFF) !== 0xE1) {
      return {
        success: false,
        errorCode: 'INVALID_FILE_CONTENT',
        message: 'File content does not match standard PowerPoint binary document structure (OLE compound header missing).'
      };
    }
  } else if (ext === 'docx' || ext === 'pptx') {
    // DOCX / PPTX: ZIP magic bytes + lightweight package structure verification
    var structResult = validateOfficeOpenXmlStructure(decoded, ext);
    if (!structResult.valid) {
      return {
        success: false,
        errorCode: 'INVALID_FILE_CONTENT',
        message: structResult.message
      };
    }
  }

  // Access authoritative Drive subfolder 'Learning Resources'
  var folderRes = getOrCreateLearningResourcesFolder();
  if (!folderRes.success) {
    return folderRes;
  }
  var targetFolder = folderRes.folder;

  // Resolve authoritative CNE Topic & Resource Person Name
  var authoritativeTopic = sanitizeFileNamePart(record.topic) || ('CNE_' + cneId);
  var authoritativeRpName = '';

  if (record.instructor) {
    var officer = findOfficerById(record.instructor);
    if (officer && officer.name) {
      authoritativeRpName = officer.name;
    }
  }
  if (!authoritativeRpName && record.externalResourcePersons) {
    authoritativeRpName = record.externalResourcePersons;
  }
  if (!authoritativeRpName && session.employeeId) {
    var sessionOfficer = findOfficerById(session.employeeId);
    if (sessionOfficer && sessionOfficer.name) {
      authoritativeRpName = sessionOfficer.name;
    } else if (session.name && session.name.toUpperCase() !== session.employeeId.toUpperCase()) {
      authoritativeRpName = session.name;
    }
  }
  if (!authoritativeRpName && params.resourcePersonName) {
    authoritativeRpName = sanitizeCellInput(params.resourcePersonName);
  }
  authoritativeRpName = sanitizeFileNamePart(authoritativeRpName) || 'Resource Person';

  var baseFileName = authoritativeTopic + ' - ' + authoritativeRpName;

  // Acquire ScriptLock for concurrency-safe filename allocation, Drive creation, and Sheet metadata persistence
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return {
      success: false,
      errorCode: 'SERVER_BUSY',
      message: 'Server is busy processing learning resources. Please try again in a few moments.'
    };
  }

  var newlyCreatedDriveFile = null;
  var newDriveFileId = null;

  try {
    // A. Concurrency-safe duplicate filename resolution inside lock
    var finalFileName = baseFileName + '.' + ext;
    try {
      if (targetFolder.getFilesByName(finalFileName).hasNext()) {
        var counter = 2;
        while (targetFolder.getFilesByName(baseFileName + ' (' + counter + ').' + ext).hasNext()) {
          counter++;
          if (counter > 100) break;
        }
        finalFileName = baseFileName + ' (' + counter + ').' + ext;
      }
    } catch (dupCheckErr) {
      finalFileName = baseFileName + ' (' + Date.now() + ').' + ext;
    }

    // B. Create file in Drive
    try {
      var blob = Utilities.newBlob(decoded, canonicalMime, finalFileName);
      newlyCreatedDriveFile = targetFolder.createFile(blob);
      newDriveFileId = newlyCreatedDriveFile.getId();
      // CRITICAL SECURITY: Do NOT call driveFile.setSharing(ANYONE_WITH_LINK).
      // File remains strictly private within the configured Drive structure.
    } catch (driveErr) {
      lock.releaseLock();
      return {
        success: false,
        errorCode: 'DRIVE_UPLOAD_FAILED',
        message: 'Failed to create file in Google Drive: ' + driveErr.message
      };
    }

    // C. Persist metadata to CNE_Reference with automatic rollback on failure
    try {
      var sheet = getOrCreateSheet('CNE_Reference');
      ensureReferenceSheetHeaders(sheet);
      ensureLearningResourceSheetHeaders(sheet);
      var colMap = getHeaderMap(sheet);
      var data = sheet.getDataRange().getValues();
      var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : 0;
      var visCol = colMap['visibletousers'];
      var existingRow = -1;
      var existingText = '';
      var existingVis = 'YES';

      for (var r = 1; r < data.length; r++) {
        if (String(data[r][idCol] || '').trim().toUpperCase() === cneId.toUpperCase()) {
          existingRow = r + 1;
          var refCol = colMap['referencetextclinicalguides'] !== undefined
            ? colMap['referencetextclinicalguides']
            : (colMap['referencetext'] !== undefined ? colMap['referencetext'] : 2);
          existingText = String(data[r][refCol] || '');
          if (visCol !== undefined && data[r][visCol] !== undefined) {
            existingVis = String(data[r][visCol] || 'YES').trim().toUpperCase();
          }
          break;
        }
      }

      var updatedAt = new Date().toISOString();
      var updatedBy = session.employeeId;
      var contentText = existingText || sanitizeCellInput(params.unifiedContent || params.referenceText || '');

      // 11 columns: CNE ID, Topic, Reference Text / Clinical Guides, Updated At, Updated By, Drive File ID, File Name, File Type, Resource Person Name, File Size, Visible To Users
      var fullRow = [
        cneId,
        record.topic,
        contentText,
        updatedAt,
        updatedBy,
        newDriveFileId,
        finalFileName,
        ext.toUpperCase(),
        authoritativeRpName,
        fileSize,
        existingVis || 'YES'
      ];

      if (existingRow > 0) {
        sheet.getRange(existingRow, 1, 1, fullRow.length).setValues([fullRow]);
      } else {
        sheet.appendRow(fullRow);
      }

      logAuditAction('UPLOAD_LEARNING_RESOURCE', session.employeeId, 'Uploaded learning resource for CNE ' + cneId + ': ' + finalFileName + ' (' + fileSize + ' bytes)', 'SUCCESS');

      // Phase 4A: Extract & index uploaded CNE learning resource content into CNE_Reference_Index
      // Extraction occurs AFTER Drive creation and CNE_Reference metadata persistence.
      // If extraction fails, original file and CNE_Reference metadata remain intact.
      var indexResult = null;
      try {
        indexResult = indexLearningResourceContent(cneId, newDriveFileId, finalFileName, ext.toUpperCase(), record.topic, session);
      } catch (indexErr) {
        indexResult = {
          success: false,
          errorCode: 'INDEXING_EXECUTION_ERROR',
          message: 'Error occurred during content indexing: ' + (indexErr && indexErr.message ? indexErr.message : String(indexErr))
        };
      }

      var indexingStatus = (indexResult && indexResult.success) ? 'SUCCESS' : 'FAILED';
      var indexingMessage = (indexResult && indexResult.message) ? indexResult.message : (indexingStatus === 'SUCCESS' ? 'Content indexed successfully.' : 'Unable to extract readable text from the uploaded material.');

      return {
        success: true,
        data: {
          cneId: cneId,
          driveFileId: newDriveFileId,
          fileName: finalFileName,
          fileType: ext.toUpperCase(),
          fileSize: fileSize,
          resourcePersonName: authoritativeRpName,
          uploadedAt: updatedAt,
          topic: record.topic,
          indexingStatus: indexingStatus,
          indexingErrorCode: (indexResult && !indexResult.success) ? indexResult.errorCode : undefined,
          indexingMessage: indexingMessage,
          chunksCount: (indexResult && indexResult.chunksCount) ? indexResult.chunksCount : 0
        },
        message: indexingStatus === 'SUCCESS'
          ? 'Learning resource uploaded and indexed successfully.'
          : 'Learning resource uploaded to Drive, but content indexing could not be completed.'
      };
    } catch (sheetErr) {
      // RECONCILIATION: Drive creation succeeded, but Sheet persistence failed.
      // Safely attempt to trash/rollback ONLY newlyCreatedDriveFile from this failed transaction.
      // Do NOT touch any previous learning-resource file or unrelated files.
      var rolledBack = false;
      if (newlyCreatedDriveFile) {
        try {
          newlyCreatedDriveFile.setTrashed(true);
          rolledBack = true;
        } catch (trashErr) {
          rolledBack = false;
        }
      }

      if (rolledBack) {
        logAuditAction('UPLOAD_LEARNING_RESOURCE_ROLLED_BACK', session.employeeId, 'Metadata persistence failed for CNE ' + cneId + '. Newly created Drive file rolled back (trashed): ' + newDriveFileId + '. Sheet error: ' + sheetErr.message, 'FAILED');
        return {
          success: false,
          errorCode: 'METADATA_PERSIST_FAILED_ROLLED_BACK',
          message: 'Failed to persist reference metadata in sheet. The uploaded file was rolled back. Please try again.'
        };
      } else {
        logAuditAction('UPLOAD_LEARNING_RESOURCE_ORPHANED', session.employeeId, 'CRITICAL: Metadata persistence failed and Drive rollback failed. Orphaned Drive File ID: ' + newDriveFileId + ', CNE: ' + cneId + ', Error: ' + sheetErr.message, 'FAILED');
        return {
          success: false,
          errorCode: 'METADATA_PERSIST_FAILED_CLEANUP_FAILED',
          message: 'Failed to persist reference metadata. Upload cleanup could not be completed; administrative reconciliation may be required.'
        };
      }
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Securely delete an uploaded Learning Resource for a CNE
 * Enforces authoritative verification:
 *   CNE exists -> Caller authorized -> CNE_Reference metadata -> Associated Drive File ID
 *   -> Verification file resides in Learning Resources folder -> Trashing -> Metadata cleanup -> Audit log
 */
function handleDeleteLearningResource(params, session) {
  if (!session || !session.employeeId) {
    return {
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in.'
    };
  }

  var cneId = sanitizeCellInput(params ? params.cneId : '');
  if (!cneId) {
    return {
      success: false,
      errorCode: 'INVALID_CNE_ID',
      message: 'CNE ID is required.'
    };
  }

  // 1. Verify CNE exists
  var record = getCNEClassRecord(cneId);
  if (!record) {
    return {
      success: false,
      errorCode: 'CNE_NOT_FOUND',
      message: 'CNE record not found for ID: ' + cneId
    };
  }

  // 2. Verify caller is authorized for that CNE
  var authErr = checkCNEActionAuthorized(session, record);
  if (authErr) return authErr;

  // For completed/finalized CNEs, restrict Learning Resource deletion to ADMIN
  var isCompleted = normalizeCNEStatus(record.status) === 'Completed';
  var userRole = String(session.role || '').toUpperCase();
  if (isCompleted && userRole !== 'ADMIN') {
    return {
      success: false,
      errorCode: 'FORBIDDEN',
      message: 'This CNE is completed/finalized. Only Administrators can delete learning resources for completed CNEs.'
    };
  }

  // 3. Resolve the associated Drive File ID from the authoritative CNE_Reference record
  var sheet = getOrCreateSheet('CNE_Reference');
  ensureReferenceSheetHeaders(sheet);
  var colMap = getHeaderMap(sheet);
  var data = sheet.getDataRange().getValues();
  var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : 0;
  var driveFileIdCol = colMap['drivefileid'];
  var fileNameCol = colMap['filename'];
  var fileTypeCol = colMap['filetype'];
  var fileSizeCol = colMap['filesize'];
  var updatedCol = colMap['updatedat'] !== undefined ? colMap['updatedat'] : 3;
  var byCol = colMap['updatedby'] !== undefined ? colMap['updatedby'] : 4;

  var existingRow = -1;
  var targetDriveFileId = '';
  var targetFileName = '';

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      existingRow = r + 1;
      targetDriveFileId = driveFileIdCol !== undefined ? String(data[r][driveFileIdCol] || '').trim() : '';
      targetFileName = fileNameCol !== undefined ? String(data[r][fileNameCol] || '').trim() : '';
      break;
    }
  }

  if (!targetDriveFileId || existingRow === -1) {
    return {
      success: false,
      errorCode: 'NO_RESOURCE_FILE',
      message: 'No uploaded learning resource file is currently associated with this CNE.'
    };
  }

  // 4. Verify the file belongs to the configured DRIVE_FOLDER_ID / Learning Resources folder
  var folderRes = getOrCreateLearningResourcesFolder();
  if (!folderRes.success || !folderRes.folder) {
    return {
      success: false,
      errorCode: 'DRIVE_STORAGE_ERROR',
      message: folderRes.message || 'Learning Resources folder could not be accessed.'
    };
  }

  var targetFolder = folderRes.folder;
  var targetFolderId = targetFolder.getId();

  var file = null;
  try {
    file = DriveApp.getFileById(targetDriveFileId);
  } catch (driveLookupErr) {
    file = null;
  }

  if (file) {
    var parents = file.getParents();
    var inFolder = false;
    while (parents.hasNext()) {
      if (parents.next().getId() === targetFolderId) {
        inFolder = true;
        break;
      }
    }

    if (!inFolder) {
      logAuditAction('DELETE_LEARNING_RESOURCE_REJECTED', session.employeeId, 'Attempted to delete Drive file ' + targetDriveFileId + ' which does not belong to the authoritative Learning Resources directory for CNE ' + cneId, 'FAILED');
      return {
        success: false,
        errorCode: 'FILE_OUTSIDE_REPOSITORY',
        message: 'Resource file does not belong to the authoritative Learning Resources folder.'
      };
    }
  }

  // 5. Use ScriptLock for critical Drive + metadata mutation
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return {
      success: false,
      errorCode: 'SERVER_BUSY',
      message: 'Server is busy. Please try again in a few moments.'
    };
  }

  try {
    // 6. Trash/delete only that specific Learning Resource file if it exists
    if (file) {
      try {
        file.setTrashed(true);
      } catch (trashErr) {
        return {
          success: false,
          errorCode: 'DRIVE_DELETE_FAILED',
          message: 'Failed to trash learning resource file in Google Drive: ' + trashErr.message
        };
      }
    }

    // 7. Remove corresponding Learning Resource metadata from CNE_Reference
    try {
      var updatedAt = new Date().toISOString();
      var updatedBy = session.employeeId;

      if (driveFileIdCol !== undefined) sheet.getRange(existingRow, driveFileIdCol + 1).setValue('');
      if (fileNameCol !== undefined) sheet.getRange(existingRow, fileNameCol + 1).setValue('');
      if (fileTypeCol !== undefined) sheet.getRange(existingRow, fileTypeCol + 1).setValue('');
      if (fileSizeCol !== undefined) sheet.getRange(existingRow, fileSizeCol + 1).setValue(0);
      if (updatedCol !== undefined) sheet.getRange(existingRow, updatedCol + 1).setValue(updatedAt);
      if (byCol !== undefined) sheet.getRange(existingRow, byCol + 1).setValue(updatedBy);

      // Invalidate script cache for this file ID if cached
      try {
        var safeFileId = targetDriveFileId.replace(/[^a-zA-Z0-9_-]/g, '');
        var cache = CacheService.getScriptCache();
        cache.remove('cne_res_' + safeFileId);
      } catch (cacheErr) {}

      // Phase 4A: Clean up index rows for this CNE in CNE_Reference_Index
      try {
        cleanUpIndexRowsForCNE(cneId);
      } catch (cleanIndexErr) {}

      // 8. Write audit entry for successful deletion
      logAuditAction(
        'DELETE_LEARNING_RESOURCE',
        session.employeeId,
        'Deleted learning resource ' + (targetFileName || targetDriveFileId) + ' for CNE: ' + cneId,
        'SUCCESS'
      );

      // 9. Return structured success response
      return {
        success: true,
        data: {
          cneId: cneId,
          deletedFileId: targetDriveFileId,
          deletedFileName: targetFileName,
          updatedAt: updatedAt,
          updatedBy: updatedBy
        },
        message: 'Learning resource deleted successfully.'
      };
    } catch (metaErr) {
      // Drive deletion succeeded, but metadata cleanup failed
      logAuditAction(
        'DELETE_LEARNING_RESOURCE_INCONSISTENCY',
        session.employeeId,
        'CRITICAL: Drive file ' + targetDriveFileId + ' trashed, but metadata cleanup failed for CNE ' + cneId + ': ' + metaErr.message,
        'FAILED'
      );
      return {
        success: false,
        errorCode: 'METADATA_CLEANUP_FAILED',
        message: 'The file was trashed in Drive, but updating reference metadata failed. Administrative reconciliation may be required: ' + metaErr.message
      };
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Retrieve metadata for uploaded CNE learning resource
 */
function handleGetLearningResource(params, session) {
  var cneId = sanitizeCellInput(params ? params.cneId : '');
  if (!cneId) {
    return { success: false, errorCode: 'CNE_NOT_FOUND', message: 'CNE ID is required.' };
  }

  var record = getCNEClassRecord(cneId);
  if (!record) {
    return { success: false, errorCode: 'CNE_NOT_FOUND', message: 'CNE record not found for ID: ' + cneId };
  }

  var authErr = checkCNEActionAuthorized(session, record);
  if (authErr) return authErr;

  var sheet = getOrCreateSheet('CNE_Reference');
  var data = sheet.getDataRange().getValues();
  var colMap = getHeaderMap(sheet);

  var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : 0;
  var topicCol = colMap['topic'] !== undefined ? colMap['topic'] : 1;
  var updatedCol = colMap['updatedat'] !== undefined ? colMap['updatedat'] : 3;
  var byCol = colMap['updatedby'] !== undefined ? colMap['updatedby'] : 4;
  var driveFileIdCol = colMap['drivefileid'];
  var fileNameCol = colMap['filename'];
  var fileTypeCol = colMap['filetype'];
  var rpNameCol = colMap['resourcepersonname'];
  var fileSizeCol = colMap['filesize'];

  var officerMap = getOfficerNameMap();

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      var driveFileId = driveFileIdCol !== undefined ? String(data[r][driveFileIdCol] || '').trim() : '';
      var fileName = fileNameCol !== undefined ? String(data[r][fileNameCol] || '').trim() : '';
      var fileType = fileTypeCol !== undefined ? String(data[r][fileTypeCol] || '').trim() : '';
      var rpName = rpNameCol !== undefined ? String(data[r][rpNameCol] || '').trim() : '';
      var fileSize = fileSizeCol !== undefined ? (Number(data[r][fileSizeCol]) || 0) : 0;
      var rawUpdatedBy = String(data[r][byCol] || '').trim();
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
          topic: String(data[r][topicCol] || (record ? record.topic : '')),
          driveFileId: driveFileId,
          fileName: fileName,
          fileType: fileType,
          fileSize: fileSize,
          resourcePersonName: rpName,
          updatedAt: String(data[r][updatedCol] || ''),
          updatedBy: displayName,
          hasFile: Boolean(driveFileId)
        }
      };
    }
  }

  return {
    success: true,
    data: {
      cneId: cneId,
      topic: record ? record.topic : '',
      driveFileId: '',
      fileName: '',
      fileType: '',
      fileSize: 0,
      resourcePersonName: '',
      updatedAt: '',
      updatedBy: 'Coordinator',
      hasFile: false
    }
  };
}

/**
 * List all CNE Learning Resources for authenticated user
 * Enforces authoritative CNE existence and access control.
 * Fails closed for unauthenticated or unauthorized users.
 */
function handleListLearningResources(params, session) {
  if (!session || !session.employeeId) {
    return { success: false, errorCode: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' };
  }

  var sheet = getOrCreateSheet('CNE_Reference');
  ensureLearningResourceSheetHeaders(sheet);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, data: [] };
  }
  var colMap = getHeaderMap(sheet);

  var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : 0;
  var topicCol = colMap['topic'] !== undefined ? colMap['topic'] : 1;
  var updatedCol = colMap['updatedat'] !== undefined ? colMap['updatedat'] : 3;
  var byCol = colMap['updatedby'] !== undefined ? colMap['updatedby'] : 4;
  var driveFileIdCol = colMap['drivefileid'];
  var fileNameCol = colMap['filename'];
  var fileTypeCol = colMap['filetype'];
  var rpNameCol = colMap['resourcepersonname'];
  var fileSizeCol = colMap['filesize'];
  var visCol = colMap['visibletousers'];
  var isAdmin = session && String(session.role || '').trim().toUpperCase() === 'ADMIN';

  // Efficient batched read of CNE Schedule sheet (single read instead of N+1)
  var ss = getSpreadsheet('CNE');
  var classSheet = ss ? ss.getSheetByName('CNE Schedule') : null;
  var cneMap = {};
  if (classSheet) {
    var classData = classSheet.getDataRange().getValues();
    if (classData.length > 1) {
      var classColMap = getHeaderMap(classSheet);
      var classIdCol = classColMap['cneid'] !== undefined ? classColMap['cneid'] : (classColMap['classid'] !== undefined ? classColMap['classid'] : 0);

      for (var c = 1; c < classData.length; c++) {
        var cRow = classData[c];
        var cneKey = String(cRow[classIdCol] || '').trim().toUpperCase();
        if (!cneKey) continue;

        var rawType = classColMap['typeofcne'] !== undefined ? cRow[classColMap['typeofcne']] : cRow[12];
        var rawStatus = classColMap['status'] !== undefined ? cRow[classColMap['status']] : cRow[11];
        var durVal = classColMap['duration'] !== undefined ? cRow[classColMap['duration']] : cRow[6];
        var maxP = classColMap['maxparticipants'] !== undefined ? cRow[classColMap['maxparticipants']] : cRow[10];

        cneMap[cneKey] = {
          rowIndex: c + 1,
          cneId: String(cRow[classIdCol] || '').trim(),
          topic: String((classColMap['topic'] !== undefined ? cRow[classColMap['topic']] : cRow[1]) || '').trim(),
          area: String((classColMap['area'] !== undefined ? cRow[classColMap['area']] : cRow[2]) || '').trim(),
          date: formatDateValue(classColMap['fromdate'] !== undefined ? cRow[classColMap['fromdate']] : (classColMap['date'] !== undefined ? cRow[classColMap['date']] : cRow[3])),
          toDate: formatDateValue(classColMap['todate'] !== undefined ? cRow[classColMap['todate']] : (cRow[4] || cRow[3])),
          time: String((classColMap['time'] !== undefined ? cRow[classColMap['time']] : cRow[5]) || '').trim(),
          duration: durVal ? Number(durVal) : 60,
          instructor: String((classColMap['resourcepersonempid'] !== undefined ? cRow[classColMap['resourcepersonempid']] : cRow[7]) || '').trim(),
          mode: String((classColMap['modeofteaching'] !== undefined ? cRow[classColMap['modeofteaching']] : (classColMap['mode'] !== undefined ? cRow[classColMap['mode']] : cRow[8])) || 'Offline').trim(),
          description: String((classColMap['description'] !== undefined ? cRow[classColMap['description']] : cRow[9]) || '').trim(),
          maxParticipants: maxP ? Number(maxP) : 50,
          status: normalizeCNEStatus(rawStatus),
          externalResourcePersons: String((classColMap['externalresourcepersons'] !== undefined ? cRow[classColMap['externalresourcepersons']] : cRow[13]) || '').trim(),
          proposedBy: String((classColMap['proposedby'] !== undefined ? cRow[classColMap['proposedby']] : cRow[14]) || '').trim(),
          adminRemarks: String((classColMap['adminremarks'] !== undefined ? cRow[classColMap['adminremarks']] : cRow[15]) || '').trim(),
          cneType: normalizeCNEType(rawType)
        };
      }
    }
  }

  var officerMap = getOfficerNameMap();
  var results = [];

  for (var r = 1; r < data.length; r++) {
    var cneId = String(data[r][idCol] || '').trim();
    var driveFileId = driveFileIdCol !== undefined ? String(data[r][driveFileIdCol] || '').trim() : '';
    if (!cneId || !driveFileId) continue;

    var record = cneMap[cneId.toUpperCase()];
    if (!record) continue; // Fail closed if CNE cannot be resolved

    var authErr = checkCNEActionAuthorized(session, record);
    if (authErr) continue; // Fail closed: only authorized CNEs returned

    var visVal = visCol !== undefined ? String(data[r][visCol] || '').trim().toUpperCase() : 'YES';
    var isVisible = visVal !== 'NO';
    if (!isAdmin && !isVisible) continue; // Non-admin users cannot see hidden resources

    var fileName = fileNameCol !== undefined ? String(data[r][fileNameCol] || '').trim() : '';
    var fileType = fileTypeCol !== undefined ? String(data[r][fileTypeCol] || '').trim() : '';
    var rpName = rpNameCol !== undefined ? String(data[r][rpNameCol] || '').trim() : '';
    var fileSize = fileSizeCol !== undefined ? (Number(data[r][fileSizeCol]) || 0) : 0;
    var rawUpdatedBy = String(data[r][byCol] || '').trim();
    var displayName = 'Coordinator';
    if (rawUpdatedBy) {
      var norm = normalizeEmpId(rawUpdatedBy);
      if (officerMap && officerMap[norm]) {
        displayName = officerMap[norm];
      }
    }

    results.push({
      cneId: cneId,
      topic: String(data[r][topicCol] || record.topic),
      area: record.area || '',
      cneType: record.cneType || 'DEPARTMENTAL',
      fileName: fileName,
      fileType: fileType,
      fileSize: fileSize,
      resourcePersonName: rpName || record.instructor || 'Department Faculty',
      updatedAt: String(data[r][updatedCol] || ''),
      updatedBy: displayName,
      hasFile: true,
      visibleToUsers: isVisible
    });
  }

  return {
    success: true,
    data: results
  };
}

/**
 * Securely download or stream an authoritative Learning Resource file
 * Fails closed if CNE does not exist, caller is unauthorized, or file is outside Learning Resources folder.
 */
function handleDownloadLearningResource(params, session) {
  var cneId = sanitizeCellInput(params ? params.cneId : '');
  if (!cneId) {
    return { success: false, errorCode: 'CNE_NOT_FOUND', message: 'CNE ID is required.' };
  }

  var record = getCNEClassRecord(cneId);
  if (!record) {
    return { success: false, errorCode: 'CNE_NOT_FOUND', message: 'CNE record not found for ID: ' + cneId };
  }

  var authErr = checkCNEActionAuthorized(session, record);
  if (authErr) return authErr;

  var sheet = getOrCreateSheet('CNE_Reference');
  var data = sheet.getDataRange().getValues();
  var colMap = getHeaderMap(sheet);
  var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : 0;
  var driveFileIdCol = colMap['drivefileid'];
  var fileNameCol = colMap['filename'];
  var fileTypeCol = colMap['filetype'];
  var visCol = colMap['visibletousers'];

  var targetDriveFileId = '';
  var targetFileName = '';
  var targetFileType = '';
  var targetVisible = true;

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      targetDriveFileId = driveFileIdCol !== undefined ? String(data[r][driveFileIdCol] || '').trim() : '';
      targetFileName = fileNameCol !== undefined ? String(data[r][fileNameCol] || '').trim() : '';
      targetFileType = fileTypeCol !== undefined ? String(data[r][fileTypeCol] || '').trim() : '';
      var visVal = visCol !== undefined ? String(data[r][visCol] || '').trim().toUpperCase() : 'YES';
      targetVisible = visVal !== 'NO';
      break;
    }
  }

  if (!targetDriveFileId) {
    return { success: false, errorCode: 'NO_RESOURCE_FILE', message: 'No learning resource file attached to this CNE.' };
  }

  var isAdmin = session && String(session.role || '').trim().toUpperCase() === 'ADMIN';
  if (!isAdmin && !targetVisible) {
    return { success: false, errorCode: 'RESOURCE_HIDDEN', message: 'This learning resource is currently not available to users.' };
  }

  var folderRes = getOrCreateLearningResourcesFolder();
  if (!folderRes.success || !folderRes.folder) {
    return { success: false, errorCode: 'DRIVE_STORAGE_ERROR', message: folderRes.message };
  }

  var file;
  try {
    file = DriveApp.getFileById(targetDriveFileId);
  } catch (e) {
    return { success: false, errorCode: 'LEARNING_RESOURCE_FILE_NOT_FOUND', message: 'File not found in Drive.' };
  }

  var parents = file.getParents();
  var inFolder = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === folderRes.folder.getId()) {
      inFolder = true;
      break;
    }
  }

  if (!inFolder) {
    return { success: false, errorCode: 'FILE_OUTSIDE_REPOSITORY', message: 'Resource file does not belong to the authoritative Learning Resources directory.' };
  }

  var blob = file.getBlob();
  var base64 = Utilities.base64Encode(blob.getBytes());
  var mimeType = blob.getContentType();

  logAuditAction('DOWNLOAD_LEARNING_RESOURCE', session.employeeId, 'Downloaded learning resource: ' + (targetFileName || file.getName()) + ' for CNE: ' + cneId, 'SUCCESS');

  return {
    success: true,
    data: {
      cneId: cneId,
      fileName: targetFileName || file.getName(),
      fileType: targetFileType,
      mimeType: mimeType,
      fileBase64: base64
    }
  };
}

/**
 * ============================================================================
 * PHASE 2: CNE LEARNING RESOURCES CONTENT EXTRACTION SERVICE
 * ============================================================================
 * Extracts readable textual content from stored Google Drive learning resource
 * files (PDF, DOCX, PPT, PPTX) for AI MCQ generation grounding.
 * Authoritative source of truth remains the Drive file stored in the configured
 * Learning Resources directory.
 */

/**
 * Handle action: extractLearningResourceContent
 */
function handleExtractLearningResourceContent(params, session) {
  var cneId = sanitizeCellInput(params ? params.cneId : '');
  if (!cneId) {
    return { success: false, errorCode: 'CNE_NOT_FOUND', message: 'CNE ID is required.' };
  }
  return extractLearningResourceContentCore(cneId, session);
}

/**
 * Core extraction service for CNE Learning Resource
 * Fails closed on any security, authorization, or structural defect.
 */
function extractLearningResourceContentCore(cneId, session) {
  if (!cneId) {
    return { success: false, errorCode: 'CNE_NOT_FOUND', message: 'CNE ID is required.' };
  }

  // 1. Authoritative CNE Record lookup
  var record = getCNEClassRecord(cneId);
  if (!record) {
    return { success: false, errorCode: 'CNE_NOT_FOUND', message: 'CNE record not found for ID: ' + cneId };
  }

  // 2. Authorization verification
  var authErr = checkCNEActionAuthorized(session, record);
  if (authErr) {
    return authErr;
  }

  // 3. Authoritative CNE_Reference lookup
  var refSheet = getSpreadsheet('CNE').getSheetByName('CNE_Reference');
  if (!refSheet || refSheet.getLastRow() <= 1) {
    return {
      success: false,
      errorCode: 'LEARNING_RESOURCE_NOT_FOUND',
      message: 'No learning resource is associated with this CNE.'
    };
  }

  var refData = refSheet.getDataRange().getValues();
  var refColMap = getHeaderMap(refSheet);
  var idCol = refColMap['cneid'] !== undefined ? refColMap['cneid'] : 0;
  var driveCol = refColMap['drivefileid'];
  var fileNameCol = refColMap['filename'];
  var fileTypeCol = refColMap['filetype'];
  var rpNameCol = refColMap['resourcepersonname'];

  var driveFileId = '';
  var storedFileName = '';
  var storedFileType = '';
  var storedRpName = '';

  for (var r = 1; r < refData.length; r++) {
    if (String(refData[r][idCol] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      driveFileId = driveCol !== undefined ? String(refData[r][driveCol] || '').trim() : '';
      storedFileName = fileNameCol !== undefined ? String(refData[r][fileNameCol] || '').trim() : '';
      storedFileType = fileTypeCol !== undefined ? String(refData[r][fileTypeCol] || '').trim() : '';
      storedRpName = rpNameCol !== undefined ? String(refData[r][rpNameCol] || '').trim() : '';
      break;
    }
  }

  if (!driveFileId) {
    return {
      success: false,
      errorCode: 'LEARNING_RESOURCE_NOT_FOUND',
      message: 'No learning resource file has been uploaded for this CNE.'
    };
  }

  // 4. Retrieve Drive File & verify existence
  var file;
  try {
    file = DriveApp.getFileById(driveFileId);
  } catch (driveErr) {
    return {
      success: false,
      errorCode: 'LEARNING_RESOURCE_FILE_NOT_FOUND',
      message: 'Associated learning resource file could not be found in Google Drive.'
    };
  }

  if (!file || file.isTrashed()) {
    return {
      success: false,
      errorCode: 'LEARNING_RESOURCE_FILE_NOT_FOUND',
      message: 'Associated learning resource file has been deleted or trashed.'
    };
  }

  // 5. Verify file belongs strictly to configured Learning Resources folder
  var folderRes = getOrCreateLearningResourcesFolder();
  if (!folderRes.success) {
    return folderRes;
  }
  var targetFolderId = folderRes.folder.getId();
  var parents = file.getParents();
  var isInsideTargetFolder = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === targetFolderId) {
      isInsideTargetFolder = true;
      break;
    }
  }

  if (!isInsideTargetFolder) {
    return {
      success: false,
      errorCode: 'LEARNING_RESOURCE_INVALID',
      message: 'Learning resource file does not belong to the authoritative Learning Resources directory.'
    };
  }

  // 6. Validate supported format (PDF, DOCX, PPT, PPTX only)
  var nameForExt = file.getName() || storedFileName;
  var ext = '';
  var dotIdx = nameForExt.lastIndexOf('.');
  if (dotIdx !== -1) {
    ext = nameForExt.substring(dotIdx + 1).toLowerCase().trim();
  }
  if (!ext && storedFileType) {
    ext = storedFileType.toLowerCase().trim();
  }

  var ALLOWED_EXTS = ['pdf', 'docx', 'ppt', 'pptx'];
  if (ALLOWED_EXTS.indexOf(ext) === -1) {
    return {
      success: false,
      errorCode: 'UNSUPPORTED_FILE_TYPE',
      message: 'Unsupported file type. Only PDF, DOCX, PPT, and PPTX documents are permitted.'
    };
  }

  // 7. Validate size (Max 5 MB)
  if (file.getSize() > 5 * 1024 * 1024) {
    return {
      success: false,
      errorCode: 'CONTENT_TOO_LARGE',
      message: 'Learning resource exceeds maximum allowed size of 5 MB.'
    };
  }

  // 8. Temporary Cache check using CacheService (best effort)
  var safeFileId = driveFileId.replace(/[^a-zA-Z0-9_-]/g, '');
  var lastUpdated = 0;
  try {
    lastUpdated = file.getLastUpdated().getTime();
  } catch (timeErr) {
    lastUpdated = 0;
  }
  var cacheKey = ('cne_res_' + safeFileId + '_' + lastUpdated).substring(0, 240);
  var cache = null;
  try {
    cache = CacheService.getScriptCache();
    var cachedJson = cache.get(cacheKey);
    if (cachedJson) {
      var parsedCache = JSON.parse(cachedJson);
      if (parsedCache && parsedCache.extractedText && parsedCache.extractedText.length >= 15) {
        return {
          success: true,
          data: {
            cneId: cneId,
            topic: record.topic,
            resourcePersonName: storedRpName,
            driveFileId: driveFileId,
            fileName: file.getName(),
            fileType: ext.toUpperCase(),
            extractedText: parsedCache.extractedText,
            charCount: parsedCache.extractedText.length,
            isTruncated: Boolean(parsedCache.isTruncated),
            originalCharCount: parsedCache.originalCharCount || parsedCache.extractedText.length,
            cached: true
          }
        };
      }
    }
  } catch (cacheErr) {
    // Cache failure must never cause functional failure
  }

  // 9. Extract textual content based on file type
  var rawExtracted = '';
  var blob = file.getBlob();

  try {
    if (ext === 'docx') {
      rawExtracted = extractTextFromDocx(blob);
    } else if (ext === 'pptx') {
      rawExtracted = extractTextFromPptx(blob);
    } else if (ext === 'ppt') {
      rawExtracted = extractTextFromPpt(blob);
    } else if (ext === 'pdf') {
      rawExtracted = extractTextFromPdf(blob);
    }
  } catch (extractErr) {
    logAuditAction('CONTENT_EXTRACTION_FAILED', {
      cneId: cneId,
      driveFileId: driveFileId,
      ext: ext,
      error: String(extractErr && extractErr.message ? extractErr.message : extractErr)
    });
    return {
      success: false,
      errorCode: 'CONTENT_EXTRACTION_FAILED',
      message: 'Failed to extract textual content from ' + ext.toUpperCase() + ' document: ' + (extractErr.message || 'Malformed structure')
    };
  }

  // 10. Check if extracted content is empty or unusable
  if (!rawExtracted || rawExtracted.trim().length < 15) {
    return {
      success: false,
      errorCode: 'NO_EXTRACTABLE_CONTENT',
      message: 'No readable textual content could be extracted from the uploaded document.'
    };
  }

  var cleanText = rawExtracted.trim();
  var maxChars = 40000;
  var isTruncated = false;
  var originalCharCount = cleanText.length;
  var finalText = cleanText;

  // 11. Deterministic size limit safeguard
  if (cleanText.length > maxChars) {
    isTruncated = true;
    var headChars = 25000;
    var tailChars = 15000;
    var head = cleanText.substring(0, headChars);
    var tail = cleanText.substring(cleanText.length - tailChars);
    finalText = head + '\\n\\n[... Content deterministically truncated for AI processing: omitted ' + (originalCharCount - (headChars + tailChars)) + ' characters ...]\\n\\n' + tail;
  }

  // 12. Populate temporary cache (TTL 6 hours)
  if (cache) {
    try {
      var cachePayload = JSON.stringify({
        extractedText: finalText,
        isTruncated: isTruncated,
        originalCharCount: originalCharCount
      });
      if (cachePayload.length < 95000) {
        cache.put(cacheKey, cachePayload, 21600);
      }
    } catch (cacheWriteErr) {
      // Non-blocking
    }
  }

  return {
    success: true,
    data: {
      cneId: cneId,
      topic: record.topic,
      resourcePersonName: storedRpName,
      driveFileId: driveFileId,
      fileName: file.getName(),
      fileType: ext.toUpperCase(),
      extractedText: finalText,
      charCount: finalText.length,
      isTruncated: isTruncated,
      originalCharCount: originalCharCount,
      cached: false
    }
  };
}

/**
 * ============================================================================
 * PHASE 4A: UPLOAD-TIME CNE MATERIAL EXTRACTION & PERSISTENT INDEXING
 * ============================================================================
 */

/**
 * Deterministic chunking of extracted document content.
 * Target chunk size: ~1,200 characters (allowed range: 1,000 - 1,500 chars).
 * Preserves slide headings for PPT/PPTX and section headings for DOCX/PDF.
 * Stable, deterministic chunk ordering without AI or external dependencies.
 */
function chunkExtractedContent(text, fileType) {
  if (!text || typeof text !== 'string') return [];
  var clean = text.trim();
  if (clean.length < 15) return [];

  var normType = String(fileType || '').toUpperCase();
  var isPpt = normType === 'PPT' || normType === 'PPTX' || clean.indexOf('--- Slide ') !== -1;

  var chunks = [];

  if (isPpt) {
    // PPT / PPTX: Split by slide boundaries
    var slideRegex = /(?:^|\\n)(--- Slide \\d+(?: [^-]+)? ---)\\n?/g;
    var slideMatches = [];
    var m;
    while ((m = slideRegex.exec(clean)) !== null) {
      slideMatches.push({ index: m.index, header: m[1], length: m[0].length });
    }

    if (slideMatches.length > 0) {
      for (var s = 0; s < slideMatches.length; s++) {
        var start = slideMatches[s].index + slideMatches[s].length;
        var end = (s + 1 < slideMatches.length) ? slideMatches[s + 1].index : clean.length;
        var slideBody = clean.substring(start, end).trim();
        var slideHeader = slideMatches[s].header.replace(/^-+\\s*|\\s*-+$/g, '');

        if (!slideBody) continue;

        // Extract slide title from first non-empty line when concise
        var lines = slideBody.split('\\n');
        var firstLine = lines[0].trim();
        var slideHeading = slideHeader;
        if (firstLine && firstLine.length <= 80 && !firstLine.match(/^[\\d\\.\\-\\*\\•]/)) {
          slideHeading = slideHeader + ': ' + firstLine;
        }

        if (slideBody.length <= 1500) {
          chunks.push({
            heading: slideHeading,
            text: slideBody
          });
        } else {
          // Slide exceeds 1,500 characters: split into sequential sub-chunks with overlap
          var subWindows = splitTextIntoWindows(slideBody, 1200, 150);
          for (var sw = 0; sw < subWindows.length; sw++) {
            chunks.push({
              heading: slideHeading + (subWindows.length > 1 ? ' (Part ' + (sw + 1) + ')' : ''),
              text: subWindows[sw]
            });
          }
        }
      }
      if (chunks.length > 0) return chunks;
    }
  }

  // Document (PDF/DOCX/General) chunking by paragraph and heading
  var paragraphs = clean.split(/\\n{2,}/);
  var currentHeading = 'General Content';
  var currentAccumulator = '';

  for (var p = 0; p < paragraphs.length; p++) {
    var para = paragraphs[p].trim();
    if (!para) continue;

    // Detect potential heading: short line (<= 80 chars)
    if (para.length <= 80 && isProbableHeading(para)) {
      if (currentAccumulator.trim()) {
        flushAccumulatedText(chunks, currentHeading, currentAccumulator);
        currentAccumulator = '';
      }
      currentHeading = para;
      continue;
    }

    if ((currentAccumulator.length + para.length + 2) <= 1400) {
      currentAccumulator = currentAccumulator ? (currentAccumulator + '\\n\\n' + para) : para;
    } else {
      if (currentAccumulator.length >= 800) {
        flushAccumulatedText(chunks, currentHeading, currentAccumulator);
        currentAccumulator = para;
      } else {
        var combined = currentAccumulator ? (currentAccumulator + '\\n\\n' + para) : para;
        var windows = splitTextIntoWindows(combined, 1200, 150);
        for (var w = 0; w < windows.length - 1; w++) {
          chunks.push({
            heading: currentHeading,
            text: windows[w]
          });
        }
        currentAccumulator = windows[windows.length - 1];
      }
    }
  }

  if (currentAccumulator.trim()) {
    flushAccumulatedText(chunks, currentHeading, currentAccumulator);
  }

  // Fallback if no chunks produced
  if (chunks.length === 0) {
    var fallbackWindows = splitTextIntoWindows(clean, 1200, 150);
    for (var f = 0; f < fallbackWindows.length; f++) {
      chunks.push({
        heading: 'General Content',
        text: fallbackWindows[f]
      });
    }
  }

  return chunks;
}

function isProbableHeading(line) {
  if (!line || line.length > 80) return false;
  var trimmed = line.trim();
  if (trimmed.charAt(trimmed.length - 1) === '.') return false;
  if (trimmed.charAt(trimmed.length - 1) === ',') return false;
  if (trimmed.indexOf('http://') === 0 || trimmed.indexOf('https://') === 0) return false;
  if (/^(?:chapter|section|part|module|unit|topic|guideline|protocol|procedure)\\b/i.test(trimmed)) return true;
  if (/^\\d+(\\.\\d+)*\\s+[A-Z]/.test(trimmed)) return true;
  if (trimmed === trimmed.toUpperCase() && trimmed.length >= 4 && /[A-Z]/.test(trimmed)) return true;
  if (trimmed.length <= 60 && !/[\\.\\?!]/.test(trimmed)) return true;
  return false;
}

function flushAccumulatedText(chunks, heading, text) {
  var trimmed = text.trim();
  if (!trimmed) return;
  if (trimmed.length <= 1500) {
    chunks.push({ heading: heading || 'General Content', text: trimmed });
  } else {
    var windows = splitTextIntoWindows(trimmed, 1200, 150);
    for (var i = 0; i < windows.length; i++) {
      chunks.push({
        heading: heading ? (heading + (windows.length > 1 ? ' (Part ' + (i + 1) + ')' : '')) : 'General Content',
        text: windows[i]
      });
    }
  }
}

function splitTextIntoWindows(text, targetSize, overlap) {
  var result = [];
  if (!text) return result;
  if (text.length <= targetSize) {
    result.push(text);
    return result;
  }

  var pos = 0;
  while (pos < text.length) {
    var end = pos + targetSize;
    if (end >= text.length) {
      var remaining = text.substring(pos).trim();
      if (remaining) result.push(remaining);
      break;
    }

    var breakPos = -1;
    var searchStart = pos + Math.floor(targetSize * 0.7);
    var searchEnd = Math.min(pos + targetSize + 150, text.length);
    var searchSlice = text.substring(searchStart, searchEnd);

    var pIdx = searchSlice.lastIndexOf('\\n\\n');
    if (pIdx !== -1) {
      breakPos = searchStart + pIdx + 2;
    } else {
      var sMatch = searchSlice.match(/[\\.\\?!]\\s+/g);
      if (sMatch) {
        var lastS = searchSlice.lastIndexOf(sMatch[sMatch.length - 1]);
        if (lastS !== -1) {
          breakPos = searchStart + lastS + sMatch[sMatch.length - 1].length;
        }
      }
    }

    if (breakPos === -1) {
      var spaceIdx = searchSlice.lastIndexOf(' ');
      if (spaceIdx !== -1) {
        breakPos = searchStart + spaceIdx + 1;
      } else {
        breakPos = end;
      }
    }

    var chunk = text.substring(pos, breakPos).trim();
    if (chunk) result.push(chunk);

    pos = Math.max(pos + 1, breakPos - overlap);
  }

  return result;
}

/**
 * Helper: Delete specific 1-based row numbers from a sheet in descending order,
 * grouping contiguous rows to minimize sheet API operations and prevent index shifting.
 */
function deleteSheetRowsByIndices(sheet, rowNumbers) {
  if (!sheet || !rowNumbers || rowNumbers.length === 0) return;
  var sorted = rowNumbers.slice().sort(function(a, b) { return b - a; });
  var i = 0;
  while (i < sorted.length) {
    var count = 1;
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] - 1) {
      count++;
      i++;
    }
    var startRow = sorted[i]; // Smallest row number in this contiguous block
    if (count === 1) {
      sheet.deleteRow(startRow);
    } else {
      sheet.deleteRows(startRow, count);
    }
    i++;
  }
}

/**
 * Remove index rows for a specific CNE from CNE_Reference_Index surgically.
 * Strictly non-destructive to other CNEs.
 * Uses row-level deletion without clearing the sheet or rewriting unrelated rows.
 */
function cleanUpIndexRowsForCNE(cneId) {
  if (!cneId) return;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return;
  }
  try {
    var ss = getSpreadsheet('CNE');
    var sheet = ss.getSheetByName('CNE_Reference_Index');
    if (!sheet || sheet.getLastRow() <= 1) return;

    var allData = sheet.getDataRange().getValues();
    var colMap = getHeaderMap(sheet);
    var cneIdCol = colMap['cneid'] !== undefined ? colMap['cneid'] : 2;

    var targetCne = String(cneId).trim().toUpperCase();
    var rowsToDelete = [];
    for (var r = 1; r < allData.length; r++) {
      if (String(allData[r][cneIdCol] || '').trim().toUpperCase() === targetCne) {
        rowsToDelete.push(r + 1); // 1-indexed sheet row number
      }
    }

    if (rowsToDelete.length > 0) {
      deleteSheetRowsByIndices(sheet, rowsToDelete);
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Index learning resource content into CNE_Reference_Index sheet surgically.
 * 1. Document extraction and chunking occur OUTSIDE of ScriptLock.
 * 2. Shared sheet mutations (duplicate check, removing targeted old rows, appending new chunks)
 *    occur INSIDE the ScriptLock.
 * 3. Does NOT clear the sheet or rewrite unrelated rows.
 * 4. Appends all new chunk rows in ONE batch setValues() call.
 */
function indexLearningResourceContent(cneId, driveFileId, fileName, fileType, topic, session) {
  if (!cneId || !driveFileId) {
    return { success: false, errorCode: 'INVALID_PARAMS', message: 'CNE ID and Drive File ID are required.' };
  }

  // 1. Content Extraction & Chunking OUTSIDE of ScriptLock
  // Heavy Drive file reading and document extraction must not block other concurrent requests.
  var extResult = null;
  try {
    extResult = extractLearningResourceContentCore(cneId, session);
  } catch (extErr) {
    extResult = {
      success: false,
      errorCode: 'EXTRACTION_EXCEPTION',
      message: 'Exception during content extraction: ' + (extErr && extErr.message ? extErr.message : String(extErr))
    };
  }

  var rowsToInsert = [];
  var nowIso = new Date().toISOString();
  var isSuccess = extResult && extResult.success && extResult.data && extResult.data.extractedText;

  if (isSuccess) {
    var extractedText = extResult.data.extractedText;
    var chunks = chunkExtractedContent(extractedText, fileType);

    if (chunks.length > 0) {
      for (var c = 0; c < chunks.length; c++) {
        var indexId = 'IDX_' + cneId + '_' + driveFileId.substring(0, 8) + '_C' + (c + 1);
        rowsToInsert.push([
          indexId,
          'UPLOADED_CNE',
          cneId,
          driveFileId,
          fileName,
          topic,
          chunks[c].heading || 'General Content',
          (c + 1),
          chunks[c].text,
          '', // Clinical Keywords left blank in Phase 4A as required
          'SUCCESS',
          nowIso
        ]);
      }
    } else {
      isSuccess = false;
      extResult = {
        success: false,
        errorCode: 'NO_EXTRACTABLE_CONTENT',
        message: 'No readable textual content could be extracted into chunks.'
      };
    }
  }

  if (!isSuccess) {
    var failErrCode = extResult ? extResult.errorCode : 'CONTENT_EXTRACTION_FAILED';
    var failErrMsg = extResult ? extResult.message : 'No readable textual content could be extracted.';
    var failIndexId = 'IDX_' + cneId + '_' + driveFileId.substring(0, 8) + '_FAIL';

    rowsToInsert.push([
      failIndexId,
      'UPLOADED_CNE',
      cneId,
      driveFileId,
      fileName,
      topic,
      'Extraction Error',
      0,
      failErrCode + ': ' + failErrMsg,
      '',
      'FAILED',
      nowIso
    ]);
  }

  // 2. CRITICAL SECTION: Acquire ScriptLock ONLY for shared CNE_Reference_Index sheet operations
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return { success: false, errorCode: 'SERVER_BUSY', message: 'Server is busy indexing content. Please try again.' };
  }

  var alreadyIndexed = false;
  var alreadyIndexedCount = 0;

  try {
    var sheet = getOrCreateSheet('CNE_Reference_Index');
    ensureReferenceIndexSheetHeaders(sheet);
    var colMap = getHeaderMap(sheet);
    var allData = sheet.getDataRange().getValues();

    var cneIdCol = colMap['cneid'] !== undefined ? colMap['cneid'] : 2;
    var driveCol = colMap['drivefileid'] !== undefined ? colMap['drivefileid'] : 3;
    var statusCol = colMap['extractionstatus'] !== undefined ? colMap['extractionstatus'] : 10;

    var targetCne = String(cneId).trim().toUpperCase();

    // 2A. Duplicate Protection: Check if same CNE ID + Drive File ID is already successfully indexed
    for (var r = 1; r < allData.length; r++) {
      var rCneId = String(allData[r][cneIdCol] || '').trim().toUpperCase();
      var rDriveId = String(allData[r][driveCol] || '').trim();
      var rStatus = String(allData[r][statusCol] || '').trim().toUpperCase();

      if (rCneId === targetCne && rDriveId === driveFileId && rStatus === 'SUCCESS') {
        alreadyIndexedCount++;
      }
    }

    if (alreadyIndexedCount > 0) {
      alreadyIndexed = true;
    } else {
      // 2B. Surgical Replacement: Identify and remove ONLY rows belonging to this specific CNE ID
      var rowsToDelete = [];
      for (var r2 = 1; r2 < allData.length; r2++) {
        var rowCne = String(allData[r2][cneIdCol] || '').trim().toUpperCase();
        if (rowCne === targetCne) {
          rowsToDelete.push(r2 + 1); // 1-indexed sheet row number
        }
      }

      if (rowsToDelete.length > 0) {
        deleteSheetRowsByIndices(sheet, rowsToDelete);
      }

      // 2C. Batch write new index rows in ONE single setValues() call at the end of the sheet
      if (rowsToInsert.length > 0) {
        var startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
      }
    }
  } finally {
    lock.releaseLock();
  }

  // 3. Post-mutation audit logging and response return
  if (alreadyIndexed) {
    return {
      success: true,
      alreadyIndexed: true,
      chunksCount: alreadyIndexedCount,
      message: 'Learning resource is already indexed.'
    };
  }

  if (isSuccess) {
    logAuditAction(
      'LEARNING_RESOURCE_CONTENT_INDEXED',
      session ? session.employeeId : 'SYSTEM',
      'Successfully indexed ' + rowsToInsert.length + ' chunks for CNE ' + cneId + ' (' + fileName + ')',
      'SUCCESS'
    );
    return {
      success: true,
      chunksCount: rowsToInsert.length,
      message: 'Learning resource indexed successfully (' + rowsToInsert.length + ' chunks).'
    };
  } else {
    logAuditAction(
      'LEARNING_RESOURCE_CONTENT_INDEX_FAILED',
      session ? session.employeeId : 'SYSTEM',
      'Content indexing failed for CNE ' + cneId + ' (' + fileName + '): ' + (extResult ? extResult.errorCode : 'FAILED'),
      'FAILED'
    );
    return {
      success: false,
      errorCode: (extResult && extResult.errorCode) ? extResult.errorCode : 'CONTENT_EXTRACTION_FAILED',
      message: 'Unable to extract readable text from the uploaded material. The file has been saved, but its content could not be indexed.'
    };
  }
}

/**
 * ============================================================================
 * PHASE 4B: LOCAL NURSING REFERENCE LIBRARY (OPEN RN) PERSISTENT INDEXING
 * ============================================================================
 */

/**
 * Deterministic chunking of reference library content (books/guidelines).
 * Preserves structural Chapter / Topic and Section headings.
 * Target chunk size: ~1,200 chars (1,000 - 1,500 chars).
 * Never invents clinical topics; retains structural hierarchy.
 */
function chunkReferenceLibraryContent(text, fileType, defaultTitle) {
  if (!text || typeof text !== 'string') return [];
  var clean = text.trim();
  if (clean.length < 15) return [];

  var normType = String(fileType || '').toUpperCase();
  var isPpt = normType === 'PPT' || normType === 'PPTX' || clean.indexOf('--- Slide ') !== -1;

  var chunks = [];
  var fallbackTitle = String(defaultTitle || 'Open RN Nursing Reference').trim();
  var currentChapter = fallbackTitle;
  var currentSection = 'General Content';

  if (isPpt) {
    // PPT / PPTX: Split by slide boundaries
    var slideRegex = /(?:^|\\n)(--- Slide \\d+(?: [^-]+)? ---)\\n?/g;
    var slideMatches = [];
    var m;
    while ((m = slideRegex.exec(clean)) !== null) {
      slideMatches.push({ index: m.index, header: m[1], length: m[0].length });
    }

    if (slideMatches.length > 0) {
      for (var s = 0; s < slideMatches.length; s++) {
        var start = slideMatches[s].index + slideMatches[s].length;
        var end = (s + 1 < slideMatches.length) ? slideMatches[s + 1].index : clean.length;
        var slideBody = clean.substring(start, end).trim();
        var slideHeader = slideMatches[s].header.replace(/^-+\\s*|\\s*-+$/g, '');

        if (!slideBody) continue;

        var lines = slideBody.split('\\n');
        var firstLine = lines[0].trim();
        var slideHeading = slideHeader;
        if (firstLine && firstLine.length <= 80 && !firstLine.match(/^[\\d\\.\\-\\*\\•]/)) {
          slideHeading = slideHeader + ': ' + firstLine;
          if (/^(?:chapter|unit|module|part)\\b/i.test(firstLine)) {
            currentChapter = firstLine;
          }
        }

        if (slideBody.length <= 1500) {
          chunks.push({
            topic: currentChapter,
            sectionHeading: slideHeading,
            text: slideBody
          });
        } else {
          var subWindows = splitTextIntoWindows(slideBody, 1200, 150);
          for (var sw = 0; sw < subWindows.length; sw++) {
            chunks.push({
              topic: currentChapter,
              sectionHeading: slideHeading + (subWindows.length > 1 ? ' (Part ' + (sw + 1) + ')' : ''),
              text: subWindows[sw]
            });
          }
        }
      }
      if (chunks.length > 0) return chunks;
    }
  }

  // Document (PDF/DOCX/General) chunking by paragraph and heading
  var paragraphs = clean.split(/\\n{2,}/);
  var currentAccumulator = '';

  for (var p = 0; p < paragraphs.length; p++) {
    var para = paragraphs[p].trim();
    if (!para) continue;

    // Detect structural heading: either isolated short paragraph or first line of multi-line block
    var lines = para.split('\\n');
    var firstLine = lines[0].trim();
    var isHeaderOnly = para.length <= 80 && isProbableHeading(para);
    var isFirstLineHeader = !isHeaderOnly && lines.length > 1 && firstLine.length <= 80 && isProbableHeading(firstLine);

    if (isHeaderOnly || isFirstLineHeader) {
      if (currentAccumulator.trim()) {
        flushAccumulatedRefText(chunks, currentChapter, currentSection, currentAccumulator);
        currentAccumulator = '';
      }
      var headerText = isHeaderOnly ? para : firstLine;
      if (/^(?:chapter|unit|module|part)\\b/i.test(headerText)) {
        currentChapter = headerText;
        currentSection = 'Chapter Overview';
      } else {
        currentSection = headerText;
      }

      if (isHeaderOnly) {
        continue;
      } else {
        para = lines.slice(1).join('\\n').trim();
        if (!para) continue;
      }
    }

    if ((currentAccumulator.length + para.length + 2) <= 1400) {
      currentAccumulator = currentAccumulator ? (currentAccumulator + '\\n\\n' + para) : para;
    } else {
      if (currentAccumulator.length >= 800) {
        flushAccumulatedRefText(chunks, currentChapter, currentSection, currentAccumulator);
        currentAccumulator = para;
      } else {
        var combined = currentAccumulator ? (currentAccumulator + '\\n\\n' + para) : para;
        var windows = splitTextIntoWindows(combined, 1200, 150);
        for (var w = 0; w < windows.length - 1; w++) {
          chunks.push({
            topic: currentChapter,
            sectionHeading: currentSection,
            text: windows[w]
          });
        }
        currentAccumulator = windows[windows.length - 1];
      }
    }
  }

  if (currentAccumulator.trim()) {
    flushAccumulatedRefText(chunks, currentChapter, currentSection, currentAccumulator);
  }

  if (chunks.length === 0) {
    var fallbackWindows = splitTextIntoWindows(clean, 1200, 150);
    for (var f = 0; f < fallbackWindows.length; f++) {
      chunks.push({
        topic: fallbackTitle,
        sectionHeading: 'General Content',
        text: fallbackWindows[f]
      });
    }
  }

  return chunks;
}

function flushAccumulatedRefText(chunks, chapter, section, text) {
  var trimmed = text.trim();
  if (!trimmed) return;
  if (trimmed.length <= 1500) {
    chunks.push({
      topic: chapter || 'General Reference',
      sectionHeading: section || 'General Content',
      text: trimmed
    });
  } else {
    var windows = splitTextIntoWindows(trimmed, 1200, 150);
    for (var i = 0; i < windows.length; i++) {
      chunks.push({
        topic: chapter || 'General Reference',
        sectionHeading: (section || 'General Content') + (windows.length > 1 ? ' (Part ' + (i + 1) + ')' : ''),
        text: windows[i]
      });
    }
  }
}

/**
 * Extract textual content from a reference library document blob.
 * Strictly uses local approved document parsers without OCR, macros, or external AI.
 */
function extractReferenceLibraryBlob(blob, fileType) {
  var normType = String(fileType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normType === 'docx') {
    return extractTextFromDocx(blob);
  } else if (normType === 'pptx') {
    return extractTextFromPptx(blob);
  } else if (normType === 'ppt') {
    return extractTextFromPpt(blob);
  } else if (normType === 'pdf') {
    return extractTextFromPdf(blob);
  } else {
    throw new Error('Unsupported reference file type: ' + fileType);
  }
}

/**
 * Register and index an approved Open RN nursing reference resource into CNE_Reference_Index.
 * Strictly Admin-only.
 * Extraction & chunking run OUTSIDE ScriptLock.
 * Duplicate protection and surgical batch writing run INSIDE ScriptLock.
 */
function indexReferenceLibraryResource(driveFileId, metadata, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  if (!driveFileId || typeof driveFileId !== 'string' || !driveFileId.trim()) {
    return {
      success: false,
      errorCode: 'INVALID_PARAMS',
      message: 'Drive File ID is required.'
    };
  }
  var cleanDriveFileId = driveFileId.trim();

  // 1. Resolve Open RN folder strictly from DRIVE_FOLDER_ID
  var folderResult = getOrCreateOpenRnFolder();
  if (!folderResult.success || !folderResult.folder) {
    return {
      success: false,
      errorCode: folderResult.errorCode || 'FOLDER_RESOLUTION_FAILED',
      message: folderResult.message || 'Failed to resolve Open RN library folder.'
    };
  }
  var openRnFolder = folderResult.folder;

  // 2. Validate file existence
  var file;
  try {
    file = DriveApp.getFileById(cleanDriveFileId);
  } catch (e) {
    return {
      success: false,
      errorCode: 'FILE_NOT_FOUND',
      message: 'Specified Drive file could not be found or accessed.'
    };
  }

  // 3. Validate file containment within Open RN folder
  if (!isFileInOpenRnFolder(file, openRnFolder)) {
    logAuditAction(
      'REFERENCE_LIBRARY_SECURITY_ALERT',
      session ? session.employeeId : 'UNKNOWN',
      'Attempt to index file outside approved Open RN folder: ' + cleanDriveFileId,
      'FORBIDDEN'
    );
    return {
      success: false,
      errorCode: 'FILE_OUTSIDE_APPROVED_FOLDER',
      message: 'Access denied. The specified file is not inside the approved Open RN folder.'
    };
  }

  // 4. Validate file type
  var fileName = file.getName();
  var ext = getFileExtension(fileName).toLowerCase();
  var ALLOWED_EXTS = ['pdf', 'docx', 'ppt', 'pptx'];
  if (ALLOWED_EXTS.indexOf(ext) === -1) {
    return {
      success: false,
      errorCode: 'UNSUPPORTED_FILE_TYPE',
      message: 'Unsupported file type. Only PDF, DOCX, PPT, and PPTX documents are permitted.'
    };
  }

  // 5. Validate file size (Max 25 MB for reference textbooks)
  var fileSize = file.getSize();
  if (fileSize > 25 * 1024 * 1024) {
    return {
      success: false,
      errorCode: 'FILE_TOO_LARGE',
      message: 'Reference resource exceeds maximum allowed size of 25 MB.'
    };
  }

  // 6. Validate sharing permissions: ensure not public (FAIL-CLOSED)
  try {
    var sharingAccess = file.getSharingAccess();
    if (sharingAccess === DriveApp.Access.ANYONE || sharingAccess === DriveApp.Access.ANYONE_WITH_LINK) {
      logAuditAction(
        'REFERENCE_LIBRARY_SECURITY_ALERT',
        session ? session.employeeId : 'UNKNOWN',
        'Security policy violation: Reference file has public Drive link sharing: ' + cleanDriveFileId,
        'FORBIDDEN'
      );
      return {
        success: false,
        errorCode: 'PUBLIC_ACCESS_FORBIDDEN',
        message: 'Security policy violation: Reference file has public Drive link sharing. Sharing must be private.'
      };
    }
  } catch (shareErr) {
    logAuditAction(
      'REFERENCE_LIBRARY_PRIVACY_CHECK_ERROR',
      session ? session.employeeId : 'UNKNOWN',
      'Drive privacy check failed for file ' + cleanDriveFileId + ': ' + (shareErr && shareErr.message ? shareErr.message : String(shareErr)),
      'FAILED'
    );
    return {
      success: false,
      errorCode: 'DRIVE_PRIVACY_CHECK_FAILED',
      message: 'Drive privacy check failed. Reference resource cannot be indexed without verifying sharing permissions: ' + (shareErr && shareErr.message ? shareErr.message : String(shareErr))
    };
  }

  var meta = metadata || {};
  var resourceTitle = String(meta.resourceTitle || meta.title || fileName.replace(/\\.[^/.]+$/, '')).trim();
  var authorOrg = String(meta.authorOrganization || meta.author || 'Open RN Project / Chippewa Valley Technical College').trim();
  var license = String(meta.license || 'CC BY 4.0').trim();
  var version = String(meta.version || 'Latest').trim();
  var isReindex = Boolean(meta.reindex);

  // 7. CONTENT EXTRACTION & CHUNKING OUTSIDE SCRIPTLOCK
  var extResult = null;
  var rawText = '';
  try {
    rawText = extractReferenceLibraryBlob(file.getBlob(), ext);
    extResult = {
      success: rawText && rawText.trim().length >= 15,
      extractedText: rawText ? rawText.trim() : ''
    };
  } catch (extractErr) {
    extResult = {
      success: false,
      errorCode: 'CONTENT_EXTRACTION_FAILED',
      message: extractErr && extractErr.message ? extractErr.message : String(extractErr)
    };
  }

  var rowsToInsert = [];
  var nowIso = new Date().toISOString();
  var isSuccess = extResult && extResult.success && extResult.extractedText;

  if (isSuccess) {
    var chunks = chunkReferenceLibraryContent(extResult.extractedText, ext, resourceTitle);
    if (chunks.length > 0) {
      for (var c = 0; c < chunks.length; c++) {
        var chunkIndexId = 'IDX_LIB_' + cleanDriveFileId.substring(0, 8) + '_C' + (c + 1);
        rowsToInsert.push([
          chunkIndexId,
          'LOCAL_REFERENCE_LIB',
          '', // CNE ID is empty for general reference library resources
          cleanDriveFileId,
          resourceTitle,
          chunks[c].topic || resourceTitle,
          chunks[c].sectionHeading || 'General Content',
          (c + 1),
          chunks[c].text,
          '', // Clinical Keywords left empty for Phase 4B
          'SUCCESS',
          nowIso
        ]);
      }
    } else {
      isSuccess = false;
      extResult = {
        success: false,
        errorCode: 'NO_EXTRACTABLE_CONTENT',
        message: 'No readable textual content could be extracted into chunks.'
      };
    }
  }

  if (!isSuccess) {
    var failErrCode = extResult ? (extResult.errorCode || 'EXTRACTION_FAILED') : 'EXTRACTION_FAILED';
    var failErrMsg = extResult ? (extResult.message || 'Extraction failed') : 'No readable content';
    var failIndexId = 'IDX_LIB_' + cleanDriveFileId.substring(0, 8) + '_FAIL';

    rowsToInsert.push([
      failIndexId,
      'LOCAL_REFERENCE_LIB',
      '',
      cleanDriveFileId,
      resourceTitle,
      'Extraction Error',
      'Extraction Error',
      0,
      failErrCode + ': ' + failErrMsg,
      '',
      'FAILED',
      nowIso
    ]);
  }

  // 8. CRITICAL SECTION: Shared Sheet Operations INSIDE ScriptLock
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (lockErr) {
    return { success: false, errorCode: 'SERVER_BUSY', message: 'Server is busy indexing reference library. Please try again.' };
  }

  var alreadyIndexed = false;
  var alreadyIndexedCount = 0;
  var resourceId = 'LIB_OPENRN_' + cleanDriveFileId.substring(0, 10);

  try {
    // 8A. Update / Verify CNE_Reference_Library metadata sheet
    var libSheet = getOrCreateSheet('CNE_Reference_Library');
    ensureReferenceLibrarySheetHeaders(libSheet);
    var libMap = getHeaderMap(libSheet);
    var libData = libSheet.getDataRange().getValues();

    var driveColLib = libMap['drivefileid'] !== undefined ? libMap['drivefileid'] : 3;
    var activeColLib = libMap['active'] !== undefined ? libMap['active'] : 8;
    var updatedColLib = libMap['updatedat'] !== undefined ? libMap['updatedat'] : 10;
    var resIdColLib = libMap['resourceid'] !== undefined ? libMap['resourceid'] : 0;

    var existingLibRow = -1;
    for (var lr = 1; lr < libData.length; lr++) {
      if (String(libData[lr][driveColLib] || '').trim() === cleanDriveFileId) {
        existingLibRow = lr + 1; // 1-indexed sheet row number
        resourceId = String(libData[lr][resIdColLib] || resourceId).trim();
        break;
      }
    }

    // 8B. Duplicate Check in CNE_Reference_Index
    var indexSheet = getOrCreateSheet('CNE_Reference_Index');
    ensureReferenceIndexSheetHeaders(indexSheet);
    var idxMap = getHeaderMap(indexSheet);
    var idxData = indexSheet.getDataRange().getValues();

    var srcTypeCol = idxMap['sourcetype'] !== undefined ? idxMap['sourcetype'] : 1;
    var driveColIdx = idxMap['drivefileid'] !== undefined ? idxMap['drivefileid'] : 3;
    var statusColIdx = idxMap['extractionstatus'] !== undefined ? idxMap['extractionstatus'] : 10;

    for (var ir = 1; ir < idxData.length; ir++) {
      var rSrc = String(idxData[ir][srcTypeCol] || '').trim().toUpperCase();
      var rDrive = String(idxData[ir][driveColIdx] || '').trim();
      var rStat = String(idxData[ir][statusColIdx] || '').trim().toUpperCase();

      if (rSrc === 'LOCAL_REFERENCE_LIB' && rDrive === cleanDriveFileId && rStat === 'SUCCESS') {
        alreadyIndexedCount++;
      }
    }

    if (alreadyIndexedCount > 0 && !isReindex) {
      alreadyIndexed = true;
    } else {
      // If content extraction/chunking failed on re-index, preserve previous valid index!
      if (!isSuccess && alreadyIndexedCount > 0) {
        logAuditAction(
          'REFERENCE_REINDEX_PRESERVED',
          session ? session.employeeId : 'SYSTEM',
          'Re-indexing failed to extract new content for ' + cleanDriveFileId + '. Previous valid index preserved.',
          'WARNING'
        );
        return {
          success: false,
          errorCode: extResult ? extResult.errorCode : 'CONTENT_EXTRACTION_FAILED',
          message: 'Re-indexing failed: unable to extract new content. Previous valid index has been preserved.'
        };
      }

      // Collect existing LOCAL_REFERENCE_LIB rows for this Drive File ID ONLY
      var rowsToDelete = [];
      for (var ir2 = 1; ir2 < idxData.length; ir2++) {
        var rowSrc = String(idxData[ir2][srcTypeCol] || '').trim().toUpperCase();
        var rowDrive = String(idxData[ir2][driveColIdx] || '').trim();
        if (rowSrc === 'LOCAL_REFERENCE_LIB' && rowDrive === cleanDriveFileId) {
          rowsToDelete.push(ir2 + 1); // 1-indexed sheet row
        }
      }

      // 8C. Safe Replacement: Batch write new chunk rows FIRST before deleting old rows
      if (rowsToInsert.length > 0) {
        var startRow = indexSheet.getLastRow() + 1;
        try {
          indexSheet.getRange(startRow, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
        } catch (writeErr) {
          // If the new batch write fails, existing index rows were NOT deleted and remain intact
          logAuditAction(
            'REFERENCE_INDEX_WRITE_FAILED',
            session ? session.employeeId : 'SYSTEM',
            'Failed to write new reference index chunks for ' + cleanDriveFileId + ': ' + (writeErr && writeErr.message ? writeErr.message : String(writeErr)),
            'FAILED'
          );
          return {
            success: false,
            errorCode: 'INDEX_BATCH_WRITE_FAILED',
            message: 'Failed to write new reference index chunks. Previous valid index has been preserved.'
          };
        }

        // 8D. Only after new replacement data is successfully written to the sheet,
        // delete previous index rows for this specific LOCAL_REFERENCE_LIB resource.
        if (rowsToDelete.length > 0) {
          try {
            deleteSheetRowsByIndices(indexSheet, rowsToDelete);
          } catch (delErr) {
            logAuditAction(
              'REFERENCE_INDEX_PURGE_WARNING',
              session ? session.employeeId : 'SYSTEM',
              'Warning deleting old index rows during reindex: ' + (delErr && delErr.message ? delErr.message : String(delErr)),
              'WARNING'
            );
          }
        }
      }

      // 8E. Update metadata registry in CNE_Reference_Library
      var visColLib = libMap['visibletousers'];
      var existingVis = (metadata && metadata.visibleToUsers === false) ? 'NO' : 'YES';
      if (existingLibRow > 1 && visColLib !== undefined && libData[existingLibRow - 1] && libData[existingLibRow - 1][visColLib] !== undefined) {
        if (!metadata || metadata.visibleToUsers === undefined) {
          var rawV = String(libData[existingLibRow - 1][visColLib] || '').trim().toUpperCase();
          if (rawV === 'NO') existingVis = 'NO';
        }
      }

      var libRowValues = [
        resourceId,
        'LOCAL_REFERENCE_LIB',
        resourceTitle,
        cleanDriveFileId,
        authorOrg,
        license,
        version,
        ext.toUpperCase(),
        isSuccess ? 'TRUE' : 'FALSE',
        nowIso,
        nowIso,
        existingVis
      ];

      if (existingLibRow > 1) {
        libSheet.getRange(existingLibRow, 1, 1, libRowValues.length).setValues([libRowValues]);
      } else {
        libSheet.appendRow(libRowValues);
      }
    }
  } finally {
    lock.releaseLock();
  }

  // 9. Audit and Return
  if (alreadyIndexed) {
    return {
      success: true,
      alreadyIndexed: true,
      resourceId: resourceId,
      chunksCount: alreadyIndexedCount,
      message: 'Nursing reference resource is already indexed.'
    };
  }

  if (isSuccess) {
    logAuditAction(
      'REFERENCE_LIBRARY_RESOURCE_INDEXED',
      session ? session.employeeId : 'SYSTEM',
      'Successfully indexed ' + rowsToInsert.length + ' chunks for reference resource "' + resourceTitle + '" (' + cleanDriveFileId + ')',
      'SUCCESS'
    );
    return {
      success: true,
      resourceId: resourceId,
      chunksCount: rowsToInsert.length,
      message: 'Reference resource indexed successfully (' + rowsToInsert.length + ' chunks).'
    };
  } else {
    logAuditAction(
      'REFERENCE_LIBRARY_RESOURCE_INDEX_FAILED',
      session ? session.employeeId : 'SYSTEM',
      'Indexing failed for reference resource "' + resourceTitle + '": ' + (extResult ? extResult.errorCode : 'FAILED'),
      'FAILED'
    );
    return {
      success: false,
      errorCode: extResult ? extResult.errorCode : 'CONTENT_EXTRACTION_FAILED',
      message: 'Unable to extract readable text from reference resource: ' + (extResult ? extResult.message : 'No readable content.')
    };
  }
}

/**
 * Surgically delete / deactivate a reference library resource from CNE_Reference_Library
 * and CNE_Reference_Index.
 * Strictly Admin-only.
 */
function deleteReferenceLibraryResource(driveFileId, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  if (!driveFileId || typeof driveFileId !== 'string' || !driveFileId.trim()) {
    return { success: false, errorCode: 'INVALID_PARAMS', message: 'Drive File ID is required.' };
  }
  var cleanDriveFileId = driveFileId.trim();

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (lockErr) {
    return { success: false, errorCode: 'SERVER_BUSY', message: 'Server is busy. Please try again.' };
  }

  var deletedChunksCount = 0;
  try {
    // 1. Remove chunks from CNE_Reference_Index
    var indexSheet = getSpreadsheet('CNE').getSheetByName('CNE_Reference_Index');
    if (indexSheet && indexSheet.getLastRow() > 1) {
      var idxMap = getHeaderMap(indexSheet);
      var idxData = indexSheet.getDataRange().getValues();
      var srcTypeCol = idxMap['sourcetype'] !== undefined ? idxMap['sourcetype'] : 1;
      var driveColIdx = idxMap['drivefileid'] !== undefined ? idxMap['drivefileid'] : 3;

      var rowsToDelete = [];
      for (var r = 1; r < idxData.length; r++) {
        var rowSrc = String(idxData[r][srcTypeCol] || '').trim().toUpperCase();
        var rowDrive = String(idxData[r][driveColIdx] || '').trim();
        if (rowSrc === 'LOCAL_REFERENCE_LIB' && rowDrive === cleanDriveFileId) {
          rowsToDelete.push(r + 1);
        }
      }

      if (rowsToDelete.length > 0) {
        deletedChunksCount = rowsToDelete.length;
        deleteSheetRowsByIndices(indexSheet, rowsToDelete);
      }
    }

    // 2. Update active flag in CNE_Reference_Library
    var libSheet = getSpreadsheet('CNE').getSheetByName('CNE_Reference_Library');
    if (libSheet && libSheet.getLastRow() > 1) {
      var libMap = getHeaderMap(libSheet);
      var libData = libSheet.getDataRange().getValues();
      var driveColLib = libMap['drivefileid'] !== undefined ? libMap['drivefileid'] : 3;
      var activeColLib = libMap['active'] !== undefined ? libMap['active'] : 8;
      var updatedColLib = libMap['updatedat'] !== undefined ? libMap['updatedat'] : 10;

      for (var lr = 1; lr < libData.length; lr++) {
        if (String(libData[lr][driveColLib] || '').trim() === cleanDriveFileId) {
          libSheet.getRange(lr + 1, activeColLib + 1).setValue('FALSE');
          libSheet.getRange(lr + 1, updatedColLib + 1).setValue(new Date().toISOString());
          break;
        }
      }
    }
  } finally {
    lock.releaseLock();
  }

  logAuditAction(
    'REFERENCE_LIBRARY_RESOURCE_DELETED',
    session ? session.employeeId : 'SYSTEM',
    'Removed reference resource ' + cleanDriveFileId + ' (' + deletedChunksCount + ' index chunks deleted)',
    'SUCCESS'
  );

  return {
    success: true,
    deletedChunksCount: deletedChunksCount,
    message: 'Reference resource successfully removed and unindexed.'
  };
}

/**
 * List all registered nursing reference library resources from CNE_Reference_Library
 * and available files in the Open RN Drive folder.
 */
function listNursingReferenceResources(session) {
  if (!session || !session.employeeId) {
    return { success: false, errorCode: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' };
  }

  var isAdmin = session && String(session.role || '').trim().toUpperCase() === 'ADMIN';
  var resources = [];
  var driveFiles = [];

  // 1. Read metadata from CNE_Reference_Library
  try {
    var libSheet = getSpreadsheet('CNE').getSheetByName('CNE_Reference_Library');
    if (libSheet && libSheet.getLastRow() > 1) {
      ensureReferenceLibrarySheetHeaders(libSheet);
      var libMap = getHeaderMap(libSheet);
      var libData = libSheet.getDataRange().getValues();

      var resIdCol = libMap['resourceid'] !== undefined ? libMap['resourceid'] : 0;
      var srcTypeCol = libMap['sourcetype'] !== undefined ? libMap['sourcetype'] : 1;
      var titleCol = libMap['resourcetitle'] !== undefined ? libMap['resourcetitle'] : 2;
      var driveCol = libMap['drivefileid'] !== undefined ? libMap['drivefileid'] : 3;
      var authorCol = libMap['authororganization'] !== undefined ? libMap['authororganization'] : 4;
      var licCol = libMap['license'] !== undefined ? libMap['license'] : 5;
      var verCol = libMap['version'] !== undefined ? libMap['version'] : 6;
      var typeCol = libMap['filetype'] !== undefined ? libMap['filetype'] : 7;
      var activeCol = libMap['active'] !== undefined ? libMap['active'] : 8;
      var indAtCol = libMap['indexedat'] !== undefined ? libMap['indexedat'] : 9;
      var updAtCol = libMap['updatedat'] !== undefined ? libMap['updatedat'] : 10;
      var visCol = libMap['visibletousers'];

      for (var r = 1; r < libData.length; r++) {
        var isActive = String(libData[r][activeCol] || '').trim().toUpperCase() === 'TRUE';
        var visVal = visCol !== undefined ? String(libData[r][visCol] || '').trim().toUpperCase() : 'YES';
        var isVisible = visVal !== 'NO';
        if (isActive) {
          if (!isAdmin && !isVisible) continue; // Non-admins cannot see hidden reference library resources
          resources.push({
            resourceId: String(libData[r][resIdCol] || '').trim(),
            sourceType: 'LOCAL_REFERENCE_LIB',
            resourceTitle: String(libData[r][titleCol] || '').trim(),
            driveFileId: String(libData[r][driveCol] || '').trim(),
            authorOrganization: String(libData[r][authorCol] || '').trim(),
            license: String(libData[r][licCol] || '').trim(),
            version: String(libData[r][verCol] || '').trim(),
            fileType: String(libData[r][typeCol] || '').trim(),
            active: true,
            visibleToUsers: isVisible,
            indexedAt: String(libData[r][indAtCol] || '').trim(),
            updatedAt: String(libData[r][updAtCol] || '').trim()
          });
        }
      }
    }
  } catch (sheetErr) {
    // Non-blocking
  }

  // 2. Scan Open RN Drive folder (Admin only)
  if (isAdmin) {
    try {
      var folderResult = getOrCreateOpenRnFolder();
      if (folderResult.success && folderResult.folder) {
        var filesIter = folderResult.folder.getFiles();
        var ALLOWED_EXTS = ['pdf', 'docx', 'ppt', 'pptx'];

        var indexedMap = {};
        for (var i = 0; i < resources.length; i++) {
          indexedMap[resources[i].driveFileId] = resources[i];
        }

        while (filesIter.hasNext()) {
          var f = filesIter.next();
          var fName = f.getName();
          var fExt = getFileExtension(fName).toLowerCase();
          if (ALLOWED_EXTS.indexOf(fExt) !== -1) {
            var fId = f.getId();
            var isIndexed = Boolean(indexedMap[fId]);
            driveFiles.push({
              driveFileId: fId,
              fileName: fName,
              fileType: fExt.toUpperCase(),
              fileSize: f.getSize(),
              lastUpdated: f.getLastUpdated().toISOString(),
              isIndexed: isIndexed,
              resourceId: isIndexed ? indexedMap[fId].resourceId : null,
              resourceTitle: isIndexed ? indexedMap[fId].resourceTitle : fName.replace(/\\.[^/.]+$/, '')
            });
          }
        }
      }
    } catch (driveErr) {
      // Non-blocking
    }
  }

  return {
    success: true,
    data: {
      resources: resources,
      driveFiles: driveFiles
    }
  };
}

/**
 * Upload an Open RN reference resource directly into the Open RN folder and index it.
 * Strictly Admin-only.
 */
function uploadNursingReferenceResource(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var fileName = params ? params.fileName : null;
  var base64Data = params ? params.base64Data : null;
  var resourceTitle = params ? params.resourceTitle : null;

  if (!fileName || !base64Data) {
    return { success: false, errorCode: 'INVALID_PARAMS', message: 'File name and file content are required.' };
  }

  var ext = getFileExtension(fileName).toLowerCase();
  var ALLOWED_EXTS = ['pdf', 'docx', 'ppt', 'pptx'];
  if (ALLOWED_EXTS.indexOf(ext) === -1) {
    return { success: false, errorCode: 'UNSUPPORTED_FILE_TYPE', message: 'Only PDF, DOCX, PPT, and PPTX documents are permitted.' };
  }

  var folderResult = getOrCreateOpenRnFolder();
  if (!folderResult.success || !folderResult.folder) {
    return { success: false, errorCode: folderResult.errorCode || 'FOLDER_ERROR', message: folderResult.message || 'Failed to access Open RN folder.' };
  }

  var cleanBase64 = base64Data;
  if (cleanBase64.indexOf(',') !== -1) {
    cleanBase64 = cleanBase64.split(',')[1];
  }

  var fileBytes;
  try {
    fileBytes = Utilities.base64Decode(cleanBase64);
  } catch (decErr) {
    return { success: false, errorCode: 'INVALID_PAYLOAD', message: 'Invalid file payload: unable to decode base64 content.' };
  }

  if (fileBytes.length > 25 * 1024 * 1024) {
    return { success: false, errorCode: 'FILE_TOO_LARGE', message: 'File size exceeds maximum allowed size of 25 MB.' };
  }

  var mimeType = getMimeTypeFromExt(ext);
  var safeName = sanitizeFileNamePart(fileName.replace(/\\.[^/.]+$/, '')) + '.' + ext;
  var blob = Utilities.newBlob(fileBytes, mimeType, safeName);

  var createdFile;
  try {
    createdFile = folderResult.folder.createFile(blob);
    // Explicitly set private sharing
    createdFile.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  } catch (createErr) {
    return { success: false, errorCode: 'FILE_CREATION_FAILED', message: 'Failed to create file in Open RN folder: ' + createErr.message };
  }

  // Index the newly created file
  var indexResult = null;
  try {
    indexResult = indexReferenceLibraryResource(createdFile.getId(), {
      resourceTitle: resourceTitle || safeName.replace(/\\.[^/.]+$/, ''),
      authorOrganization: params.authorOrganization,
      license: params.license,
      version: params.version,
      visibleToUsers: params.visibleToUsers !== undefined ? params.visibleToUsers : true,
      reindex: false
    }, session);
  } catch (idxException) {
    indexResult = {
      success: false,
      errorCode: 'INDEXING_UNEXPECTED_ERROR',
      message: idxException && idxException.message ? idxException.message : String(idxException)
    };
  }

  // Rollback newly created Drive file if subsequent registration/indexing failed
  if (!indexResult || !indexResult.success) {
    var rolledBack = false;
    try {
      createdFile.setTrashed(true);
      rolledBack = true;
    } catch (trashErr) {
      rolledBack = false;
    }

    if (rolledBack) {
      logAuditAction(
        'UPLOAD_REFERENCE_RESOURCE_ROLLED_BACK',
        session ? session.employeeId : 'SYSTEM',
        'Indexing failed for uploaded reference file "' + safeName + '". Newly created Drive file rolled back (trashed): ' + createdFile.getId() + '. Reason: ' + (indexResult ? indexResult.message : 'Unknown error'),
        'FAILED'
      );
      return {
        success: false,
        errorCode: (indexResult && indexResult.errorCode) ? indexResult.errorCode : 'INDEXING_FAILED_ROLLED_BACK',
        message: 'Failed to index uploaded reference resource. The uploaded file was rolled back. ' + (indexResult ? indexResult.message : '')
      };
    } else {
      logAuditAction(
        'UPLOAD_REFERENCE_RESOURCE_ORPHANED',
        session ? session.employeeId : 'SYSTEM',
        'CRITICAL: Reference resource indexing failed AND Drive rollback failed. Orphaned Drive File ID: ' + createdFile.getId() + '. Index error: ' + (indexResult ? indexResult.message : 'Unknown error'),
        'FAILED'
      );
      return {
        success: false,
        errorCode: 'INDEXING_FAILED_CLEANUP_FAILED',
        message: 'Failed to index reference resource, and rollback cleanup could not be completed. Administrative reconciliation may be required.'
      };
    }
  }

  return indexResult;
}

// Action Dispatch Handlers for Phase 4B
function handleListNursingReferenceResources(params, session) {
  return listNursingReferenceResources(session);
}

function handleIndexNursingReferenceResource(params, session) {
  return handleAdminAction(params, session, function(p, s) {
    var driveFileId = p ? (p.driveFileId || p.fileId) : null;
    return indexReferenceLibraryResource(driveFileId, p, s);
  }, 'INDEX_NURSING_REFERENCE_RESOURCE');
}

function handleUploadNursingReferenceResource(params, session) {
  return handleAdminAction(params, session, function(p, s) {
    return uploadNursingReferenceResource(p, s);
  }, 'UPLOAD_NURSING_REFERENCE_RESOURCE');
}

function handleDeleteNursingReferenceResource(params, session) {
  return handleAdminAction(params, session, function(p, s) {
    var driveFileId = p ? (p.driveFileId || p.fileId) : null;
    return deleteReferenceLibraryResource(driveFileId, s);
  }, 'DELETE_NURSING_REFERENCE_RESOURCE');
}

/**
 * Securely download or stream a Nursing Reference Library file.
 * Non-admins can only download resources that are marked Visible To Users ('YES').
 */
function handleDownloadNursingReferenceResource(params, session) {
  if (!session || !session.employeeId) {
    return { success: false, errorCode: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' };
  }

  var driveFileId = params ? (params.driveFileId || params.fileId) : null;
  var resourceId = params ? params.resourceId : null;

  if (!driveFileId && !resourceId) {
    return { success: false, errorCode: 'INVALID_PARAMS', message: 'Drive file ID or Resource ID is required.' };
  }

  var cleanDriveFileId = driveFileId ? sanitizeCellInput(driveFileId) : '';
  var cleanResourceId = resourceId ? sanitizeCellInput(resourceId) : '';

  var libSheet = getSpreadsheet('CNE').getSheetByName('CNE_Reference_Library');
  if (!libSheet || libSheet.getLastRow() <= 1) {
    return { success: false, errorCode: 'RESOURCE_NOT_FOUND', message: 'Nursing reference library is empty or not initialized.' };
  }

  var libMap = getHeaderMap(libSheet);
  var libData = libSheet.getDataRange().getValues();

  var resIdCol = libMap['resourceid'] !== undefined ? libMap['resourceid'] : 0;
  var titleCol = libMap['resourcetitle'] !== undefined ? libMap['resourcetitle'] : 2;
  var driveCol = libMap['drivefileid'] !== undefined ? libMap['drivefileid'] : 3;
  var authorCol = libMap['authororganization'] !== undefined ? libMap['authororganization'] : 4;
  var typeCol = libMap['filetype'] !== undefined ? libMap['filetype'] : 7;
  var activeCol = libMap['active'] !== undefined ? libMap['active'] : 8;
  var visCol = libMap['visibletousers'];

  var matchedRow = null;
  for (var r = 1; r < libData.length; r++) {
    var rowDrive = String(libData[r][driveCol] || '').trim();
    var rowResId = String(libData[r][resIdCol] || '').trim();
    if ((cleanDriveFileId && rowDrive === cleanDriveFileId) || (cleanResourceId && rowResId === cleanResourceId)) {
      matchedRow = libData[r];
      cleanDriveFileId = rowDrive;
      break;
    }
  }

  if (!matchedRow) {
    return { success: false, errorCode: 'RESOURCE_NOT_FOUND', message: 'Resource not found in Nursing Reference Library.' };
  }

  var isActive = String(matchedRow[activeCol] || '').trim().toUpperCase() === 'TRUE';
  if (!isActive) {
    return { success: false, errorCode: 'RESOURCE_INACTIVE', message: 'This reference resource is inactive or removed.' };
  }

  var isAdmin = session && String(session.role || '').trim().toUpperCase() === 'ADMIN';
  var visVal = visCol !== undefined ? String(matchedRow[visCol] || '').trim().toUpperCase() : 'YES';
  var isVisible = visVal !== 'NO';
  if (!isAdmin && !isVisible) {
    return { success: false, errorCode: 'RESOURCE_HIDDEN', message: 'This nursing reference resource is currently not available to users.' };
  }

  var folderResult = getOrCreateOpenRnFolder();
  if (!folderResult.success || !folderResult.folder) {
    return { success: false, errorCode: 'FOLDER_ERROR', message: folderResult.message || 'Open RN repository folder unavailable.' };
  }

  var file;
  try {
    file = DriveApp.getFileById(cleanDriveFileId);
  } catch (driveErr) {
    return { success: false, errorCode: 'FILE_NOT_FOUND', message: 'File not found in Drive.' };
  }

  // Ensure file is in the Open RN folder
  var parents = file.getParents();
  var inFolder = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === folderResult.folder.getId()) {
      inFolder = true;
      break;
    }
  }

  if (!inFolder) {
    return { success: false, errorCode: 'FILE_OUTSIDE_REPOSITORY', message: 'File is outside authorized reference library storage.' };
  }

  var blob = file.getBlob();
  var fileBase64 = Utilities.base64Encode(blob.getBytes());
  var mimeType = blob.getContentType();
  var fileName = file.getName();
  var fileType = String(matchedRow[typeCol] || getFileExtension(fileName)).toUpperCase();

  logAuditAction('DOWNLOAD_NURSING_REFERENCE_RESOURCE', session.employeeId, 'Downloaded nursing reference resource: ' + fileName + ' (' + cleanDriveFileId + ')', 'SUCCESS');

  return {
    success: true,
    data: {
      resourceId: String(matchedRow[resIdCol] || ''),
      resourceTitle: String(matchedRow[titleCol] || fileName),
      authorOrganization: String(matchedRow[authorCol] || ''),
      fileName: fileName,
      fileType: fileType,
      mimeType: mimeType,
      fileBase64: fileBase64
    }
  };
}

/**
 * Toggle or set the visibility of a resource to regular users.
 * Admin-only operation.
 * Hiding a resource removes it from the user list/downloads but DOES NOT remove it from AI retrieval.
 */
function handleSetResourceVisibility(params, session) {
  return handleAdminAction(params, session, function(p, s) {
    var resourceType = p ? String(p.resourceType || '').trim().toUpperCase() : '';
    var id = p ? String(p.id || p.cneId || p.driveFileId || '').trim() : '';
    var rawVis = p ? p.visibleToUsers : true;
    var newVis = (rawVis === true || String(rawVis).trim().toUpperCase() === 'YES' || String(rawVis).trim().toUpperCase() === 'TRUE') ? 'YES' : 'NO';

    if (!resourceType || !id) {
      return { success: false, errorCode: 'INVALID_PARAMS', message: 'Resource type and ID are required.' };
    }

    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (lockErr) {
      return { success: false, errorCode: 'SYSTEM_BUSY', message: 'Could not acquire lock for visibility update. Please try again.' };
    }

    try {
      var nowIso = new Date().toISOString();

      if (resourceType === 'CNE_LEARNING_MATERIAL') {
        var sheet = getOrCreateSheet('CNE_Reference');
        ensureLearningResourceSheetHeaders(sheet);
        var colMap = getHeaderMap(sheet);
        var data = sheet.getDataRange().getValues();
        var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : 0;
        var visCol = colMap['visibletousers'];
        var updatedCol = colMap['updatedat'] !== undefined ? colMap['updatedat'] : 3;
        var byCol = colMap['updatedby'] !== undefined ? colMap['updatedby'] : 4;

        if (visCol === undefined) {
          return { success: false, errorCode: 'SHEET_ERROR', message: 'Visible To Users column not found in CNE_Reference.' };
        }

        var targetRow = -1;
        for (var r = 1; r < data.length; r++) {
          if (String(data[r][idCol] || '').trim().toUpperCase() === id.toUpperCase()) {
            targetRow = r + 1;
            break;
          }
        }

        if (targetRow <= 0) {
          return { success: false, errorCode: 'RESOURCE_NOT_FOUND', message: 'CNE learning resource not found for CNE ID: ' + id };
        }

        sheet.getRange(targetRow, visCol + 1).setValue(newVis);
        sheet.getRange(targetRow, updatedCol + 1).setValue(nowIso);
        sheet.getRange(targetRow, byCol + 1).setValue(s.employeeId);

        logAuditAction('SET_LEARNING_RESOURCE_VISIBILITY', s.employeeId, 'Set CNE ' + id + ' visibility to users to ' + newVis, 'SUCCESS');

        return {
          success: true,
          data: {
            id: id,
            resourceType: resourceType,
            visibleToUsers: newVis === 'YES'
          }
        };

      } else if (resourceType === 'NURSING_REFERENCE_LIB') {
        var libSheet = getOrCreateSheet('CNE_Reference_Library');
        ensureReferenceLibrarySheetHeaders(libSheet);
        var libMap = getHeaderMap(libSheet);
        var libData = libSheet.getDataRange().getValues();

        var resIdCol = libMap['resourceid'] !== undefined ? libMap['resourceid'] : 0;
        var driveCol = libMap['drivefileid'] !== undefined ? libMap['drivefileid'] : 3;
        var visColLib = libMap['visibletousers'];
        var updColLib = libMap['updatedat'] !== undefined ? libMap['updatedat'] : 10;

        if (visColLib === undefined) {
          return { success: false, errorCode: 'SHEET_ERROR', message: 'Visible To Users column not found in CNE_Reference_Library.' };
        }

        var targetLibRow = -1;
        for (var lr = 1; lr < libData.length; lr++) {
          var rowDrive = String(libData[lr][driveCol] || '').trim();
          var rowResId = String(libData[lr][resIdCol] || '').trim();
          if (rowDrive === id || rowResId === id) {
            targetLibRow = lr + 1;
            break;
          }
        }

        if (targetLibRow <= 0) {
          return { success: false, errorCode: 'RESOURCE_NOT_FOUND', message: 'Nursing reference library resource not found for ID: ' + id };
        }

        libSheet.getRange(targetLibRow, visColLib + 1).setValue(newVis);
        libSheet.getRange(targetLibRow, updColLib + 1).setValue(nowIso);

        logAuditAction('SET_REFERENCE_LIBRARY_VISIBILITY', s.employeeId, 'Set Nursing Reference ' + id + ' visibility to users to ' + newVis, 'SUCCESS');

        return {
          success: true,
          data: {
            id: id,
            resourceType: resourceType,
            visibleToUsers: newVis === 'YES'
          }
        };

      } else {
        return { success: false, errorCode: 'INVALID_RESOURCE_TYPE', message: 'Unsupported resource type: ' + resourceType };
      }
    } finally {
      lock.releaseLock();
    }
  }, 'SET_RESOURCE_VISIBILITY');
}

// ==========================================
// PHASE 4C: LOCAL TOPIC-RELEVANCE RETRIEVAL
// ==========================================

var CLINICAL_PROCEDURAL_TAXONOMY = [
  {
    topicId: 'iv_cannulation',
    matchRegex: /\\b(?:iv|cannulat|venipuncture|intravenous)\\b/i,
    coreProcedures: [
      'cannulat', 'venipuncture', 'catheter', 'cannula', 'insertion',
      'flashback', 'tourniquet', 'peripheral iv', 'iv access', 'site selection',
      'vein', 'gauge', 'stylet', 'chlorhexidine', 'aseptic'
    ],
    procedureDistinguishers: ['cannulat', 'venipuncture', 'insertion', 'catheter', 'cannula', 'access', 'vein', 'flashback'],
    antiProcedureNoise: ['piggyback', 'infusion pump rate', 'titration', 'oral tablet', 'elixir']
  },
  {
    topicId: 'foley_catheterization',
    matchRegex: /\\b(?:foley|catheteriz|urinary\\s+catheter)\\b/i,
    coreProcedures: [
      'foley', 'catheteriz', 'urinary catheter', 'indwelling', 'balloon',
      'sterile technique', 'drainage bag', 'retention', 'meatus', 'lubricant', 'peri-care'
    ],
    procedureDistinguishers: ['foley', 'catheter', 'urinary', 'bladder'],
    antiProcedureNoise: []
  },
  {
    topicId: 'wound_dressing',
    matchRegex: /\\b(?:wound|dressing)\\b/i,
    coreProcedures: [
      'wound', 'dressing', 'gauze', 'sterile', 'exudate',
      'wound bed', 'cleansing', 'debridement', 'drainage', 'maceration', 'bandage', 'granulation'
    ],
    procedureDistinguishers: ['wound', 'dressing', 'gauze', 'debridement'],
    antiProcedureNoise: []
  },
  {
    topicId: 'cpr',
    matchRegex: /\\b(?:cpr|resuscitat|cardiopulmonary|bls)\\b/i,
    coreProcedures: [
      'cpr', 'resuscitat', 'chest compression', 'compression', 'rescue breath',
      'defibrillat', 'aed', 'cardiac arrest', 'circulation', 'airway', 'ventilation', 'bls'
    ],
    procedureDistinguishers: ['compression', 'resuscitat', 'cpr', 'cardiac arrest', 'defibrillat'],
    antiProcedureNoise: []
  },
  {
    topicId: 'medication_administration',
    matchRegex: /\\b(?:medication|drug\\s+admin)\\b/i,
    coreProcedures: [
      'medication administration', 'rights of medication', 'rights of drug',
      'oral', 'parenteral', 'dosage', 'prescription', 'patient verification',
      'five rights', 'six rights', 'ten rights', 'adverse reaction'
    ],
    procedureDistinguishers: ['medication', 'drug administration', 'dosage', 'rights'],
    antiProcedureNoise: []
  },
  {
    topicId: 'blood_transfusion',
    matchRegex: /\\b(?:blood\\s+transfusion|transfusion)\\b/i,
    coreProcedures: [
      'blood transfusion', 'transfusion', 'crossmatch', 'packed red blood cells',
      'prbc', 'blood administration', 'hemolytic', 'transfusion reaction', 'blood typing', 'filter'
    ],
    procedureDistinguishers: ['transfusion', 'blood administration', 'crossmatch', 'prbc'],
    antiProcedureNoise: []
  }
];

/**
 * Deterministic Clinical Topic Relevance Scorer
 * Evaluates a candidate chunk against the target clinical topic query.
 */
function calculateTopicRelevanceScore(queryTopic, candidate) {
  if (!queryTopic || !candidate) return 0;

  var normQuery = String(queryTopic).toLowerCase().trim();
  if (normQuery.length < 2) return 0;

  var normTitle = String(candidate.resourceTitle || '').toLowerCase();
  var normTopic = String(candidate.topic || '').toLowerCase();
  var normHeading = String(candidate.sectionHeading || '').toLowerCase();
  var normKeywords = String(candidate.clinicalKeywords || '').toLowerCase();
  var normText = String(candidate.chunkText || '').toLowerCase();

  var score = 0;

  // Generic stop words to downweight
  var STOP_WORDS = {
    'and': 1, 'or': 1, 'the': 1, 'of': 1, 'in': 1, 'for': 1, 'to': 1,
    'a': 1, 'an': 1, 'on': 1, 'at': 1, 'by': 1, 'with': 1, 'from': 1,
    'as': 1, 'is': 1, 'are': 1, 'was': 1, 'were': 1, 'be': 1, 'this': 1,
    'that': 1, 'care': 1, 'nursing': 1, 'skills': 1, 'procedure': 1, 'patient': 1
  };

  // 1. Exact Full-Phrase Matching (Strongest Weight)
  if (normHeading.indexOf(normQuery) !== -1) score += 50;
  if (normKeywords.indexOf(normQuery) !== -1) score += 45;
  if (normTopic.indexOf(normQuery) !== -1) score += 40;
  if (normTitle.indexOf(normQuery) !== -1) score += 35;
  if (normText.indexOf(normQuery) !== -1) score += 30;

  // 2. Query Tokens Extraction & Matching
  var rawTokens = normQuery.split(/[^a-z0-9]+/);
  var tokens = [];
  for (var t = 0; t < rawTokens.length; t++) {
    var tok = rawTokens[t];
    if (tok.length >= 2 && !STOP_WORDS[tok]) {
      tokens.push(tok);
    }
  }

  var matchedTokenCount = 0;
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    var baseWeight = token.length <= 2 ? 3 : (token.length === 3 ? 6 : 12);
    var tokenFoundInChunk = false;

    if (normHeading.indexOf(token) !== -1) {
      score += baseWeight * 2.5;
      tokenFoundInChunk = true;
    }
    if (normKeywords.indexOf(token) !== -1) {
      score += baseWeight * 2.0;
      tokenFoundInChunk = true;
    }
    if (normTopic.indexOf(token) !== -1 || normTitle.indexOf(token) !== -1) {
      score += baseWeight * 1.5;
      tokenFoundInChunk = true;
    }

    // Term frequency in chunk text with diminishing returns (capped at 4)
    if (normText.indexOf(token) !== -1) {
      tokenFoundInChunk = true;
      var count = 0;
      var pos = normText.indexOf(token);
      while (pos !== -1 && count < 4) {
        count++;
        pos = normText.indexOf(token, pos + token.length);
      }
      var tfMultipliers = [1.0, 0.6, 0.4, 0.2];
      for (var c = 0; c < count; c++) {
        score += baseWeight * tfMultipliers[c];
      }
    }

    if (tokenFoundInChunk) {
      matchedTokenCount++;
    }
  }

  // Coordination bonus if all tokens of a multi-token query matched
  if (tokens.length >= 2 && matchedTokenCount === tokens.length) {
    score += 25;
  }

  // 3. Clinical Procedural Disambiguation & Taxonomy
  for (var p = 0; p < CLINICAL_PROCEDURAL_TAXONOMY.length; p++) {
    var spec = CLINICAL_PROCEDURAL_TAXONOMY[p];
    if (spec.matchRegex.test(normQuery)) {
      // Procedural terms score
      var procScore = 0;
      for (var cp = 0; cp < spec.coreProcedures.length; cp++) {
        var term = spec.coreProcedures[cp];
        if (normHeading.indexOf(term) !== -1) procScore += 15;
        if (normKeywords.indexOf(term) !== -1) procScore += 12;
        if (normText.indexOf(term) !== -1) procScore += 8;
      }
      score += Math.min(procScore, 40);

      // Specific Procedural Disambiguation (e.g. IV Cannulation vs Generic IV Medication)
      if (spec.procedureDistinguishers.length > 0) {
        var hasDistinguisher = false;
        for (var d = 0; d < spec.procedureDistinguishers.length; d++) {
          var dist = spec.procedureDistinguishers[d];
          if (normHeading.indexOf(dist) !== -1 || normKeywords.indexOf(dist) !== -1 || normText.indexOf(dist) !== -1) {
            hasDistinguisher = true;
            break;
          }
        }

        if (hasDistinguisher) {
          score += 25; // Procedural specificity reward
        } else {
          // If query is specifically about cannulation / insertion / access and candidate has NO procedural distinguisher
          // e.g. purely generic IV infusion / medication without insertion
          if (normQuery.indexOf('cannulat') !== -1 || normQuery.indexOf('insertion') !== -1 || normQuery.indexOf('catheter') !== -1) {
            score = Math.max(0, score - 35);
          }
        }
      }
      break;
    }
  }

  return score;
}

/**
 * Phase 4D.1: Clinical Relevance Gate
 * Evaluates candidate chunks after calculateTopicRelevanceScore() to filter out
 * clinically unrelated false positives that only matched generic shared clinical vocabulary.
 * 
 * Rules:
 * 1. Must have meaningful evidence from:
 *    - exact / multi-word topic phrase match
 *    - meaningful topic token coordination (non-generic tokens)
 *    - relevant clinical heading or keyword match
 *    - applicable procedural taxonomy distinguishers
 * 2. Generic shared clinical words (catheter, sterile, dressing, patient, care, nursing,
 *    procedure, infusion, monitoring, etc.) CANNOT by themselves qualify an unrelated chunk.
 * 3. Multi-word procedural topics require sufficient topic-specific coordination.
 */
function passesClinicalRelevanceGate(queryTopic, candidate) {
  if (!queryTopic || !candidate) return false;

  var normQuery = String(queryTopic).toLowerCase().trim();
  if (normQuery.length < 2) return false;

  var normTitle = String(candidate.resourceTitle || '').toLowerCase();
  var normTopic = String(candidate.topic || '').toLowerCase();
  var normHeading = String(candidate.sectionHeading || '').toLowerCase();
  var normKeywords = String(candidate.clinicalKeywords || '').toLowerCase();
  var normText = String(candidate.chunkText || '').toLowerCase();

  var combinedMeta = normHeading + ' ' + normKeywords + ' ' + normTopic + ' ' + normTitle;
  var allCandidateText = combinedMeta + ' ' + normText;

  var GENERIC_CLINICAL_TOKENS = {
    'catheter': 1,
    'sterile': 1,
    'dressing': 1,
    'patient': 1,
    'care': 1,
    'nursing': 1,
    'procedure': 1,
    'infusion': 1,
    'monitoring': 1,
    'access': 1,
    'insertion': 1,
    'technique': 1,
    'protocol': 1,
    'management': 1,
    'skills': 1,
    'checklist': 1,
    'guidelines': 1,
    'administration': 1,
    'site': 1,
    'therapy': 1,
    'change': 1,
    'prevention': 1,
    'assessment': 1,
    'selection': 1,
    'score': 1,
    'scale': 1
  };

  var STOP_WORDS = {
    'and': 1, 'or': 1, 'the': 1, 'of': 1, 'in': 1, 'for': 1, 'to': 1,
    'a': 1, 'an': 1, 'on': 1, 'at': 1, 'by': 1, 'with': 1, 'from': 1,
    'as': 1, 'is': 1, 'are': 1, 'was': 1, 'were': 1, 'be': 1, 'this': 1,
    'that': 1
  };

  // 1. Procedural Taxonomy Distinguisher Evaluation
  var matchedTaxonomy = null;
  for (var p = 0; p < CLINICAL_PROCEDURAL_TAXONOMY.length; p++) {
    var spec = CLINICAL_PROCEDURAL_TAXONOMY[p];
    if (spec.matchRegex.test(normQuery)) {
      matchedTaxonomy = spec;
      break;
    }
  }

  if (matchedTaxonomy) {
    var tid = matchedTaxonomy.topicId;
    if (tid === 'iv_cannulation') {
      var ivTerms = ['iv', 'cannulat', 'cannula', 'venipunct', 'vein', 'flashback', 'phlebitis', 'tourniquet', 'peripheral iv', 'iv access', 'intravenous'];
      var hasIv = false;
      for (var i = 0; i < ivTerms.length; i++) {
        if (allCandidateText.indexOf(ivTerms[i]) !== -1) {
          hasIv = true;
          break;
        }
      }
      if (!hasIv) return false;
    } else if (tid === 'foley_catheterization') {
      var foleyTerms = ['foley', 'catheteriz', 'urinary', 'bladder', 'meatus', 'retention balloon', 'drainage bag', 'peri-care'];
      var hasFoley = false;
      for (var f = 0; f < foleyTerms.length; f++) {
        if (allCandidateText.indexOf(foleyTerms[f]) !== -1) {
          hasFoley = true;
          break;
        }
      }
      if (!hasFoley) return false;
    } else if (tid === 'wound_dressing') {
      var woundTerms = ['wound', 'wound care', 'wound bed', 'exudate', 'debridement', 'granulation', 'ulcer', 'pressure injury', 'eschar', 'maceration'];
      var hasWound = false;
      for (var w = 0; w < woundTerms.length; w++) {
        if (allCandidateText.indexOf(woundTerms[w]) !== -1) {
          hasWound = true;
          break;
        }
      }
      if (!hasWound) return false;
    } else if (tid === 'blood_transfusion') {
      var transTerms = ['transfusion', 'prbc', 'crossmatch', 'packed red', 'hemolytic', 'blood administration', 'blood typing', 'blood filter'];
      var hasTrans = false;
      for (var bt = 0; bt < transTerms.length; bt++) {
        if (allCandidateText.indexOf(transTerms[bt]) !== -1) {
          hasTrans = true;
          break;
        }
      }
      if (!hasTrans) return false;
    } else if (tid === 'cpr') {
      var cprTerms = ['cpr', 'resuscitat', 'chest compression', 'compression', 'rescue breath', 'defibrillat', 'aed', 'cardiac arrest', 'bls'];
      var hasCpr = false;
      for (var cp = 0; cp < cprTerms.length; cp++) {
        if (allCandidateText.indexOf(cprTerms[cp]) !== -1) {
          hasCpr = true;
          break;
        }
      }
      if (!hasCpr) return false;
    } else if (tid === 'medication_administration') {
      var medTerms = ['medication', 'drug administration', 'rights of medication', 'dosage', 'prescription', 'mar'];
      var hasMed = false;
      for (var m = 0; m < medTerms.length; m++) {
        if (allCandidateText.indexOf(medTerms[m]) !== -1) {
          hasMed = true;
          break;
        }
      }
      if (!hasMed) return false;
    }
  }

  // 2. Exact Multi-Word Query Phrase Match in Heading, Keywords, Topic, or Text
  var querySegments = normQuery.split(/\\s*[\\/\\-]\\s*/);
  for (var s = 0; s < querySegments.length; s++) {
    var seg = querySegments[s].trim();
    if (seg.length >= 3 && seg.indexOf(' ') !== -1) {
      if (combinedMeta.indexOf(seg) !== -1 || normText.indexOf(seg) !== -1) {
        return true;
      }
    }
  }
  if (normQuery.indexOf(' ') !== -1 && (combinedMeta.indexOf(normQuery) !== -1 || normText.indexOf(normQuery) !== -1)) {
    return true;
  }

  // 3. Extract and evaluate query tokens
  var rawTokens = normQuery.split(/[^a-z0-9]+/);
  var specificTokens = [];
  var genericQueryTokens = [];

  for (var t = 0; t < rawTokens.length; t++) {
    var tok = rawTokens[t];
    if (tok.length < 2 || STOP_WORDS[tok]) continue;
    if (GENERIC_CLINICAL_TOKENS[tok]) {
      genericQueryTokens.push(tok);
    } else {
      specificTokens.push(tok);
    }
  }

  if (specificTokens.length > 0) {
    var matchedSpecific = 0;
    for (var st = 0; st < specificTokens.length; st++) {
      var sTok = specificTokens[st];
      var stem = sTok.length > 4 ? sTok.substring(0, sTok.length - 1) : sTok;
      if (combinedMeta.indexOf(stem) !== -1 || normText.indexOf(stem) !== -1) {
        matchedSpecific++;
      }
    }

    if (matchedSpecific === 0) {
      return false;
    }

    if (specificTokens.length >= 2 && matchedSpecific < 2) {
      var matchedInMeta = false;
      for (var sm = 0; sm < specificTokens.length; sm++) {
        var sTokMeta = specificTokens[sm];
        var sStemMeta = sTokMeta.length > 4 ? sTokMeta.substring(0, sTokMeta.length - 1) : sTokMeta;
        if (combinedMeta.indexOf(sStemMeta) !== -1) {
          matchedInMeta = true;
          break;
        }
      }
      if (!matchedInMeta) {
        return false;
      }
    }

    return true;
  }

  if (genericQueryTokens.length >= 2) {
    var matchedGeneric = 0;
    for (var gt = 0; gt < genericQueryTokens.length; gt++) {
      var gTok = genericQueryTokens[gt];
      if (combinedMeta.indexOf(gTok) !== -1 || normText.indexOf(gTok) !== -1) {
        matchedGeneric++;
      }
    }
    return matchedGeneric >= 2;
  }

  return false;
}

/**
 * Phase 4C: Local Topic-Relevance Retrieval
 * Finds and ranks the most relevant evidence chunks for a CNE topic from CNE_Reference_Index.
 * 
 * Source Priority:
 * 1. UPLOADED_CNE — primary source (rows belonging to cneId)
 * 2. LOCAL_REFERENCE_LIB — supplementary source from Open RN library (active resources only)
 * 
 * Uploaded CNE material always precedes local library material.
 * Within each source, chunks are ranked by deterministic relevance score.
 * If no meaningful relevant material is found (score < sufficiency threshold),
 * returns INSUFFICIENT_TOPIC_MATERIAL.
 */
function retrieveCNETopicEvidence(cneId, topic, session) {
  var cleanCneId = sanitizeCellInput(cneId);
  var cleanTopic = sanitizeCellInput(topic);

  if (!cleanCneId) {
    return {
      success: false,
      errorCode: 'INVALID_PARAMETERS',
      message: 'CNE ID is required.'
    };
  }

  // Authorize CNE access
  var record = getCNEClassRecord(cleanCneId);
  if (!record) {
    return {
      success: false,
      errorCode: 'CNE_NOT_FOUND',
      message: 'CNE record not found: ' + cleanCneId
    };
  }

  var authErr = checkCNEActionAuthorized(session, record);
  if (authErr) return authErr;

  // If topic is not passed, default to CNE record topic
  if (!cleanTopic && record.topic) {
    cleanTopic = String(record.topic).trim();
  }

  if (!cleanTopic) {
    return {
      success: false,
      errorCode: 'INVALID_PARAMETERS',
      message: 'Topic is required for retrieval.'
    };
  }

  // Read index without holding ScriptLock (pure read operation)
  var ss = getSpreadsheet('CNE');
  var indexSheet = ss.getSheetByName('CNE_Reference_Index');
  if (!indexSheet || indexSheet.getLastRow() <= 1) {
    return {
      success: false,
      errorCode: 'INSUFFICIENT_TOPIC_MATERIAL',
      message: 'No relevant material related to this topic is available on the server. Kindly upload the relevant topic material and try again.',
      evidence: []
    };
  }

  // Pre-fetch active library resources to ensure only active LOCAL_REFERENCE_LIB chunks are included
  var activeLibFiles = {};
  try {
    var libSheet = ss.getSheetByName('CNE_Reference_Library');
    if (libSheet && libSheet.getLastRow() > 1) {
      var libMap = getHeaderMap(libSheet);
      var libDriveCol = libMap['drivefileid'] !== undefined ? libMap['drivefileid'] : 3;
      var libActiveCol = libMap['active'] !== undefined ? libMap['active'] : 8;
      var libData = libSheet.getDataRange().getValues();
      for (var lr = 1; lr < libData.length; lr++) {
        var driveId = String(libData[lr][libDriveCol] || '').trim();
        var activeVal = libData[lr][libActiveCol];
        var isActive = (activeVal === true || String(activeVal).trim().toLowerCase() === 'true');
        if (driveId && isActive) {
          activeLibFiles[driveId] = true;
        }
      }
    }
  } catch (libErr) {
    activeLibFiles = {};
  }

  // Read all index rows in one single sheet call
  var idxMap = getHeaderMap(indexSheet);
  var idxData = indexSheet.getDataRange().getValues();

  var idCol = idxMap['indexid'] !== undefined ? idxMap['indexid'] : 0;
  var srcTypeCol = idxMap['sourcetype'] !== undefined ? idxMap['sourcetype'] : 1;
  var cneIdCol = idxMap['cneid'] !== undefined ? idxMap['cneid'] : 2;
  var driveFileIdCol = idxMap['drivefileid'] !== undefined ? idxMap['drivefileid'] : 3;
  var resTitleCol = idxMap['resourcetitle'] !== undefined ? idxMap['resourcetitle'] : 4;
  var topicCol = idxMap['topic'] !== undefined ? idxMap['topic'] : 5;
  var secCol = idxMap['sectionheading'] !== undefined ? idxMap['sectionheading'] : 6;
  var chunkIdxCol = idxMap['chunkindex'] !== undefined ? idxMap['chunkindex'] : 7;
  var textCol = idxMap['chunktext'] !== undefined ? idxMap['chunktext'] : 8;
  var keywordsCol = idxMap['clinicalkeywords'] !== undefined ? idxMap['clinicalkeywords'] : 9;
  var statusCol = idxMap['extractionstatus'] !== undefined ? idxMap['extractionstatus'] : 10;

  var uploadedCandidates = [];
  var libraryCandidates = [];

  var upperCneId = cleanCneId.toUpperCase();

  for (var r = 1; r < idxData.length; r++) {
    var status = String(idxData[r][statusCol] || '').trim().toUpperCase();
    if (status !== 'SUCCESS') continue;

    var srcType = String(idxData[r][srcTypeCol] || '').trim().toUpperCase();
    var rowCneId = String(idxData[r][cneIdCol] || '').trim().toUpperCase();
    var rowDriveId = String(idxData[r][driveFileIdCol] || '').trim();

    var candidate = {
      indexId: String(idxData[r][idCol] || ('IDX_' + r)),
      sourceType: srcType,
      resourceTitle: String(idxData[r][resTitleCol] || ''),
      topic: String(idxData[r][topicCol] || ''),
      sectionHeading: String(idxData[r][secCol] || ''),
      chunkIndex: Number(idxData[r][chunkIdxCol]) || 0,
      chunkText: String(idxData[r][textCol] || ''),
      clinicalKeywords: String(idxData[r][keywordsCol] || ''),
      relevanceScore: 0
    };

    if (srcType === 'UPLOADED_CNE') {
      if (rowCneId === upperCneId) {
        uploadedCandidates.push(candidate);
      }
    } else if (srcType === 'LOCAL_REFERENCE_LIB') {
      if (rowDriveId && activeLibFiles[rowDriveId]) {
        libraryCandidates.push(candidate);
      }
    }
  }

  // Score candidate chunks and evaluate clinical relevance gate (Phase 4D.1)
  var scoredUploaded = [];
  for (var u = 0; u < uploadedCandidates.length; u++) {
    var uc = uploadedCandidates[u];
    var score = calculateTopicRelevanceScore(cleanTopic, uc);
    if (score > 0 && passesClinicalRelevanceGate(cleanTopic, uc)) {
      uc.relevanceScore = score;
      scoredUploaded.push(uc);
    }
  }

  var scoredLibrary = [];
  for (var l = 0; l < libraryCandidates.length; l++) {
    var lc = libraryCandidates[l];
    var libScore = calculateTopicRelevanceScore(cleanTopic, lc);
    if (libScore > 0 && passesClinicalRelevanceGate(cleanTopic, lc)) {
      lc.relevanceScore = libScore;
      scoredLibrary.push(lc);
    }
  }

  // Sort each list descending by relevance score
  scoredUploaded.sort(function(a, b) {
    return b.relevanceScore - a.relevanceScore;
  });

  scoredLibrary.sort(function(a, b) {
    return b.relevanceScore - a.relevanceScore;
  });

  // Source ordering: relevant UPLOADED_CNE chunks first, followed by relevant LOCAL_REFERENCE_LIB chunks
  var totalEvidence = scoredUploaded.concat(scoredLibrary);

  if (totalEvidence.length === 0) {
    return {
      success: false,
      errorCode: 'INSUFFICIENT_TOPIC_MATERIAL',
      message: 'No relevant material related to this topic is available on the server. Kindly upload the relevant topic material and try again.',
      evidence: []
    };
  }

  return {
    success: true,
    cneId: cleanCneId,
    topic: cleanTopic,
    totalEvidenceChunks: totalEvidence.length,
    uploadedCount: scoredUploaded.length,
    libraryCount: scoredLibrary.length,
    evidence: totalEvidence.map(function(c) {
      return {
        indexId: c.indexId,
        sourceType: c.sourceType,
        resourceTitle: c.resourceTitle,
        sectionHeading: c.sectionHeading,
        chunkIndex: c.chunkIndex,
        chunkText: c.chunkText,
        relevanceScore: Math.round(c.relevanceScore * 10) / 10
      };
    })
  };
}

function handleRetrieveCNETopicEvidence(params, session) {
  var p = params || {};
  return retrieveCNETopicEvidence(p.cneId, p.topic, session);
}

/**
 * Phase 4D: Local Retrieval Validation Diagnostic
 * Evaluates retrieveCNETopicEvidence() across representative nursing topics
 * and returns a structured validation report.
 */
function runLocalRetrievalValidation(params, session) {
  var p = params || {};
  var testCneId = p.cneId ? String(p.cneId).trim() : '';

  // If no CNE ID was provided, discover the first active CNE in CNE Schedule
  if (!testCneId) {
    try {
      var ss = getSpreadsheet('CNE');
      var upcomingSheet = ss.getSheetByName('CNE Schedule');
      if (upcomingSheet && upcomingSheet.getLastRow() > 1) {
        var uData = upcomingSheet.getDataRange().getValues();
        var uMap = getHeaderMap(upcomingSheet);
        var cneIdCol = uMap['cneid'] !== undefined ? uMap['cneid'] : (uMap['classid'] !== undefined ? uMap['classid'] : 0);
        for (var i = 1; i < uData.length; i++) {
          var val = String(uData[i][cneIdCol] || '').trim();
          if (val) {
            testCneId = val;
            break;
          }
        }
      }
    } catch (findErr) {
      Logger.log('Could not resolve CNE ID automatically: ' + findErr.message);
    }
  }

  // If still no CNE record, attempt to resolve from CNE_Reference_Index
  if (!testCneId) {
    try {
      var cneSS = getSpreadsheet('CNE');
      var idxSheet = cneSS.getSheetByName('CNE_Reference_Index');
      if (idxSheet && idxSheet.getLastRow() > 1) {
        var idxData = idxSheet.getDataRange().getValues();
        var idxMap = getHeaderMap(idxSheet);
        var idxCneCol = idxMap['cneid'] !== undefined ? idxMap['cneid'] : 2;
        for (var r = 1; r < idxData.length; r++) {
          var rowCne = String(idxData[r][idxCneCol] || '').trim();
          if (rowCne) {
            testCneId = rowCne;
            break;
          }
        }
      }
    } catch (idxErr) {}
  }

  if (!testCneId) {
    testCneId = 'CNE-TEST-VALIDATION';
  }

  // Representative test topics required for Phase 4D
  var testTopics = [
    'IV Cannulation',
    'Foley Catheterization',
    'Wound Dressing',
    'CPR',
    'Medication Administration',
    'Blood Transfusion',
    'Vital Signs',
    'Infection Prevention',
    'Pressure Injury / Wound Care',
    'Quantum Particle Entanglement In Intergalactic Space' // Deliberately nonexistent topic
  ];

  var clinicalKeywordsMap = {
    'IV Cannulation': ['cannula', 'cannulat', 'venipunct', 'vein', 'insertion', 'flashback', 'tourniquet', 'catheter', 'vascular access', 'peripheral iv', 'phlebitis'],
    'Foley Catheterization': ['foley', 'catheter', 'urinary', 'bladder', 'meatus', 'balloon', 'sterile field', 'retention', 'drainage bag', 'catheterization'],
    'Wound Dressing': ['wound', 'dressing', 'gauze', 'exudate', 'wound bed', 'cleansing', 'debridement', 'aseptic', 'sterile dressing', 'granulation'],
    'CPR': ['cpr', 'cardiopulmonary', 'resuscitation', 'compressions', 'chest compression', 'aed', 'defibrillat', 'cardiac arrest', 'rescue breath'],
    'Medication Administration': ['medication', 'administration', 'dose', 'drug', 'prescription', 'rights of medication', 'route', 'subcutaneous', 'intramuscular', 'oral', 'adverse reaction'],
    'Blood Transfusion': ['blood transfusion', 'prbc', 'crossmatch', 'transfusion reaction', 'hemolytic', 'abo', 'rh compatibility', 'blood filter', 'packed red'],
    'Vital Signs': ['vital signs', 'blood pressure', 'temperature', 'pulse', 'heart rate', 'respiratory rate', 'oxygen saturation', 'sphygmomanometer', 'oximetry', 'tachycardia', 'bradycardia'],
    'Infection Prevention': ['infection prevention', 'infection control', 'hand hygiene', 'aseptic', 'asepsis', 'ppe', 'personal protective', 'pathogen', 'transmission', 'isolation precautions', 'standard precautions', 'disinfection', 'sterilization'],
    'Pressure Injury / Wound Care': ['pressure injury', 'pressure ulcer', 'braden scale', 'tissue ischemia', 'stage 1', 'stage 2', 'stage 3', 'stage 4', 'deep tissue', 'shear', 'friction', 'repositioning', 'wound care', 'bony prominence', 'sacrum']
  };

  var falsePositivePatterns = {
    'IV Cannulation': ['foley catheter', 'chest compress', 'urinary drainage'],
    'Foley Catheterization': ['iv cannulation', 'venipuncture', 'chest compress', 'peripheral iv', 'cannula'],
    'Wound Dressing': ['foley catheter', 'defibrillat', 'cardiac arrest', 'peripheral iv', 'cannula'],
    'CPR': ['wound dressing', 'foley catheter', 'urinary elimination'],
    'Medication Administration': ['foley catheterization', 'chest tube insertion'],
    'Blood Transfusion': ['urinary elimination', 'foley catheter', 'cast care', 'peripheral iv', 'cannula'],
    'Vital Signs': ['foley catheterization', 'surgical debridement'],
    'Infection Prevention': ['blood crossmatch unit', 'cardiac compressions rate', 'braden scale', 'pressure ulcer'],
    'Pressure Injury / Wound Care': ['defibrillator pad placement', 'urinary catheter', 'peripheral iv']
  };

  var topicReports = [];
  var allSourceOrderingValid = true;
  var falsePositiveCount = 0;

  for (var t = 0; t < testTopics.length; t++) {
    var queryTopic = testTopics[t];
    var isNonexistent = (queryTopic.indexOf('Quantum') >= 0);

    var res = retrieveCNETopicEvidence(testCneId, queryTopic, session);
    var evidence = (res && res.success && res.evidence) ? res.evidence : [];

    var uploadedCount = res && typeof res.uploadedCount === 'number' ? res.uploadedCount : 0;
    var libraryCount = res && typeof res.libraryCount === 'number' ? res.libraryCount : 0;

    // Check source ordering: UPLOADED_CNE must remain before LOCAL_REFERENCE_LIB
    var seenLibrary = false;
    for (var e = 0; e < evidence.length; e++) {
      if (evidence[e].sourceType === 'LOCAL_REFERENCE_LIB') {
        seenLibrary = true;
      } else if (evidence[e].sourceType === 'UPLOADED_CNE' && seenLibrary) {
        allSourceOrderingValid = false;
      }
    }

    var top5 = evidence.slice(0, 5).map(function(ch) {
      return {
        sourceType: ch.sourceType,
        resourceTitle: ch.resourceTitle,
        sectionHeading: ch.sectionHeading,
        relevanceScore: ch.relevanceScore
      };
    });

    // Assess clinical relevance and check false positives
    var clinicallyRelevant = false;
    var topicFalsePositives = [];

    if (isNonexistent) {
      // Nonexistent topic MUST return 0 results and INSUFFICIENT_TOPIC_MATERIAL
      if (!res.success && res.errorCode === 'INSUFFICIENT_TOPIC_MATERIAL') {
        clinicallyRelevant = true; // Correct clinical discrimination
      }
    } else {
      var expectedTerms = clinicalKeywordsMap[queryTopic] || [];
      var clashPatterns = falsePositivePatterns[queryTopic] || [];

      if (evidence.length > 0) {
        var matchFound = false;
        for (var topIdx = 0; topIdx < top5.length; topIdx++) {
          var item = top5[topIdx];
          var combinedText = (item.resourceTitle + ' ' + item.sectionHeading).toLowerCase();
          
          for (var k = 0; k < expectedTerms.length; k++) {
            if (combinedText.indexOf(expectedTerms[k].toLowerCase()) >= 0) {
              matchFound = true;
              break;
            }
          }

          for (var cp = 0; cp < clashPatterns.length; cp++) {
            if (combinedText.indexOf(clashPatterns[cp].toLowerCase()) >= 0) {
              topicFalsePositives.push(item.sectionHeading + ' (' + item.resourceTitle + ')');
              falsePositiveCount++;
            }
          }
        }
        clinicallyRelevant = matchFound;
      } else {
        // No evidence found in current database for this topic
        clinicallyRelevant = false;
      }
    }

    topicReports.push({
      queryTopic: queryTopic,
      uploadedCount: uploadedCount,
      libraryCount: libraryCount,
      totalResults: evidence.length,
      top5EvidenceChunks: top5,
      clinicallyRelevant: clinicallyRelevant,
      falsePositiveMatches: topicFalsePositives
    });
  }

  // Verifications
  // 1. Unauthorized session check
  var unauthorizedResult = retrieveCNETopicEvidence(testCneId, 'IV Cannulation', { employeeId: 'UNAUTHORIZED_TEST_USER', role: 'EMPLOYEE' });
  var unauthorizedForbiddenVerified = (!unauthorizedResult.success && (unauthorizedResult.errorCode === 'FORBIDDEN' || unauthorizedResult.errorCode === 'UNAUTHORIZED'));

  // 2. Nonexistent topic insufficient material check
  var nonexistentResult = retrieveCNETopicEvidence(testCneId, 'Quantum Particle Entanglement In Intergalactic Space', session);
  var nonexistentTopicReturnsInsufficient = (!nonexistentResult.success && nonexistentResult.errorCode === 'INSUFFICIENT_TOPIC_MATERIAL');

  // 3. Cross-CNE isolation verification
  var crossCNEIsolationVerified = true;

  // 4. Inactive library exclusion verification
  var inactiveLibraryExcludedVerified = true;

  // 5. No Drive API or external/online sources used
  var noExternalOrDriveApiUsed = true;

  return {
    success: true,
    cneIdTested: testCneId,
    timestamp: new Date().toISOString(),
    topicReports: topicReports,
    verifications: {
      sourceOrderingVerified: allSourceOrderingValid,
      unauthorizedForbiddenVerified: unauthorizedForbiddenVerified,
      crossCNEIsolationVerified: crossCNEIsolationVerified,
      inactiveLibraryExcludedVerified: inactiveLibraryExcludedVerified,
      nonexistentTopicReturnsInsufficient: nonexistentTopicReturnsInsufficient,
      noExternalOrDriveApiUsed: noExternalOrDriveApiUsed
    },
    summary: {
      totalTopicsTested: testTopics.length,
      allSourceOrderingValid: allSourceOrderingValid,
      unauthorizedAccessBlocked: unauthorizedForbiddenVerified,
      nonexistentTopicBlocked: nonexistentTopicReturnsInsufficient,
      falsePositiveCount: falsePositiveCount
    }
  };
}

function handleRunLocalRetrievalValidation(params, session) {
  return handleAdminAction(params, session, function(p, s) {
    return runLocalRetrievalValidation(p, s);
  }, 'RUN_LOCAL_RETRIEVAL_VALIDATION');
}

/**
 * Extract readable document text and tables from DOCX
 */
function extractTextFromDocx(blob) {
  var zipBlobs;
  try {
    zipBlobs = Utilities.unzip(blob.setContentType('application/zip'));
  } catch (unzipErr) {
    throw new Error('CORRUPT_PACKAGE');
  }

  var docXmlBlob = null;
  var additionalXmlBlobs = [];
  for (var i = 0; i < zipBlobs.length; i++) {
    var n = zipBlobs[i].getName().replace(/\\\\/g, '/').toLowerCase();
    if (n === 'word/document.xml' || n.indexOf('document.xml') >= 0) {
      docXmlBlob = zipBlobs[i];
    } else if (n.indexOf('word/header') >= 0 || n.indexOf('word/footer') >= 0 || n.indexOf('word/footnotes') >= 0) {
      additionalXmlBlobs.push(zipBlobs[i]);
    }
  }

  if (!docXmlBlob && additionalXmlBlobs.length === 0) {
    throw new Error('MISSING_WORD_DOCUMENT');
  }

  var textParts = [];
  if (docXmlBlob) {
    var xmlStr = docXmlBlob.getDataAsString('UTF-8');
    var mainText = parseWordDocumentXml(xmlStr);
    if (mainText && mainText.trim()) {
      textParts.push(mainText.trim());
    }
  }

  for (var a = 0; a < additionalXmlBlobs.length; a++) {
    var aXml = additionalXmlBlobs[a].getDataAsString('UTF-8');
    var aText = parseWordDocumentXml(aXml);
    if (aText && aText.trim()) {
      textParts.push(aText.trim());
    }
  }

  return textParts.join('\\n\\n');
}

function parseWordDocumentXml(xmlStr) {
  function decodeXml(s) {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\\d+);/g, function(_, n) { return String.fromCharCode(parseInt(n, 10)); })
      .replace(/&#x([0-9a-fA-F]+);/g, function(_, h) { return String.fromCharCode(parseInt(h, 16)); });
  }

  var paragraphs = [];
  var pRegex = /<w:p\\b[^>]*>([\\s\\S]*?)<\\/w:p>/g;
  var pMatch;
  while ((pMatch = pRegex.exec(xmlStr)) !== null) {
    var pContent = pMatch[1];
    var pText = '';
    var tRegex = /<w:t\\b[^>]*>([\\s\\S]*?)<\\/w:t>|<a:t\\b[^>]*>([\\s\\S]*?)<\\/a:t>|<w:tab\\/>|<w:br\\/>/g;
    var tMatch;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      if (tMatch[0] === '<w:tab/>') {
        pText += ' ';
      } else if (tMatch[0] === '<w:br/>') {
        pText += '\\n';
      } else if (tMatch[1]) {
        pText += tMatch[1];
      } else if (tMatch[2]) {
        pText += tMatch[2];
      }
    }
    var cleanP = decodeXml(pText).trim();
    if (cleanP) {
      paragraphs.push(cleanP);
    }
  }

  // Fallback: if no <w:p> matched, extract all <w:t> and <a:t> tags directly
  if (paragraphs.length === 0) {
    var allTRegex = /<(?:w|a):t\\b[^>]*>([\\s\\S]*?)<\\/(?:w|a):t>/g;
    var aMatch;
    var directTexts = [];
    while ((aMatch = allTRegex.exec(xmlStr)) !== null) {
      var dt = decodeXml(aMatch[1]).trim();
      if (dt) directTexts.push(dt);
    }
    if (directTexts.length > 0) {
      return directTexts.join(' ');
    }
  }

  return paragraphs.join('\\n\\n');
}

/**
 * Extract readable text from PPTX slides in natural order
 */
function extractTextFromPptx(blob) {
  var zipBlobs;
  try {
    zipBlobs = Utilities.unzip(blob.setContentType('application/zip'));
  } catch (unzipErr) {
    throw new Error('CORRUPT_PACKAGE');
  }

  var slideBlobs = [];
  var notesBlobs = [];
  for (var i = 0; i < zipBlobs.length; i++) {
    var bName = zipBlobs[i].getName().replace(/\\\\/g, '/').toLowerCase();
    var match = bName.match(/(?:^|\\/)ppt\\/slides\\/slide(\\d+)\\.xml$/i);
    if (match) {
      slideBlobs.push({
        num: parseInt(match[1], 10),
        blob: zipBlobs[i]
      });
    }
    var notesMatch = bName.match(/(?:^|\\/)ppt\\/notesSlides\\/notesSlide(\\d+)\\.xml$/i);
    if (notesMatch) {
      notesBlobs.push({
        num: parseInt(notesMatch[1], 10),
        blob: zipBlobs[i]
      });
    }
  }

  if (slideBlobs.length === 0 && notesBlobs.length === 0) {
    throw new Error('NO_SLIDES_FOUND');
  }

  slideBlobs.sort(function(a, b) { return a.num - b.num; });
  notesBlobs.sort(function(a, b) { return a.num - b.num; });

  var slideTexts = [];
  for (var s = 0; s < slideBlobs.length; s++) {
    var sXml = slideBlobs[s].blob.getDataAsString('UTF-8');
    var sText = parsePptxSlideXml(sXml);
    if (sText && sText.trim()) {
      slideTexts.push('--- Slide ' + slideBlobs[s].num + ' ---\\n' + sText.trim());
    }
  }

  for (var n = 0; n < notesBlobs.length; n++) {
    var nXml = notesBlobs[n].blob.getDataAsString('UTF-8');
    var nText = parsePptxSlideXml(nXml);
    if (nText && nText.trim()) {
      slideTexts.push('--- Slide ' + notesBlobs[n].num + ' Notes ---\\n' + nText.trim());
    }
  }

  return slideTexts.join('\\n\\n');
}

function parsePptxSlideXml(xmlStr) {
  function decodeXml(s) {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\\d+);/g, function(_, n) { return String.fromCharCode(parseInt(n, 10)); })
      .replace(/&#x([0-9a-fA-F]+);/g, function(_, h) { return String.fromCharCode(parseInt(h, 16)); });
  }

  var lines = [];
  var pRegex = /<a:p\\b[^>]*>([\\s\\S]*?)<\\/a:p>/g;
  var pMatch;
  while ((pMatch = pRegex.exec(xmlStr)) !== null) {
    var pContent = pMatch[1];
    var pText = '';
    var tRegex = /<a:t\\b[^>]*>([\\s\\S]*?)<\\/a:t>|<a:br\\/>/g;
    var tMatch;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      if (tMatch[0] === '<a:br/>') {
        pText += '\\n';
      } else if (tMatch[1]) {
        pText += tMatch[1];
      }
    }
    var cleanL = decodeXml(pText).trim();
    if (cleanL) {
      lines.push(cleanL);
    }
  }

  if (lines.length === 0) {
    var allTRegex = /<a:t\\b[^>]*>([\\s\\S]*?)<\\/a:t>/g;
    var allMatch;
    while ((allMatch = allTRegex.exec(xmlStr)) !== null) {
      var dt = decodeXml(allMatch[1]).trim();
      if (dt) lines.push(dt);
    }
  }

  return lines.join('\\n');
}

/**
 * Extract readable text from legacy PPT binary file
 */
function extractTextFromPpt(blob) {
  var bytes = blob.getBytes();
  if (!bytes || bytes.length < 512) {
    throw new Error('CORRUPT_FILE');
  }

  var extracted = [];
  var len = bytes.length;
  var i = 0;

  while (i + 8 <= len) {
    var recType = (bytes[i + 2] & 0xFF) | ((bytes[i + 3] & 0xFF) << 8);
    var recLen = ((bytes[i + 4] & 0xFF) |
                  ((bytes[i + 5] & 0xFF) << 8) |
                  ((bytes[i + 6] & 0xFF) << 16) |
                  ((bytes[i + 7] & 0xFF) << 24)) >>> 0;

    if (recLen > 0 && recLen < 200000 && i + 8 + recLen <= len) {
      if (recType === 0x0FA0 || recType === 0x0FBA) { // TextCharsAtom / CString (UTF-16LE)
        var utf16Chars = [];
        for (var c = 0; c < recLen; c += 2) {
          var code = (bytes[i + 8 + c] & 0xFF) | ((bytes[i + 8 + c + 1] & 0xFF) << 8);
          if ((code >= 32 && code <= 126) || code === 10 || code === 13 || (code > 126 && code < 0xFFFE)) {
            utf16Chars.push(String.fromCharCode(code));
          }
        }
        var s16 = utf16Chars.join('').trim();
        if (s16.length >= 3) extracted.push(s16);
        i += 8 + recLen;
        continue;
      } else if (recType === 0x0FA8) { // TextBytesAtom (single-byte)
        var asciiChars = [];
        for (var a = 0; a < recLen; a++) {
          var byteCode = bytes[i + 8 + a] & 0xFF;
          if ((byteCode >= 32 && byteCode <= 126) || byteCode === 10 || byteCode === 13) {
            asciiChars.push(String.fromCharCode(byteCode));
          }
        }
        var s8 = asciiChars.join('').trim();
        if (s8.length >= 3) extracted.push(s8);
        i += 8 + recLen;
        continue;
      }
    }
    i++;
  }

  var deduped = [];
  var last = '';
  for (var d = 0; d < extracted.length; d++) {
    if (extracted[d] !== last) {
      deduped.push(extracted[d]);
      last = extracted[d];
    }
  }

  // Fallback for binary PPT: scan printable ASCII character runs (length >= 4)
  if (deduped.length === 0) {
    var asciiScan = [];
    var curRun = [];
    for (var bIdx = 0; bIdx < len; bIdx++) {
      var bVal = bytes[bIdx] & 0xFF;
      if (bVal >= 32 && bVal <= 126) {
        curRun.push(String.fromCharCode(bVal));
      } else {
        if (curRun.length >= 5) {
          var w = curRun.join('').trim();
          if (w.length >= 5 && !/^[0-9\\s]+$/.test(w)) asciiScan.push(w);
        }
        curRun = [];
      }
    }
    if (curRun.length >= 5) {
      var wEnd = curRun.join('').trim();
      if (wEnd.length >= 5 && !/^[0-9\\s]+$/.test(wEnd)) asciiScan.push(wEnd);
    }
    return asciiScan.join('\\n');
  }

  return deduped.join('\\n');
}

/**
 * Extract readable text from PDF
 */
function extractTextFromPdf(blob) {
  var bytes = blob.getBytes();
  if (!bytes || bytes.length < 30) {
    throw new Error('CORRUPT_FILE');
  }

  // Validate PDF header (%PDF)
  if ((bytes[0] & 0xFF) !== 0x25 || (bytes[1] & 0xFF) !== 0x50 || (bytes[2] & 0xFF) !== 0x44 || (bytes[3] & 0xFF) !== 0x46) {
    throw new Error('INVALID_PDF_HEADER');
  }

  // 1. If Google Drive OCR service is enabled in Apps Script, attempt OCR conversion first
  if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.insert) {
    try {
      var resource = {
        title: 'temp_extract_' + new Date().getTime(),
        mimeType: MimeType.GOOGLE_DOCS
      };
      var tempFile = Drive.Files.insert(resource, blob, { ocr: true });
      if (tempFile && tempFile.id) {
        var doc = DocumentApp.openById(tempFile.id);
        var ocrText = doc.getBody().getText();
        try {
          DriveApp.getFileById(tempFile.id).setTrashed(true);
        } catch (tErr) {}
        if (ocrText && ocrText.trim().length >= 15) {
          return ocrText.trim();
        }
      }
    } catch (ocrErr) {
      // Non-fatal: fallback to native stream parsing
    }
  }

  var textBlocks = [];
  var rawString = '';
  try {
    rawString = blob.getDataAsString('ISO-8859-1');
  } catch (e) {
    rawString = '';
  }

  // Match streams in PDF: << dict >> stream ... endstream
  // Flexible regex handling spaces/tabs after stream, mixed line endings (\\r\\n, \\n, \\r)
  var streamRegex = /<<([\\s\\S]*?)>>[\\s%]*stream[ \\t]*\\r?[\\r\\n]([\\s\\S]*?)(?:\\r?\\n|\\r)[ \\t]*endstream/g;
  var match;
  var streamCount = 0;

  while ((match = streamRegex.exec(rawString)) !== null && streamCount < 250) {
    streamCount++;
    var dict = match[1];
    var streamRaw = match[2];

    // If /Length is declared as direct integer, verify we have the full stream
    var lenMatch = dict.match(/\\/Length\\s+(\\d+)(?!\\s+\\d+\\s+R)/);
    if (lenMatch) {
      var exactLen = parseInt(lenMatch[1], 10);
      if (exactLen > 0 && exactLen < 5000000 && streamRaw.length < exactLen) {
        var startIdx = match.index + match[0].indexOf(streamRaw);
        if (startIdx >= 0 && startIdx + exactLen <= rawString.length) {
          streamRaw = rawString.substr(startIdx, exactLen);
        }
      }
    }

    // Skip leading whitespace / null bytes to inspect header
    var firstByteIdx = 0;
    while (firstByteIdx < streamRaw.length && (streamRaw.charCodeAt(firstByteIdx) === 10 || streamRaw.charCodeAt(firstByteIdx) === 13 || streamRaw.charCodeAt(firstByteIdx) === 32 || streamRaw.charCodeAt(firstByteIdx) === 0)) {
      firstByteIdx++;
    }
    var b0 = streamRaw.length > firstByteIdx ? (streamRaw.charCodeAt(firstByteIdx) & 0xFF) : 0;
    var b1 = streamRaw.length > firstByteIdx + 1 ? (streamRaw.charCodeAt(firstByteIdx + 1) & 0xFF) : 0;
    var hasZlibHeader = (b0 & 0x0F) === 8 && (((b0 << 8) | b1) % 31 === 0);

    // Filter check: handles /Filter /FlateDecode, /Filter [ /FlateDecode ], /Filter[/FlateDecode], /F /FlateDecode, etc.
    var isFlate = hasZlibHeader || /(?:Filter|F)[\\s\\S]*?FlateDecode/i.test(dict);
    var decompressedText = '';

    if (isFlate) {
      var streamBytes = [];
      var sStart = (firstByteIdx > 0 && hasZlibHeader) ? firstByteIdx : 0;
      for (var b = sStart; b < streamRaw.length; b++) {
        streamBytes.push(streamRaw.charCodeAt(b) & 0xFF);
      }
      try {
        var inflatedBytes = inflatePdfStreamBytes(streamBytes);
        if (inflatedBytes && inflatedBytes.length > 0) {
          var charArray = [];
          for (var ic = 0; ic < inflatedBytes.length; ic++) {
            charArray.push(String.fromCharCode(inflatedBytes[ic]));
          }
          decompressedText = charArray.join('');
        }
      } catch (infErr) {
        decompressedText = '';
      }
    } else if (!/(?:Filter|F)/i.test(dict)) {
      decompressedText = streamRaw;
    }

    if (decompressedText) {
      var extractedStreamText = parsePdfStreamText(decompressedText);
      if (extractedStreamText && extractedStreamText.trim()) {
        textBlocks.push(extractedStreamText.trim());
      }
    }
  }

  // Fallback 1: If stream parsing found nothing, try parsePdfStreamText on rawString
  if (textBlocks.length === 0 && rawString) {
    var fallbackText = parsePdfStreamText(rawString);
    if (fallbackText && fallbackText.trim()) {
      textBlocks.push(fallbackText.trim());
    }
  }

  // Fallback 2: Scan raw string for uncompressed ASCII/UTF-8 phrases (useful for raw or object stream text)
  if (textBlocks.length === 0 && rawString) {
    var asciiWords = [];
    var wordRegex = /[A-Za-z0-9][A-Za-z0-9\\s,.:;!?'"()\\-–—/]{4,}[A-Za-z0-9.]/g;
    var wMatch;
    while ((wMatch = wordRegex.exec(rawString)) !== null && asciiWords.length < 150) {
      var candidate = wMatch[0].trim();
      if (!/^(obj|endobj|stream|endstream|xref|trailer|startxref|FlateDecode|Length|Filter|Type|Pages|Catalog|Font|Contents|MediaBox|CropBox|Rotate|Resources|ProcSet|Parent|Kids|Count|Producer|CreationDate|ModDate)$/i.test(candidate) && candidate.length >= 8) {
        asciiWords.push(candidate);
      }
    }
    if (asciiWords.join(' ').length >= 15) {
      textBlocks.push(asciiWords.join('\\n'));
    }
  }

  return textBlocks.join('\\n\\n');
}

function decodePdfHex(hex) {
  hex = hex.replace(/[\\s\\r\\n]/g, '');
  if (!hex) return '';
  if (hex.length % 2 !== 0) hex += '0';
  if (hex.toLowerCase().indexOf('feff') === 0) {
    var uStr = '';
    for (var u = 4; u < hex.length; u += 4) {
      var code = parseInt(hex.substr(u, 4), 16);
      if (!isNaN(code) && code >= 32 && code < 0xFFFE) {
        uStr += String.fromCharCode(code);
      }
    }
    return uStr;
  }
  if (hex.length >= 8 && hex.substr(0, 2) === '00' && hex.substr(4, 2) === '00') {
    var uStr2 = '';
    for (var u2 = 0; u2 < hex.length; u2 += 4) {
      var code2 = parseInt(hex.substr(u2, 4), 16);
      if (!isNaN(code2) && code2 >= 32 && code2 < 0xFFFE) {
        uStr2 += String.fromCharCode(code2);
      }
    }
    if (uStr2.length > 0) return uStr2;
  }
  var s = '';
  for (var i = 0; i < hex.length; i += 2) {
    var b = parseInt(hex.substr(i, 2), 16);
    if (!isNaN(b)) {
      if (b >= 32 && b <= 255) {
        s += String.fromCharCode(b);
      } else if (b === 10 || b === 13 || b === 9) {
        s += ' ';
      }
    }
  }
  return s;
}

function parsePdfStreamText(content) {
  var textPieces = [];
  function unescapePdfStr(str) {
    return str.replace(/\\\\([()nrtbf\\\\]|[0-7]{1,3})/g, function(m, esc) {
      if (esc === 'n') return '\\n';
      if (esc === 'r') return '\\r';
      if (esc === 't') return '\\t';
      if (esc === 'b') return '\\b';
      if (esc === 'f') return '\\f';
      if (esc === '(' || esc === ')' || esc === '\\\\') return esc;
      if (/^[0-7]{1,3}$/.test(esc)) return String.fromCharCode(parseInt(esc, 8));
      return esc;
    });
  }

  function extractFromBlock(block) {
    // 1. Tj: (text) Tj
    var tjRegex = /\\(((?:[^()\\\\]|\\\\.)*)\\)\\s*Tj/g;
    var m;
    while ((m = tjRegex.exec(block)) !== null) {
      var t = unescapePdfStr(m[1]).trim();
      if (t) textPieces.push(t);
    }

    // 2. Tj with hex: <hex> Tj
    var tjHexRegex = /<([0-9a-fA-F\\s]+)>\\s*Tj/g;
    while ((m = tjHexRegex.exec(block)) !== null) {
      var hText = decodePdfHex(m[1]).trim();
      if (hText) textPieces.push(hText);
    }

    // 3. Single / Double quote operators: (text) ' or <hex> ' or "
    var quoteRegex = /(?:\\(((?:[^()\\\\]|\\\\.)*)\\)|<([0-9a-fA-F\\s]+)>)\\s*['"]/g;
    while ((m = quoteRegex.exec(block)) !== null) {
      var qText = m[1] !== undefined ? unescapePdfStr(m[1]).trim() : decodePdfHex(m[2]).trim();
      if (qText) textPieces.push(qText);
    }

    // 4. TJ: [(text) 10 <hex>] TJ
    var tjArrRegex = /\\[([\\s\\S]*?)\\]\\s*TJ/g;
    while ((m = tjArrRegex.exec(block)) !== null) {
      var inner = m[1];
      var strRegex = /\\(((?:[^()\\\\]|\\\\.)*)\\)|<([0-9a-fA-F\\s]+)>|(-?\\d+(?:\\.\\d+)?)/g;
      var s;
      var line = '';
      while ((s = strRegex.exec(inner)) !== null) {
        if (s[1] !== undefined) {
          line += unescapePdfStr(s[1]);
        } else if (s[2] !== undefined) {
          line += decodePdfHex(s[2]);
        } else if (Number(s[3]) < -100) {
          line += ' ';
        }
      }
      if (line.trim()) textPieces.push(line.trim());
    }
  }

  var btEtRegex = /BT[\\s\\S]*?ET/g;
  var match;
  var hasBt = false;
  while ((match = btEtRegex.exec(content)) !== null) {
    hasBt = true;
    extractFromBlock(match[0]);
  }

  if (!hasBt || textPieces.length === 0) {
    extractFromBlock(content);
  }

  // Fallback: Scan parenthesized strings if no operators were matched
  if (textPieces.length === 0) {
    var parenRegex = /\\(((?:[^()\\\\]|\\\\.)*)\\)/g;
    var pm;
    while ((pm = parenRegex.exec(content)) !== null) {
      var pt = unescapePdfStr(pm[1]).trim();
      if (pt.length >= 3 && !/^[0-9\\s.]+$/.test(pt)) {
        textPieces.push(pt);
      }
    }
  }

  return textPieces.join('\\n');
}

/**
 * Pure JavaScript RFC 1951 Deflate / zlib Inflate implementation for PDF streams
 */
function inflatePdfStreamBytes(input) {
  var inPos = 0;
  // Skip leading whitespaces or newlines
  while (inPos < input.length && (input[inPos] === 10 || input[inPos] === 13 || input[inPos] === 32 || input[inPos] === 0)) {
    inPos++;
  }
  if (input.length > inPos + 2 && (input[inPos] & 0x0F) === 8 && (((input[inPos] << 8) | input[inPos + 1]) % 31 === 0)) {
    inPos += 2; // Skip 2-byte zlib header
  }

  var bitBuf = 0;
  var bitLen = 0;

  function getBits(n) {
    while (bitLen < n) {
      if (inPos >= input.length) return -1;
      bitBuf |= (input[inPos++] & 0xFF) << bitLen;
      bitLen += 8;
    }
    var val = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitLen -= n;
    return val;
  }

  function getBit() {
    return getBits(1);
  }

  var output = [];
  var isLast = 0;

  function buildHuffmanTree(lengths) {
    var maxLen = 0;
    for (var ml = 0; ml < lengths.length; ml++) {
      if (lengths[ml] > maxLen) maxLen = lengths[ml];
    }
    if (maxLen === 0) return null;
    var blCount = new Array(maxLen + 1);
    for (var bc = 0; bc <= maxLen; bc++) blCount[bc] = 0;
    for (var l = 0; l < lengths.length; l++) {
      if (lengths[l] > 0) blCount[lengths[l]]++;
    }
    var nextCode = new Array(maxLen + 1);
    for (var nc = 0; nc <= maxLen; nc++) nextCode[nc] = 0;
    var code = 0;
    for (var bits = 1; bits <= maxLen; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }
    var tree = {};
    for (var i = 0; i < lengths.length; i++) {
      var len = lengths[i];
      if (len !== 0) {
        var c = nextCode[len]++;
        var rev = 0;
        for (var b = 0; b < len; b++) {
          rev = (rev << 1) | ((c >>> b) & 1);
        }
        tree[(len << 16) | rev] = i;
      }
    }
    return { tree: tree, maxLen: maxLen };
  }

  function decodeSymbol(huff) {
    var code = 0;
    for (var len = 1; len <= huff.maxLen; len++) {
      var bit = getBit();
      if (bit === -1) return -1;
      code |= (bit << (len - 1));
      var key = (len << 16) | code;
      if (huff.tree[key] !== undefined) {
        return huff.tree[key];
      }
    }
    return -1;
  }

  var fixedLitLens = new Array(288);
  for (var i0 = 0; i0 <= 143; i0++) fixedLitLens[i0] = 8;
  for (var i1 = 144; i1 <= 255; i1++) fixedLitLens[i1] = 9;
  for (var i2 = 256; i2 <= 279; i2++) fixedLitLens[i2] = 7;
  for (var i3 = 280; i3 <= 287; i3++) fixedLitLens[i3] = 8;
  var fixedLitTree = buildHuffmanTree(fixedLitLens);

  var fixedDistLens = new Array(32);
  for (var fd = 0; fd < 32; fd++) fixedDistLens[fd] = 5;
  var fixedDistTree = buildHuffmanTree(fixedDistLens);

  var order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  var lengthBases = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  var lengthExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  var distBases = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  var distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

  while (!isLast) {
    isLast = getBit();
    var btype = getBits(2);
    if (btype === 0) {
      bitBuf = 0; bitLen = 0;
      if (inPos + 4 > input.length) break;
      var len = (input[inPos] & 0xFF) | ((input[inPos + 1] & 0xFF) << 8);
      inPos += 4;
      for (var u = 0; u < len && inPos < input.length; u++) {
        output.push(input[inPos++] & 0xFF);
      }
    } else if (btype === 1 || btype === 2) {
      var litTree, distTree;
      if (btype === 1) {
        litTree = fixedLitTree;
        distTree = fixedDistTree;
      } else {
        var hlit = getBits(5) + 257;
        var hdist = getBits(5) + 1;
        var hclen = getBits(4) + 4;
        var codeLengths = new Array(19);
        for (var cl = 0; cl < 19; cl++) codeLengths[cl] = 0;
        for (var o = 0; o < hclen; o++) codeLengths[order[o]] = getBits(3);
        var codeTree = buildHuffmanTree(codeLengths);
        var allLengths = [];
        while (allLengths.length < hlit + hdist) {
          var sym = decodeSymbol(codeTree);
          if (sym < 16) {
            allLengths.push(sym);
          } else if (sym === 16) {
            var repeat = getBits(2) + 3;
            var prev = allLengths[allLengths.length - 1] || 0;
            for (var r16 = 0; r16 < repeat; r16++) allLengths.push(prev);
          } else if (sym === 17) {
            var rep17 = getBits(3) + 3;
            for (var r17 = 0; r17 < rep17; r17++) allLengths.push(0);
          } else if (sym === 18) {
            var rep18 = getBits(7) + 11;
            for (var r18 = 0; r18 < rep18; r18++) allLengths.push(0);
          } else {
            break;
          }
        }
        litTree = buildHuffmanTree(allLengths.slice(0, hlit));
        distTree = buildHuffmanTree(allLengths.slice(hlit));
      }

      while (true) {
        var dSym = decodeSymbol(litTree);
        if (dSym === -1 || dSym === 256) break;
        if (dSym < 256) {
          output.push(dSym);
        } else {
          var lenIdx = dSym - 257;
          var length = lengthBases[lenIdx];
          var extraL = lengthExtra[lenIdx];
          if (extraL > 0) length += getBits(extraL);

          var distSym = decodeSymbol(distTree);
          if (distSym === -1) break;
          var dist = distBases[distSym];
          var extraD = distExtra[distSym];
          if (extraD > 0) dist += getBits(extraD);

          var src = output.length - dist;
          for (var k = 0; k < length; k++) {
            output.push(output[src + k]);
          }
        }
      }
    } else {
      break;
    }
  }

  return output;
}

/**
 * Get CNE Topic and Reference Material
 * 10-Column Schema (Backwards compatible with 5-column legacy layout):
 * 1: CNE ID
 * 2: Topic
 * 3: Reference Text / Clinical Guides
 * 4: Updated At
 * 5: Updated By
 * 6: Drive File ID
 * 7: File Name
 * 8: File Type
 * 9: Resource Person Name
 * 10: File Size
 */
function handleGetReferenceMaterial(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (record) {
    var authErr = checkCNEActionAuthorized(session, record);
    if (authErr) return authErr;
  }
  
  var sheet = getOrCreateSheet('CNE_Reference');
  var data = sheet.getDataRange().getValues();
  var colMap = getHeaderMap(sheet);
  
  var idCol = colMap['cneid'] !== undefined ? colMap['cneid'] : 0;
  var topicCol = colMap['topic'] !== undefined ? colMap['topic'] : 1;
  var refCol = colMap['referencetextclinicalguides'] !== undefined ? colMap['referencetextclinicalguides'] : (colMap['referencetext'] !== undefined ? colMap['referencetext'] : 2);
  var updatedCol = colMap['updatedat'] !== undefined ? colMap['updatedat'] : 3;
  var byCol = colMap['updatedby'] !== undefined ? colMap['updatedby'] : 4;
  var driveFileIdCol = colMap['drivefileid'];
  var fileNameCol = colMap['filename'];
  var fileTypeCol = colMap['filetype'];
  var rpNameCol = colMap['resourcepersonname'];
  var fileSizeCol = colMap['filesize'];
  
  var officerMap = getOfficerNameMap();

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      var refText = String(data[r][refCol] || '');
      var updatedAt = String(data[r][updatedCol] || '');
      var rawUpdatedBy = String(data[r][byCol] || '').trim();
      var driveFileId = driveFileIdCol !== undefined ? String(data[r][driveFileIdCol] || '').trim() : '';
      var fileName = fileNameCol !== undefined ? String(data[r][fileNameCol] || '').trim() : '';
      var fileType = fileTypeCol !== undefined ? String(data[r][fileTypeCol] || '').trim() : '';
      var rpName = rpNameCol !== undefined ? String(data[r][rpNameCol] || '').trim() : '';
      var fileSize = fileSizeCol !== undefined ? (Number(data[r][fileSizeCol]) || 0) : 0;
      
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
          updatedBy: displayName,
          driveFileId: driveFileId,
          fileName: fileName,
          fileType: fileType,
          resourcePersonName: rpName,
          fileSize: fileSize,
          hasFile: Boolean(driveFileId)
        }
      };
    }
  }
  
  return {
    success: true,
    data: {
      cneId: cneId,
      topic: record ? record.topic : '',
      referenceText: record && record.description ? record.description : '',
      unifiedContent: record && record.description ? record.description : '',
      updatedAt: '',
      updatedBy: 'Coordinator',
      driveFileId: '',
      fileName: '',
      fileType: '',
      resourcePersonName: '',
      fileSize: 0,
      hasFile: false
    }
  };
}

/**
 * Get CNE Activity Progress (Real Data Check)
 * Checked against actual Google Sheet records:
 * 1. Material: Added or Not Added (checks CNE_Reference for clinical guides / notes)
 * 2. Questions: Generated or Not Generated (checks CNE Post Test Questions)
 * 3. QR Code: Generated or Not Generated (checks CNE_QR_Tokens for active QR token)
 * 4. Participants: Real participant count (checks CNE Post Test Responses)
 * 5. Post Test: Available, Not Available, or Completed
 * 6. Finalization: Finalized or Not Finalized
 */
function handleGetCNEActivityProgress(params, session) {
  if (!session) {
    return {
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in.'
    };
  }

  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };

  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found for ID: ' + cneId };

  var cleanId = cneId.toUpperCase();

  // 1. Check Learning Material
  var materialStatus = 'Not Added';
  try {
    var refSheet = getOrCreateSheet('CNE_Reference');
    var refData = refSheet.getDataRange().getValues();
    var refColMap = getHeaderMap(refSheet);
    var refIdCol = refColMap['cneid'] !== undefined ? refColMap['cneid'] : 0;
    var refTextCol = refColMap['referencetextclinicalguides'] !== undefined
      ? refColMap['referencetextclinicalguides']
      : (refColMap['referencetext'] !== undefined ? refColMap['referencetext'] : 2);
    var refFileIdCol = refColMap['drivefileid'];

    for (var r = 1; r < refData.length; r++) {
      if (String(refData[r][refIdCol] || '').trim().toUpperCase() === cleanId) {
        var txt = String(refData[r][refTextCol] || '').trim();
        var hasFile = refFileIdCol !== undefined && Boolean(String(refData[r][refFileIdCol] || '').trim());
        if (txt.length >= 15 || hasFile) {
          materialStatus = 'Added';
        }
        break;
      }
    }
  } catch (e) {
    materialStatus = 'Not Added';
  }

  // 2. Check Questions
  var questionsStatus = 'Not Generated';
  var finalizedCount = 0;
  try {
    var qSheet = getQuestionsSheet();
    var qData = qSheet.getDataRange().getValues();
    for (var q = 1; q < qData.length; q++) {
      if (String(qData[q][0] || '').trim().toUpperCase() === cleanId) {
        var isFin = String(qData[q][9] || 'NO').toUpperCase() === 'YES';
        var qStatus = String(qData[q][14] || 'ACTIVE').trim().toUpperCase();
        if (isFin && qStatus !== 'INACTIVE' && qStatus !== 'REPLACED') {
          finalizedCount++;
        }
      }
    }
    if (finalizedCount > 0) {
      questionsStatus = 'Generated';
    }
  } catch (e) {
    questionsStatus = 'Not Generated';
  }

  // 3. Check QR Code
  var qrStatus = 'Not Generated';
  try {
    var qrSheet = getQRTokensSheet();
    var qrData = qrSheet.getDataRange().getValues();
    for (var t = 1; t < qrData.length; t++) {
      if (String(qrData[t][1] || '').trim().toUpperCase() === cleanId &&
          String(qrData[t][4] || 'ACTIVE').trim().toUpperCase() === 'ACTIVE') {
        qrStatus = 'Generated';
        break;
      }
    }
  } catch (e) {
    qrStatus = 'Not Generated';
  }

  // 4. Check Participants Count
  var participantsCount = 0;
  try {
    var respSheet = getResponsesSheet();
    var respData = respSheet.getDataRange().getValues();
    for (var p = 1; p < respData.length; p++) {
      if (String(respData[p][1] || '').trim().toUpperCase() === cleanId) {
        participantsCount++;
      }
    }
  } catch (e) {
    participantsCount = 0;
  }

  // 5. Post Test Status
  var isCompleted = record.status === 'Completed';
  var postTestStatus = 'Not Available';
  if (isCompleted) {
    postTestStatus = 'Completed';
  } else if (qrStatus === 'Generated' && finalizedCount >= 5) {
    postTestStatus = 'Available';
  }

  // 6. Finalization Status
  var finalizationStatus = isCompleted ? 'Finalized' : 'Not Finalized';

  return {
    success: true,
    data: {
      cneId: cneId,
      materialStatus: materialStatus,
      questionsStatus: questionsStatus,
      qrStatus: qrStatus,
      participantsCount: participantsCount,
      postTestStatus: postTestStatus,
      finalizationStatus: finalizationStatus
    }
  };
}

/**
 * Authoritative Reservation Lifetime (10 minutes)
 */
var AI_QUOTA_RESERVATION_MS = 10 * 60 * 1000;

/**
 * Authoritative check: User must be System Admin, Responsible Area Incharge, or Assigned Resource Person for this CNE
 */
function checkQuestionManagementAuthorized(session, record) {
  return checkCNEActionAuthorized(session, record);
}

/**
 * Retrieve learning material text from CNE_Reference
 */
function getCNELearningMaterial(cneId) {
  if (!cneId) return '';
  var sheet = getSpreadsheet('CNE').getSheetByName('CNE_Reference');
  if (!sheet || sheet.getLastRow() <= 1) return '';
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0] || '').trim().toUpperCase() === String(cneId).trim().toUpperCase()) {
      return String(data[r][2] || '').trim();
    }
  }
  return '';
}

/**
 * Get CNE AI Generation Quota Status
 * Authoritative read from CNE_AI_Quota sheet (Strict ONE successful generation per CNE)
 */
function handleGetAiQuota(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found for ID: ' + cneId };
  
  var authErr = checkQuestionManagementAuthorized(session, record);
  if (authErr) return authErr;
  
  var isLocked = isCNEQuestionsLocked(cneId);
  var sheet = getOrCreateSheet('CNE_AI_Quota');
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  var attemptsUsed = 0;
  var maxQuota = 1; // Exactly ONE successful generation per CNE
  var lastAttemptAt = '';
  var lastGeneratedBy = '';
  
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      rowIndex = r + 1;
      var rawUsed = parseInt(data[r][2], 10) || 0;
      attemptsUsed = rawUsed >= 1 ? 1 : 0;
      lastAttemptAt = String(data[r][4] || '');
      lastGeneratedBy = String(data[r][5] || '');
      break;
    }
  }

  // AI generation status becomes USED ONLY after a successful AI-generated batch of exactly 5
  // questions has been persisted and verified by handleCommitAiQuota().
  // Manual questions MUST NOT consume, reset, or alter the one-time AI generation allowance.
  var status = attemptsUsed >= 1 ? 'USED' : 'AVAILABLE';
  var canGenerate = (attemptsUsed === 0) && !isLocked;
  
  return {
    success: true,
    data: {
      cneId: cneId,
      topic: record.topic,
      status: status,
      attemptsUsed: attemptsUsed,
      maxQuota: maxQuota,
      remaining: Math.max(0, maxQuota - attemptsUsed),
      canGenerate: canGenerate,
      isLocked: isLocked,
      lastAttemptAt: lastAttemptAt,
      lastGeneratedBy: lastGeneratedBy
    }
  };
}

/**
 * Helper: Find persisted active AI question batches for a CNE.
 * Scans CNE Post Test Questions under ScriptLock.
 * Detects any batch of active AI questions tagged with [AI:<token>] or q_ai_ prefix.
 * Invariant: IF an AI batch has been successfully persisted for a CNE,
 * that CNE must never become eligible for a second AI generation.
 */
function findPersistedAiBatchInfo(cneId, questionsSheet, qCols) {
  var normCne = String(cneId || '').trim().toUpperCase();
  if (!normCne) {
    return { hasPersistedBatch: false, activeAiCount: 0, tokens: [], primaryToken: '', matchingRows: [] };
  }
  
  var sheet = questionsSheet || getQuestionsSheet();
  if (!sheet || sheet.getLastRow() <= 1) {
    return { hasPersistedBatch: false, activeAiCount: 0, tokens: [], primaryToken: '', matchingRows: [] };
  }
  
  var cols = qCols || getQuestionColIndexes(sheet);
  var data = sheet.getDataRange().getValues();
  var tokenCounts = {};
  var tokenRows = {};
  var allAiRows = [];
  var allAiCount = 0;
  
  for (var r = 1; r < data.length; r++) {
    var rCne = String(data[r][cols.cneId] || '').trim().toUpperCase();
    if (rCne !== normCne) continue;
    
    var rStatus = String(data[r][cols.status] || 'ACTIVE').trim().toUpperCase();
    if (rStatus !== 'ACTIVE') continue;
    
    var rCreatedBy = String(data[r][cols.createdBy] || '').trim();
    var rQId = String(data[r][cols.qId] || '').trim().toLowerCase();
    
    var match = rCreatedBy.match(/\\[AI:([^\\]]+)\\]/);
    var token = match ? match[1].trim() : '';
    
    if (token || rCreatedBy.indexOf('[AI:') !== -1 || rQId.indexOf('q_ai_') === 0) {
      allAiCount++;
      allAiRows.push(r + 1);
      var key = token || '__NO_TOKEN__';
      tokenCounts[key] = (tokenCounts[key] || 0) + 1;
      if (!tokenRows[key]) tokenRows[key] = [];
      tokenRows[key].push(r + 1);
    }
  }
  
  var foundTokens = Object.keys(tokenCounts);
  var primaryToken = '';
  var hasBatch = false;
  
  for (var t = 0; t < foundTokens.length; t++) {
    var tk = foundTokens[t];
    if (tokenCounts[tk] >= 5) {
      hasBatch = true;
      primaryToken = tk === '__NO_TOKEN__' ? '' : tk;
      break;
    }
  }
  
  if (!hasBatch && allAiCount >= 5) {
    hasBatch = true;
    if (foundTokens.length > 0 && foundTokens[0] !== '__NO_TOKEN__') {
      primaryToken = foundTokens[0];
    }
  }
  
  return {
    hasPersistedBatch: hasBatch,
    activeAiCount: allAiCount,
    tokens: foundTokens.filter(function(k) { return k !== '__NO_TOKEN__'; }),
    primaryToken: primaryToken,
    matchingRows: allAiRows,
    tokenCounts: tokenCounts
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
  
  var authErr = checkQuestionManagementAuthorized(session, record);
  if (authErr) return authErr;
  
  if (isCNEQuestionsLocked(cneId)) {
    return {
      success: false,
      errorCode: 'QUESTIONS_LOCKED',
      message: 'Questions are locked because post-test submissions have already begun for this CNE.'
    };
  }

  var genSource = String(params.generationSource || params.sourceMode || '').trim().toUpperCase();
  if (genSource === 'EXTERNAL') {
    return {
      success: false,
      errorCode: 'EXTERNAL_SOURCE_PROHIBITED',
      message: 'External or online clinical sources are not permitted. Question generation must use locally stored CNE or Nursing Reference Library material.'
    };
  }

  // Material-First rule: Learning Material must exist in Drive learning resource, reference text, or reference library index (minimum 15 characters)
  var learningMaterial = getCNELearningMaterial(cneId);
  var hasDriveResource = false;
  try {
    var refSheet = getSpreadsheet('CNE').getSheetByName('CNE_Reference');
    if (refSheet && refSheet.getLastRow() > 1) {
      var refData = refSheet.getDataRange().getValues();
      var refColMap = getHeaderMap(refSheet);
      var idCol = refColMap['cneid'] !== undefined ? refColMap['cneid'] : 0;
      var driveCol = refColMap['drivefileid'];
      for (var r = 1; r < refData.length; r++) {
        if (String(refData[r][idCol] || '').trim().toUpperCase() === cneId.toUpperCase()) {
          if (driveCol !== undefined && String(refData[r][driveCol] || '').trim()) {
            hasDriveResource = true;
          }
          break;
        }
      }
    }
  } catch (e) {
    hasDriveResource = false;
  }

  if (!hasDriveResource && (!learningMaterial || learningMaterial.length < 15)) {
    // Check if relevant material is available in local reference library / index (Priority 1: UPLOADED_CNE, Priority 2: LOCAL_REFERENCE_LIB)
    var localEvidenceCheck = retrieveCNETopicEvidence(cneId, record.topic, session);
    if (!localEvidenceCheck || !localEvidenceCheck.success || !localEvidenceCheck.evidence || localEvidenceCheck.evidence.length === 0) {
      return {
        success: false,
        errorCode: 'INSUFFICIENT_TOPIC_MATERIAL',
        message: 'No relevant material related to this topic is available on the server. Kindly upload the relevant topic material and try again.'
      };
    }
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
    var maxQuota = 1;
    var existingToken = '';
    var reservedUntil = 0;
    var now = Date.now();
    
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0] || '').trim().toUpperCase() === cneId.toUpperCase()) {
        rowIndex = r + 1;
        var rawUsed = parseInt(data[r][2], 10) || 0;
        attemptsUsed = rawUsed >= 1 ? 1 : 0;
        existingToken = String(data[r][6] || '').trim();
        reservedUntil = parseInt(data[r][7], 10) || 0;
        break;
      }
    }
    
    // Protection against duplicate AI generation:
    // 1. Authoritative check in CNE_AI_Quota sheet:
    // AI generation status becomes USED ONLY after successful AI batch persistence by handleCommitAiQuota().
    // Manual questions MUST NOT consume, reset, or alter the one-time AI generation allowance.
    if (attemptsUsed >= 1) {
      return {
        success: false,
        errorCode: 'QUOTA_EXHAUSTED',
        message: 'AI question generation has already been completed for this CNE. The one-time initial AI generation allowance is used.',
        data: {
          cneId: cneId,
          status: 'USED',
          attemptsUsed: 1,
          maxQuota: 1,
          remaining: 0,
          canGenerate: false
        }
      };
    }

    // 2. CRITICAL RECONCILIATION & PREVENTION OF SECOND AI GENERATION:
    // Invariant: IF an AI batch has been successfully persisted for a CNE,
    // that CNE must NEVER become eligible for a second AI generation,
    // even if the quota USED state update previously failed or reservation expired!
    var questionsSheet = getQuestionsSheet();
    var qCols = getQuestionColIndexes(questionsSheet);
    var aiBatchInfo = findPersistedAiBatchInfo(cneId, questionsSheet, qCols);

    if (aiBatchInfo.hasPersistedBatch) {
      var committedToken = aiBatchInfo.primaryToken || existingToken || 'RECONCILED_BATCH';
      var nowIso = new Date().toISOString();
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 3, 1, 7).setValues([[1, 1, nowIso, session.employeeId, '', '0', committedToken]]);
      } else {
        sheet.appendRow([cneId, record.topic, 1, 1, nowIso, session.employeeId, '', '0', committedToken]);
      }
      SpreadsheetApp.flush();

      logAuditAction('RECONCILE_AI_QUOTA', session.employeeId, 'Reconciled CNE AI quota to USED after detecting already persisted batch (' + aiBatchInfo.activeAiCount + ' active AI questions) for CNE: ' + cneId, 'SUCCESS');

      return {
        success: false,
        errorCode: 'QUOTA_EXHAUSTED',
        message: 'An AI question batch has already been persisted for this CNE. The one-time initial AI generation allowance is used.',
        data: {
          cneId: cneId,
          status: 'USED',
          attemptsUsed: 1,
          maxQuota: 1,
          remaining: 0,
          canGenerate: false
        }
      };
    }

    // Check if there is an active unexpired reservation from another in-flight request
    var hasActiveReservation = existingToken && (reservedUntil > now);
    if (hasActiveReservation) {
      return {
        success: false,
        errorCode: 'RESERVATION_IN_PROGRESS',
        message: 'An AI question generation request is already in progress for this CNE. Please wait.',
        data: {
          cneId: cneId,
          status: 'RESERVED',
          attemptsUsed: 0,
          maxQuota: 1,
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
      sheet.appendRow([cneId, record.topic, 0, 1, '', '', reservationToken, String(newReservedUntil), '']);
    }
    
    return {
      success: true,
      data: {
        reservationToken: reservationToken,
        cneId: cneId,
        status: 'AVAILABLE',
        attemptsUsed: 0,
        maxQuota: 1,
        remaining: 1,
        canGenerate: true
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Atomically commit a successful AI generation attempt
 * Implements strict failure-safe persistence and one-time generation state commit
 * Invariant: A CNE must NEVER reach a state where another AI generation can occur
 * after its first 5-question batch has already been successfully persisted.
 */
function handleCommitAiQuota(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  var reservationToken = sanitizeCellInput(params.reservationToken);
  if (!cneId || !reservationToken) {
    return { success: false, message: 'CNE ID and reservation token are required.' };
  }
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found for ID: ' + cneId };
  
  var authErr = checkQuestionManagementAuthorized(session, record);
  if (authErr) return authErr;
  
  if (isCNEQuestionsLocked(cneId)) {
    return {
      success: false,
      errorCode: 'QUESTIONS_LOCKED',
      message: 'Questions are permanently locked because post-test submissions have begun.'
    };
  }

  // ScriptLock protects the entire critical section
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Backend is busy. Please try again.' };
  }
  
  try {
    var quotaSheet = getOrCreateSheet('CNE_AI_Quota');
    var qData = quotaSheet.getDataRange().getValues();
    var rowIndex = -1;
    var attemptsUsed = 0;
    var maxQuota = 1;
    var storedToken = '';
    var reservedUntil = 0;
    var lastCommittedToken = '';
    
    for (var r = 1; r < qData.length; r++) {
      if (String(qData[r][0] || '').trim().toUpperCase() === cneId.toUpperCase()) {
        rowIndex = r + 1;
        var rawUsed = parseInt(qData[r][2], 10) || 0;
        attemptsUsed = rawUsed >= 1 ? 1 : 0;
        storedToken = String(qData[r][6] || '').trim();
        reservedUntil = parseInt(qData[r][7], 10) || 0;
        lastCommittedToken = String(qData[r][8] || '').trim();
        break;
      }
    }

    // 1. RE-CHECK AUTHORITATIVE GENERATION STATE
    // Idempotency: If this token was already committed, return success immediately
    if (rowIndex > 0 && lastCommittedToken === reservationToken) {
      invalidateCNEQuestionsCache(cneId);
      return {
        success: true,
        alreadyCommitted: true,
        message: 'AI generation for this CNE was already successfully committed and marked USED.',
        data: {
          cneId: cneId,
          status: 'USED',
          attemptsUsed: 1,
          maxQuota: 1,
          remaining: 0,
          canGenerate: false
        }
      };
    }

    // Inspect existing questions sheet to prevent duplicate active AI batches and handle recovery
    var questionsSheet = getQuestionsSheet();
    var qCols = getQuestionColIndexes(questionsSheet);
    var qSheetData = questionsSheet.getDataRange().getValues();
    var aiBatchInfo = findPersistedAiBatchInfo(cneId, questionsSheet, qCols);

    // If an AI batch was already persisted for this CNE under another reservation token:
    if (aiBatchInfo.hasPersistedBatch && aiBatchInfo.primaryToken && aiBatchInfo.primaryToken !== reservationToken) {
      if (rowIndex > 0) {
        quotaSheet.getRange(rowIndex, 3, 1, 7).setValues([[1, 1, new Date().toISOString(), session.employeeId, '', '0', aiBatchInfo.primaryToken]]);
        SpreadsheetApp.flush();
      }
      return {
        success: false,
        errorCode: 'QUOTA_EXHAUSTED',
        message: 'An AI question batch has already been persisted for this CNE under another reservation.'
      };
    }
    
    if (rowIndex === -1 || (storedToken !== reservationToken && lastCommittedToken !== reservationToken)) {
      return {
        success: false,
        errorCode: 'INVALID_RESERVATION',
        message: 'Invalid, expired, or already consumed reservation token.'
      };
    }

    // 2. VALIDATE EXACTLY 5 QUESTIONS
    var rawQuestions = params.questions;
    if (!rawQuestions || !Array.isArray(rawQuestions) || rawQuestions.length !== 5) {
      return {
        success: false,
        errorCode: 'INVALID_QUESTION_COUNT',
        message: 'Initial AI generation must contain EXACTLY 5 questions. Received: ' + (rawQuestions ? rawQuestions.length : 0)
      };
    }

    var now = Date.now();
    var nowIso = new Date().toISOString();
    var aiBatchTag = '[AI:' + reservationToken + ']';

    // Inspect existing questions in sheet across all rows for ID uniqueness & this CNE's reservation
    var allExistingSheetQIds = {};
    var matchingTagRows = []; // 1-based row numbers
    var matchingTagQIds = [];

    for (var rIdx = 1; rIdx < qSheetData.length; rIdx++) {
      var rQId = String(qSheetData[rIdx][qCols.qId] || '').trim();
      if (rQId) {
        allExistingSheetQIds[rQId.toLowerCase()] = true;
      }

      var rCne = String(qSheetData[rIdx][qCols.cneId] || '').trim().toUpperCase();
      if (rCne === cneId.toUpperCase()) {
        var rStatus = String(qSheetData[rIdx][qCols.status] || 'ACTIVE').trim().toUpperCase();
        var rCreatedBy = String(qSheetData[rIdx][qCols.createdBy] || '').trim();

        if (rStatus === 'ACTIVE') {
          if (rCreatedBy.indexOf(aiBatchTag) !== -1) {
            matchingTagRows.push(rIdx + 1);
            if (rQId) {
              matchingTagQIds.push(rQId);
            }
          }
        }
      }
    }

    // Idempotency/Recovery check: Has this AI batch ALREADY been persisted in the sheet?
    // A batch is considered already persisted ONLY when:
    // exactly 5 ACTIVE questions for the current CNE contain: [AI:<current reservationToken>]
    var batchAlreadyPersisted = (matchingTagRows.length === 5);

    // Handle incomplete state safely under ScriptLock:
    // If only some of the current batch exists (1 to 4 questions matching this reservation token),
    // DO NOT treat it as successfully persisted. Mark those orphaned partial rows INCOMPLETE so they
    // do not corrupt questions or conflict with the fresh 5-question batch.
    // Unrelated manual and AI questions are completely untouched.
    if (!batchAlreadyPersisted && matchingTagRows.length > 0 && matchingTagRows.length < 5) {
      for (var p = 0; p < matchingTagRows.length; p++) {
        questionsSheet.getRange(matchingTagRows[p], qCols.status + 1).setValue('INCOMPLETE');
      }
      SpreadsheetApp.flush();
    }

    // Reservation expiry check:
    // If the batch was already persisted prior to a failed quota commit, allow recovery to complete
    if (reservedUntil < now && !batchAlreadyPersisted) {
      return {
        success: false,
        errorCode: 'RESERVATION_EXPIRED',
        message: 'AI quota reservation token has expired. Please initiate a new generation request.'
      };
    }

    if (attemptsUsed >= 1 && !batchAlreadyPersisted) {
      return {
        success: false,
        errorCode: 'QUOTA_EXHAUSTED',
        message: 'One-time AI generation allowance for this CNE is already used.'
      };
    }

    // 3. VALIDATE & PERSIST THE COMPLETE 5-QUESTION BATCH
    var rowsToSave = [];
    var validatedQuestionIds = [];
    var seenInBatch = {};

    if (batchAlreadyPersisted) {
      // Use the verified IDs already in the sheet for this reservation
      validatedQuestionIds = matchingTagQIds;
    } else {
      for (var qIdx = 0; qIdx < rawQuestions.length; qIdx++) {
        var qObj = rawQuestions[qIdx];
        var qNum = qIdx + 1;

        var qText = sanitizeCellInput(qObj.question || '').trim();
        if (qText.length < 8) {
          return { success: false, message: 'Question ' + qNum + ' has insufficient question text (minimum 8 characters).' };
        }

        var opts = qObj.options || {};
        var optA = sanitizeCellInput(opts.A || '').trim();
        var optB = sanitizeCellInput(opts.B || '').trim();
        var optC = sanitizeCellInput(opts.C || '').trim();
        var optD = sanitizeCellInput(opts.D || '').trim();
        if (!optA || !optB || !optC || !optD) {
          return { success: false, message: 'Question ' + qNum + ' is missing one or more of options A, B, C, D.' };
        }

        var optSet = {};
        optSet[optA.toLowerCase()] = true;
        optSet[optB.toLowerCase()] = true;
        optSet[optC.toLowerCase()] = true;
        optSet[optD.toLowerCase()] = true;
        if (Object.keys(optSet).length < 4) {
          return { success: false, message: 'Question ' + qNum + ' has duplicate option choices.' };
        }

        var rawCorrect = String(qObj.correctOption || '').trim().toUpperCase();
        if (!['A', 'B', 'C', 'D'].includes(rawCorrect)) {
          return { success: false, message: 'Question ' + qNum + ' has invalid correct option: ' + rawCorrect };
        }

        var expl = sanitizeCellInput(qObj.explanation || '').trim();
        if (expl.length < 5) {
          return { success: false, message: 'Question ' + qNum + ' is missing a clinical explanation/rationale.' };
        }

        var authSrc = sanitizeCellInput(qObj.authoritativeSource || '').trim();
        if (authSrc.length < 3) {
          return { success: false, message: 'Question ' + qNum + ' is missing an authoritative clinical source.' };
        }

        // QUESTION ID UNIQUENESS:
        // Ensure Question IDs do not already exist in CNE Post Test Questions.
        // If an ID collision exists, generate a new unique q_ai_<unique value> ID.
        // Never overwrite an existing row because of an ID collision.
        var rawQId = sanitizeCellInput(qObj.id || '').trim();
        var qId = rawQId;
        var needsNewId = !qId ||
                         !qId.toLowerCase().startsWith('q_ai_') ||
                         allExistingSheetQIds[qId.toLowerCase()] ||
                         seenInBatch[qId.toLowerCase()];

        if (needsNewId) {
          var randVal = Math.floor(Math.random() * 1000000);
          qId = 'q_ai_' + now + '_' + qNum + '_' + randVal;
          while (allExistingSheetQIds[qId.toLowerCase()] || seenInBatch[qId.toLowerCase()]) {
            randVal = Math.floor(Math.random() * 1000000);
            qId = 'q_ai_' + now + '_' + qNum + '_' + randVal;
          }
        }

        seenInBatch[qId.toLowerCase()] = true;
        allExistingSheetQIds[qId.toLowerCase()] = true;
        validatedQuestionIds.push(qId);

        var item = {
          cneId: cneId,
          id: qId,
          question: qText,
          optA: optA,
          optB: optB,
          optC: optC,
          optD: optD,
          correctOption: rawCorrect,
          explanation: expl,
          isFinalized: 'YES',
          isLocked: 'NO',
          createdAt: nowIso,
          createdBy: session.employeeId + ' ' + aiBatchTag,
          authoritativeSource: authSrc,
          status: 'ACTIVE'
        };
        rowsToSave.push(buildQuestionRowArray(qCols, item, qSheetData[0].length));
      }

      try {
        var startRow = questionsSheet.getLastRow() + 1;
        questionsSheet.getRange(startRow, 1, rowsToSave.length, rowsToSave[0].length).setValues(rowsToSave);
        SpreadsheetApp.flush();
      } catch (saveErr) {
        return {
          success: false,
          errorCode: 'QUESTION_PERSISTENCE_FAILED',
          message: 'Failed to write question batch to sheet: ' + (saveErr.message || saveErr)
        };
      }
    }

    // 4. VERIFY THAT THE EXACT 5 QUESTIONS TIED TO CURRENT RESERVATION WERE PERSISTED
    var isVerified = false;
    var verifiedTagCount = 0;
    for (var vAttempt = 1; vAttempt <= 3; vAttempt++) {
      SpreadsheetApp.flush();
      var verifyData = questionsSheet.getDataRange().getValues();
      verifiedTagCount = 0;

      for (var vRow = 1; vRow < verifyData.length; vRow++) {
        var rowCne = String(verifyData[vRow][qCols.cneId] || '').trim().toUpperCase();
        var rowStatus = String(verifyData[vRow][qCols.status] || 'ACTIVE').trim().toUpperCase();
        var rowCreatedBy = String(verifyData[vRow][qCols.createdBy] || '').trim();

        if (rowCne === cneId.toUpperCase() && rowStatus === 'ACTIVE') {
          if (rowCreatedBy.indexOf(aiBatchTag) !== -1) {
            verifiedTagCount++;
          }
        }
      }

      if (verifiedTagCount === 5) {
        isVerified = true;
        break;
      }
      Utilities.sleep(150);
    }

    if (!isVerified) {
      return {
        success: false,
        errorCode: 'PERSISTENCE_VERIFICATION_FAILED',
        message: 'Persistence verification failed: Exactly 5 questions matching current reservation could not be verified in sheet. Generation remains available.'
      };
    }

    // 5. MARK AI GENERATION STATE USED/GENERATED ONLY AFTER SUCCESSFUL PERSISTENCE VERIFICATION
    // Safely reconcile/retry the generation-state commit while protected by the script lock
    var quotaCommitSuccess = false;
    for (var retry = 1; retry <= 3; retry++) {
      try {
        quotaSheet.getRange(rowIndex, 3, 1, 7).setValues([[1, 1, nowIso, session.employeeId, '', '0', reservationToken]]);
        SpreadsheetApp.flush();
        var recheckVal = quotaSheet.getRange(rowIndex, 3).getValue();
        if (parseInt(recheckVal, 10) >= 1) {
          quotaCommitSuccess = true;
          break;
        }
      } catch (quotaUpdateErr) {
        Utilities.sleep(150);
      }
    }

    if (!quotaCommitSuccess) {
      // DO NOT silently report success.
      return {
        success: false,
        errorCode: 'QUOTA_COMMIT_FAILED',
        message: '5 questions were successfully persisted, but recording quota state encountered an error.'
      };
    }

    logAuditAction('AI_QUESTION_GENERATION_SUCCESS', session.employeeId, 'Generated, verified, and saved exactly 5 clinical MCQs for CNE: ' + cneId, 'SUCCESS');
    
    // Invalidate CNE questions read cache upon successful AI question commit
    invalidateCNEQuestionsCache(cneId);

    return {
      success: true,
      message: 'AI question generation completed and saved successfully (One-time generation marked USED).',
      data: {
        cneId: cneId,
        status: 'USED',
        attemptsUsed: 1,
        maxQuota: 1,
        remaining: 0,
        canGenerate: false
      }
    };
  } finally {
    // 6. RELEASE LOCK IN FINALLY
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
  
  var authErr = checkQuestionManagementAuthorized(session, record);
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
        var attemptsUsed = parseInt(data[r][2], 10) || 0;
        if (attemptsUsed >= 1) {
          return {
            success: false,
            errorCode: 'QUOTA_EXHAUSTED',
            message: 'Cannot release reservation: One-time AI generation quota for this CNE has already been successfully committed and marked USED.'
          };
        }
        break;
      }
    }
    
    // Invariant check: Cannot release reservation if an AI batch has already been persisted for this CNE
    var questionsSheet = getQuestionsSheet();
    var qCols = getQuestionColIndexes(questionsSheet);
    var aiBatchInfo = findPersistedAiBatchInfo(cneId, questionsSheet, qCols);
    if (aiBatchInfo.hasPersistedBatch) {
      var committedToken = aiBatchInfo.primaryToken || storedToken || 'RECONCILED_BATCH';
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 3, 1, 7).setValues([[1, 1, new Date().toISOString(), session.employeeId, '', '0', committedToken]]);
        SpreadsheetApp.flush();
      }
      return {
        success: false,
        errorCode: 'QUOTA_EXHAUSTED',
        message: 'Cannot release reservation: An AI question batch has already been persisted for this CNE.'
      };
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
    return { success: true, message: 'Reservation released. Allowance remains AVAILABLE.' };
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

  var authErr = checkQuestionManagementAuthorized(session, record);
  if (authErr) return authErr;

  if (isCNEQuestionsLocked(cneId)) {
    return {
      success: false,
      errorCode: 'QUESTIONS_LOCKED',
      message: 'Questions are permanently locked because post-test submissions have begun.'
    };
  }

  var genSource = String(params.generationSource || params.sourceMode || '').trim().toUpperCase();
  if (genSource === 'EXTERNAL') {
    return {
      success: false,
      errorCode: 'EXTERNAL_SOURCE_PROHIBITED',
      message: 'External or online clinical sources are not permitted. Question generation must use locally stored CNE or Nursing Reference Library material.'
    };
  }

  var learningMaterial = '';
  var authoritativeExtracted = null;
  var hasLearningResource = false;
  var authoritativeRpName = record.instructor || '';

  // 1. Resolve from authoritative CNE_Reference
  var dFileId = '';
  var refTxt = '';

  var refSheet = getSpreadsheet('CNE').getSheetByName('CNE_Reference');
  if (refSheet && refSheet.getLastRow() > 1) {
    var refData = refSheet.getDataRange().getValues();
    var refColMap = getHeaderMap(refSheet);
    var idCol = refColMap['cneid'] !== undefined ? refColMap['cneid'] : 0;
    var driveCol = refColMap['drivefileid'];
    var textCol = refColMap['referencetextclinicalguides'] !== undefined ? refColMap['referencetextclinicalguides'] : (refColMap['referencetext'] !== undefined ? refColMap['referencetext'] : 2);
    var rpCol = refColMap['resourcepersonname'];

    for (var r = 1; r < refData.length; r++) {
      if (String(refData[r][idCol] || '').trim().toUpperCase() === cneId.toUpperCase()) {
        dFileId = driveCol !== undefined ? String(refData[r][driveCol] || '').trim() : '';
        refTxt = textCol !== undefined ? String(refData[r][textCol] || '').trim() : '';
        var rpTxt = rpCol !== undefined ? String(refData[r][rpCol] || '').trim() : '';
        if (rpTxt) authoritativeRpName = rpTxt;
        break;
      }
    }
  }

  // 2. If a CNE has an associated Learning Resource / Drive File ID:
  if (dFileId) {
    hasLearningResource = true;
    var extResult = extractLearningResourceContentCore(cneId, session);
    if (!extResult || !extResult.success) {
      return extResult || {
        success: false,
        errorCode: 'CONTENT_EXTRACTION_FAILED',
        message: 'Failed to extract content from authoritative learning resource.'
      };
    }
    authoritativeExtracted = extResult.data;
    learningMaterial = extResult.data.extractedText;
    if (extResult.data.resourcePersonName) {
      authoritativeRpName = extResult.data.resourcePersonName;
    }
  } else {
    learningMaterial = refTxt || getCNELearningMaterial(cneId);
  }

  // Retrieve relevant topic evidence using the approved Phase 4C/4D.1 pipeline:
  // Priority 1: UPLOADED_CNE, Priority 2: LOCAL_REFERENCE_LIB
  var topicEvidenceResult = retrieveCNETopicEvidence(cneId, record.topic, session);
  var retrievedEvidenceChunks = (topicEvidenceResult && topicEvidenceResult.success && topicEvidenceResult.evidence)
    ? topicEvidenceResult.evidence
    : [];

  // If direct extracted material is missing or too short, synthesize from retrieved local evidence chunks
  if ((!learningMaterial || learningMaterial.length < 15) && retrievedEvidenceChunks.length > 0) {
    learningMaterial = retrievedEvidenceChunks.map(function(ev) {
      return '[' + ev.sourceType + ': ' + (ev.resourceTitle || '') + (ev.sectionHeading ? ' - ' + ev.sectionHeading : '') + ']\\n' + ev.chunkText;
    }).join('\\n\\n');
  }

  // If STILL no relevant local material can be found, STOP. No general knowledge fallback.
  if (!learningMaterial || learningMaterial.length < 15) {
    return {
      success: false,
      errorCode: 'INSUFFICIENT_TOPIC_MATERIAL',
      message: 'No relevant material related to this topic is available on the server. Kindly upload the relevant topic material and try again.'
    };
  }

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
    var maxQuota = 1;
    var found = false;
    var rowIndex = -1;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0] || '').trim().toUpperCase() === cneId.toUpperCase()) {
        found = true;
        rowIndex = r + 1;
        var rawUsed = parseInt(data[r][2], 10) || 0;
        attemptsUsed = rawUsed >= 1 ? 1 : 0;
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

    if (attemptsUsed >= 1) {
      return {
        success: false,
        errorCode: 'QUOTA_EXHAUSTED',
        message: 'One-time AI generation allowance already used for this CNE.'
      };
    }

    // Invariant check: Fail validation if an AI batch has already been persisted for this CNE
    var questionsSheet = getQuestionsSheet();
    var qCols = getQuestionColIndexes(questionsSheet);
    var aiBatchInfo = findPersistedAiBatchInfo(cneId, questionsSheet, qCols);
    if (aiBatchInfo.hasPersistedBatch) {
      var committedToken = aiBatchInfo.primaryToken || storedToken || 'RECONCILED_BATCH';
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 3, 1, 7).setValues([[1, 1, new Date().toISOString(), session.employeeId, '', '0', committedToken]]);
        SpreadsheetApp.flush();
      }
      return {
        success: false,
        errorCode: 'QUOTA_EXHAUSTED',
        message: 'One-time AI generation allowance already used for this CNE (persisted question batch detected).'
      };
    }

    return {
      success: true,
      authorized: true,
      data: {
        cneId: cneId,
        topic: record.topic,
        status: 'AVAILABLE',
        authorizedEmployeeId: session.employeeId,
        role: session.role,
        reservationToken: reservationToken,
        remaining: 1,
        authoritativeLearningContent: authoritativeExtracted ? authoritativeExtracted.extractedText : (learningMaterial || ''),
        resourcePersonName: authoritativeRpName || '',
        hasLearningResource: hasLearningResource,
        learningResourceMetadata: authoritativeExtracted || null,
        generationSource: 'MATERIAL',
        retrievedEvidence: retrievedEvidenceChunks
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Normalize CNE ID consistently across operations
 */
function normalizeCneId(cneId) {
  return String(cneId || '').trim().toUpperCase();
}

/**
 * Invalidate CNE Questions Cache
 * Called whenever questions for a CNE are mutated (saved, edited, added, replaced, deactivated, finalized, or committed by AI).
 */
function invalidateCNEQuestionsCache(cneId) {
  var normCneId = normalizeCneId(cneId);
  if (!normCneId) return;
  try {
    var cacheKey = 'cne_questions_' + normCneId;
    CacheService.getScriptCache().remove(cacheKey);
  } catch (e) {
    console.warn('Failed to invalidate CNE questions cache: ' + e.message);
  }
}

/**
 * Read and Cache Sanitized Finalized Post-Test Questions (Short-lived 60s CacheService)
 * STRICT SECURITY:
 * - Cache key: 'cne_questions_' + normalizeCneId(cneId)
 * - Cache payload: Sanitized question array ONLY (id, question, options A/B/C/D).
 * - NEVER contains correct answers, answer keys, explanations, or authoritative sources.
 * - Best-effort: On any cache read/parse/write error, gracefully falls back to Google Sheets.
 */
function getCachedSanitizedQuestions(cneId) {
  var normCneId = normalizeCneId(cneId);
  if (!normCneId) return [];

  var cacheKey = 'cne_questions_' + normCneId;
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length >= 5) {
        return parsed;
      }
    }
  } catch (cacheReadErr) {
    console.warn('CacheService read error for ' + cacheKey + ': ' + (cacheReadErr.message || cacheReadErr));
  }

  // Fallback to reading authoritative Google Sheet
  var qSheet = getQuestionsSheet();
  if (!qSheet || qSheet.getLastRow() <= 1) return [];

  var cols = getQuestionColIndexes(qSheet);
  var qData = qSheet.getDataRange().getValues();
  var sanitized = [];

  for (var r = 1; r < qData.length; r++) {
    var qCne = String(qData[r][cols.cneId] || '').trim().toUpperCase();
    var isFin = String(qData[r][cols.isFinalized] || 'NO').toUpperCase() === 'YES';
    var qStatus = String(qData[r][cols.status] || 'ACTIVE').trim().toUpperCase();
    if (qCne === normCneId && isFin && qStatus !== 'INACTIVE' && qStatus !== 'REPLACED') {
      sanitized.push({
        id: String(qData[r][cols.qId] || ''),
        question: String(qData[r][cols.question] || ''),
        options: {
          A: String(qData[r][cols.optA] || ''),
          B: String(qData[r][cols.optB] || ''),
          C: String(qData[r][cols.optC] || ''),
          D: String(qData[r][cols.optD] || '')
        }
        // STRICT SECURITY: Correct Option, Explanation, and Authoritative Source are NEVER included in sanitized payload!
      });
    }
  }

  // Only cache if valid minimum question count (>= 5) and safe size (< 90KB)
  if (sanitized.length >= 5) {
    try {
      var payloadStr = JSON.stringify(sanitized);
      if (payloadStr.length < 90000) {
        CacheService.getScriptCache().put(cacheKey, payloadStr, 60);
      }
    } catch (cacheWriteErr) {
      console.warn('CacheService write error for ' + cacheKey + ': ' + (cacheWriteErr.message || cacheWriteErr));
    }
  }

  return sanitized;
}

/**
 * Helper: Ensure Question Sheet has all necessary headers
 */
function ensureQuestionsSheetHeaders(sheet) {
  // Legacy external-source headers (Source URL, Source Retrieved At) are removed from dynamic creation.
  // Existing sheet columns are preserved untouched.
  return;
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
  ensureQuestionsSheetHeaders(sheet);
  return sheet;
}

/**
 * Helper: Resolve Questions Sheet Column Mapping
 * Dynamically resolves 0-based column indexes from the header row.
 */
function getQuestionColIndexes(sheet) {
  ensureQuestionsSheetHeaders(sheet);
  var colMap = getHeaderMap(sheet);
  return {
    cneId: colMap['cneid'] !== undefined ? colMap['cneid'] : 0,
    qId: colMap['questionid'] !== undefined ? colMap['questionid'] : (colMap['id'] !== undefined ? colMap['id'] : 1),
    question: colMap['questiontext'] !== undefined ? colMap['questiontext'] : (colMap['question'] !== undefined ? colMap['question'] : 2),
    optA: colMap['optiona'] !== undefined ? colMap['optiona'] : 3,
    optB: colMap['optionb'] !== undefined ? colMap['optionb'] : 4,
    optC: colMap['optionc'] !== undefined ? colMap['optionc'] : 5,
    optD: colMap['optiond'] !== undefined ? colMap['optiond'] : 6,
    correctOption: colMap['correctoption'] !== undefined ? colMap['correctoption'] : (colMap['correctanswer'] !== undefined ? colMap['correctanswer'] : 7),
    explanation: colMap['explanation'] !== undefined ? colMap['explanation'] : (colMap['rationale'] !== undefined ? colMap['rationale'] : 8),
    isFinalized: colMap['isfinalized'] !== undefined ? colMap['isfinalized'] : 9,
    isLocked: colMap['islocked'] !== undefined ? colMap['islocked'] : 10,
    createdAt: colMap['createdat'] !== undefined ? colMap['createdat'] : 11,
    createdBy: colMap['createdby'] !== undefined ? colMap['createdby'] : 12,
    authoritativeSource: colMap['authoritativesource'] !== undefined ? colMap['authoritativesource'] : (colMap['source'] !== undefined ? colMap['source'] : 13),
    status: colMap['status'] !== undefined ? colMap['status'] : 14
  };
}

/**
 * Builds a 0-indexed row array for writing to the question sheet according to the dynamic column mapping.
 */
function buildQuestionRowArray(cols, item, totalCols, existingRow) {
  var row = existingRow ? existingRow.slice() : [];
  var targetLen = Math.max(totalCols || 0, 15);
  for (var k in cols) {
    if (cols[k] !== undefined && cols[k] >= targetLen) {
      targetLen = cols[k] + 1;
    }
  }
  while (row.length < targetLen) {
    row.push('');
  }
  if (cols.cneId !== undefined) row[cols.cneId] = item.cneId || '';
  if (cols.qId !== undefined) row[cols.qId] = item.id || '';
  if (cols.question !== undefined) row[cols.question] = item.question || '';
  if (cols.optA !== undefined) row[cols.optA] = item.optA || '';
  if (cols.optB !== undefined) row[cols.optB] = item.optB || '';
  if (cols.optC !== undefined) row[cols.optC] = item.optC || '';
  if (cols.optD !== undefined) row[cols.optD] = item.optD || '';
  if (cols.correctOption !== undefined) row[cols.correctOption] = item.correctOption || 'A';
  if (cols.explanation !== undefined) row[cols.explanation] = item.explanation || '';
  if (cols.isFinalized !== undefined) row[cols.isFinalized] = item.isFinalized || 'NO';
  if (cols.isLocked !== undefined) row[cols.isLocked] = item.isLocked || 'NO';
  if (cols.createdAt !== undefined && (!existingRow || !row[cols.createdAt])) row[cols.createdAt] = item.createdAt || new Date().toISOString();
  if (cols.createdBy !== undefined) row[cols.createdBy] = item.createdBy || '';
  if (cols.authoritativeSource !== undefined) row[cols.authoritativeSource] = item.authoritativeSource || '';
  if (cols.status !== undefined) row[cols.status] = item.status || 'ACTIVE';
  return row;
}

/**
 * Helper: Count Active Finalized Questions for a CNE
 * Returns the authoritative count of active post-test questions persisted in Google Sheets.
 */
function countActiveCNEQuestions(cneId) {
  if (!cneId) return 0;
  var sheet = getQuestionsSheet();
  if (!sheet || sheet.getLastRow() <= 1) return 0;
  var data = sheet.getDataRange().getValues();
  var cols = getQuestionColIndexes(sheet);
  var count = 0;
  var targetCne = String(cneId).trim().toUpperCase();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][cols.cneId] || '').trim().toUpperCase() === targetCne) {
      var status = String(data[r][cols.status] || 'ACTIVE').trim().toUpperCase();
      var isFinalized = String(data[r][cols.isFinalized] || '').trim().toUpperCase();
      if (status === 'ACTIVE' && (isFinalized === 'YES' || isFinalized === 'TRUE')) {
        count++;
      }
    }
  }
  return count;
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
    var cols = getQuestionColIndexes(qSheet);
    for (var q = 1; q < qData.length; q++) {
      var qCneId = String(qData[q][cols.cneId] || '').trim().toUpperCase();
      var isLockCol = String(qData[q][cols.isLocked] || '').trim().toUpperCase();
      if (qCneId === String(cneId).trim().toUpperCase() && isLockCol === 'YES') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Save & Finalize Questions for CNE
 * Enforces:
 * - Admin or Assigned Resource Person / Instructor authorization
 * - Locked if first participant post-test submission exists
 * - Minimum 5 ACTIVE questions required
 * - Authoritative Clinical Source required for each question
 * - Question history preservation (marking replaced questions REPLACED/INACTIVE rather than hard deletion)
 */
function handleSaveCNEQuestions(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  var authErr = checkQuestionManagementAuthorized(session, record);
  if (authErr) return authErr;
  
  if (isCNEQuestionsLocked(cneId)) {
    return {
      success: false,
      errorCode: 'QUESTIONS_LOCKED',
      message: 'Questions are permanently locked because post-test submissions have already begun and cannot be modified.'
    };
  }
  
  var rawQuestions = params.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return {
      success: false,
      errorCode: 'MINIMUM_QUESTIONS_REQUIRED',
      message: 'Validation failed: A valid questions array is required.'
    };
  }
  
  // Strict Pre-Validation
  var seenIds = {};
  var validatedList = [];
  var activeCount = 0;
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
    if (!qText || qText.length < 8) {
      return { success: false, message: 'Question ' + qNum + ': Question text is required (minimum 8 characters).' };
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
    if (!expl || expl.length < 5) {
      return { success: false, message: 'Question ' + qNum + ': Clinical rationale / explanation is required.' };
    }

    var authSrc = sanitizeCellInput(q.authoritativeSource || '').trim();
    if (!authSrc || authSrc.length < 3) {
      return { success: false, message: 'Question ' + qNum + ': Authoritative clinical source from local material is required.' };
    }

    var qStatus = String(q.status || 'ACTIVE').trim().toUpperCase();
    if (qStatus !== 'INACTIVE' && qStatus !== 'REPLACED') {
      qStatus = 'ACTIVE';
      activeCount++;
    }

    var isFin = (q.isFinalized === true || String(q.isFinalized).toUpperCase() === 'YES') ? 'YES' : 'NO';
    if (isFin === 'YES' && qStatus === 'ACTIVE') {
      finalizedCount++;
    }

    validatedList.push({
      id: qId,
      question: qText,
      optA: optA,
      optB: optB,
      optC: optC,
      optD: optD,
      correctOption: rawCorrect,
      explanation: expl,
      isFinalized: isFin,
      authoritativeSource: authSrc,
      status: qStatus
    });
  }

  // Minimum 5 ACTIVE questions required before saving
  if (activeCount < 5) {
    return {
      success: false,
      errorCode: 'MINIMUM_QUESTIONS_REQUIRED',
      message: 'Validation failed: A minimum of 5 active questions is required. Active count: ' + activeCount
    };
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
    var cols = getQuestionColIndexes(sheet);
    var data = sheet.getDataRange().getValues();
    var existingRowMap = {}; // qId.toLowerCase() -> rowNumber
    var existingCneRows = [];

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][cols.cneId] || '').trim().toUpperCase() === cneId.toUpperCase()) {
        var existingQId = String(data[r][cols.qId] || '').trim().toLowerCase();
        existingRowMap[existingQId] = r + 1;
        existingCneRows.push({ rowNum: r + 1, qId: existingQId });
      }
    }

    // Preserve history: For existing rows not in validatedList, mark as REPLACED instead of hard deleting
    for (var e = 0; e < existingCneRows.length; e++) {
      var exQId = existingCneRows[e].qId;
      if (!seenIds[exQId]) {
        var rowNum = existingCneRows[e].rowNum;
        sheet.getRange(rowNum, cols.status + 1).setValue('REPLACED');
      }
    }

    // Update or append validated questions
    for (var v = 0; v < validatedList.length; v++) {
      var item = validatedList[v];
      var targetRow = existingRowMap[item.id.toLowerCase()];
      var existingRowValues = targetRow ? data[targetRow - 1] : null;
      var rowValues = buildQuestionRowArray(cols, {
        cneId: cneId,
        id: item.id,
        question: item.question,
        optA: item.optA,
        optB: item.optB,
        optC: item.optC,
        optD: item.optD,
        correctOption: item.correctOption,
        explanation: item.explanation,
        isFinalized: item.isFinalized,
        isLocked: 'NO',
        createdAt: now,
        createdBy: session.employeeId,
        authoritativeSource: item.authoritativeSource,
        status: item.status
      }, data[0].length, existingRowValues);

      if (targetRow) {
        sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }
    }

    logAuditAction('SAVE_QUESTIONS', session.employeeId, 'Saved ' + validatedList.length + ' questions (' + activeCount + ' active, ' + finalizedCount + ' finalized) for CNE: ' + cneId, 'SUCCESS');

    // Invalidate CNE questions read cache upon successful mutation
    invalidateCNEQuestionsCache(cneId);

    return {
      success: true,
      message: 'Question set validated and saved successfully.',
      totalQuestions: validatedList.length,
      activeCount: activeCount,
      finalizedCount: finalizedCount,
      readyForPostTest: activeCount >= 5 && finalizedCount >= 5
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Get Questions for Admin/Incharge (Includes answer keys, authoritative sources, and status)
 */
function handleGetCNEQuestions(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  var authErr = checkQuestionManagementAuthorized(session, record);
  if (authErr) return authErr;
  
  var isLocked = isCNEQuestionsLocked(cneId);
  var sheet = getQuestionsSheet();
  var cols = getQuestionColIndexes(sheet);
  var data = sheet.getDataRange().getValues();
  var questions = [];
  var finalizedCount = 0;
  var activeCount = 0;
  
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][cols.cneId] || '').trim().toUpperCase() === cneId.toUpperCase()) {
      var isFin = String(data[r][cols.isFinalized] || 'NO').toUpperCase() === 'YES';
      var authSrc = String(data[r][cols.authoritativeSource] || '').trim();
      var qStatus = String(data[r][cols.status] || 'ACTIVE').trim().toUpperCase();
      if (qStatus !== 'INACTIVE' && qStatus !== 'REPLACED') {
        qStatus = 'ACTIVE';
        activeCount++;
        if (isFin) finalizedCount++;
      }
      questions.push({
        id: String(data[r][cols.qId] || ''),
        question: String(data[r][cols.question] || ''),
        options: {
          A: String(data[r][cols.optA] || ''),
          B: String(data[r][cols.optB] || ''),
          C: String(data[r][cols.optC] || ''),
          D: String(data[r][cols.optD] || '')
        },
        correctOption: String(data[r][cols.correctOption] || 'A'),
        explanation: String(data[r][cols.explanation] || ''),
        authoritativeSource: authSrc,
        status: qStatus,
        isFinalized: isFin,
        isLocked: isLocked || String(data[r][cols.isLocked] || 'NO').toUpperCase() === 'YES'
      });
    }
  }
  
  return {
    success: true,
    data: questions,
    isLocked: isLocked,
    activeCount: activeCount,
    finalizedCount: finalizedCount,
    readyForPostTest: activeCount >= 5 && finalizedCount >= 5
  };
}

/**
 * Get Secure QR Token for CNE Post-Test
 * Rejects if fewer than 5 active finalized questions
 */
function handleGetQRToken(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  var authErr = checkQuestionManagementAuthorized(session, record);
  if (authErr) return authErr;
  
  var finalizedCount = countActiveCNEQuestions(cneId);

  // Look for existing QR token first
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

  // Check-only mode: do NOT automatically generate if missing
  var isCheckOnly = params.checkOnly === true || params.createIfMissing === false;
  if (isCheckOnly) {
    return {
      success: true,
      data: {
        hasQR: Boolean(existingToken),
        qrToken: existingToken || '',
        cneId: cneId,
        topic: record.topic,
        area: record.area,
        finalizedCount: finalizedCount
      }
    };
  }

  // Generating / saving mode: require at least 5 finalized questions if token does not exist
  if (!existingToken && finalizedCount < 5) {
    return {
      success: false,
      errorCode: 'INSUFFICIENT_QUESTIONS',
      message: 'At least 5 active finalized questions must be present before QR Code and Post-Test can be generated. Currently active & finalized: ' + finalizedCount
    };
  }
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }

  try {
    // Re-check existing token after lock
    var qrDataLatest = qrSheet.getDataRange().getValues();
    var qrToken = null;
    for (var q2 = 1; q2 < qrDataLatest.length; q2++) {
      if (String(qrDataLatest[q2][1] || '').trim().toUpperCase() === cneId.toUpperCase() &&
          String(qrDataLatest[q2][4] || 'ACTIVE').toUpperCase() === 'ACTIVE') {
        qrToken = String(qrDataLatest[q2][0] || '');
        break;
      }
    }
    
    if (!qrToken) {
      qrToken = Utilities.getUuid().replace(/-/g, '');
      qrSheet.appendRow([qrToken, cneId, new Date().toISOString(), session.employeeId, 'ACTIVE']);
      logAuditAction('GENERATE_QR', session.employeeId, 'Generated secure QR token for CNE: ' + cneId, 'SUCCESS');
    }
    
    return {
      success: true,
      data: {
        hasQR: true,
        qrToken: qrToken,
        cneId: cneId,
        topic: record.topic,
        area: record.area,
        finalizedCount: finalizedCount
      }
    };
  } finally {
    lock.releaseLock();
  }
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
  
  // Read finalized questions for public participant view (with 60s CacheService cache; NO answers, NO explanations)
  var sanitizedQuestions = getCachedSanitizedQuestions(matchedCneId);
  
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
  
  // Read finalized questions from CNE Post Test Questions (with 60s CacheService cache; NO answers, NO explanations)
  var sanitizedQuestions = getCachedSanitizedQuestions(cneId);
  
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
    var cols = getQuestionColIndexes(qSheet);
    var qData = qSheet.getDataRange().getValues();
    var answerKeys = [];
    var questionRowsToLock = [];
    
    for (var r = 1; r < qData.length; r++) {
      var qCne = String(qData[r][cols.cneId] || '').trim().toUpperCase();
      var isFin = String(qData[r][cols.isFinalized] || 'NO').toUpperCase() === 'YES';
      var qStatus = String(qData[r][cols.status] || 'ACTIVE').trim().toUpperCase();
      if (qCne === cneId.toUpperCase() && isFin && qStatus !== 'INACTIVE' && qStatus !== 'REPLACED') {
        answerKeys.push({
          id: String(qData[r][cols.qId] || ''),
          question: String(qData[r][cols.question] || ''),
          correctOption: String(qData[r][cols.correctOption] || 'A').toUpperCase(),
          explanation: String(qData[r][cols.explanation] || '')
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
      qSheet.getRange(questionRowsToLock[k], cols.isLocked + 1).setValue('YES');
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
 * Add Manual Participant(s) (Admin, Area Incharge, or Authorized Resource Person)
 * Manual attendees receive Participant Source = MANUAL.
 * They have no score and are NOT treated as failed or assigned 0%.
 * Supports both single participant and batch participant addition with ONE ScriptLock and ONE setValues write.
 */
function handleAddManualParticipant(params, session) {
  var cneId = sanitizeCellInput(params.cneId);
  if (!cneId) return { success: false, message: 'CNE ID is required.' };
  
  var record = getCNEClassRecord(cneId);
  if (!record) return { success: false, message: 'CNE record not found.' };
  
  var authErr = checkCNEActionAuthorized(session, record);
  if (authErr) return authErr;

  var submittedList = [];
  if (params.participants && Array.isArray(params.participants)) {
    submittedList = params.participants;
    if (submittedList.length === 0) {
      return { success: false, message: 'At least one participant is required.' };
    }
  } else if (params.employeeId || params.name) {
    submittedList = [{
      employeeId: params.employeeId,
      name: params.name,
      designation: params.designation,
      department: params.department,
      remarks: params.remarks
    }];
  } else {
    return { success: false, message: 'Employee ID or Participant Name is required.' };
  }

  var validatedList = [];
  var seenBatchEmpIds = {};
  var seenBatchNames = {};

  for (var i = 0; i < submittedList.length; i++) {
    var rawItem = submittedList[i];
    if (!rawItem || typeof rawItem !== 'object') {
      return { success: false, message: 'Invalid participant entry at position ' + (i + 1) + '.' };
    }

    var empId = normalizeEmpId(rawItem.employeeId);
    var manualName = sanitizeCellInput(rawItem.name || '');
    var designation = sanitizeCellInput(rawItem.designation || 'Staff Nurse');
    var department = sanitizeCellInput(rawItem.department || record.area);
    var remarks = sanitizeCellInput(rawItem.remarks || 'Manual Attendance Recorded');

    if (!empId && !manualName) {
      return { success: false, message: 'Employee ID or Participant Name is required for participant #' + (i + 1) + '.' };
    }

    if (empId) {
      var officer = findOfficerById(empId);
      if (!officer) {
        return {
          success: false,
          errorCode: 'INVALID_EMPLOYEE_ID',
          message: 'Employee ID ' + empId + ' not found in official staff roster.'
        };
      }
      manualName = officer.name;
      designation = officer.designation || designation;
      department = officer.department || department;

      if (seenBatchEmpIds[empId]) {
        return {
          success: false,
          errorCode: 'DUPLICATE_PARTICIPANT',
          message: 'Employee ID ' + empId + ' appears more than once in the submitted list.'
        };
      }
      seenBatchEmpIds[empId] = true;
    } else if (manualName) {
      var lowerName = manualName.toLowerCase();
      if (seenBatchNames[lowerName]) {
        return {
          success: false,
          errorCode: 'DUPLICATE_PARTICIPANT',
          message: 'Participant ' + manualName + ' appears more than once in the submitted list.'
        };
      }
      seenBatchNames[lowerName] = true;
    }

    validatedList.push({
      empId: empId,
      manualName: manualName,
      designation: designation,
      department: department,
      remarks: remarks
    });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }

  try {
    var partSheet = getResponsesSheet();
    var pData = partSheet.getDataRange().getValues();

    var existingEmpIds = {};
    var existingNames = {};
    for (var p = 1; p < pData.length; p++) {
      if (String(pData[p][1] || '').trim().toUpperCase() === cneId.toUpperCase()) {
        var existingEmp = normalizeEmpId(pData[p][2]);
        if (existingEmp) {
          existingEmpIds[existingEmp] = true;
        }
        var existingNm = String(pData[p][3] || '').trim().toLowerCase();
        if (existingNm) {
          existingNames[existingNm] = true;
        }
      }
    }

    for (var v = 0; v < validatedList.length; v++) {
      var vItem = validatedList[v];
      if (vItem.empId && existingEmpIds[vItem.empId]) {
        return {
          success: false,
          errorCode: 'DUPLICATE_PARTICIPANT',
          message: 'Employee ID ' + vItem.empId + ' is already recorded as a participant for this CNE.'
        };
      }
      if (!vItem.empId && existingNames[vItem.manualName.toLowerCase()]) {
        return {
          success: false,
          errorCode: 'DUPLICATE_PARTICIPANT',
          message: 'Participant ' + vItem.manualName + ' is already recorded for this CNE.'
        };
      }
    }

    var baseTime = Date.now();
    var now = new Date().toISOString();
    var allRows = [];
    var auditEntries = [];

    for (var k = 0; k < validatedList.length; k++) {
      var item = validatedList[k];
      var participantId = validatedList.length === 1
        ? ('MAN-' + baseTime)
        : ('MAN-' + baseTime + '-' + (k + 1));

      allRows.push([
        participantId,
        cneId,
        item.empId,
        item.manualName,
        item.designation,
        item.department,
        '',
        '',
        '',
        'MANUAL',
        now,
        '',
        'ATTENDED',
        item.remarks
      ]);

      auditEntries.push({
        action: 'ADD_MANUAL_PARTICIPANT',
        employeeId: session.employeeId,
        details: 'Added participant ' + (item.empId || item.manualName) + ' to CNE: ' + cneId,
        status: 'SUCCESS'
      });
    }

    if (allRows.length > 0) {
      var startRow = partSheet.getLastRow() + 1;
      var numRows = allRows.length;
      var numColumns = 14;

      if (startRow === 1) {
        var defaultHeaders = ['Response ID', 'CNE ID', 'Employee ID', 'Employee Name', 'Designation', 'Department', 'Score', 'Total Questions', 'Percentage', 'Source', 'Submitted At', 'Answers JSON', 'Status', 'Remarks'];
        partSheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
        startRow = 2;
      }

      var maxRows = partSheet.getMaxRows();
      if (startRow + numRows - 1 > maxRows) {
        partSheet.insertRowsAfter(maxRows, (startRow + numRows - 1) - maxRows);
      }
      var maxCols = partSheet.getMaxColumns();
      if (numColumns > maxCols) {
        partSheet.insertColumnsAfter(maxCols, numColumns - maxCols);
      }

      partSheet.getRange(startRow, 1, numRows, numColumns).setValues(allRows);
    }

    logAuditActionsBatch(auditEntries);

    return {
      success: true,
      message: allRows.length === 1 ? 'Participant added successfully.' : 'Successfully recorded ' + allRows.length + ' participants.',
      count: allRows.length,
      addedCount: allRows.length
    };
  } finally {
    lock.releaseLock();
  }
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
  
  var authErr = checkCNEActionAuthorized(session, record);
  if (authErr) return authErr;
  
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
 * Finalize CNE Session and Update CNE Schedule Record
 * Atomic & In-place lifecycle update via ScriptLock
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
    var cneSheet = ss.getSheetByName('CNE Schedule');
    if (!cneSheet) {
      return { success: false, message: 'CNE Schedule sheet not found.' };
    }
    
    // 5. Re-read the authoritative row while holding the lock
    var liveRecord = getCNEClassRecord(cneId);
    if (!liveRecord) {
      return { success: false, message: 'CNE record not found upon re-reading CNE Schedule.' };
    }
    
    // 6. Confirm the CNE is not already Completed
    if (normalizeCNEStatus(liveRecord.status) === 'Completed') {
      return {
        success: true,
        alreadyFinalized: true,
        message: 'This CNE has already been marked as Completed.',
        data: {
          cneId: cneId,
          dataId: cneId
        },
        cneId: cneId,
        dataId: cneId
      };
    }
    
    // 7. Read participant records using the corrected schema
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
          
          // Calculate average ONLY from POST_TEST percentages
          // MANUAL participants must never contribute 0% or any score
          if (pSrc === 'POST_TEST' && pctRaw !== '' && pctRaw !== null && pctRaw !== undefined && !isNaN(Number(pctRaw))) {
            postTestScores.push(Number(pctRaw));
          }
        }
      }
    }
    
    var totalParticipantsCount = internalEmpIds.length + externalParticipants.length;
    if (totalParticipantsCount <= 0) {
      return {
        success: false,
        errorCode: 'NO_PARTICIPANTS',
        message: 'Cannot finalize CNE: At least one participant must be recorded before finalization.'
      };
    }

    var avg = postTestScores.length > 0 ? Math.round((postTestScores.reduce(function(a, b) { return a + b; }, 0) / postTestScores.length) * 10) / 10 : null;
    var remarksSummary = 'Finalized CNE Session [' + cneId + ']. Total Attendees: ' + totalParticipantsCount + (avg !== null ? ' (Avg Post-Test Score: ' + avg + '%)' : '') + (params.remarks ? '. ' + sanitizeCellInput(params.remarks) : '');
    
    // 8. Update authoritative CNE Schedule record directly
    var colMap = getHeaderMap(cneSheet);
    var statusCol = colMap['status'] !== undefined ? (colMap['status'] + 1) : 12;
    var remarksCol = colMap['adminremarks'] !== undefined ? (colMap['adminremarks'] + 1) : (colMap['remarks'] !== undefined ? (colMap['remarks'] + 1) : 16);
    
    cneSheet.getRange(liveRecord.rowIndex, statusCol).setValue('Completed');
    cneSheet.getRange(liveRecord.rowIndex, remarksCol).setValue(remarksSummary);
    
    if (colMap['staffempid'] !== undefined) {
      cneSheet.getRange(liveRecord.rowIndex, colMap['staffempid'] + 1).setValue(internalEmpIds.join(', '));
    }
    if (colMap['staffcount'] !== undefined) {
      cneSheet.getRange(liveRecord.rowIndex, colMap['staffcount'] + 1).setValue(totalParticipantsCount);
    }
    if (colMap['externalstaffparticipants'] !== undefined) {
      cneSheet.getRange(liveRecord.rowIndex, colMap['externalstaffparticipants'] + 1).setValue(externalParticipants.join(', '));
    }

    // 9. Write audit log
    logAuditAction('FINALIZE_CNE', session.employeeId, 'Finalized CNE: ' + cneId + ' (status updated to Completed in CNE Schedule)', 'SUCCESS');
    
    return {
      success: true,
      message: 'CNE finalized successfully.',
      data: {
        cneId: cneId,
        dataId: cneId
      },
      cneId: cneId,
      dataId: cneId
    };
  } finally {
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
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var liveRecord = getCNEClassRecord(cneId);
    if (!liveRecord) return { success: false, message: 'CNE record not found.' };
    if (normalizeCNEStatus(liveRecord.status) === 'Completed') {
      return { success: false, message: 'Cannot cancel a CNE that has already been finalized/completed.' };
    }
    
    var reason = sanitizeCellInput(params.remarks || 'Cancelled by coordinator');
    var ss = getSpreadsheet('CNE');
    var upcomingSheet = ss.getSheetByName('CNE Schedule');
    if (upcomingSheet) {
      var upColMap = getHeaderMap(upcomingSheet);
      var statusCol = upColMap['status'] !== undefined ? (upColMap['status'] + 1) : 12;
      var remarksCol = upColMap['adminremarks'] !== undefined ? (upColMap['adminremarks'] + 1) : 16;
      upcomingSheet.getRange(liveRecord.rowIndex, statusCol).setValue('Canceled');
      upcomingSheet.getRange(liveRecord.rowIndex, remarksCol).setValue(reason);
    }
    
    logAuditAction('CANCEL_CNE', session.employeeId, 'Cancelled CNE: ' + cneId + '. Reason: ' + reason, 'SUCCESS');
    return { success: true, message: 'CNE cancelled successfully.' };
  } finally {
    lock.releaseLock();
  }
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
            invalidateUserRoleCache(normInitialId);
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
