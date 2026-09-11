import { Employee, SessionUser } from './types';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

/**
 * Formats a date string into the strict DD-MMM-YYYY format (e.g., 01-Jan-2026).
 * Zero-pads single-digit days (01-31), uses 3-letter English month abbreviations (Jan-Dec),
 * and 4-digit years.
 */
export function formatCneDateDisplay(dateVal?: string | Date | null): string {
  if (!dateVal) return '—';

  // If Date object
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return '—';
    const day = String(dateVal.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[dateVal.getMonth()];
    const year = dateVal.getFullYear();
    return `${day}-${month}-${year}`;
  }

  const str = String(dateVal).trim();
  if (!str) return '—';

  // 1. If already DD-MMM-YYYY (e.g. 01-Jan-2026, 1-Feb-2026, 05-feb-2026)
  const dmmmMatch = str.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[-\s/](\d{4})$/);
  if (dmmmMatch) {
    const day = dmmmMatch[1].padStart(2, '0');
    const mRaw = dmmmMatch[2].toLowerCase();
    const foundMonth = MONTH_NAMES.find((m) => m.toLowerCase() === mRaw);
    const month = foundMonth || (mRaw.charAt(0).toUpperCase() + mRaw.slice(1, 3));
    const year = dmmmMatch[3];
    return `${day}-${month}-${year}`;
  }

  // 2. YYYY-MM-DD or YYYY-M-D (e.g. 2026-03-01, 2026-01-05, 2026-09-30)
  // Parsing with regex avoids local/UTC timezone offsets shifting the date
  const ymdMatch = str.match(/^(\d{4})[-\s/](\d{1,2})[-\s/](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const monthIdx = parseInt(ymdMatch[2], 10) - 1;
    const day = ymdMatch[3].padStart(2, '0');
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day}-${MONTH_NAMES[monthIdx]}-${year}`;
    }
  }

  // 3. DD-MM-YYYY or DD/MM/YYYY (e.g. 01/01/2026)
  const dmyMatch = str.match(/^(\d{1,2})[-\s/](\d{1,2})[-\s/](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const monthIdx = parseInt(dmyMatch[2], 10) - 1;
    const year = dmyMatch[3];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day}-${MONTH_NAMES[monthIdx]}-${year}`;
    }
  }

  // 4. Fallback: Parse via new Date()
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return str;
}

/**
 * Formats a CNE activity date range (fromDate & optional toDate) using DD-MMM-YYYY.
 * If toDate is equal to fromDate or empty, returns formatted fromDate.
 * If toDate is different, returns `${formattedFrom} - ${formattedTo}`.
 */
export function formatCneDateRangeDisplay(fromDate?: string | null, toDate?: string | null): string {
  if (!fromDate) return '—';
  const formattedFrom = formatCneDateDisplay(fromDate);
  if (!toDate || toDate === fromDate) {
    return formattedFrom;
  }
  const formattedTo = formatCneDateDisplay(toDate);
  if (formattedTo === formattedFrom || formattedTo === '—') {
    return formattedFrom;
  }
  return `${formattedFrom} - ${formattedTo}`;
}

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a Date or date-time string into standard user-facing:
 * "DD-MMM-YYYY hh:mm AM/PM" (e.g. "01-Jan-2026 08:00 AM").
 * If the input is date-only (e.g. "2026-01-01"), returns "DD-MMM-YYYY".
 */
