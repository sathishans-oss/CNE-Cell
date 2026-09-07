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
 * Checks if a user is authorized to manage a CNE session (Reference material, Questions, QR, Attendance, Finalization).
 * Admin = full control over Central and Departmental CNEs.
 * Area Incharge = Departmental CNE only within their assigned area.
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
    const type = (cneType || '').toUpperCase();
    if (type === 'CENTRAL') return false;
    if (!user.assignedArea || !cneArea) return true;
    return user.assignedArea.trim().toLowerCase() === cneArea.trim().toLowerCase();
  }
  return false;
}
