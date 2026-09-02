import React from 'react';
import { Bell } from 'lucide-react';
import { NewsEventItem } from '../../types';

interface NewsCircularsWidgetProps {
  newsEvents: NewsEventItem[];
  onSelectNews: (news: NewsEventItem) => void;
  accentColor?: 'emerald' | 'blue' | 'amber' | 'teal';
  limit?: number;
}

export const NewsCircularsWidget: React.FC<NewsCircularsWidgetProps> = ({
  newsEvents,
  onSelectNews,
  accentColor = 'emerald',
  limit = 5
}) => {
  const iconColor = {
    emerald: 'text-amber-400',
    blue: 'text-amber-400',
    amber: 'text-amber-400',
    teal: 'text-amber-400'
  }[accentColor];

  const titleHoverColor = {
    emerald: 'group-hover:text-emerald-700',
    blue: 'group-hover:text-blue-700',
    amber: 'group-hover:text-amber-700',
    teal: 'group-hover:text-teal-700'
  }[accentColor];

  const items = newsEvents.slice(0, limit);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className={`w-4 h-4 ${iconColor}`} />
          <h2 className="text-sm font-bold tracking-tight">News & Circulars</h2>
        </div>
        <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Live
        </span>
      </div>

      <div className="p-3 divide-y divide-slate-100">
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">No circulars posted.</div>
        ) : (
          items.map((news) => (
            <div
              key={news.id}
              onClick={() => onSelectNews(news)}
              className="py-3 first:pt-1 last:pb-1 space-y-1.5 cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">
                  {news.date}
                </span>
                {news.isImportant && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                    URGENT
                  </span>
                )}
              </div>
              <h3 className={`text-xs font-bold text-slate-900 ${titleHoverColor} transition-colors line-clamp-2 leading-snug`}>
                {news.title}
              </h3>
              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                {news.summary}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