export function formatCneDateTimeDisplay(
  fromDate?: string | Date | null,
  toDate?: string | null,
  legacyTime?: string | null
): string {
  if (!fromDate) return '—';

  // If toDate or legacyTime was passed, defer to range display
  if (toDate !== undefined || legacyTime !== undefined) {
    const fromStr = fromDate instanceof Date ? fromDate.toISOString() : fromDate;
    return formatCneDateTimeRangeDisplay(fromStr, toDate, legacyTime);
  }

  const dtVal = fromDate;

  // Handle Date instance
  if (dtVal instanceof Date) {
    if (isNaN(dtVal.getTime())) return '—';
    const day = String(dtVal.getDate()).padStart(2, '0');
    const month = MONTH_NAMES_SHORT[dtVal.getMonth()] || 'Jan';
    const year = dtVal.getFullYear();
    const h = dtVal.getHours();
    const min = String(dtVal.getMinutes()).padStart(2, '0');
    const h12 = h % 12 || 12;
    const h12Str = String(h12).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${day}-${month}-${year} ${h12Str}:${min} ${ampm}`;
  }

  const str = String(dtVal).trim();
  if (!str) return '—';

  // Match ISO YYYY-MM-DDTHH:mm(:ss)? or YYYY-MM-DD HH:mm(:ss)?
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (isoMatch) {
    const year = isoMatch[1];
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    const month = MONTH_NAMES_SHORT[monthIdx] || 'Jan';
    const day = isoMatch[3].padStart(2, '0');
    const h = parseInt(isoMatch[4], 10);
    const min = isoMatch[5].padStart(2, '0');
    const h12 = h % 12 || 12;
    const h12Str = String(h12).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${day}-${month}-${year} ${h12Str}:${min} ${ampm}`;
  }

  // Match DD-MMM-YYYY hh:mm AM/PM
  const dmmmAmPmMatch = str.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[-\s/](\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (dmmmAmPmMatch) {
    const day = dmmmAmPmMatch[1].padStart(2, '0');
    const rawMon = dmmmAmPmMatch[2].toLowerCase();
    const mIdx = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(rawMon);
    const month = mIdx >= 0 ? MONTH_NAMES_SHORT[mIdx] : dmmmAmPmMatch[2];
    const year = dmmmAmPmMatch[3];
    let h = parseInt(dmmmAmPmMatch[4], 10);
    const min = dmmmAmPmMatch[5].padStart(2, '0');
    const ampm = (dmmmAmPmMatch[6] || (h >= 12 ? 'PM' : 'AM')).toUpperCase();
    const h12 = h % 12 || 12;
    const h12Str = String(h12).padStart(2, '0');
    return `${day}-${month}-${year} ${h12Str}:${min} ${ampm}`;
  }

  // If date only, use standard formatCneDateDisplay
  return formatCneDateDisplay(str);
}

/**
 * Formats a CNE activity date & time range.
 * Example: "01-Jan-2026 08:00 AM – 03-Jan-2026 05:00 PM"
 * If fromDate and toDate are identical: "01-Jan-2026 08:00 AM"
 * If legacy date-only with legacyTime: "01-Jan-2026 • 14:00 - 15:30"
 */
export function formatCneDateTimeRangeDisplay(
  fromDate?: string | null,
  toDate?: string | null,
  legacyTime?: string | null
): string {
  if (!fromDate) return '—';

  const hasFromTime = String(fromDate).includes('T') || (String(fromDate).includes(':') && /\d{1,2}:\d{2}/.test(String(fromDate)));
  const hasToTime = toDate ? (String(toDate).includes('T') || (String(toDate).includes(':') && /\d{1,2}:\d{2}/.test(String(toDate)))) : false;

  if (hasFromTime) {
    const formattedFrom = formatCneDateTimeDisplay(fromDate);
    if (!toDate || toDate === fromDate) {
      return formattedFrom;
    }
    const formattedTo = hasToTime ? formatCneDateTimeDisplay(toDate) : formatCneDateDisplay(toDate);
    if (formattedTo === formattedFrom || formattedTo === '—') {
      return formattedFrom;
    }
    return `${formattedFrom} – ${formattedTo}`;
  }

  // Legacy date-only formatting
  const formattedFrom = formatCneDateDisplay(fromDate);
  const formattedTo = toDate && toDate !== fromDate ? formatCneDateDisplay(toDate) : '';
  const datePart = formattedTo && formattedTo !== formattedFrom ? `${formattedFrom} – ${formattedTo}` : formattedFrom;

  const cleanLegacyTime = legacyTime ? legacyTime.trim() : '';
  if (cleanLegacyTime && cleanLegacyTime !== '—') {
    return `${datePart} • ${cleanLegacyTime}`;
  }
  return datePart;
}

/**
 * Formats a short time/range or duration for compact widgets.
 */
export function formatCneTimeOrRangeShort(
  fromDate?: string | null,
  toDate?: string | null,
  legacyTime?: string | null,
  duration?: string | null
): string {
  if (fromDate && (String(fromDate).includes('T') || String(fromDate).includes(':'))) {
    const dStr = formatCneDateTimeDisplay(fromDate);
    // Extract the time portion e.g. "08:00 AM"
    const match = dStr.match(/(\d{2}:\d{2}\s+(?:AM|PM))$/);
    if (match) return match[1];
  }
  if (legacyTime && legacyTime.trim() && legacyTime !== '—') {
    return legacyTime.trim();
  }
  if (duration && duration.trim()) {
    return `${duration.trim()} Hrs`;
  }
  return 'Scheduled';
}

/**
 * Converts any date or date-time representation into YYYY-MM-DDTHH:mm
 * for standard HTML <input type="datetime-local" /> fields.
 */
export function toDateTimeLocalString(val?: string | Date | null, defaultTime = '09:00'): string {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    const h = String(val.getHours()).padStart(2, '0');
    const min = String(val.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  }

  const str = String(val).trim();
  if (!str) return '';

  // Match YYYY-MM-DDTHH:mm(:ss)?
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T${isoMatch[4]}:${isoMatch[5]}`;
  }

  // Match YYYY-MM-DD HH:mm(:ss)?
  const spaceMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (spaceMatch) {
    return `${spaceMatch[1]}-${spaceMatch[2]}-${spaceMatch[3]}T${spaceMatch[4]}:${spaceMatch[5]}`;
  }

  // Match DD-MMM-YYYY hh:mm AM/PM
  const dmmmAmPmMatch = str.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[-\s/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?)?/i);
  if (dmmmAmPmMatch) {
    const day = dmmmAmPmMatch[1].padStart(2, '0');
    const rawMon = dmmmAmPmMatch[2].toLowerCase();
    const mIdx = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(rawMon);
    const month = mIdx >= 0 ? String(mIdx + 1).padStart(2, '0') : '01';
    const year = dmmmAmPmMatch[3];
    let h = parseInt(dmmmAmPmMatch[4] || '9', 10);
    const min = (dmmmAmPmMatch[5] || '00').padStart(2, '0');
    const ampm = (dmmmAmPmMatch[6] || '').toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const hStr = String(h).padStart(2, '0');
    return `${year}-${month}-${day}T${hStr}:${min}`;
  }

  // Match date only YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}T${defaultTime}`;
  }

  // General Date parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    const h = String(parsed.getHours()).padStart(2, '0');
    const min = String(parsed.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  }

  return '';
}

