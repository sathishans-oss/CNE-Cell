import React from 'react';
import { BookOpen } from 'lucide-react';

interface SpecialtyModulesWidgetProps {
  accentColor?: 'emerald' | 'blue' | 'amber' | 'teal';
}

export const SpecialtyModulesWidget: React.FC<SpecialtyModulesWidgetProps> = ({
  accentColor = 'emerald'
}) => {
  const iconColor = {
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    teal: 'text-teal-600'
  }[accentColor];

  return (
    <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className={`w-4 h-4 ${iconColor}`} />
        <h3 className="text-sm font-bold text-slate-900">Core Clinical Specialty Modules</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 hover:border-slate-300 transition-colors">
          <h4 className="text-xs font-bold text-slate-900">1. Critical Care & Hemodynamics</h4>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Ventilator graphics, arterial lines, vasopressor titrations, and central venous catheter care.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 hover:border-slate-300 transition-colors">
          <h4 className="text-xs font-bold text-slate-900">2. Emergency & Trauma Resuscitation</h4>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Basic & Advanced Cardiac Life Support (BLS/ACLS), polytrauma triage, and rapid sequence intubation.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 hover:border-slate-300 transition-colors">
          <h4 className="text-xs font-bold text-slate-900">3. Infection Control & Sepsis Bundles</h4>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            CLABSI/CAUTI/VAP bundles, biomedical waste management, and antibiotic stewardship protocols.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 hover:border-slate-300 transition-colors">
          <h4 className="text-xs font-bold text-slate-900">4. High-Alert Medication Safety</h4>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Chemotherapy handling, pediatric drug calculations, and double-check verification standards.
          </p>
        </div>
      </div>
    </section>
  );
};
