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
  UserRole,
  CoordinatorDeskInfo
} from '../types';
const STORAGE_KEYS = {
  SESSION: 'cne_session_user',
  API_URL: 'CNE_CUSTOM_APPS_SCRIPT_URL'
};

// Actively purge legacy mock credential storage or environment mode flags from browser storage
try {
  localStorage.removeItem('cne_user_creds');
  localStorage.removeItem('CNE_ENVIRONMENT_MODE');
} catch (e) {}

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
   * Strictly connects to Google Apps Script Web App.
   * Fails closed if not configured or unavailable. Never falls back to sandbox, mock users, or local credentials.
   */
  static async executeAction<T = any>(
    action: string,
    params: Record<string, any> = {}
  ): Promise<ApiResponse<T>> {
    const apiUrl = this.getAppsScriptUrl();
    const session = this.getSessionUser();
    const payload = {
      action,
      ...params,
      token: session?.token,
      loggedInEmployeeId: session?.employeeId
    };

    // Fail closed if backend URL is not configured: NEVER fall back to local/sandbox credentials or mock users
    if (!apiUrl) {
      if (action === 'ping') {
        return { success: false, message: 'Google Apps Script URL is not configured.' };
      }
      return {
        success: false,
        errorCode: 'BACKEND_NOT_CONFIGURED',
        message: 'Google Apps Script backend URL is not configured. Please configure your Google Sheets backend to connect to Google Sheets.'
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

  static async reviewUpcomingClass(
    classId: string,
    status: 'Approved' | 'Rejected',
    adminRemarks?: string
  ): Promise<ApiResponse> {
    return this.executeAction('reviewUpcomingClass', { classId, status, adminRemarks });
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

  static async deleteGalleryItem(id: string): Promise<ApiResponse> {
    return this.executeAction('deleteGalleryItem', { id });
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

  static async updateNewsEvent(id: string, data: Partial<NewsEventItem>): Promise<ApiResponse> {
    return this.executeAction('updateNewsEvent', { id, ...data });
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
   * CNE Coordinator Desk APIs
   */
  static async getCoordinatorDesk(): Promise<ApiResponse<CoordinatorDeskInfo>> {
    return this.executeAction<CoordinatorDeskInfo>('getCoordinatorDesk');
  }

  static async updateCoordinatorDesk(data: Partial<CoordinatorDeskInfo>): Promise<ApiResponse<CoordinatorDeskInfo>> {
    return this.executeAction<CoordinatorDeskInfo>('updateCoordinatorDesk', data);
  }

  /**
   * Quick Links APIs
   */
  static async getQuickLinks(): Promise<ApiResponse<QuickLinkItem[]>> {
    return this.executeAction<QuickLinkItem[]>('getQuickLinks');
  }

  static async addQuickLink(item: Partial<QuickLinkItem>): Promise<ApiResponse<{ id: string }>> {
    return this.executeAction<{ id: string }>('addQuickLink', item);
  }

  static async updateQuickLink(id: string, data: Partial<QuickLinkItem>): Promise<ApiResponse> {
    return this.executeAction('updateQuickLink', { id, ...data });
  }

  static async deleteQuickLink(id: string): Promise<ApiResponse> {
    return this.executeAction('deleteQuickLink', { id });
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

}
