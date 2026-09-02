import React from 'react';
import { HeartHandshake, Users, Mail } from 'lucide-react';

interface CoordinatorDeskCardProps {
  accentColor?: 'emerald' | 'blue' | 'amber' | 'teal';
}

export const CoordinatorDeskCard: React.FC<CoordinatorDeskCardProps> = ({
  accentColor = 'emerald'
}) => {
  const iconColor = {
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    teal: 'text-teal-600'
  }[accentColor];

  const dotColor = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    teal: 'bg-teal-500'
  }[accentColor];

  const linkHover = {
    emerald: 'hover:text-emerald-700',
    blue: 'hover:text-blue-700',
    amber: 'hover:text-amber-700',
    teal: 'hover:text-teal-700'
  }[accentColor];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
        <HeartHandshake className={`w-3.5 h-3.5 ${iconColor}`} />
        <span>CNE Coordinator Desk</span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Have questions regarding class credits, attendance verification, or training schedules?
      </p>
      <div className="pt-1 text-[11px] text-slate-800 space-y-2">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <Users className={`w-3.5 h-3.5 ${iconColor}`} />
            <span>CNE Coordinators:</span>
          </div>
          <div className="text-slate-700 space-y-1 pl-1 font-medium">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              <span>Ms. Suman Choudhary</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              <span>Ms. Ramya T</span>
            </div>
          </div>
        </div>

        <div className="space-y-1 pt-0.5">
          <div className="flex items-center gap-1.5 truncate text-slate-700 font-semibold">
            <Mail className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
            <a
              href="mailto:training.nur@aiimsrishikesh.edu.in"
              className={`truncate ${linkHover} hover:underline`}
            >
              training.nur@aiimsrishikesh.edu.in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
