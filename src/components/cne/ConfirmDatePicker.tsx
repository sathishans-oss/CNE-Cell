import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface ConfirmDatePickerProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
  minDate?: string; // 'YYYY-MM-DD'
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  compact?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDisplayDate(val?: string): string {
  if (!val) return '';
  const parts = val.split('-');
  if (parts.length !== 3) return val;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return val;
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${shortMonths[m] || ''} ${y}`;
}

export const ConfirmDatePicker: React.FC<ConfirmDatePickerProps> = ({
  value,
  onChange,
  minDate,
  disabled = false,
  placeholder = 'Select date...',
  id,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stagedDate, setStagedDate] = useState(value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  // Calendar view month & year
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => {
    if (value) {
      const p = value.split('-');
      if (p.length === 3 && !isNaN(parseInt(p[0], 10))) return parseInt(p[0], 10);
    }
    if (minDate) {
      const p = minDate.split('-');
      if (p.length === 3 && !isNaN(parseInt(p[0], 10))) return parseInt(p[0], 10);
    }
    return today.getFullYear();
  });

  const [viewMonth, setViewMonth] = useState(() => {
    if (value) {
      const p = value.split('-');
      if (p.length === 3 && !isNaN(parseInt(p[1], 10))) return parseInt(p[1], 10) - 1;
    }
    if (minDate) {
      const p = minDate.split('-');
      if (p.length === 3 && !isNaN(parseInt(p[1], 10))) return parseInt(p[1], 10) - 1;
    }
    return today.getMonth();
  });

  // Automatically calculate popup position so it is fully visible in viewport without scrolling
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 288; // w-72 = 18rem = 288px
    const popoverHeight = popoverRef.current ? popoverRef.current.offsetHeight : 340;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    // If space below is insufficient (< popoverHeight + 10) and space above is greater, open above field
    let top: number;
    if (spaceBelow < popoverHeight + 10 && spaceAbove > spaceBelow) {
      top = triggerRect.top - popoverHeight - 6;
    } else {
      top = triggerRect.bottom + 6;
    }

    // Safety clamp: ensure entire popup including OK/Cancel is visible within viewport
    if (top + popoverHeight > viewportHeight - 8) {
      top = viewportHeight - popoverHeight - 8;
    }
    if (top < 8) {
      top = 8;
    }

    // Horizontal alignment with trigger, clamped inside viewport
    let left = triggerRect.left;
    if (left + popoverWidth > viewportWidth - 8) {
      left = viewportWidth - popoverWidth - 8;
    }
    if (left < 8) {
      left = 8;
    }

    setPopoverStyle({
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${popoverWidth}px`,
      zIndex: 70,
    });
  };

  // Sync stagedDate when value changes externally
  useEffect(() => {
    setStagedDate(value);
  }, [value]);

  // Keep position updated on open, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleReposition = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, viewYear, viewMonth]);

  const handleOpen = () => {
    if (disabled) return;
    setStagedDate(value);
    // Initialize view to value or minDate or today
    const targetDate = value || minDate;
    if (targetDate) {
      const p = targetDate.split('-');
      if (p.length === 3) {
        const y = parseInt(p[0], 10);
        const m = parseInt(p[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setViewYear(y);
          setViewMonth(m);
        }
      }
    }

    // Pre-calculate immediate position before mounting
    if (triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 288;
      const estimatedHeight = 340;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      let top = (spaceBelow < estimatedHeight + 10 && spaceAbove > spaceBelow)
        ? triggerRect.top - estimatedHeight - 6
        : triggerRect.bottom + 6;

      if (top + estimatedHeight > viewportHeight - 8) {
        top = viewportHeight - estimatedHeight - 8;
      }
      if (top < 8) top = 8;

      let left = triggerRect.left;
      if (left + popoverWidth > viewportWidth - 8) {
        left = viewportWidth - popoverWidth - 8;
      }
      if (left < 8) left = 8;

      setPopoverStyle({
        position: 'fixed',
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${popoverWidth}px`,
        zIndex: 70,
      });
    }

    setIsOpen(true);
  };

  const handleCancel = () => {
    setStagedDate(value);
    setIsOpen(false);
  };

  const handleOk = () => {
    if (stagedDate) {
      onChange(stagedDate);
    }
    setIsOpen(false);
  };

  // Month navigation
  const canGoPrev = () => {
    if (!minDate) return true;
    const p = minDate.split('-');
    if (p.length !== 3) return true;
    const minY = parseInt(p[0], 10);
    const minM = parseInt(p[1], 10) - 1;
    if (viewYear > minY) return true;
    if (viewYear === minY && viewMonth > minM) return true;
    return false;
  };

  const handlePrevMonth = () => {
    if (!canGoPrev()) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Days calculation
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const emptySlots = Array.from({ length: firstDayOfWeek });
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={handleOpen}
        className={`w-full ${compact ? 'px-2 py-1.5' : 'p-2.5'} bg-white border border-slate-300 rounded-lg text-xs flex items-center justify-between focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${
          disabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
            : 'hover:border-indigo-400 cursor-pointer text-slate-800'
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className={`w-3.5 h-3.5 shrink-0 ${disabled ? 'text-slate-400' : 'text-indigo-600'}`} />
          <span className={value ? 'font-medium text-slate-900' : 'text-slate-400'}>
            {formatDisplayDate(value) || placeholder}
          </span>
        </span>
        <span className="text-[10px] text-slate-400">▼</span>
      </button>

      {/* Calendar Popover */}
      {isOpen && (
        <>
          {/* Backdrop for outside click cancellation */}
          <div
            className="fixed inset-0 z-[60] cursor-default"
            onClick={handleCancel}
          />

          {/* Calendar Modal Card */}
          <div
            ref={popoverRef}
            style={popoverStyle}
            className="fixed z-[70] bg-white border border-slate-200 rounded-xl shadow-2xl p-3.5 text-slate-800 select-none animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Header: Month / Year & Prev / Next */}
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100">
              <button
                type="button"
                disabled={!canGoPrev()}
                onClick={handlePrevMonth}
                className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-xs font-bold text-slate-800">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="text-[10px] font-bold text-slate-400 uppercase py-0.5">
                  {label}
                </div>
              ))}
            </div>

            {/* Day Cells Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {emptySlots.map((_, idx) => (
                <div key={`empty-${idx}`} className="h-7 w-7" />
              ))}

              {monthDays.map((d) => {
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isDisabled = Boolean(minDate && dateStr < minDate);
                const isStaged = stagedDate === dateStr;
                const isConfirmed = value === dateStr;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setStagedDate(dateStr)}
                    className={`h-7 w-7 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
                      isDisabled
                        ? 'text-slate-300 opacity-35 cursor-not-allowed pointer-events-none'
                        : isStaged
                        ? 'bg-indigo-600 text-white font-bold shadow-xs scale-105'
                        : isConfirmed
                        ? 'border border-indigo-500 text-indigo-700 bg-indigo-50/50 font-semibold'
                        : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {/* Staged Date Preview */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Selected:</span>
              <span className={`font-semibold ${stagedDate ? 'text-indigo-700' : 'text-slate-400 italic'}`}>
                {formatDisplayDate(stagedDate) || 'None'}
              </span>
            </div>

            {/* Footer Actions: Cancel + OK/Done */}
            <div className="flex items-center justify-end gap-2 pt-2.5 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!stagedDate}
                onClick={handleOk}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
