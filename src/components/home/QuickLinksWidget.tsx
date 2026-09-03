import React from 'react';
import {
  ExternalLink,
  BookOpen,
  Calendar,
  Sparkles,
  Award,
  ShieldCheck,
  Building2,
  FileDown,
  Info,
  GraduationCap,
  ChevronRight
} from 'lucide-react';
import { QuickLinkItem, ViewMode } from '../../types';

interface QuickLinksWidgetProps {
  quickLinks: QuickLinkItem[];
  onNavigate: (view: ViewMode) => void;
  onQuickLinkClick: (item: QuickLinkItem) => void;
  accentColor?: 'emerald' | 'blue' | 'amber' | 'teal';
}

export const QuickLinksWidget: React.FC<QuickLinksWidgetProps> = ({
  quickLinks,
  onNavigate,
  onQuickLinkClick,
  accentColor = 'emerald'
}) => {
  const iconColor = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    teal: 'text-teal-400'
  }[accentColor];

  const linkHoverColor = {
    emerald: 'group-hover:text-emerald-700',
    blue: 'group-hover:text-blue-700',
    amber: 'group-hover:text-amber-700',
    teal: 'group-hover:text-teal-700'
  }[accentColor];

  const getDynamicIcon = (name?: string) => {
    if (!name || typeof name !== 'string') return BookOpen;
    switch (name.toLowerCase()) {
      case 'calendar':
        return Calendar;
      case 'sparkles':
        return Sparkles;
      case 'award':
        return Award;
      case 'shieldcheck':
      case 'shield':
      case 'filecheck':
        return ShieldCheck;
      case 'building':
      case 'building2':
        return Building2;
      case 'filedown':
        return FileDown;
      case 'info':
        return Info;
      case 'graduationcap':
        return GraduationCap;
      default:
        return BookOpen;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ExternalLink className={`w-4 h-4 ${iconColor}`} />
          <h2 className="text-sm font-bold tracking-tight">Quick Links</h2>
        </div>
        <span className="text-[10px] text-slate-400">Institutional</span>
      </div>

      <div className="p-3 divide-y divide-slate-100">
        {quickLinks.map((link, index) => {
          const IconComp = getDynamicIcon(link?.iconName);
          const linkId = link?.id || `quick-link-${index}`;
          const title = link?.title || 'Resource Link';
          const description = link?.description || '';
          return (
            <div
              key={linkId}
              onClick={() => onQuickLinkClick(link)}
              className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 cursor-pointer group hover:bg-slate-50/80 -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center shrink-0 transition-colors">
                  <IconComp className="w-3.5 h-3.5 text-slate-700" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold text-slate-900 ${linkHoverColor} transition-colors truncate`}>
                      {title}
                    </span>
                    {link?.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-slate-100 text-slate-700 uppercase">
                        {link.badge}
                      </span>
                    )}
                  </div>
                  {description && (
                    <p className="text-[11px] text-slate-500 truncate">{description}</p>
                  )}
                </div>
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
};
