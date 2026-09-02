import React, { useState } from 'react';
import { Palette, Check, RotateCcw, ChevronDown, ChevronUp, Sparkles, Layout, Eye } from 'lucide-react';
import { usePortalTheme } from '../context/ThemeContext';
import { PortalTheme } from '../types';

export const ThemePreviewSelector: React.FC = () => {
  const { theme, setTheme, resetTheme } = usePortalTheme();
  const [isExpanded, setIsExpanded] = useState(true);

  const themeOptions: {
    id: PortalTheme;
    name: string;
    badge: string;
    description: string;
    color: string;
    layoutDesc: string;
  }[] = [
    {
      id: 'emerald',
      name: 'Option 1: Emerald Institutional',
      badge: 'Current / Default',
      description: 'Classic 3-column AIIMS balanced medical layout with deep slate & emerald styling.',
      color: 'from-emerald-600 to-teal-700',
      layoutDesc: '3-Column (25% / 50% / 25%)'
    },
    {
      id: 'navy',
      name: 'Option 2: Clinical Sapphire & Navy',
      badge: 'Modern Hospital 2-Col',
      description: 'Wide clinical stage (70%) featuring interactive class schedule & calendar, plus compact 30% sticky leadership sidebar.',
      color: 'from-blue-600 to-indigo-800',
      layoutDesc: '2-Column Clinical Stage (70% / 30%)'
    },
    {
      id: 'bento',
      name: 'Option 3: Executive Bento & Oxford Slate',
      badge: 'Academic Prestige',
      description: 'Full-width top 4-metric Impact Ribbon followed by a high-prestige 2-column academic split with gold & slate accents.',
      color: 'from-slate-800 to-amber-700',
      layoutDesc: 'Top Impact Ribbon + 2-Column Split'
    },
    {
      id: 'nordic',
      name: 'Option 4: Nordic Minimalist Clinical',
      badge: 'Ultra-Clean Teal',
      description: 'Streamlined clinical teal design with high-contrast typography, borderless soft cards, and fast mobile/tablet flow.',
      color: 'from-teal-600 to-cyan-700',
      layoutDesc: 'Streamlined High-Readability Flow'
    }
  ];

  return (
    <aside
      aria-label="Theme Preview Selector"
      className="bg-white border-b border-slate-200 shadow-sm transition-all text-slate-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        {/* Header row with toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Theme & Layout Live Previewer
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Interactive Test Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Click any layout option below to preview the changes live. Choose one or revert to the original anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {theme !== 'emerald' && (
              <button
                type="button"
                onClick={resetTheme}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-300"
                title="Revert back to original Emerald Institutional theme"
              >
                <RotateCcw className="w-3 h-3 text-slate-600" />
                <span>Revert to Original</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label={isExpanded ? 'Collapse Theme Previewer' : 'Expand Theme Previewer'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Options Grid */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {themeOptions.map((opt) => {
                const isActive = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isActive
                        ? 'bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/30 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${opt.color}`} />
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {opt.name}
                          </span>
                        </div>
                        {isActive && (
                          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="mb-2">
                        <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                          isActive
                            ? 'bg-emerald-200/70 text-emerald-900'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {opt.layoutDesc}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-snug">
                        {opt.description}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] font-bold">
                      <span className={isActive ? 'text-emerald-700' : 'text-slate-400'}>
                        {isActive ? '● Currently Active' : 'Click to preview'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
