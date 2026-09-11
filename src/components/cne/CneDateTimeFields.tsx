import React from 'react';
import { ConfirmDatePicker } from './ConfirmDatePicker';
import { calculateCneDuration } from '../../utils';

export interface CneTimePickerProps {
  id?: string;
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
  min?: string;
  required?: boolean;
  compact?: boolean;
  title?: string;
  accentColor?: 'indigo' | 'emerald';
}

export const CneTimePicker: React.FC<CneTimePickerProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  min,
  required = false,
  compact = false,
  title = 'Select time',
  accentColor = 'indigo'
}) => {
  const focusClass =
    accentColor === 'emerald'
      ? 'focus:ring-emerald-500 focus:border-emerald-500'
      : 'focus:ring-indigo-500 focus:border-indigo-500';

  return (
    <input
      type="time"
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      min={min}
      required={required}
      title={title}
      className={`w-full ${
        compact ? 'px-2 py-1.5 text-xs' : 'p-2.5 text-xs'
      } bg-white border border-slate-300 rounded-lg focus:ring-2 ${focusClass} focus:outline-none transition-all ${
        disabled
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
          : 'text-slate-800'
      }`}
    />
  );
};

export interface CneDateTimeFieldsProps {
  idPrefix: string;
  fromDate: string; // 'YYYY-MM-DD'
  fromTime: string; // 'HH:mm'
  toDate: string;   // 'YYYY-MM-DD'
  toTime: string;   // 'HH:mm'
  onChange: (updates: {
    fromDate: string;
    fromTime: string;
    toDate: string;
    toTime: string;
    fullFrom: string; // 'YYYY-MM-DDTHH:mm'
    fullTo: string;   // 'YYYY-MM-DDTHH:mm'
    calculatedDuration: string; // 'HH:MM:SS'
  }) => void;
  minDate?: string;
  compact?: boolean;
  required?: boolean;
  layout?: 'stack' | 'grid';
  accentColor?: 'indigo' | 'emerald';
  fromLabel?: string;
  toLabel?: string;
}

