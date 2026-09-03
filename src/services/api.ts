import {
  ApiResponse,
  Area,
  CNEApplication,
  CNERecord,
  CNEReportStats,
  ProgramImpactStats,
  ChairpersonMessageData,
  Employee,
  GalleryItem,
  NewsEventItem,
  QuickLinkItem,
  RoleMapping,
  SessionUser,
  UpcomingClass,
  UserRole
} from '../types';
import {
  INITIAL_AREAS,
  INITIAL_CHAIRPERSON_MESSAGE,
  INITIAL_CNE_RECORDS,
  INITIAL_GALLERY,
  INITIAL_NEWS_EVENTS,
  INITIAL_OFFICERS,
  INITIAL_QUICK_LINKS,
  INITIAL_ROLES,
  INITIAL_UPCOMING_CLASSES,
  INITIAL_USER_CREDS
} from './initialData';

const STORAGE_KEYS = {
  AREAS: 'cne_areas',
  OFFICERS: 'cne_officers',
  ROLES: 'cne_roles',
  USER_CREDS: 'cne_user_creds',
  CNE_RECORDS: 'cne_records',
  UPCOMING_CLASSES: 'cne_upcoming_classes',
  APPLICATIONS: 'cne_applications',
  GALLERY: 'cne_gallery',
  NEWS_EVENTS: 'cne_news_events',
  CHAIRPERSON_MESSAGE: 'cne_chairperson_message',
  QUICK_LINKS: 'cne_quick_links',
  SESSION: 'cne_session_user',
  API_URL: 'CNE_CUSTOM_APPS_SCRIPT_URL',
  ENV_MODE: 'CNE_ENVIRONMENT_MODE' // 'production' | 'sandbox'
};

/**
 * Safely normalize Duration to standard HH:MM:SS duration string.
 * Duration in Google Sheets can be returned as:
 * 1. Formatted display string from getDisplayValues() (e.g. "1:00:00", "1:30:00", "0:30:00", "15:00:00")
 * 2. Date object from getValues() (e.g. Sat Dec 30 1899 01:30:00 GMT+...)
 * 3. Numeric serial fraction of a day (e.g. 1/24 = 0.041666... for 1 hr, 1.5/24 = 0.0625 for 1.5 hrs)
 * 4. Existing string representation or ISO/Date string
 * Note: Duration can exceed 24 hours (e.g. 25:00:00, 120:00:00). It must NEVER be converted to a JavaScript Date object.
 */
export function formatDurationValue(rawValue: any, displayValue?: any): string {
  // 1. Prefer Google Sheets display value if available and valid duration
  if (displayValue !== null && displayValue !== undefined) {
    const disp = String(displayValue).trim();
    if (disp) {
      const durMatch = disp.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
      if (durMatch) {
        if (durMatch[3] !== undefined) {
          const m1 = durMatch[2].length === 1 ? '0' + durMatch[2] : durMatch[2];
          const s1 = durMatch[3].length === 1 ? '0' + durMatch[3] : durMatch[3];
          return `${durMatch[1]}:${m1}:${s1}`;
        }
        const m = durMatch[2].length === 1 ? '0' + durMatch[2] : durMatch[2];
        return `${durMatch[1]}:${m}:00`;
      }
    }
  }

  // 2. Safe numeric day-fraction conversion (Google Sheets serial value)
  if (typeof rawValue === 'number' && !isNaN(rawValue)) {
    const totalSeconds = Math.round(rawValue * 86400);
    if (totalSeconds >= 0) {
      const nHours = Math.floor(totalSeconds / 3600);
      const nMinutes = Math.floor((totalSeconds % 3600) / 60);
      const nSeconds = totalSeconds % 60;
      return `${nHours}:${nMinutes < 10 ? '0' : ''}${nMinutes}:${nSeconds < 10 ? '0' : ''}${nSeconds}`;
    }
  }

  // If rawValue is a duration string (e.g. "1:30:00" or "25:00:00")
  if (typeof rawValue === 'string') {
    const str = rawValue.trim();
    const durMatchStr = str.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
    if (durMatchStr) {
      if (durMatchStr[3] !== undefined) {
        const m2 = durMatchStr[2].length === 1 ? '0' + durMatchStr[2] : durMatchStr[2];
        const s2 = durMatchStr[3].length === 1 ? '0' + durMatchStr[3] : durMatchStr[3];
        return `${durMatchStr[1]}:${m2}:${s2}`;
      }
      const m3 = durMatchStr[2].length === 1 ? '0' + durMatchStr[2] : durMatchStr[2];
      return `${durMatchStr[1]}:${m3}:00`;
    }
  }

  // If rawValue is an 1899 Date object (Google Sheets returns Date for time-formatted cells under 24 hrs when read without display value)
  if (Object.prototype.toString.call(rawValue) === '[object Date]' || (rawValue instanceof Date)) {
    const d = rawValue as Date;
    if (!isNaN(d.getTime())) {
      const dHours = d.getHours();
      const dMinutes = d.getMinutes();
      const dSeconds = d.getSeconds();
      return `${dHours}:${dMinutes < 10 ? '0' : ''}${dMinutes}:${dSeconds < 10 ? '0' : ''}${dSeconds}`;
    }
  }

  // 3. Safe fallback handling
  return '1:00:00';
}

