import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Link as LinkIcon,
  CheckCircle2,
  RefreshCw,
  Camera,
  ShieldCheck,
  User,
  AlertCircle,
  HardDrive,
  Cloud,
  Check
} from 'lucide-react';
import { ChairpersonMessageData } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface ChangeCnoPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: ChairpersonMessageData;
  onSuccess: (updated: ChairpersonMessageData) => void;
}

const PRESET_PHOTOS = [
  {
    label: 'Official Portrait 1 (Default)',
    url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80'
  },
  {
    label: 'Official Portrait 2 (Senior Clinical Leader)',
    url: 'https://images.unsplash.com/photo-1594824813580-0c460d0fb9b0?auto=format&fit=crop&w=600&q=80'
  },
  {
    label: 'Official Portrait 3 (Executive Healthcare)',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80'
  },
  {
    label: 'Official Portrait 4 (Medical Academic Leader)',
    url: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=600&q=80'
  }
];

export const ChangeCnoPhotoModal: React.FC<ChangeCnoPhotoModalProps> = ({
  isOpen,
  onClose,
  currentData,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'presets'>('upload');
  const [photoUrl, setPhotoUrl] = useState(currentData.photoUrl || '');
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [name, setName] = useState(currentData.name || 'Dr. Anita Rani Kansal');
  const [designation, setDesignation] = useState(
    currentData.designation || 'Chief Nursing Officer (C.N.O) & Chairperson, CNE Committee'
  );
  const [institution, setInstitution] = useState(
    currentData.institution || 'All India Institute of Medical Sciences (AIIMS), Rishikesh'
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imgError, setImgError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error } = useToast();

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      error('Please select a valid image file (JPEG, PNG, WebP).', 'Invalid File');
      return;
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      error('Image file size must be less than 5MB.', 'File Too Large');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoUrl(result);
      setBase64Image(result);
      setUploadedFileName(file.name);
      setImgError(false);
      success(`"${file.name}" loaded for preview. It will be uploaded to Google Drive upon saving.`, 'Ready to Upload');
    };
    reader.onerror = () => {
      error('Failed to read selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl || photoUrl.trim() === '') {
      error('Please provide or upload a valid photo.');
      return;
    }

    setSaving(true);
    try {
      const updatedPayload = {
        photoUrl: photoUrl.trim(),
        base64Image: base64Image || (photoUrl.startsWith('data:image') ? photoUrl : undefined),
        name: name.trim(),
        designation: designation.trim(),
        institution: institution.trim()
      };

      const res = await ApiService.updateChairpersonMessage(updatedPayload);
      if (res.success) {
        const finalUrl = res.data?.photoUrl || photoUrl.trim();
        const driveFileId = res.data?.driveFileId || currentData.driveFileId;
        const driveUrl = res.data?.driveUrl || currentData.driveUrl;

        const fullUpdated: ChairpersonMessageData = {
          ...currentData,
          photoUrl: finalUrl,
          name: name.trim(),
          designation: designation.trim(),
          institution: institution.trim(),
          driveFileId,
          driveUrl
        };

        success(
          res.message || 'CNO photo successfully saved to Google Drive and leadership profile updated.',
          'Saved to Google Drive'
        );
        onSuccess(fullUpdated);
        onClose();
      } else {
        error(res.message || 'Failed to update CNO photo.');
      }
    } catch (err: any) {
      error(err?.message || 'Error occurred while saving CNO photo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl border border-white/20">
              <Camera className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Update CNO Portrait Photo</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400 text-emerald-950 uppercase">
                  Admin Control
                </span>
              </div>
              <p className="text-xs text-emerald-200">
                Change leadership photograph • Saves directly into your connected Google Drive
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Google Drive Storage Info Banner */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-start gap-3 text-xs text-emerald-900">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg shrink-0 mt-0.5">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-950">Google Drive Cloud Storage</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-200/80 text-[10px] font-extrabold text-emerald-900">
                  Drive Folder Auto-Sync
                </span>
              </div>
              <p className="text-emerald-800 text-[11px] leading-relaxed">
                Photos uploaded from your device are stored permanently in your institution's configured Google Drive repository. Public viewing permissions are automatically configured.
              </p>
            </div>
          </div>

          {/* Top Preview Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-5">
            {/* Portrait Frame Preview */}
            <div className="relative shrink-0">
              <div className="w-24 h-32 sm:w-28 sm:h-36 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md bg-slate-200 relative flex items-center justify-center">
                {photoUrl && !imgError ? (
                  <img
                    src={photoUrl}
                    alt="Preview of CNO"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <User className="w-8 h-8 mx-auto mb-1 opacity-50" />
                    <span className="text-[10px]">No Photo</span>
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/80 to-transparent py-1 text-center">
                  <span className="text-[9px] font-bold text-emerald-300">C.N.O PREVIEW</span>
                </div>
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 p-1 bg-emerald-600 rounded-full text-white shadow-xs border-2 border-white">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Officer Details Preview */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900">
                  Live Section Preview
                </span>
                {uploadedFileName && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                    <Cloud className="w-3 h-3" />
                    <span>File: {uploadedFileName}</span>
                  </span>
                )}
              </div>
              <h4 className="text-base font-extrabold text-slate-900">{name || 'Dr. Anita Rani Kansal'}</h4>
              <p className="text-xs font-semibold text-emerald-700">{designation}</p>
              <p className="text-[11px] text-slate-500">{institution}</p>
              {imgError && (
                <div className="flex items-center gap-1.5 text-rose-600 text-xs font-semibold pt-1 justify-center sm:justify-start">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Image failed to load. Please check the URL or upload a file.</span>
                </div>
              )}
            </div>
          </div>

          {/* Photo Source Tabs */}
          <div className="space-y-4">
            <div className="flex items-center border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`pb-2.5 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'upload'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload From Device (Google Drive)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`pb-2.5 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'url'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                <span>Paste Image URL</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`pb-2.5 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'presets'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Preset Gallery</span>
              </button>
            </div>

            {/* Tab 1: Upload File */}
            {activeTab === 'upload' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Click to browse or drag & drop CNO photo here
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports JPEG, PNG, or WebP (Max file size: 5MB). Photo is saved in Google Drive.
                </p>
                <button
                  type="button"
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Choose Photo File</span>
                </button>
              </div>
            )}

            {/* Tab 2: URL Input */}
            {activeTab === 'url' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Direct Image URL (HTTPS link or Google Drive direct link)
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={photoUrl}
                      onChange={(e) => {
                        setPhotoUrl(e.target.value);
                        setBase64Image(null);
                        setUploadedFileName(null);
                        setImgError(false);
                      }}
                      placeholder="https://example.com/cno-photo.jpg or https://drive.google.com/..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Provide a direct publicly accessible web image URL or Google Drive link.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 3: Presets */}
            {activeTab === 'presets' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PRESET_PHOTOS.map((preset, idx) => {
                  const isSelected = photoUrl === preset.url;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPhotoUrl(preset.url);
                        setBase64Image(null);
                        setUploadedFileName(null);
                        setImgError(false);
                      }}
                      className={`group relative rounded-xl border-2 overflow-hidden text-left p-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 shadow-md ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="h-28 rounded-lg overflow-hidden bg-slate-100 mb-2 relative">
                        <img
                          src={preset.url}
                          alt={preset.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover object-top"
                        />
                        {isSelected && (
                          <div className="absolute top-1 right-1 p-0.5 bg-emerald-600 rounded-full text-white">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-800 line-clamp-2 leading-tight">
                        {preset.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Additional Leadership Info Fields */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Leadership Profile Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Full Name & Title
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Designation & Committee Role
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              setPhotoUrl('https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80');
              setBase64Image(null);
              setUploadedFileName(null);
              setName('Dr. Anita Rani Kansal');
              setDesignation('Chief Nursing Officer (C.N.O) & Chairperson, CNE Committee');
              setImgError(false);
            }}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading to Drive...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>Save to Google Drive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
