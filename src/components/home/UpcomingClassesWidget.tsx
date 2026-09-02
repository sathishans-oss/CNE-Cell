import React from 'react';
import { Sparkles, Calendar, Clock, ChevronRight } from 'lucide-react';
import { UpcomingClass, ViewMode } from '../../types';

interface UpcomingClassesWidgetProps {
  openClasses: UpcomingClass[];
  loading: boolean;
  onNavigate: (view: ViewMode) => void;
  onSelectClass: (c: UpcomingClass) => void;
  accentColor?: 'emerald' | 'blue' | 'amber' | 'teal';
  compact?: boolean;
}

export const UpcomingClassesWidget: React.FC<UpcomingClassesWidgetProps> = ({
  openClasses,
  loading,
  onNavigate,
  onSelectClass,
  accentColor = 'emerald',
  compact = false
}) => {
  const iconColor = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    teal: 'text-teal-400'
  }[accentColor];

  const dateBadgeBg = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-950 group-hover:bg-emerald-600 group-hover:text-white',
    blue: 'bg-blue-50 border-blue-200 text-blue-950 group-hover:bg-blue-600 group-hover:text-white',
    amber: 'bg-amber-50 border-amber-200 text-amber-950 group-hover:bg-amber-600 group-hover:text-white',
    teal: 'bg-teal-50 border-teal-200 text-teal-950 group-hover:bg-teal-600 group-hover:text-white'
  }[accentColor];

  const durationBadgeBg = {
    emerald: 'bg-emerald-100 text-emerald-800',
    blue: 'bg-blue-100 text-blue-800',
    amber: 'bg-amber-100 text-amber-800',
    teal: 'bg-teal-100 text-teal-800'
  }[accentColor];

  const actionBtnBg = {
    emerald: 'text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100',
    blue: 'text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100',
    amber: 'text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100',
    teal: 'text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100'
  }[accentColor];

  const titleHoverColor = {
    emerald: 'group-hover:text-emerald-700',
    blue: 'group-hover:text-blue-700',
    amber: 'group-hover:text-amber-700',
    teal: 'group-hover:text-teal-700'
  }[accentColor];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className={`w-4 h-4 ${iconColor}`} />
          <h2 className="text-sm font-bold tracking-tight">Upcoming Classes</h2>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('upcoming')}
          className={`text-[11px] font-semibold ${iconColor} hover:underline flex items-center gap-0.5 cursor-pointer`}
        >
          <span>View All</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3.5 divide-y divide-slate-100">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading upcoming sessions...</div>
        ) : openClasses.length === 0 ? (
          <div className="py-8 text-center px-4 space-y-2">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">No Open Classes Today</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Check back soon or consult the interactive annual calendar for next month's schedule.
            </p>
          </div>
        ) : (
          openClasses.map((item) => {
            const dateObj = new Date(item.date);
            const monthName = isNaN(dateObj.getTime())
              ? 'UP'
              : dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
            const dayNum = isNaN(dateObj.getTime()) ? '01' : dateObj.getDate();

            return (
              <div key={item.classId} className="py-3 first:pt-1 last:pb-1 space-y-2 group">
                <div className="flex items-start gap-3">
                  {/* Compact Date Badge */}
                  <div className={`w-11 h-12 rounded-xl border flex flex-col items-center justify-center shrink-0 transition-colors ${dateBadgeBg}`}>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider">
                      {monthName}
                    </span>
                    <span className="text-sm font-black leading-none">
                      {dayNum}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${durationBadgeBg}`}>
                        {item.duration || '2:00'} Hrs
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">{item.area}</span>
                    </div>
                    <h3 className={`text-xs font-bold text-slate-900 ${titleHoverColor} transition-colors line-clamp-2 leading-snug`}>
                      {item.topic}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <div className="flex items-center gap-1 truncate max-w-[140px]">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{item.time || '09:00 AM'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectClass(item)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${actionBtnBg}`}
                  >
                    Details / Apply
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!compact && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => onNavigate('calendar')}
            className="w-full py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            <span>Open Training Calendar</span>
          </button>
        </div>
      )}
    </div>
  );
};