/**
 * Parses a duration string (HH:MM:SS or HH:MM or decimal hours) into total seconds.
 */
export function parseDurationToSeconds(str: string): number | null {
  if (!str) return null;
  const trimmed = str.trim();
  const parts = trimmed.split(':');
  if (parts.length >= 2 && parts.length <= 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parts.length === 3 ? parseInt(parts[2], 10) : 0;
    if (isNaN(h) || isNaN(m) || isNaN(s) || m < 0 || m >= 60 || s < 0 || s >= 60 || h < 0) {
      return null;
    }
    return h * 3600 + m * 60 + s;
  }
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num > 0) {
    return Math.round(num * 3600);
  }
  return null;
}

/**
 * Formats total seconds into standard HH:MM:SS (e.g. 08:00:00).
 */
export function formatSecondsToDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Calculates how many distinct calendar days are touched between fromDt and toDt inclusive.
 */
export function getCalendarDaysTouched(fromDtStr: string, toDtStr: string): number {
  if (!fromDtStr || !toDtStr) return 1;
  const d1 = new Date(fromDtStr);
  const d2 = new Date(toDtStr);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 1;

  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  const diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/**
 * Authoritative CNE automatic duration calculation rule:
 * - For each calendar day touched by the CNE:
 *   - maximum allowed CNE duration for that day = 8 hours
 *   - first and last days respect actual time interval
 *   - intermediate full calendar days contribute a maximum of 8 hours each
 */
export function calculateCneDuration(fromDtStr: string, toDtStr: string): string {
  if (!fromDtStr || !toDtStr) return '01:00:00';
  const d1 = new Date(fromDtStr);
  const d2 = new Date(toDtStr);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) {
    return '01:00:00';
  }

  const daysTouched = getCalendarDaysTouched(fromDtStr, toDtStr);

  // Same calendar day
  if (daysTouched === 1) {
    const elapsedHours = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60);
    const cappedHours = Math.min(8, Math.max(0, elapsedHours));
    return formatSecondsToDuration(cappedHours * 3600);
  }

  // Multi-day:
  // Day 1: respects actual time interval, capped at 8 hours.
  // Daytime training runs from From Time up to 17:00 (or up to 24:00 if scheduled past 17:00).
  const fromHourDecimal = d1.getHours() + d1.getMinutes() / 60 + d1.getSeconds() / 3600;
  const day1Hours = fromHourDecimal < 17 ? (17 - fromHourDecimal) : (24 - fromHourDecimal);
  const day1Contribution = Math.min(8, Math.max(0, day1Hours));

  // Intermediate full calendar days: 8 hours maximum each
  const intermediateContribution = daysTouched > 2 ? (daysTouched - 2) * 8 : 0;

  // Last day: respects actual time interval from start of day to To Time, capped at 8 hours
  const toHourDecimal = d2.getHours() + d2.getMinutes() / 60 + d2.getSeconds() / 3600;
  const lastDayContribution = Math.min(8, Math.max(0, toHourDecimal));

  const totalHours = day1Contribution + intermediateContribution + lastDayContribution;
  return formatSecondsToDuration(totalHours * 3600);
}

