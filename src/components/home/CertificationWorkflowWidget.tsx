import React from 'react';
import { FileCheck } from 'lucide-react';

interface CertificationWorkflowWidgetProps {
  accentColor?: 'emerald' | 'blue' | 'amber' | 'teal';
}

export const CertificationWorkflowWidget: React.FC<CertificationWorkflowWidgetProps> = ({
  accentColor = 'emerald'
}) => {
  const containerBg = {
    emerald: 'bg-emerald-50/50 border-emerald-200 text-emerald-950',
    blue: 'bg-blue-50/50 border-blue-200 text-blue-950',
    amber: 'bg-amber-50/50 border-amber-200 text-slate-900',
    teal: 'bg-teal-50/50 border-teal-200 text-teal-950'
  }[accentColor];

  const iconColor = {
    emerald: 'text-emerald-700',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    teal: 'text-teal-700'
  }[accentColor];

  const stepTitleColor = {
    emerald: 'text-emerald-800',
    blue: 'text-blue-800',
    amber: 'text-amber-900',
    teal: 'text-teal-800'
  }[accentColor];

  const cardBorder = {
    emerald: 'border-emerald-200',
    blue: 'border-blue-200',
    amber: 'border-amber-200',
    teal: 'border-teal-200'
  }[accentColor];

  return (
    <section className={`border rounded-3xl p-6 shadow-sm space-y-3 ${containerBg}`}>
      <h3 className="text-sm font-bold flex items-center gap-2">
        <FileCheck className={`w-4 h-4 ${iconColor}`} />
        <span>How CNE Portfolios are Certified</span>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
        <div className={`bg-white p-3 rounded-xl border ${cardBorder} space-y-1 shadow-2xs`}>
          <span className={`font-extrabold ${stepTitleColor}`}>Step 1: Attend</span>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Enroll in accredited hospital training workshops and log presence.
          </p>
        </div>
        <div className={`bg-white p-3 rounded-xl border ${cardBorder} space-y-1 shadow-2xs`}>
          <span className={`font-extrabold ${stepTitleColor}`}>Step 2: Verify</span>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            CNE Coordinator verifies participation and logs credit hours.
          </p>
        </div>
        <div className={`bg-white p-3 rounded-xl border ${cardBorder} space-y-1 shadow-2xs`}>
          <span className={`font-extrabold ${stepTitleColor}`}>Step 3: Certification & Record</span>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Sign in, generate institutional signed PDF, and get verified by CNE Coordinator & Chairperson.
          </p>
        </div>
      </div>
    </section>
  );
};
