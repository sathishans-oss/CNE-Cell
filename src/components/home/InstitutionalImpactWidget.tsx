import React from 'react';
import { Activity } from 'lucide-react';

interface InstitutionalImpactWidgetProps {
  totalCompletedClasses: number;
  uniqueStaffTrained: number;
  uniqueWardsCount: number;
  attendanceComplianceRate: string;
  accentColor?: 'emerald' | 'blue' | 'amber' | 'teal';
  horizontal?: boolean;
  loading?: boolean;
  error?: string | null;
  scope?: 'institutional' | 'user';
}

export const InstitutionalImpactWidget: React.FC<InstitutionalImpactWidgetProps> = ({
  totalCompletedClasses,
  uniqueStaffTrained,
  uniqueWardsCount,
  attendanceComplianceRate,
  accentColor = 'emerald',
  horizontal = false,
  loading = false,
  error = null,
  scope = 'institutional'
}) => {
  const iconColor = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    teal: 'text-teal-400'
  }[accentColor];

  const pulseColor = {
    emerald: 'bg-emerald-400',
    blue: 'bg-blue-400',
    amber: 'bg-amber-400',
    teal: 'bg-teal-400'
  }[accentColor];

  const numberColor = {
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    teal: 'text-teal-600'
  }[accentColor];

  const hoverBorder = {
    emerald: 'hover:border-emerald-200',
    blue: 'hover:border-blue-200',
    amber: 'hover:border-amber-200',
    teal: 'hover:border-teal-200'
  }[accentColor];

  const liveBadge = {
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    teal: 'bg-teal-500/20 text-teal-300 border-teal-500/30'
  }[accentColor];

  const title = scope === 'user' ? 'My CNE Program Impact' : 'Institutional CNE Program Impact';
  const badgeLabel = scope === 'user' ? 'My Impact' : 'Live';

  if (horizontal) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${iconColor}`} />
            <h2 className="text-sm font-bold tracking-tight">{title}</h2>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${liveBadge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pulseColor} animate-pulse`} />
            <span>{badgeLabel}</span>
          </span>
        </div>
        <div className="p-4 bg-slate-50/50">
          {loading ? (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-teal-600 rounded-full animate-spin" />
              <span className="text-xs text-slate-500 font-medium">Loading CNE impact data...</span>
            </div>
          ) : error ? (
            <div className="py-6 text-center">
              <p className="text-xs font-semibold text-slate-700">Unable to Load Impact Data</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Please check Google Sheets connection or try again.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className={`p-3 rounded-xl bg-white border border-slate-200 ${hoverBorder} transition-colors shadow-2xs`}>
                <span className={`text-xl sm:text-2xl font-black ${numberColor} block`}>
                  {totalCompletedClasses}{totalCompletedClasses > 0 ? '+' : ''}
                </span>
                <span className="text-xs text-slate-600 font-semibold mt-0.5 block">Completed Classes</span>
              </div>
              <div className={`p-3 rounded-xl bg-white border border-slate-200 ${hoverBorder} transition-colors shadow-2xs`}>
                <span className={`text-xl sm:text-2xl font-black ${numberColor} block`}>
                  {uniqueStaffTrained}{uniqueStaffTrained > 0 ? '+' : ''}
                </span>
                <span className="text-xs text-slate-600 font-semibold mt-0.5 block">Officers Trained</span>
              </div>
              <div className={`p-3 rounded-xl bg-white border border-slate-200 ${hoverBorder} transition-colors shadow-2xs`}>
                <span className={`text-xl sm:text-2xl font-black ${numberColor} block`}>
                  {uniqueWardsCount}{uniqueWardsCount > 0 ? '+' : ''}
                </span>
                <span className="text-xs text-slate-600 font-semibold mt-0.5 block">Wards & ICUs Active</span>
              </div>
              <div className={`p-3 rounded-xl bg-white border border-slate-200 ${hoverBorder} transition-colors shadow-2xs`}>
                <span className={`text-xl sm:text-2xl font-black ${numberColor} block`}>{attendanceComplianceRate}</span>
                <span className="text-xs text-slate-600 font-semibold mt-0.5 block">Verified Compliance</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 text-white px-4 sm:px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${iconColor}`} />
          <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${liveBadge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pulseColor} animate-pulse`} />
          <span>{badgeLabel}</span>
        </span>
      </div>

      <div className="p-3.5 bg-slate-50/50">
        {loading ? (
          <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-teal-600 rounded-full animate-spin" />
            <span className="text-xs text-slate-500 font-medium">Loading CNE impact data...</span>
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <p className="text-xs font-semibold text-slate-700">Unable to Load Impact Data</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Please check Google Sheets connection or try again.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 text-center">
            <div className={`p-3 rounded-xl bg-white border border-slate-200 ${hoverBorder} transition-colors shadow-2xs`}>
              <span className={`text-xl sm:text-2xl font-black ${numberColor} block`}>
                {totalCompletedClasses}{totalCompletedClasses > 0 ? '+' : ''}
              </span>
              <span className="text-xs text-slate-600 font-semibold mt-0.5 block">Completed Classes</span>
            </div>
            <div className={`p-3 rounded-xl bg-white border border-slate-200 ${hoverBorder} transition-colors shadow-2xs`}>
              <span className={`text-xl sm:text-2xl font-black ${numberColor} block`}>
                {uniqueStaffTrained}{uniqueStaffTrained > 0 ? '+' : ''}
              </span>
              <span className="text-xs text-slate-600 font-semibold mt-0.5 block">Officers Trained</span>
            </div>
            <div className={`p-3 rounded-xl bg-white border border-slate-200 ${hoverBorder} transition-colors shadow-2xs`}>
              <span className={`text-xl sm:text-2xl font-black ${numberColor} block`}>
                {uniqueWardsCount}{uniqueWardsCount > 0 ? '+' : ''}
              </span>
              <span className="text-xs text-slate-600 font-semibold mt-0.5 block">Wards & ICUs Active</span>
            </div>
            <div className={`p-3 rounded-xl bg-white border border-slate-200 ${hoverBorder} transition-colors shadow-2xs`}>
              <span className={`text-xl sm:text-2xl font-black ${numberColor} block`}>{attendanceComplianceRate}</span>
              <span className="text-xs text-slate-600 font-semibold mt-0.5 block">Verified Compliance</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