/**
 * Validates whether an entered duration satisfies:
 * 1. Minimum 00:05:00 (5 minutes)
 * 2. Maximum 8 hours × calendar days touched
 */
export function validateCneDuration(
  durationStr: string,
  fromDtStr: string,
  toDtStr: string
): { isValid: boolean; error?: string; message: string; maxDurationStr: string } {
  const daysTouched = getCalendarDaysTouched(fromDtStr, toDtStr);
  const maxSeconds = daysTouched * 8 * 3600;
  const maxDurationStr = formatSecondsToDuration(maxSeconds);
  const minSeconds = 300; // 00:05:00

  const sec = parseDurationToSeconds(durationStr);
  if (sec === null) {
    const err = 'Invalid duration format. Please enter as HH:MM:SS (e.g. 01:30:00 or 08:00:00).';
    return {
      isValid: false,
      error: err,
      message: err,
      maxDurationStr
    };
  }

  if (sec < minSeconds || sec > maxSeconds) {
    const err = `Duration must be between 00:05:00 and ${maxDurationStr} for this CNE.`;
    return {
      isValid: false,
      error: err,
      message: err,
      maxDurationStr
    };
  }

  return { isValid: true, message: '', maxDurationStr };
}

/**
 * Resolves an individual Employee ID to the employee's name from the authoritative officers list.
 * If not found, safely returns the Employee ID.
 */
export function resolveEmployeeName(
  empId?: string | null,
  officers?: Employee[]
): string {
  if (!empId) return '';
  const trimmedId = empId.trim();
  if (!trimmedId) return '';

  if (officers && officers.length > 0) {
    const norm = trimmedId.toLowerCase();
    const found = officers.find(
      (o) => (o.employeeId || '').trim().toLowerCase() === norm
    );
    if (found && found.name && found.name.trim()) {
      return found.name.trim();
    }
  }

  return trimmedId;
}

/**
 * Resolves a comma/semicolon/newline-separated string or array of Employee IDs
 * to their corresponding Employee Names using the authoritative officers list.
 * Any ID that cannot be resolved safely falls back to its Employee ID.
 */
export function resolveEmployeeNamesList(
  empIds?: string | string[] | null,
  officers?: Employee[]
): string[] {
  if (!empIds) return [];
  const list = Array.isArray(empIds) ? empIds : String(empIds).split(/[,;\n]+/);
  return list
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => resolveEmployeeName(id, officers));
}

/**
 * Formats the full Resource Persons display string for an activity or class.
 * Internal Resource Persons are displayed by Employee Name (separated by commas).
 * External Resource Persons are appended with their entered name, marked with '(Ext)'.
 * If multiple internal RPs exist, displays their names separated by commas.
 */