export class ApiService {
  /**
   * Initialize Local Storage for Sandbox/Test Mode only
   */
  static initLocalStorage() {
    let officers: Employee[] = [];
    const storedOfficers = localStorage.getItem(STORAGE_KEYS.OFFICERS);
    if (!storedOfficers) {
      officers = [...INITIAL_OFFICERS];
    } else {
      try {
        officers = JSON.parse(storedOfficers);
      } catch (e) {
        officers = [...INITIAL_OFFICERS];
      }
    }
    // Ensure invalid employee 100062 is never present
    officers = officers.filter((o) => o.employeeId.toLowerCase() !== '100062');
    localStorage.setItem(STORAGE_KEYS.OFFICERS, JSON.stringify(officers));

    if (!localStorage.getItem(STORAGE_KEYS.AREAS)) {
      localStorage.setItem(STORAGE_KEYS.AREAS, JSON.stringify(INITIAL_AREAS));
    }

    let roles: RoleMapping[] = [];
    const storedRoles = localStorage.getItem(STORAGE_KEYS.ROLES);
    if (!storedRoles) {
      roles = [...INITIAL_ROLES];
    } else {
      try {
        roles = JSON.parse(storedRoles);
      } catch (e) {
        roles = [...INITIAL_ROLES];
      }
    }
    // Ensure invalid employee 100062 is never present
    roles = roles.filter((r) => r.employeeId.toLowerCase() !== '100062');
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));

    if (!localStorage.getItem(STORAGE_KEYS.USER_CREDS)) {
      localStorage.setItem(STORAGE_KEYS.USER_CREDS, JSON.stringify(INITIAL_USER_CREDS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CNE_RECORDS)) {
      localStorage.setItem(STORAGE_KEYS.CNE_RECORDS, JSON.stringify(INITIAL_CNE_RECORDS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.UPCOMING_CLASSES)) {
      localStorage.setItem(STORAGE_KEYS.UPCOMING_CLASSES, JSON.stringify(INITIAL_UPCOMING_CLASSES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.GALLERY)) {
      localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(INITIAL_GALLERY));
    }
    if (!localStorage.getItem(STORAGE_KEYS.APPLICATIONS)) {
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NEWS_EVENTS)) {
      localStorage.setItem(STORAGE_KEYS.NEWS_EVENTS, JSON.stringify(INITIAL_NEWS_EVENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CHAIRPERSON_MESSAGE)) {
      localStorage.setItem(STORAGE_KEYS.CHAIRPERSON_MESSAGE, JSON.stringify(INITIAL_CHAIRPERSON_MESSAGE));
    }
    if (!localStorage.getItem(STORAGE_KEYS.QUICK_LINKS)) {
      localStorage.setItem(STORAGE_KEYS.QUICK_LINKS, JSON.stringify(INITIAL_QUICK_LINKS));
    }
  }

  /**
   * Environment Mode: 'production' (Strict Google Sheets) vs 'sandbox' (Local dev simulation)
   */
  static getEnvironmentMode(): 'production' | 'sandbox' {
    const saved = localStorage.getItem(STORAGE_KEYS.ENV_MODE);
    if (saved === 'sandbox') return 'sandbox';
    return 'production';
  }

  static setEnvironmentMode(mode: 'production' | 'sandbox') {
    localStorage.setItem(STORAGE_KEYS.ENV_MODE, mode);
  }

  /**
   * Get configured Google Apps Script Web App URL
   */
  static isLiveBackendConnected(): boolean {
    return !!this.getAppsScriptUrl();
  }

  static getAppsScriptUrl(): string {
    const fromStorage = localStorage.getItem(STORAGE_KEYS.API_URL);
    if (fromStorage && fromStorage.trim() !== '') {
      return fromStorage.trim();
    }
    const envUrl = (import.meta as any).env?.VITE_APPS_SCRIPT_URL;
    if (envUrl && envUrl.trim() !== '') {
      return envUrl.trim();
    }
    return '';
  }

  static setAppsScriptUrl(url: string) {
    if (url && url.trim() !== '') {
      localStorage.setItem(STORAGE_KEYS.API_URL, url.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.API_URL);
    }
  }

  /**
   * Central Action Executor:
   * In Production mode: Exclusively connects to Google Apps Script. Fails closed if not configured.
   * In Sandbox mode: Runs offline local simulation for development/testing.
   */
  static async executeAction<T = any>(
    action: string,
    params: Record<string, any> = {}
  ): Promise<ApiResponse<T>> {
    const mode = this.getEnvironmentMode();
    const apiUrl = this.getAppsScriptUrl();
    const session = this.getSessionUser();
    const payload = {
      action,
      ...params,
      token: session?.token,
      loggedInEmployeeId: session?.employeeId
    };

    // In Production Mode: Fail closed if backend URL is not configured
    if (mode === 'production') {
      if (!apiUrl) {
        if (action === 'ping') {
          return { success: false, message: 'Google Apps Script URL is not configured.' };
        }
        return {
          success: false,
          errorCode: 'BACKEND_NOT_CONFIGURED',
          message: 'Google Apps Script backend URL is not configured. Please configure your backend to connect to Google Sheets.'
        };
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45-second timeout for Apps Script

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          // Check for session expiry/invalid token
          if (result.errorCode === 'UNAUTHORIZED' && session) {
            this.logout();
          }
          if (result.success && result.data && action.startsWith('get')) {
            try {
              const cacheKey = action === 'getProgramImpact'
                ? (session && session.employeeId ? `cne_cache_getProgramImpact_${session.employeeId.toLowerCase()}` : 'cne_cache_getProgramImpact_institutional')
                : (action === 'getCNERecords' && session && session.employeeId ? `cne_cache_getCNERecords_${session.employeeId.toLowerCase()}` : `cne_cache_${action}`);
              localStorage.setItem(cacheKey, JSON.stringify(result.data));
            } catch (e) {}
          }
          return result as ApiResponse<T>;
        } else {
          // If server returns HTTP error and it's a read query, attempt offline cache fallback
          if (action.startsWith('get')) {
            console.warn(`[CNE Service] HTTP ${response.status} on ${action}. Serving cached dataset.`);
            try {
              const cacheKey = action === 'getProgramImpact'
                ? (session && session.employeeId ? `cne_cache_getProgramImpact_${session.employeeId.toLowerCase()}` : 'cne_cache_getProgramImpact_institutional')
                : (action === 'getCNERecords' && session && session.employeeId ? `cne_cache_getCNERecords_${session.employeeId.toLowerCase()}` : `cne_cache_${action}`);
              const cached = localStorage.getItem(cacheKey);
              if (cached) {
                return { success: true, data: JSON.parse(cached), message: 'Loaded from local cache' } as ApiResponse<T>;
              }
            } catch (e) {}
          }

          return {
            success: false,
            errorCode: 'HTTP_ERROR',
            message: `Server returned HTTP error status ${response.status}. Please check Google Apps Script deployment.`
          };
        }
      } catch (err: any) {
        console.warn(`[CNE Service] Network notice executing ${action} against ${apiUrl}:`, err);
        const isTimeout = err?.name === 'AbortError';

        // For read queries, gracefully fall back to cached dataset if present
        if (action.startsWith('get') || action === 'ping') {
          try {
            const cacheKey = action === 'getProgramImpact'
              ? (session && session.employeeId ? `cne_cache_getProgramImpact_${session.employeeId.toLowerCase()}` : 'cne_cache_getProgramImpact_institutional')
              : (action === 'getCNERecords' && session && session.employeeId ? `cne_cache_getCNERecords_${session.employeeId.toLowerCase()}` : `cne_cache_${action}`);
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              return { success: true, data: JSON.parse(cached), message: 'Loaded from local cache' } as ApiResponse<T>;
            }
          } catch (e) {}
        }

        return {
          success: false,
          errorCode: 'BACKEND_UNAVAILABLE',
          message: isTimeout
            ? 'Backend connection timed out. Please check your internet connection or Google Apps Script performance.'
            : 'Backend connection is unavailable. Please check your network and Google Apps Script configuration.'
        };
      }
    }

    // Explicit Sandbox Mode execution only
    this.initLocalStorage();
    return this.executeLocalAction<T>(action, payload);
  }

  /**
   * Test Connection with Diagnostics
   */
  static async testConnection(url: string): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      return { success: false, message: 'URL is required.' };
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(cleanUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - start);

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return {
            success: true,
            message: `Connected successfully (${latencyMs}ms). ${data.message || 'Google Sheets backend active.'}`,
            latencyMs
          };
        } else {
          return {
            success: false,
            message: data.message || 'Apps Script returned an unsuccessful response.'
          };
        }
      } else {
        return {
          success: false,
          message: `HTTP Error ${res.status}: ${res.statusText}. Verify Web App is deployed with Access: Anyone.`
        };
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.name === 'AbortError'
          ? 'Connection timed out. Please check the URL and deployment.'
          : (e?.message || 'Network request failed. Ensure CORS and Web App permissions are set to Anyone.')
      };
    }
  }

  /**
   * Initialize All Sheet Tabs
   */
  static async initializeSheets(): Promise<ApiResponse> {
    return this.executeAction('initializeSheets');
  }

  /**
   * Authentication
   */
  static async login(employeeId: string, password: string): Promise<ApiResponse<SessionUser>> {
    const cleanEmpId = (employeeId || '').trim();
    const cleanPass = (password || '').trim();

    if (!cleanEmpId || !cleanPass) {
      return { success: false, message: 'Please enter both your Employee ID and Password.' };
    }

    const res = await this.executeAction<SessionUser>('login', {
      employeeId: cleanEmpId,
      password: cleanPass
    });

    if (res.success && res.data) {
      this.saveSessionUser(res.data);
    }
    return res;
  }

  static async changePassword(newPassword: string): Promise<ApiResponse> {
    return this.executeAction('changePassword', { newPassword });
  }

  static async resetPassword(employeeId: string, doj: string, newPassword: string): Promise<ApiResponse> {
    return this.executeAction('resetPassword', { employeeId, dateOfJoining: doj, doj, newPassword });
  }

  static async adminResetPassword(targetEmployeeId: string): Promise<ApiResponse> {
    return this.executeAction('adminResetPassword', { targetEmployeeId });
  }

  static logout() {
    const session = this.getSessionUser();
    if (session && session.employeeId) {
      localStorage.removeItem(`cne_cache_getProgramImpact_${session.employeeId.toLowerCase()}`);
      localStorage.removeItem(`cne_cache_getCNERecords_${session.employeeId.toLowerCase()}`);
    }
    localStorage.removeItem('cne_cache_getProgramImpact');
    localStorage.removeItem('cne_cache_getCNERecords');
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }

  static getSessionUser(): SessionUser | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse session user', e);
    }
    return null;
  }

  static getCurrentUser(): SessionUser {
    const user = this.getSessionUser();
    if (user) return user;

    // Default guest session for unauthenticated state
    return {
      employeeId: '',
      name: 'Guest User',
      designation: 'Visitor',
      email: '',
      role: 'EMPLOYEE',
      token: ''
    };
  }

  static saveSessionUser(user: SessionUser) {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
  }

  /**
   * Master Data APIs
   */
  static async getOfficersDropdown(): Promise<ApiResponse<Employee[]>> {
    return this.executeAction<Employee[]>('getOfficersDropdown');
  }

  static async getAreas(): Promise<ApiResponse<Area[]>> {
    return this.executeAction<Area[]>('getAreas');
  }

  static async addArea(name: string): Promise<ApiResponse> {
    return this.executeAction('addArea', { name });
  }

  static async updateArea(oldName: string, name: string, status: 'ACTIVE' | 'INACTIVE'): Promise<ApiResponse> {
    return this.executeAction('updateArea', { oldName, name, status });
  }

  static async getRoles(): Promise<ApiResponse<RoleMapping[]>> {
    return this.executeAction<RoleMapping[]>('getRoles');
  }

  static async updateRole(employeeId: string, role: UserRole, name?: string, designation?: string): Promise<ApiResponse> {
    return this.executeAction('updateRole', { employeeId, role, name, designation });
  }

  /**
   * CNE Records APIs
   */
  static async getCNERecords(): Promise<ApiResponse<CNERecord[]>> {
    return this.executeAction<CNERecord[]>('getCNERecords');
  }

  static async addCNE(record: Partial<CNERecord>): Promise<ApiResponse<{ dataId: string }>> {
    return this.executeAction<{ dataId: string }>('addCNE', record);
  }

  static async updateCNE(dataId: string, record: Partial<CNERecord>): Promise<ApiResponse> {
    return this.executeAction('updateCNE', { dataId, ...record });
  }

  static async deleteCNE(dataId: string): Promise<ApiResponse> {
    return this.executeAction('deleteCNE', { dataId });
  }

  /**
   * Upcoming Classes & Applications
   */
  static async getUpcomingClasses(): Promise<ApiResponse<UpcomingClass[]>> {
    return this.executeAction<UpcomingClass[]>('getUpcomingClasses');
  }

  static async addUpcomingClass(classData: Partial<UpcomingClass>): Promise<ApiResponse<{ classId: string }>> {
    return this.executeAction<{ classId: string }>('addUpcomingClass', classData);
  }

  static async updateUpcomingClass(classId: string, classData: Partial<UpcomingClass>): Promise<ApiResponse> {
    return this.executeAction('updateUpcomingClass', { classId, ...classData });
  }

  static async applyForClass(classId: string, remarks?: string): Promise<ApiResponse<CNEApplication>> {
    return this.executeAction<CNEApplication>('applyForClass', { classId, remarks });
  }

  static async getMyApplications(): Promise<ApiResponse<CNEApplication[]>> {
    return this.executeAction<CNEApplication[]>('getMyApplications');
  }

  static async getAllApplications(): Promise<ApiResponse<CNEApplication[]>> {
    return this.executeAction<CNEApplication[]>('getAllApplications');
  }

  static async updateApplicationStatus(
    applicationId: string,
    status: CNEApplication['status'],
    remarks?: string
  ): Promise<ApiResponse> {
    return this.executeAction('updateApplicationStatus', { applicationId, status, remarks });
  }

  /**
   * Gallery & Drive Images
   */
  static async getGallery(): Promise<ApiResponse<GalleryItem[]>> {
    return this.executeAction<GalleryItem[]>('getGallery');
  }

  static async uploadImage(
    base64Image: string,
    title: string,
    description?: string,
    date?: string
  ): Promise<ApiResponse<{ id: string; imageUrl: string; fileId?: string }>> {
    return this.executeAction('uploadImage', { base64Image, title, description, date });
  }

  static async updateGalleryItem(id: string, data: Partial<GalleryItem>): Promise<ApiResponse> {
    return this.executeAction('updateGalleryItem', { id, ...data });
  }

  /**
   * News & Events APIs
   */
  static async getNewsEvents(): Promise<ApiResponse<NewsEventItem[]>> {
    return this.executeAction<NewsEventItem[]>('getNewsEvents');
  }

  static async addNewsEvent(item: Partial<NewsEventItem>): Promise<ApiResponse<{ id: string }>> {
    return this.executeAction<{ id: string }>('addNewsEvent', item);
  }

  static async deleteNewsEvent(id: string): Promise<ApiResponse> {
    return this.executeAction('deleteNewsEvent', { id });
  }

  /**
   * Chairperson Message & Institutional Content
   */
  static async getChairpersonMessage(): Promise<ApiResponse<ChairpersonMessageData>> {
    return this.executeAction<ChairpersonMessageData>('getChairpersonMessage');
  }

  static async updateChairpersonMessage(
    data: Partial<ChairpersonMessageData> & { base64Image?: string }
  ): Promise<ApiResponse<{ photoUrl?: string; driveFileId?: string; driveUrl?: string }>> {
    return this.executeAction<{ photoUrl?: string; driveFileId?: string; driveUrl?: string }>('updateChairpersonMessage', data);
  }

  /**
   * Quick Links
   */
  static async getQuickLinks(): Promise<ApiResponse<QuickLinkItem[]>> {
    return this.executeAction<QuickLinkItem[]>('getQuickLinks');
  }

  /**
   * CNE Program Impact (Adaptive: Institutional when unauthenticated, Personal when logged in)
   */
  static async getProgramImpact(): Promise<ApiResponse<ProgramImpactStats>> {
    return this.executeAction<ProgramImpactStats>('getProgramImpact');
  }

  /**
   * Dashboard & Analytics
   */
  static async getDashboardStats(): Promise<ApiResponse<CNEReportStats>> {
    return this.executeAction<CNEReportStats>('getDashboardStats');
  }

  /**
   * Local Simulation Mock Engine (Sandbox / Test Mode Only)
   */
  private static executeLocalAction<T>(
    action: string,
    params: Record<string, any>
  ): ApiResponse<T> {
    try {
      switch (action) {
        case 'ping':
          return { success: true, message: 'Sandbox Offline Simulation Active' } as any;

        case 'login': {
          const empId = (params.employeeId || '').trim();
          const password = (params.password || '').trim();

          let officers: Employee[] = [];
          try {
            officers = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFICERS) || '[]');
          } catch (e) {
            officers = [...INITIAL_OFFICERS];
          }

          let officer = officers.find(
            (o) => o.employeeId.toLowerCase() === empId.toLowerCase()
          );

          if (!officer) {
            officer = INITIAL_OFFICERS.find(
              (o) => o.employeeId.toLowerCase() === empId.toLowerCase()
            );
            if (officer) {
              officers.push(officer);
              localStorage.setItem(STORAGE_KEYS.OFFICERS, JSON.stringify(officers));
            }
          }

          if (!officer) {
            return { success: false, message: 'Employee ID not found in institutional roster.' };
          }

          const creds = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_CREDS) || '{}');
          const savedPass = creds[officer.employeeId];

          let isValid = false;
          let isFirstLogin = false;

          if (savedPass) {
            // User has a saved password: ONLY the saved personal password is valid (pass1234 is rejected)
            if (password === savedPass) {
              isValid = true;
            }
          } else {
            // New user without a saved personal password: ONLY pass1234 is accepted
            if (password === 'pass1234') {
              isValid = true;
              isFirstLogin = true;
            }
          }

          if (!isValid) {
            return {
              success: false,
              message: 'Invalid credentials. Default first-time password is pass1234. If you changed your password, please enter your new personal password.'
            };
          }

          let roles: RoleMapping[] = [];
          try {
            roles = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROLES) || '[]');
          } catch (e) {
            roles = [...INITIAL_ROLES];
          }

          const roleEntry = roles.find((r) => r.employeeId.toLowerCase() === empId.toLowerCase());
          const role: UserRole = roleEntry?.role === 'ADMIN' ? 'ADMIN' : (roleEntry ? roleEntry.role : 'EMPLOYEE');

          const sessionUser: SessionUser = {
            employeeId: officer.employeeId,
            name: officer.name,
            designation: officer.designation,
            email: officer.email,
            role,
            token: `${officer.employeeId}:${Date.now()}:sandbox`,
            isFirstLogin,
            mustChangePassword: isFirstLogin
          };

          return { success: true, data: sessionUser as any, message: 'Login successful' };
        }

        case 'changePassword': {
          const creds = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_CREDS) || '{}');
          const empId = params.loggedInEmployeeId;
          if (empId) {
            creds[empId] = params.newPassword;
            localStorage.setItem(STORAGE_KEYS.USER_CREDS, JSON.stringify(creds));
          }
          return { success: true, message: 'Password updated in local sandbox.' } as any;
        }

        case 'resetPassword': {
          const empId = (params.employeeId || '').trim();
          const doj = (params.dateOfJoining || params.doj || '').trim();
          const officers: Employee[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFICERS) || '[]');
          const officer = officers.find((o) => o.employeeId.toLowerCase() === empId.toLowerCase());
          if (!officer) return { success: false, message: 'Verification failed. Employee ID not found in hospital records.' };

          const normInput = doj.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const normDoj = (officer.doj || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (!normInput || (normInput !== normDoj && doj !== officer.doj)) {
            return { success: false, message: 'Verification failed. Date of Joining does not match hospital records.' };
          }

          const creds = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_CREDS) || '{}');
          creds[officer.employeeId] = params.newPassword;
          localStorage.setItem(STORAGE_KEYS.USER_CREDS, JSON.stringify(creds));
          return { success: true, message: 'Password reset successfully. You can now log in with your new password.' } as any;
        }

        case 'adminResetPassword': {
          const targetEmpId = (params.targetEmployeeId || params.employeeId || '').trim();
          const officers: Employee[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFICERS) || '[]');
          const officer = officers.find((o) => o.employeeId.toLowerCase() === targetEmpId.toLowerCase());
          if (!officer) return { success: false, message: 'Employee not found in roster.' };

          const creds = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_CREDS) || '{}');
          creds[officer.employeeId] = 'pass1234';
          localStorage.setItem(STORAGE_KEYS.USER_CREDS, JSON.stringify(creds));
          return {
            success: true,
            message: `Password for ${officer.name} (${officer.employeeId}) has been reset to pass1234.`
          } as any;
        }

        case 'getOfficersDropdown': {
          const raw: Employee[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFICERS) || '[]');
          const sanitized = raw.map((o) => ({
            employeeId: o.employeeId,
            name: o.name,
            designation: o.designation
          }));
          return { success: true, data: sanitized as any };
        }

        case 'getAreas': {
          const areas: Area[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.AREAS) || '[]');
          return { success: true, data: areas as any };
        }

        case 'addArea': {
          const areas: Area[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.AREAS) || '[]');
          const newArea: Area = {
            id: `AREA-${areas.length + 1}`,
            name: params.name,
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
          };
          areas.push(newArea);
          localStorage.setItem(STORAGE_KEYS.AREAS, JSON.stringify(areas));
          return { success: true, message: 'Area added in sandbox.' } as any;
        }

        case 'updateArea': {
          const areas: Area[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.AREAS) || '[]');
          const idx = areas.findIndex((a) => (a.name || '').toLowerCase() === (params.oldName || '').toLowerCase());
          if (idx !== -1) {
            areas[idx].name = params.name || areas[idx].name;
            areas[idx].status = params.status || areas[idx].status;
            localStorage.setItem(STORAGE_KEYS.AREAS, JSON.stringify(areas));
            return { success: true, message: 'Area updated in sandbox.' } as any;
          }
          return { success: false, message: 'Area not found' };
        }

        case 'getRoles': {
          const roles: RoleMapping[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROLES) || '[]');
          return { success: true, data: roles as any };
        }

        case 'updateRole': {
          const roles: RoleMapping[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROLES) || '[]');
          const idx = roles.findIndex((r) => (r.employeeId || '').toLowerCase() === (params.employeeId || '').toLowerCase());
          if (idx !== -1) {
            roles[idx].role = params.role;
            roles[idx].updatedAt = new Date().toISOString();
          } else {
            roles.push({
              employeeId: params.employeeId,
              name: params.name || params.employeeId,
              designation: params.designation || 'Staff',
              role: params.role,
              updatedAt: new Date().toISOString()
            });
          }
          localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
          return { success: true, message: 'Role updated in sandbox.' } as any;
        }

        case 'getCNERecords': {
          const records: CNERecord[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CNE_RECORDS) || '[]');
          const user = this.getSessionUser();
          const isAdmin = user?.role === 'ADMIN';
          const loggedInId = (user?.employeeId || '').toLowerCase().trim();

          // Privacy filtering
          const filtered = records.filter((r) => {
            if (isAdmin) return true;
            const isRp = r.resourcePersonEmpId.toLowerCase() === loggedInId;
            const isStaff = (r.staffEmpIds || []).some((s) => s.toLowerCase() === loggedInId);
            return isRp || isStaff;
          }).map((r) => {
            if (isAdmin) return r;
            const isStaff = (r.staffEmpIds || []).some((s) => s.toLowerCase() === loggedInId);
            return {
              ...r,
              staffEmpIds: isStaff ? [user?.employeeId || ''] : []
            };
          });

          return { success: true, data: filtered as any };
        }

        case 'addCNE': {
          const records: CNERecord[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CNE_RECORDS) || '[]');
          const dataId = `CNE-${new Date().getFullYear()}-${('00000' + (records.length + 1)).slice(-5)}`;
          const staffArr = Array.isArray(params.staffEmpIds) ? params.staffEmpIds : [];
          const newRec: CNERecord = {
            dataId,
            area: params.area || '',
            fromDate: params.fromDate || '',
            toDate: params.toDate || params.fromDate || '',
            duration: formatDurationValue(params.duration, params.duration),
            topic: params.topic || '',
            resourcePersonEmpId: params.resourcePersonEmpId || '',
            modeOfTeaching: params.modeOfTeaching || 'Lecture Cum Discussion',
            staffEmpIds: staffArr,
            staffCount: staffArr.length,
            remarks: params.remarks || '',
            createdAt: new Date().toISOString()
          };
          records.unshift(newRec);
          localStorage.setItem(STORAGE_KEYS.CNE_RECORDS, JSON.stringify(records));
          return { success: true, message: 'CNE record added in sandbox.', data: { dataId } as any };
        }

        case 'updateCNE': {
          const records: CNERecord[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CNE_RECORDS) || '[]');
          const idx = records.findIndex((r) => r.dataId === params.dataId);
          if (idx !== -1) {
            const updatedDuration = params.duration !== undefined ? formatDurationValue(params.duration, params.duration) : records[idx].duration;
            records[idx] = { ...records[idx], ...params, duration: updatedDuration, updatedAt: new Date().toISOString() };
            localStorage.setItem(STORAGE_KEYS.CNE_RECORDS, JSON.stringify(records));
            return { success: true, message: 'CNE record updated in sandbox.' } as any;
          }
          return { success: false, message: 'Record not found' };
        }

        case 'deleteCNE': {
          let records: CNERecord[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CNE_RECORDS) || '[]');
          records = records.filter((r) => r.dataId !== params.dataId);
          localStorage.setItem(STORAGE_KEYS.CNE_RECORDS, JSON.stringify(records));
          return { success: true, message: 'CNE record deleted in sandbox.' } as any;
        }

        case 'getUpcomingClasses': {
          const list: UpcomingClass[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPCOMING_CLASSES) || '[]');
          return { success: true, data: list as any };
        }

        case 'addUpcomingClass': {
          const list: UpcomingClass[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPCOMING_CLASSES) || '[]');
          const classId = `CLS-${new Date().getFullYear()}-${('0000' + (list.length + 1)).slice(-4)}`;
          const newClass: UpcomingClass = {
            classId,
            topic: params.topic || '',
            area: params.area || '',
            date: params.date || '',
            time: params.time || '14:00',
            duration: params.duration || '1:00:00',
            resourcePersonEmpId: params.resourcePersonEmpId || '',
            modeOfTeaching: params.modeOfTeaching || 'Lecture Cum Discussion',
            description: params.description || '',
            maxParticipants: params.maxParticipants || 50,
            status: 'OPEN',
            createdAt: new Date().toISOString()
          };
          list.unshift(newClass);
          localStorage.setItem(STORAGE_KEYS.UPCOMING_CLASSES, JSON.stringify(list));
          return { success: true, message: 'Class added in sandbox.', data: { classId } as any };
        }

        case 'applyForClass': {
          const apps: CNEApplication[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS) || '[]');
          const user = this.getSessionUser();
          if (!user || !user.employeeId) {
            return { success: false, message: 'Please log in to apply for a CNE class.' };
          }
          const appId = `APP-${new Date().getFullYear()}-${('00000' + (apps.length + 1)).slice(-5)}`;
          const newApp: CNEApplication = {
            applicationId: appId,
            classId: params.classId,
            employeeId: user.employeeId,
            employeeName: user.name || 'Staff User',
            appliedAt: new Date().toISOString(),
            status: 'Applied',
            remarks: params.remarks || ''
          };
          apps.unshift(newApp);
          localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
          return { success: true, message: 'Application submitted in sandbox.', data: newApp as any };
        }

        case 'getMyApplications': {
          const apps: CNEApplication[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS) || '[]');
          const user = this.getSessionUser();
          const myApps = apps.filter((a) => a.employeeId.toLowerCase() === (user?.employeeId || '').toLowerCase());
          return { success: true, data: myApps as any };
        }

        case 'getAllApplications': {
          const apps: CNEApplication[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS) || '[]');
          return { success: true, data: apps as any };
        }

        case 'updateApplicationStatus': {
          const apps: CNEApplication[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS) || '[]');
          const idx = apps.findIndex((a) => a.applicationId === params.applicationId);
          if (idx !== -1) {
            apps[idx].status = params.status;
            if (params.remarks) apps[idx].remarks = params.remarks;
            localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
            return { success: true, message: 'Application status updated.' } as any;
          }
          return { success: false, message: 'Application not found' };
        }

        case 'getGallery': {
          const list: GalleryItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.GALLERY) || '[]');
          return { success: true, data: list.filter((i) => i.isActive) as any };
        }

        case 'uploadImage': {
          const list: GalleryItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.GALLERY) || '[]');
          const id = `IMG-${new Date().getFullYear()}-${('0000' + (list.length + 1)).slice(-4)}`;
          const newItem: GalleryItem = {
            id,
            title: params.title || 'CNE Activity',
            description: params.description || '',
            date: params.date || new Date().toISOString().split('T')[0],
            imageUrl: params.base64Image,
            uploadedAt: new Date().toISOString(),
            isActive: true
          };
          list.unshift(newItem);
          localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(list));
          return { success: true, message: 'Image uploaded in sandbox.', data: { id, imageUrl: params.base64Image } as any };
        }

        case 'getNewsEvents': {
          const list: NewsEventItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.NEWS_EVENTS) || '[]');
          return { success: true, data: list as any };
        }

        case 'addNewsEvent': {
          const list: NewsEventItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.NEWS_EVENTS) || '[]');
          const id = `NEWS-${new Date().getFullYear()}-${('000' + (list.length + 1)).slice(-3)}`;
          const newItem: NewsEventItem = {
            id,
            title: params.title || 'CNE Update',
            date: params.date || new Date().toISOString().split('T')[0],
            category: params.category || 'Update',
            summary: params.summary || '',
            content: params.content || '',
            venue: params.venue || '',
            speaker: params.speaker || '',
            isImportant: !!params.isImportant
          };
          list.unshift(newItem);
          localStorage.setItem(STORAGE_KEYS.NEWS_EVENTS, JSON.stringify(list));
          return { success: true, message: 'News item published.', data: { id } as any };
        }

        case 'deleteNewsEvent': {
          let list: NewsEventItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.NEWS_EVENTS) || '[]');
          list = list.filter((n) => n.id !== params.id);
          localStorage.setItem(STORAGE_KEYS.NEWS_EVENTS, JSON.stringify(list));
          return { success: true, message: 'News item deleted.' } as any;
        }

        case 'getChairpersonMessage': {
          const data: ChairpersonMessageData = JSON.parse(
            localStorage.getItem(STORAGE_KEYS.CHAIRPERSON_MESSAGE) || JSON.stringify(INITIAL_CHAIRPERSON_MESSAGE)
          );
          return { success: true, data: data as any };
        }

        case 'updateChairpersonMessage': {
          const existing: ChairpersonMessageData = JSON.parse(
            localStorage.getItem(STORAGE_KEYS.CHAIRPERSON_MESSAGE) || JSON.stringify(INITIAL_CHAIRPERSON_MESSAGE)
          );
          
          let driveFileId = existing.driveFileId;
          let driveUrl = existing.driveUrl;
          let photoUrl = params.photoUrl || existing.photoUrl;

          // If base64 image or data URL provided, simulate Google Drive upload
          if (params.base64Image || (params.photoUrl && params.photoUrl.startsWith('data:image'))) {
            driveFileId = `DRIVE-CNO-${Date.now()}`;
            photoUrl = params.base64Image || params.photoUrl;
            driveUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
          }

          const updated: ChairpersonMessageData = {
            ...existing,
            ...params,
            photoUrl,
            driveFileId,
            driveUrl
          };
          localStorage.setItem(STORAGE_KEYS.CHAIRPERSON_MESSAGE, JSON.stringify(updated));
          return {
            success: true,
            message: driveFileId
              ? 'CNO photo successfully saved to Google Drive and leadership profile updated.'
              : 'CNO profile updated successfully.',
            data: {
              photoUrl,
              driveFileId,
              driveUrl
            }
          } as any;
        }

        case 'getQuickLinks': {
          const data: QuickLinkItem[] = JSON.parse(
            localStorage.getItem(STORAGE_KEYS.QUICK_LINKS) || JSON.stringify(INITIAL_QUICK_LINKS)
          );
          return { success: true, data: data as any };
        }

        case 'getProgramImpact': {
          const records: CNERecord[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CNE_RECORDS) || '[]');
          const user = this.getSessionUser();
          const loggedInId = (user?.employeeId || '').toLowerCase().trim();
          const isUserLoggedIn = Boolean(user && loggedInId);

          let completedClasses = 0;
          const uniqueStaffSet = new Set<string>();
          const uniqueWardsSet = new Set<string>();
          const userTrainedOthersSet = new Set<string>();
          let anonymousStaffCount = 0;
          let anonymousStaffTrainedByRp = 0;

          records.forEach((r) => {
            const area = (r.area || '').trim();
            const rpEmpId = (r.resourcePersonEmpId || '').toLowerCase().trim();
            const staffArray = (r.staffEmpIds || []).map((s) => s.toLowerCase().trim()).filter(Boolean);
            const staffCount = r.staffCount || (staffArray.length > 0 ? staffArray.length : 0);

            if (!isUserLoggedIn) {
              completedClasses++;
              if (area) uniqueWardsSet.add(area.toLowerCase());
              if (staffArray.length > 0) {
                staffArray.forEach((s) => uniqueStaffSet.add(s));
              } else if (staffCount > 0) {
                anonymousStaffCount += staffCount;
              }
            } else {
              const isRp = rpEmpId === loggedInId;
              const isParticipant = staffArray.includes(loggedInId);

              if (isRp || isParticipant) {
                completedClasses++;
                if (area) uniqueWardsSet.add(area.toLowerCase());
                if (isRp) {
                  if (staffArray.length > 0) {
                    staffArray.forEach((s) => {
                      if (s !== loggedInId) userTrainedOthersSet.add(s);
                    });
                  } else if (staffCount > 0) {
                    anonymousStaffTrainedByRp += staffCount;
                  }
                }
              }
            }
          });

          let totalStaff = 0;
          if (!isUserLoggedIn) {
            totalStaff = uniqueStaffSet.size > 0 ? uniqueStaffSet.size : anonymousStaffCount;
          } else {
            // For logged-in Resource Person, Officers Trained = unique participants trained by RP (excluding themselves)
            const trainedOthers = userTrainedOthersSet.size > 0 ? userTrainedOthersSet.size : anonymousStaffTrainedByRp;
            totalStaff = trainedOthers;
          }

          return {
            success: true,
            data: {
              totalCompletedClasses: completedClasses,
              uniqueStaffTrained: totalStaff,
              uniqueWardsCount: uniqueWardsSet.size,
              attendanceComplianceRate: 'N/A', // Verified compliance column does not exist in Data sheet
              scope: isUserLoggedIn ? 'user' : 'institutional'
            } as any
          };
        }

        case 'initializeSheets':
          return { success: true, message: 'Sandbox storage initialized.' } as any;

        default:
          return { success: false, message: `Unknown sandbox action: ${action}` };
      }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Error processing sandbox action' };
    }
  }
}
