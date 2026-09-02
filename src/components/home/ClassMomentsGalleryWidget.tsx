import React from 'react';
import { Images, ChevronRight } from 'lucide-react';
import { GalleryItem, ViewMode } from '../../types';

interface ClassMomentsGalleryWidgetProps {
  gallery: GalleryItem[];
  loading: boolean;
  onNavigate: (view: ViewMode) => void;
  onSelectPhoto: (photo: GalleryItem) => void;
  accentColor?: 'emerald' | 'blue' | 'amber' | 'teal';
  limit?: number;
}

export const ClassMomentsGalleryWidget: React.FC<ClassMomentsGalleryWidgetProps> = ({
  gallery,
  loading,
  onNavigate,
  onSelectPhoto,
  accentColor = 'emerald',
  limit = 6
}) => {
  const iconColor = {
    emerald: 'text-emerald-700 bg-emerald-50',
    blue: 'text-blue-700 bg-blue-50',
    amber: 'text-amber-700 bg-amber-50',
    teal: 'text-teal-700 bg-teal-50'
  }[accentColor];

  const viewAllColor = {
    emerald: 'text-emerald-700 hover:text-emerald-800',
    blue: 'text-blue-700 hover:text-blue-800',
    amber: 'text-amber-700 hover:text-amber-800',
    teal: 'text-teal-700 hover:text-teal-800'
  }[accentColor];

  const recentPhotos = gallery.filter((g) => g.isActive !== false).slice(0, limit);

  return (
    <section id="previous-class-photos-section" className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center`}>
            <Images className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Previous Class Photos & Training Moments
            </h2>
            <p className="text-xs text-slate-500">
              Photographs from hands-on simulation workshops and clinical CNE classes
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('gallery')}
          className={`text-xs font-bold ${viewAllColor} flex items-center gap-1 cursor-pointer`}
        >
          <span>Full Gallery ({gallery.length})</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading photo gallery...</div>
      ) : recentPhotos.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">No photos uploaded yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {recentPhotos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => onSelectPhoto(photo)}
              className="group relative rounded-2xl overflow-hidden aspect-4/3 bg-slate-100 border border-slate-200 cursor-pointer shadow-xs hover:shadow-md transition-all hover:scale-[1.02]"
            >
              <img
                src={photo.imageUrl}
                alt={photo.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 text-white">
                <p className="text-[11px] font-bold line-clamp-1">{photo.title}</p>
                <span className="text-[9px] text-slate-300">{photo.date}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