export function formatResourcePersonsDisplay(params: {
  resourcePersonEmpId?: string | null;
  resourcePersonName?: string | null;
  externalResourcePersons?: string[] | null;
  officers?: Employee[];
}): string {
  const { resourcePersonEmpId, resourcePersonName, externalResourcePersons, officers } = params;

  let internalNames: string[] = [];

  if (officers && officers.length > 0 && resourcePersonEmpId) {
    internalNames = resolveEmployeeNamesList(resourcePersonEmpId, officers);
  } else if (resourcePersonName && resourcePersonName.trim()) {
    internalNames = resourcePersonName
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (resourcePersonEmpId && resourcePersonEmpId.trim()) {
    internalNames = resourcePersonEmpId
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const extNames = (externalResourcePersons || [])
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `${p} (Ext)`);

  const combined = [...internalNames, ...extNames];
  return combined.length > 0 ? combined.join(', ') : '—';
}

/**
 * Formats internal and external staff participants display for an activity.
 * Returns both formatted summary text and individual names array.
 */
export function formatStaffParticipantsDisplay(params: {
  staffEmpIds?: string[] | null;
  staffNames?: string[] | null;
  externalStaffParticipants?: string[] | null;
  officers?: Employee[];
}): {
  internalNames: string[];
  externalNames: string[];
  allNames: string[];
  summaryText: string;
} {
  const { staffEmpIds, staffNames, externalStaffParticipants, officers } = params;

  let internal: string[] = [];
  if (officers && officers.length > 0 && staffEmpIds && staffEmpIds.length > 0) {
    internal = staffEmpIds.map((id) => resolveEmployeeName(id, officers));
  } else if (staffNames && staffNames.length > 0) {
    internal = staffNames.map((s) => s.trim()).filter(Boolean);
  } else if (staffEmpIds && staffEmpIds.length > 0) {
    internal = staffEmpIds.map((id) => id.trim()).filter(Boolean);
  }

  const external = (externalStaffParticipants || []).map((s) => s.trim()).filter(Boolean);
  const extFormatted = external.map((s) => `${s} (Ext)`);

  const allNames = [...internal, ...extFormatted];
  return {
    internalNames: internal,
    externalNames: external,
    allNames,
    summaryText: allNames.length > 0 ? allNames.join(', ') : 'None'
  };
}

/**
 * Retrieves all unique assigned clinical areas/wards for a user (Area Incharge).
 * Supports both array `assignedAreas` and comma/semicolon/newline-delimited `assignedArea`.
 */
export function getUserAssignedAreas(user?: SessionUser | null): string[] {
  if (!user) return [];
  const list: string[] = [];

  if (user.assignedAreas && Array.isArray(user.assignedAreas)) {
    for (const a of user.assignedAreas) {
      if (typeof a === 'string' && a.trim()) {
        const trimmed = a.trim();
        if (!list.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
          list.push(trimmed);
        }
      }
    }
  }

  if (user.assignedArea && typeof user.assignedArea === 'string') {
    const parts = user.assignedArea.split(/[,;\n]+/);
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed && !list.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
        list.push(trimmed);
      }
    }
  }

  return list;
}

/**
 * Checks if a user is authorized to manage a CNE session (Reference material, Questions, QR, Attendance, Finalization).
 * Admin = full control over Central and Departmental CNEs.
 * Area Incharge = Departmental CNE only within their assigned area(s)/ward(s). Supports multiple assigned areas.
 * Normal users = no administrative control.
 */
export function isCneAuthorized(
  user?: SessionUser | null,
  cneArea?: string,
  cneType?: string
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'AREA_INCHARGE') {
    const type = (cneType || '').trim().toUpperCase();
    if (type !== 'DEPARTMENTAL') return false;
    if (!cneArea) return false;
    const targetArea = cneArea.trim().toLowerCase();
    const assigned = getUserAssignedAreas(user);
    return assigned.some((a) => a.toLowerCase() === targetArea);
  }
  return false;
}

/**
 * Checks if the user is an assigned Resource Person for a specific CNE.
 * Normalizes and checks against comma- or semicolon-separated resource person employee IDs.
 */
export function isUserAssignedResourcePerson(
  user?: SessionUser | null,
  resourcePersonEmpId?: string | null
): boolean {
  if (!user?.employeeId || !resourcePersonEmpId) return false;
  const userEmpId = user.employeeId.trim().toUpperCase();
  const rpList = resourcePersonEmpId
    .split(/[,;\n]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return rpList.includes(userEmpId);
}

/**
 * Checks if the user is authorized for operational CNE actions:
 * Material, Questions, QR Code, Take Post Test, Participants.
 *
 * Allowed:
 * 1. Admin
 * 2. Responsible Area Incharge (Departmental CNE in their assigned area)
 * 3. Resource Person ONLY when assigned to THIS particular CNE
 *
 * Forbidden:
 * - Other Resource Persons not assigned to this CNE
 * - Ordinary staff
 */
export function canManageCneActions(
  user?: SessionUser | null,
  cne?: { area?: string; cneType?: string; resourcePersonEmpId?: string | null } | null
): boolean {
  if (!user || !cne) return false;
  if (user.role === 'ADMIN') return true;
  if (isCneAuthorized(user, cne.area, cne.cneType)) return true;
  if (isUserAssignedResourcePerson(user, cne.resourcePersonEmpId)) return true;
  return false;
}

