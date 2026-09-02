import React from 'react';
import { Award } from 'lucide-react';

interface GuidelinesCardProps {
  accentColor?: 'emerald' | 'blue' | 'amber' | 'teal';
}

export const GuidelinesCard: React.FC<GuidelinesCardProps> = ({
  accentColor = 'emerald'
}) => {
  const iconColor = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    teal: 'text-teal-400'
  }[accentColor];

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-sm space-y-2.5">
      <div className="flex items-center gap-2">
        <Award className={`w-4 h-4 ${iconColor}`} />
        <h3 className="text-xs font-bold tracking-tight text-slate-100 uppercase">
          Annual CNE Guidelines
        </h3>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">
        All Nursing Officers must accrue at least <strong>20–30 verified CNE credit hours</strong> per year across clinical training modules.
      </p>
    </div>
  );
};
