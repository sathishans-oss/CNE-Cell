/**
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

// Formula Injection Prevention: Prepend apostrophe to user strings starting with =, +, -, @, \t, \r
function sanitizeCellInput(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  var str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
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

  var role = getUserRole(verifiedEmpId);
  return { employeeId: verifiedEmpId, role: role };
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
    var ss = getSpreadsheet('CNE');
    var auditSheet = ss.getSheetByName('Audit Log');
    if (!auditSheet) {
      auditSheet = ss.insertSheet('Audit Log');
      auditSheet.appendRow(['Timestamp', 'Action', 'Employee ID', 'Details', 'Status']);
      auditSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }
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
        output = handleAdminAction(params, session, handleAddUpcomingClass, 'ADD_UPCOMING_CLASS');
        break;
        
      case 'updateUpcomingClass':
        output = handleAdminAction(params, session, handleUpdateUpcomingClass, 'UPDATE_UPCOMING_CLASS');
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
 * Check User Role directly from 'Role' sheet tab
 */
function getUserRole(employeeId) {
  var normId = normalizeEmpId(employeeId);
  if (!normId) return 'EMPLOYEE';
  
  try {
    var ss = getSpreadsheet('CNE');
    var roleSheet = ss.getSheetByName('Role');
    if (!roleSheet) return 'EMPLOYEE';
    
    var data = roleSheet.getDataRange().getValues();
    if (data.length <= 1) return 'EMPLOYEE';
    
    var empIdCol = 0;
    var roleCol = 3;
    var headers = data[0];
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).toLowerCase().trim();
      if (h.indexOf('emp') !== -1 && h.indexOf('id') !== -1) empIdCol = i;
      if (h === 'role') roleCol = i;
    }
    
    for (var r = 1; r < data.length; r++) {
      var rowEmpId = normalizeEmpId(data[r][empIdCol]);
      if (rowEmpId === normId) {
        var rVal = String(data[r][roleCol]).toUpperCase().trim();
        return (rVal === 'ADMIN') ? 'ADMIN' : 'EMPLOYEE';
      }
    }
  } catch (e) {
    console.warn('Error reading role sheet: ' + e.message);
  }
  
  return 'EMPLOYEE';
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
  var matchTextMonth = str.match(/^(\d{1,2})[-/.\s]+([a-zA-Z]+)[-/.\s,]+(\d{4})(?:[T\s].*)?$/);
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
  var matchMonthText = str.match(/^([a-zA-Z]+)[-/.\s]+(\d{1,2})[-/.\s,]+(\d{4})(?:[T\s].*)?$/);
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
  var matchYearText = str.match(/^(\d{4})[-/.\s]+([a-zA-Z]+)[-/.\s]+(\d{1,2})(?:[T\s].*)?$/);
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
  var dateOnly = str.split(/[T\s]/)[0].trim();
  
  // 4. YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  var matchYMD = dateOnly.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
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
  var matchDMY = dateOnly.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
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
  
  var role = getUserRole(employeeId);
  var token = generateSessionToken(employeeId);
  
  logAuditAction('LOGIN_SUCCESS', employeeId, 'Role: ' + role, 'SUCCESS');
  
  return {
    success: true,
    message: 'Login successful',
    data: {
      employeeId: officer.employeeId,
      name: officer.name,
      designation: officer.designation,
      role: role,
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
  var sheet = getOrCreateSheet('Area', ['Area', 'Status', 'CreatedAt']);
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
    var sheet = getOrCreateSheet('Area', ['Area', 'Status', 'CreatedAt']);
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
      var durMatch = disp.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
      if (durMatch) {
        if (durMatch[3] !== undefined) {
          var m1 = durMatch[2].length === 1 ? '0' + durMatch[2] : durMatch[2];
          var s1 = durMatch[3].length === 1 ? '0' + durMatch[3] : durMatch[3];
          return durMatch[1] + ':' + m1 + ':' + s1;
        }
        var m = durMatch[2].length === 1 ? '0' + durMatch[2] : durMatch[2];
        return durMatch[1] + ':' + m + ':00';
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
      return nHours + ':' + (nMinutes < 10 ? '0' : '') + nMinutes + ':' + (nSeconds < 10 ? '0' : '') + nSeconds;
    }
  }

  // If rawValue is a duration string (e.g. "1:30:00" or "25:00:00")
  if (typeof rawValue === 'string') {
    var str = rawValue.trim();
    var durMatchStr = str.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
    if (durMatchStr) {
      if (durMatchStr[3] !== undefined) {
        var m2 = durMatchStr[2].length === 1 ? '0' + durMatchStr[2] : durMatchStr[2];
        var s2 = durMatchStr[3].length === 1 ? '0' + durMatchStr[3] : durMatchStr[3];
        return durMatchStr[1] + ':' + m2 + ':' + s2;
      }
      var m3 = durMatchStr[2].length === 1 ? '0' + durMatchStr[2] : durMatchStr[2];
      return durMatchStr[1] + ':' + m3 + ':00';
    }
  }

  // If rawValue is an 1899 Date object (Google Sheets returns Date for time-formatted cells under 24 hrs when read without display value)
  if (Object.prototype.toString.call(rawValue) === '[object Date]' || (rawValue instanceof Date)) {
    if (!isNaN(rawValue.getTime())) {
      var dHours = rawValue.getHours();
      var dMinutes = rawValue.getMinutes();
      var dSeconds = rawValue.getSeconds();
      return dHours + ':' + (dMinutes < 10 ? '0' : '') + dMinutes + ':' + (dSeconds < 10 ? '0' : '') + dSeconds;
    }
  }

  // 3. Safe fallback handling
  return '1:00:00';
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
  var match = str.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
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
    
    // Strict exact participant parsing
    var staffArray = staffIdsRaw.split(',').map(function(s) {
      return normalizeEmpId(s);
    }).filter(Boolean);
    
    if (staffCount === 0 && staffArray.length > 0) {
      staffCount = staffArray.length;
    }
    
    var isResourcePerson = (resourcePersonEmpId === loggedInId);
    var isStaffParticipant = (staffArray.indexOf(loggedInId) !== -1);
    
    // Ordinary employees ONLY receive records where they were RP or participant
    if (!isAdmin && !isResourcePerson && !isStaffParticipant) {
      continue;
    }
    
    // PRIVACY HARDENING: Non-admins ONLY receive their own ID in staffEmpIds (never other staff IDs)
    var sanitizedStaffEmpIds = isAdmin ? staffArray : (isStaffParticipant ? [session.employeeId] : []);
    
    records.push({
      dataId: dataId,
      area: area,
      fromDate: fromDate,
      toDate: toDate,
      duration: duration,
      topic: topic,
      resourcePersonEmpId: resourcePersonEmpId,
      modeOfTeaching: mode,
      staffEmpIds: sanitizedStaffEmpIds,
      staffCount: staffCount,
      remarks: remarks
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
    var sheet = getOrCreateSheet('Data', [
      'Data ID', 'Ward Name / Area', 'From Date', 'To Date', 'Duration',
      'Topic', 'Resource Person Emp Id', 'Mode of Teaching', 'Staff Emp ID', 'Staff Count', 'Remarks', 'CreatedAt', 'CreatedBy'
    ]);
    
    var fromDate = (params.fromDate || '').trim();
    var toDate = (params.toDate || fromDate).trim();
    var topic = sanitizeCellInput(params.topic);
    var area = sanitizeCellInput(params.area);
    var rpEmpId = normalizeEmpId(params.resourcePersonEmpId);
    
    if (!topic || !area || !fromDate || !rpEmpId) {
      return { success: false, message: 'Topic, Area, Date, and Resource Person are required.' };
    }
    
    // Validate Resource Person against Rosters Master Data
    var rpOfficer = findOfficerById(rpEmpId);
    if (!rpOfficer) {
      return { success: false, message: 'Resource Person Employee ID (' + rpEmpId + ') was not found in the employee master roster.' };
    }
    
    // Sanitize, deduplicate, and validate staff IDs against Rosters Master Data
    var inputStaff = Array.isArray(params.staffEmpIds) ? params.staffEmpIds : (params.staffEmpIds || '').split(',');
    var cleanMap = {};
    var staffClean = [];
    var invalidStaffIds = [];
    
    for (var i = 0; i < inputStaff.length; i++) {
      var sid = normalizeEmpId(inputStaff[i]);
      if (sid && !cleanMap[sid]) {
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
    
    var staffString = staffClean.join(', ');
    var staffCount = staffClean.length;
    
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
      rpEmpId,
      sanitizeCellInput(params.modeOfTeaching || 'Lecture Cum Discussion'),
      staffString,
      staffCount,
      sanitizeCellInput(params.remarks || ''),
      new Date().toISOString(),
      session.employeeId || ''
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
        
        if (params.resourcePersonEmpId !== undefined) {
          var rpEmpId = normalizeEmpId(params.resourcePersonEmpId);
          var rpOfficer = findOfficerById(rpEmpId);
          if (!rpOfficer) {
            return { success: false, message: 'Resource Person Employee ID (' + rpEmpId + ') was not found in roster.' };
          }
          sheet.getRange(r + 1, 7).setValue(rpEmpId);
        }
        
        if (params.modeOfTeaching !== undefined) sheet.getRange(r + 1, 8).setValue(sanitizeCellInput(params.modeOfTeaching));
        
        if (params.staffEmpIds !== undefined) {
          var inputStaff = Array.isArray(params.staffEmpIds) ? params.staffEmpIds : (params.staffEmpIds || '').split(',');
          var cleanMap = {};
          var staffClean = [];
          var invalidStaffIds = [];
          
          for (var i = 0; i < inputStaff.length; i++) {
            var sid = normalizeEmpId(inputStaff[i]);
            if (sid && !cleanMap[sid]) {
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
          
          sheet.getRange(r + 1, 9).setValue(staffClean.join(', '));
          sheet.getRange(r + 1, 10).setValue(staffClean.length);
        }
        
        if (params.remarks !== undefined) sheet.getRange(r + 1, 11).setValue(sanitizeCellInput(params.remarks));
        
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
 * 4 & 17. Upcoming Classes Management
 */
function handleGetUpcomingClasses(params) {
  var sheet = getOrCreateSheet('Upcoming Classes', [
    'Class ID', 'Topic', 'Area', 'Date', 'Time', 'Duration', 'Resource Person Emp Id', 'Mode', 'Description', 'Max Participants', 'Status'
  ]);
  
  var data = sheet.getDataRange().getValues();
  var list = [];
  
  for (var r = 1; r < data.length; r++) {
    var id = String(data[r][0] || '').trim();
    if (!id) continue;
    
    list.push({
      classId: id,
      topic: String(data[r][1] || ''),
      area: String(data[r][2] || ''),
      date: formatDateValue(data[r][3]),
      time: String(data[r][4] || ''),
      duration: String(data[r][5] || '1:00:00'),
      resourcePersonEmpId: normalizeEmpId(data[r][6]),
      modeOfTeaching: String(data[r][7] || 'Lecture Cum Discussion'),
      description: String(data[r][8] || ''),
      maxParticipants: parseInt(data[r][9], 10) || 50,
      status: String(data[r][10] || 'OPEN').toUpperCase()
    });
  }
  
  return { success: true, data: list };
}

function handleAddUpcomingClass(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var topic = sanitizeCellInput(params.topic);
  var area = sanitizeCellInput(params.area);
  var date = (params.date || '').trim();
  var rpEmpId = normalizeEmpId(params.resourcePersonEmpId);
  
  if (!topic || !area || !date || !rpEmpId) {
    return { success: false, message: 'Topic, Area, Date, and Resource Person are required.' };
  }
  
  var rpOfficer = findOfficerById(rpEmpId);
  if (!rpOfficer) {
    return { success: false, message: 'Resource Person Employee ID (' + rpEmpId + ') not found in master roster.' };
  }
  
  var rawStatus = String(params.status || 'OPEN').toUpperCase().trim();
  var allowedStatuses = ['OPEN', 'CLOSED', 'CANCELLED'];
  var status = (allowedStatuses.indexOf(rawStatus) !== -1) ? rawStatus : 'OPEN';
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var sheet = getOrCreateSheet('Upcoming Classes', [
      'Class ID', 'Topic', 'Area', 'Date', 'Time', 'Duration', 'Resource Person Emp Id', 'Mode', 'Description', 'Max Participants', 'Status'
    ]);
    
    var curYear = new Date().getFullYear();
    var timestampSuffix = Date.now().toString().slice(-4);
    var randSuffix = ('000' + Math.floor(Math.random() * 1000)).slice(-3);
    var classId = 'CLS-' + curYear + '-' + timestampSuffix + randSuffix;
    
    sheet.appendRow([
      classId,
      topic,
      area,
      date,
      params.time || '14:00',
      sanitizeCellInput(params.duration || '1:00:00'),
      rpEmpId,
      sanitizeCellInput(params.modeOfTeaching || 'Lecture Cum Discussion'),
      sanitizeCellInput(params.description || ''),
      parseInt(params.maxParticipants, 10) || 50,
      status
    ]);
    
    logAuditAction('ADD_UPCOMING_CLASS', session.employeeId, 'Scheduled class: ' + classId + ' (' + topic + ')', 'SUCCESS');
    return { success: true, message: 'Upcoming class scheduled successfully.', data: { classId: classId } };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateUpcomingClass(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  var classId = (params.classId || '').trim();
  if (!classId) return { success: false, message: 'Class ID is required.' };
  
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
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === classId.toLowerCase()) {
        if (params.topic !== undefined) sheet.getRange(r + 1, 2).setValue(sanitizeCellInput(params.topic));
        if (params.area !== undefined) sheet.getRange(r + 1, 3).setValue(sanitizeCellInput(params.area));
        if (params.date !== undefined) sheet.getRange(r + 1, 4).setValue(params.date);
        if (params.time !== undefined) sheet.getRange(r + 1, 5).setValue(params.time);
        if (params.duration !== undefined) sheet.getRange(r + 1, 6).setValue(sanitizeCellInput(params.duration));
        
        if (params.resourcePersonEmpId !== undefined) {
          var rpEmpId = normalizeEmpId(params.resourcePersonEmpId);
          var rpOfficer = findOfficerById(rpEmpId);
          if (!rpOfficer) {
            return { success: false, message: 'Resource Person Employee ID (' + rpEmpId + ') not found in master roster.' };
          }
          sheet.getRange(r + 1, 7).setValue(rpEmpId);
        }
        
        if (params.modeOfTeaching !== undefined) sheet.getRange(r + 1, 8).setValue(sanitizeCellInput(params.modeOfTeaching));
        if (params.description !== undefined) sheet.getRange(r + 1, 9).setValue(sanitizeCellInput(params.description));
        if (params.maxParticipants !== undefined) sheet.getRange(r + 1, 10).setValue(parseInt(params.maxParticipants, 10) || 50);
        
        if (params.status !== undefined) {
          var rawStatus = String(params.status).toUpperCase().trim();
          var allowedStatuses = ['OPEN', 'CLOSED', 'CANCELLED'];
          if (allowedStatuses.indexOf(rawStatus) === -1) {
            return { success: false, message: 'Invalid status. Allowed values: OPEN, CLOSED, CANCELLED.' };
          }
          sheet.getRange(r + 1, 11).setValue(rawStatus);
        }
        
        logAuditAction('UPDATE_UPCOMING_CLASS', session.employeeId, 'Updated class: ' + classId, 'SUCCESS');
        return { success: true, message: 'Upcoming class updated successfully.' };
      }
    }
    return { success: false, message: 'Class not found.' };
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
  
  var classId = (params.classId || '').trim();
  if (!classId) return { success: false, message: 'Class ID is required.' };
  
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
    
    // 1. Confirm Class Exists and is OPEN
    var classData = classSheet.getDataRange().getValues();
    var targetClass = null;
    for (var c = 1; c < classData.length; c++) {
      if (String(classData[c][0]).trim().toLowerCase() === classId.toLowerCase()) {
        targetClass = {
          classId: String(classData[c][0]),
          topic: String(classData[c][1]),
          maxParticipants: parseInt(classData[c][9], 10) || 50,
          status: String(classData[c][10] || 'OPEN').toUpperCase().trim()
        };
        break;
      }
    }
    
    if (!targetClass) {
      return { success: false, message: 'Class with ID ' + classId + ' not found.' };
    }
    
    if (targetClass.status !== 'OPEN') {
      return { success: false, message: 'This class is currently ' + targetClass.status + ' and not accepting applications.' };
    }
    
    var appSheet = getOrCreateSheet('CNE Applications', [
      'Application ID', 'Class ID', 'Employee ID', 'Employee Name', 'Applied At', 'Status', 'Remarks'
    ]);
    
    var appData = appSheet.getDataRange().getValues();
    var empId = normalizeEmpId(session.employeeId);
    var activeAppCount = 0;
    
    // 2. Prevent duplicate applications and count active applications
    for (var r = 1; r < appData.length; r++) {
      var rowClassId = String(appData[r][1]).trim().toLowerCase();
      var rowEmpId = normalizeEmpId(appData[r][2]);
      var rowStatus = String(appData[r][5]).trim();
      
      if (rowClassId === classId.toLowerCase()) {
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
      classId,
      session.employeeId,
      empName,
      new Date().toISOString(),
      'Applied',
      sanitizeCellInput(params.remarks || '')
    ]);
    
    logAuditAction('APPLY_CLASS', session.employeeId, 'Applied for Class: ' + classId + ' (App ID: ' + appId + ')', 'SUCCESS');
    
    return {
      success: true,
      message: 'Application submitted successfully.',
      data: {
        applicationId: appId,
        classId: classId,
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
  var empId = normalizeEmpId(session.employeeId);
  var list = [];
  
  for (var r = 1; r < data.length; r++) {
    if (normalizeEmpId(data[r][2]) === empId) {
      list.push({
        applicationId: String(data[r][0]),
        classId: String(data[r][1]),
        employeeId: String(data[r][2]),
        employeeName: String(data[r][3]),
        appliedAt: formatDateValue(data[r][4]),
        status: String(data[r][5]),
        remarks: String(data[r][6] || '')
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
  var list = [];
  
  for (var r = 1; r < data.length; r++) {
    var id = String(data[r][0]).trim();
    if (!id) continue;
    list.push({
      applicationId: id,
      classId: String(data[r][1]),
      employeeId: String(data[r][2]),
      employeeName: String(data[r][3]),
      appliedAt: formatDateValue(data[r][4]),
      status: String(data[r][5]),
      remarks: String(data[r][6] || '')
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
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === appId.toLowerCase()) {
        sheet.getRange(r + 1, 6).setValue(newStatus);
        if (params.remarks !== undefined) sheet.getRange(r + 1, 7).setValue(sanitizeCellInput(params.remarks));
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
  var sheet = getOrCreateSheet('Gallery', [
    'Image ID', 'Title', 'Description', 'Date', 'Drive File ID', 'Image URL', 'Uploaded By', 'Uploaded At', 'Status'
  ]);
  
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
    
    var sheet = getOrCreateSheet('Gallery', [
      'Image ID', 'Title', 'Description', 'Date', 'Drive File ID', 'Image URL', 'Uploaded By', 'Uploaded At', 'Status'
    ]);
    
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

  var sheet = getOrCreateSheet('Role', ['Employee ID No.', 'Name of the Officers', 'Designation', 'Role']);
  var data = sheet.getDataRange().getValues();
  var roles = [];
  
  for (var r = 1; r < data.length; r++) {
    var empId = String(data[r][0] || '').trim();
    if (empId) {
      roles.push({
        employeeId: empId,
        name: String(data[r][1] || ''),
        designation: String(data[r][2] || ''),
        role: String(data[r][3] || 'EMPLOYEE').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE'
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
  
  var targetRole = (params.role || 'EMPLOYEE').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server is busy. Please try again.' };
  }
  
  try {
    var sheet = getOrCreateSheet('Role', ['Employee ID No.', 'Name of the Officers', 'Designation', 'Role']);
    var data = sheet.getDataRange().getValues();
    var adminCount = 0;
    var targetRow = -1;
    var currentRole = 'EMPLOYEE';
    
    for (var r = 1; r < data.length; r++) {
      var rowEmpId = normalizeEmpId(data[r][0]);
      var rVal = String(data[r][3] || 'EMPLOYEE').toUpperCase().trim();
      if (rVal === 'ADMIN') {
        adminCount++;
      }
      if (rowEmpId === employeeId) {
        targetRow = r + 1;
        currentRole = rVal;
      }
    }
    
    // Prevent accidental removal of the last administrator
    if (currentRole === 'ADMIN' && targetRole === 'EMPLOYEE' && adminCount <= 1) {
      return {
        success: false,
        message: 'Cannot remove the last administrator account. Please assign another administrator first.'
      };
    }
    
    if (targetRow > 0) {
      sheet.getRange(targetRow, 4).setValue(targetRole);
    } else {
      var officer = findOfficerById(employeeId);
      var name = officer ? officer.name : (params.name || '');
      var desig = officer ? officer.designation : (params.designation || '');
      sheet.appendRow([employeeId, name, desig, targetRole]);
    }
    
    logAuditAction('UPDATE_ROLE', session.employeeId, 'Set role for ' + employeeId + ' -> ' + targetRole, 'SUCCESS');
    return { success: true, message: 'Role assigned successfully.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 11. News & Events Management (Public Read, Admin Write)
 */
function handleGetNewsEvents(params) {
  var sheet = getOrCreateSheet('News and Events', [
    'Event ID', 'Title', 'Category', 'Date', 'Summary', 'Full Content', 'Status', 'CreatedAt', 'CreatedBy'
  ]);
  
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
    var sheet = getOrCreateSheet('News and Events', [
      'Event ID', 'Title', 'Category', 'Date', 'Summary', 'Full Content', 'Status', 'CreatedAt', 'CreatedBy'
    ]);
    
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
  var coordinators = ['Ms. Suman Choudhary', 'Ms. Ramya T'];
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
        uniqueStaffTrained: 0,
        uniqueWardsCount: 0,
        attendanceComplianceRate: 'N/A',
        scope: isUserLoggedIn ? 'user' : 'institutional'
      }
    };
  }
  
  var data = dataSheet.getDataRange().getValues();
  if (data.length <= 1) {
    return {
      success: true,
      data: {
        totalCompletedClasses: 0,
        uniqueStaffTrained: 0,
        uniqueWardsCount: 0,
        attendanceComplianceRate: 'N/A',
        scope: isUserLoggedIn ? 'user' : 'institutional'
      }
    };
  }
  
  var completedClasses = 0;
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
    for (var u = 1; u < uData.length; u++) {
      if (String(uData[u][10] || 'OPEN').toUpperCase() === 'OPEN') upcomingCount++;
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
    return Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
  }
  return String(val);
}

/**
 * Strictly NON-DESTRUCTIVE Sheet Tab & Header Resolver
 * If tab exists: leaves existing rows, structure, and formatting completely untouched.
 * If tab is missing: creates tab and writes initial bold headers.
 */
function getOrCreateSheet(sheetName, defaultHeaders) {
  var ss = getSpreadsheet('CNE');
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (defaultHeaders && defaultHeaders.length > 0) {
      sheet.appendRow(defaultHeaders);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight('bold');
    }
  } else if (sheet.getLastRow() === 0 && defaultHeaders && defaultHeaders.length > 0) {
    sheet.appendRow(defaultHeaders);
    sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight('bold');
  }
  return sheet;
}

/**
 * Internal Non-Destructive Sheet Initializer (Shared by setup script and admin endpoint)
 */
function internalInitializeSheets(executorEmpId) {
  var cneTabs = [
    { name: 'Data', headers: ['Data ID', 'Ward Name / Area', 'From Date', 'To Date', 'Duration', 'Topic', 'Resource Person Emp Id', 'Mode of Teaching', 'Staff Emp ID', 'Staff Count', 'Remarks', 'CreatedAt', 'CreatedBy'] },
    { name: 'Area', headers: ['Area', 'Status', 'CreatedAt'] },
    { name: 'Role', headers: ['Employee ID No.', 'Name of the Officers', 'Designation', 'Role'] },
    { name: 'Upcoming Classes', headers: ['Class ID', 'Topic', 'Area', 'Date', 'Time', 'Duration', 'Resource Person Emp Id', 'Mode', 'Description', 'Max Participants', 'Status'] },
    { name: 'CNE Applications', headers: ['Application ID', 'Class ID', 'Employee ID', 'Employee Name', 'Applied At', 'Status', 'Remarks'] },
    { name: 'Gallery', headers: ['Image ID', 'Title', 'Description', 'Date', 'Drive File ID', 'Image URL', 'Uploaded By', 'Uploaded At', 'Status'] },
    { name: 'News and Events', headers: ['Event ID', 'Title', 'Category', 'Date', 'Summary', 'Full Content', 'Status', 'CreatedAt', 'CreatedBy'] },
    { name: 'User Credentials', headers: ['Employee ID', 'Password Hash', 'Password Salt', 'Must Change Password', 'Created At', 'Updated At', 'Last Login At', 'Account Status'] },
    { name: 'Audit Log', headers: ['Timestamp', 'Action', 'Employee ID', 'Details', 'Status'] }
  ];
  
  var auditReport = [];
  var ss = getSpreadsheet('CNE');
  
  for (var i = 0; i < cneTabs.length; i++) {
    var item = cneTabs[i];
    var sheet = ss.getSheetByName(item.name);
    if (sheet) {
      var rows = sheet.getLastRow();
      if (rows === 0 && item.headers.length > 0) {
        sheet.appendRow(item.headers);
        sheet.getRange(1, 1, 1, item.headers.length).setFontWeight('bold');
        auditReport.push({ tab: item.name, status: 'Existing (Headers added to empty tab)', rowCount: 1 });
      } else {
        auditReport.push({ tab: item.name, status: 'Existing, unchanged', rowCount: rows });
      }
    } else {
      var newSheet = ss.insertSheet(item.name);
      newSheet.appendRow(item.headers);
      newSheet.getRange(1, 1, 1, item.headers.length).setFontWeight('bold');
      auditReport.push({ tab: item.name, status: 'Created', rowCount: 1 });
    }
  }
  
  // Check Employee Master
  try {
    var offSS = getSpreadsheet('OFFICERS');
    var offSheet = offSS.getSheetByName('Rosters Master Data');
    if (offSheet) {
      auditReport.push({ tab: offSheet.getName(), status: 'Existing, unchanged (Master Roster)', rowCount: offSheet.getLastRow() });
    }
  } catch (e) {
    auditReport.push({ tab: 'Rosters Master Data', status: 'Separate Sheet / Unconfigured', error: e.message });
  }
  
  logAuditAction('INITIALIZE_SHEETS', executorEmpId || 'SYSTEM', 'Sheet verification executed', 'SUCCESS');
  
  return {
    success: true,
    message: 'Sheet initialization completed safely. All existing data remained completely untouched.',
    auditReport: auditReport
  };
}

/**
 * 8 & 24. Auto-Initialize Sheets (Strictly NON-DESTRUCTIVE with Audit Report, Requires ADMIN)
 */
function handleInitializeSheets(params, session) {
  var adminError = requireAdmin(session);
  if (adminError) return adminError;

  return internalInitializeSheets(session ? session.employeeId : 'ADMIN');
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
  
  // 2. Initialize all CNE tabs safely via internal trusted function
  var result = internalInitializeSheets('SCRIPT_OWNER');
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