export const CneDateTimeFields: React.FC<CneDateTimeFieldsProps> = ({
  idPrefix,
  fromDate,
  fromTime = '09:00',
  toDate,
  toTime = '10:30',
  onChange,
  minDate,
  compact = false,
  required = true,
  layout = 'stack',
  accentColor = 'indigo',
  fromLabel = 'From Date & Time',
  toLabel = 'To Date & Time'
}) => {
  const isFromComplete = Boolean(fromDate && fromTime);

  const calculateDuration = (fDate: string, fTime: string, tDate: string, tTime: string): string => {
    if (!fDate || !fTime || !tDate || !tTime) {
      return '00:00:00';
    }
    const fullFrom = `${fDate}T${fTime}`;
    const fullTo = `${tDate}T${tTime}`;
    const dFrom = new Date(fullFrom);
    const dTo = new Date(fullTo);
    if (!isNaN(dFrom.getTime()) && !isNaN(dTo.getTime()) && dTo >= dFrom) {
      const dur = calculateCneDuration(fullFrom, fullTo);
      return dur || '00:00:00';
    }
    return '00:00:00';
  };

  const handleFromDateChange = (val: string) => {
    let updatedToDate = toDate;
    let updatedToTime = toTime;

    if (updatedToDate && updatedToDate < val) {
      updatedToDate = val;
      if (updatedToTime && fromTime && updatedToTime < fromTime) {
        updatedToTime = fromTime;
      }
    } else if (updatedToDate === val && updatedToTime && fromTime && updatedToTime < fromTime) {
      updatedToTime = fromTime;
    }

    const calculatedDuration = calculateDuration(val, fromTime, updatedToDate, updatedToTime);
    const fullFrom = val && fromTime ? `${val}T${fromTime}` : '';
    const fullTo = updatedToDate && updatedToTime ? `${updatedToDate}T${updatedToTime}` : '';

    onChange({
      fromDate: val,
      fromTime,
      toDate: updatedToDate,
      toTime: updatedToTime,
      fullFrom,
      fullTo,
      calculatedDuration
    });
  };

  const handleFromTimeChange = (val: string) => {
    let updatedToTime = toTime;

    if (toDate === fromDate && updatedToTime && val && updatedToTime < val) {
      updatedToTime = val;
    }

    const calculatedDuration = calculateDuration(fromDate, val, toDate, updatedToTime);
    const fullFrom = fromDate && val ? `${fromDate}T${val}` : '';
    const fullTo = toDate && updatedToTime ? `${toDate}T${updatedToTime}` : '';

    onChange({
      fromDate,
      fromTime: val,
      toDate,
      toTime: updatedToTime,
      fullFrom,
      fullTo,
      calculatedDuration
    });
  };

  const handleToDateChange = (val: string) => {
    let updatedToTime = toTime;

    if (val === fromDate && updatedToTime && fromTime && updatedToTime < fromTime) {
      updatedToTime = fromTime;
    }

    const calculatedDuration = calculateDuration(fromDate, fromTime, val, updatedToTime);
    const fullFrom = fromDate && fromTime ? `${fromDate}T${fromTime}` : '';
    const fullTo = val && updatedToTime ? `${val}T${updatedToTime}` : '';

    onChange({
      fromDate,
      fromTime,
      toDate: val,
      toTime: updatedToTime,
      fullFrom,
      fullTo,
      calculatedDuration
    });
  };

  const handleToTimeChange = (val: string) => {
    const calculatedDuration = calculateDuration(fromDate, fromTime, toDate, val);
    const fullFrom = fromDate && fromTime ? `${fromDate}T${fromTime}` : '';
    const fullTo = toDate && val ? `${toDate}T${val}` : '';

    onChange({
      fromDate,
      fromTime,
      toDate,
      toTime: val,
      fullFrom,
      fullTo,
      calculatedDuration
    });
  };

  const labelClass = compact
    ? 'block text-[11px] font-bold text-slate-700'
    : 'block text-xs font-bold uppercase tracking-wider text-slate-700';

  const badgeClass =
    accentColor === 'emerald'
      ? 'text-emerald-700'
      : 'text-indigo-600';

  return (
    <div className={layout === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : compact ? 'space-y-2.5' : 'space-y-3'}>
      {/* From Date & Time */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass}>
            {fromLabel} {required && <span className="text-rose-500">*</span>}
          </label>
          <span className={`text-[10px] ${badgeClass} font-medium`}>Calendar + Time</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <div className="sm:col-span-3">
            <ConfirmDatePicker
              id={`${idPrefix}-from-date`}
              value={fromDate}
              onChange={handleFromDateChange}
              minDate={minDate}
              placeholder="Select From Date..."
              compact={compact}
            />
          </div>
          <div className="sm:col-span-2">
            <CneTimePicker
              id={`${idPrefix}-from-time`}
              value={fromTime}
              onChange={handleFromTimeChange}
              required={required}
              compact={compact}
              title="From Time"
              accentColor={accentColor}
            />
          </div>
        </div>
      </div>

      {/* To Date & Time */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass}>
            {toLabel} {required && <span className="text-rose-500">*</span>}
          </label>
          {!isFromComplete ? (
            <span className="text-[10px] text-amber-600 font-medium">Select From Date first</span>
          ) : toDate === fromDate ? (
            <span className={`text-[10px] ${badgeClass} font-medium`}>
              Same day (Min: {fromTime})
            </span>
          ) : (
            <span className="text-[10px] text-emerald-600 font-medium">Multi-day workshop</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <div className="sm:col-span-3">
            <ConfirmDatePicker
              id={`${idPrefix}-to-date`}
              value={toDate}
              onChange={handleToDateChange}
              minDate={fromDate || minDate}
              disabled={!isFromComplete}
              placeholder={isFromComplete ? 'Select To Date...' : 'Select From Date first'}
              compact={compact}
            />
          </div>
          <div className="sm:col-span-2">
            <CneTimePicker
              id={`${idPrefix}-to-time`}
              value={toTime}
              onChange={handleToTimeChange}
              disabled={!isFromComplete || !toDate}
              min={toDate === fromDate ? fromTime : undefined}
              required={required}
              compact={compact}
              title={toDate === fromDate ? `To Time (Min: ${fromTime})` : 'To Time'}
              accentColor={accentColor}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
