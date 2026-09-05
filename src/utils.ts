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
