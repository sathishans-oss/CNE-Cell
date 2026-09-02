import React from 'react';
import {
  GraduationCap,
  ShieldCheck,
  Camera,
  CheckCircle2,
  Edit3,
  Stethoscope,
  Activity,
  Award
} from 'lucide-react';
import { ChairpersonMessageData } from '../../types';

interface CnoLeadershipCardProps {
  cnoMessage: ChairpersonMessageData;
  isAdmin: boolean;
  onOpenChangePhoto: () => void;
  accentColor?: 'emerald' | 'blue' | 'amber' | 'teal';
  compact?: boolean;
}

export const CnoLeadershipCard: React.FC<CnoLeadershipCardProps> = ({
  cnoMessage,
  isAdmin,
  onOpenChangePhoto,
  accentColor = 'emerald',
  compact = false
}) => {
  const headerGradient = {
    emerald: 'from-emerald-800 via-emerald-700 to-teal-800',
    blue: 'from-blue-900 via-indigo-800 to-slate-900',
    amber: 'from-slate-900 via-slate-800 to-amber-900',
    teal: 'from-teal-800 via-teal-700 to-slate-900'
  }[accentColor];

  const subBadgeBg = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    teal: 'bg-teal-50 text-teal-900 border-teal-200'
  }[accentColor];

  const quoteBoxBg = {
    emerald: 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950',
    blue: 'bg-blue-50/60 border-blue-200/80 text-blue-950',
    amber: 'bg-amber-50/60 border-amber-200/80 text-slate-900',
    teal: 'bg-teal-50/60 border-teal-200/80 text-teal-950'
  }[accentColor];

  const iconAccent = {
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    teal: 'text-teal-600'
  }[accentColor];

  const photoBorder = {
    emerald: 'border-emerald-500/40',
    blue: 'border-blue-500/40',
    amber: 'border-amber-500/40',
    teal: 'border-teal-500/40'
  }[accentColor];

  const checkBadgeBg = {
    emerald: 'bg-emerald-600',
    blue: 'bg-blue-600',
    amber: 'bg-amber-600',
    teal: 'bg-teal-600'
  }[accentColor];

  return (
    <section id="cno-message-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Official Header Banner */}
      <div className={`bg-gradient-to-r ${headerGradient} text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-xs border border-white/20">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-200 block">
              Leadership Address
            </span>
            <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
              Message from the Chief Nursing Officer
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenChangePhoto}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900 border border-white/20 text-[11px] font-bold text-slate-200 hover:text-white transition-all cursor-pointer shadow-xs"
              title="Change CNO Portrait Photo (Admin Permission)"
            >
              <Camera className="w-3.5 h-3.5 text-slate-300" />
              <span>Change CNO Photo</span>
            </button>
          )}

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 border border-white/20 text-[10px] font-bold text-slate-200 shrink-0">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>AIIMS Rishikesh</span>
          </div>
        </div>
      </div>

      {/* Officer Profile & Official Content */}
      <div className="p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* CNO Portrait Photo with Admin Edit Trigger */}
          <div className="relative shrink-0 mx-auto sm:mx-0 group/cno">
            <div className={`w-24 h-28 sm:w-28 sm:h-32 rounded-2xl overflow-hidden border-2 ${photoBorder} shadow-md bg-slate-100 relative`}>
              <img
                src={cnoMessage.photoUrl || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80"}
                alt={`Chief Nursing Officer - ${cnoMessage.name || 'Dr. Anita Rani Kansal'}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/80 to-transparent py-1 text-center pointer-events-none">
                <span className="text-[9px] font-bold text-white">C.N.O</span>
              </div>

              {/* Admin Hover Change Photo Overlay */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={onOpenChangePhoto}
                  className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover/cno:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer rounded-2xl z-10"
                  title="Click to Change CNO Photo"
                >
                  <Camera className="w-6 h-6 mb-1 text-slate-200" />
                  <span className="text-[10px] font-bold">Change Photo</span>
                </button>
              )}
            </div>

            {/* Verified Badge */}
            <div className={`absolute -bottom-2 -right-2 p-1 ${checkBadgeBg} rounded-full text-white shadow-xs border-2 border-white z-20`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>

            {/* Admin Quick Action Badge */}
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenChangePhoto}
                className="absolute -top-2 -left-2 p-1.5 bg-slate-900 hover:bg-slate-800 rounded-full text-white shadow-md border-2 border-white cursor-pointer transition-colors z-20"
                title="Admin: Change CNO Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Title & Credentials */}
          <div className="space-y-1 text-center sm:text-left flex-1">
            <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border mb-1 ${subBadgeBg}`}>
              Department of Nursing Services
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                {cnoMessage.name || 'Dr. Anita Rani Kansal'}
              </h3>
              {isAdmin && (
                <button
                  type="button"
                  onClick={onOpenChangePhoto}
                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Edit Leadership Profile"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-700">
              {cnoMessage.designation || 'Chief Nursing Officer (C.N.O) & Chairperson, CNE Committee'}
            </p>
            <p className="text-[11px] text-slate-500">
              {cnoMessage.institution || 'All India Institute of Medical Sciences (AIIMS), Rishikesh'}
            </p>
          </div>
        </div>

        {/* Message Paragraphs */}
        <div className="space-y-3 text-xs sm:text-[13px] text-slate-700 leading-relaxed border-t border-slate-100 pt-5">
          {Array.isArray(cnoMessage.message) && cnoMessage.message.length > 0 ? (
            cnoMessage.message.map((para, idx) => <p key={idx}>{para}</p>)
          ) : (
            <>
              <p>
                Welcome to the <strong>Clinical Nursing Education (CNE) Portal</strong> of AIIMS Rishikesh. Continuing nursing education is not merely a professional obligation; it is the cornerstone of clinical excellence, patient safety, and compassionate nursing leadership.
              </p>
              <p>
                In our tertiary apex healthcare institution, nursing officers stand on the frontlines of complex critical care, advanced surgical procedures, and intensive hemodynamic management. Ongoing skill development guarantees that our clinical practices adhere strictly to evidence-based national and international benchmarks.
              </p>
              <p>
                This dedicated portal empowers every nursing officer to easily explore upcoming workshops, track verified attendance, maintain lifelong training portfolios, and auto-generate certified annual CNE documentation for coordinator verification and personal records.
              </p>
            </>
          )}
        </div>

        {!compact && (
          <>
            {/* Core Leadership Pillars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center space-y-1">
                <Stethoscope className={`w-4 h-4 ${iconAccent} mx-auto`} />
                <span className="text-[10px] font-bold text-slate-800 block">Evidence-Based</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center space-y-1">
                <Activity className={`w-4 h-4 ${iconAccent} mx-auto`} />
                <span className="text-[10px] font-bold text-slate-800 block">Simulation Labs</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center space-y-1">
                <ShieldCheck className={`w-4 h-4 ${iconAccent} mx-auto`} />
                <span className="text-[10px] font-bold text-slate-800 block">Patient Safety</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center space-y-1">
                <Award className={`w-4 h-4 ${iconAccent} mx-auto`} />
                <span className="text-[10px] font-bold text-slate-800 block">Certified Credits</span>
              </div>
            </div>

            {/* Official Quote */}
            <div className={`border rounded-2xl p-4 text-center ${quoteBoxBg}`}>
              <p className="text-xs sm:text-[13px] italic leading-relaxed font-medium">
                “Empowering nursing professionals through continuous learning is our highest guarantee of zero-harm, compassionate patient care.”
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
