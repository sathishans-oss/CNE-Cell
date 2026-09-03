import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Copy,
  Check,
  ExternalLink,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  HelpCircle,
  Sparkles,
  Database,
  Layers,
  ShieldCheck,
  Wrench
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_CODE } from '../backend/googleAppsScript';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface AppsScriptSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackendConfigured?: () => void;
}

export const AppsScriptSetupModal: React.FC<AppsScriptSetupModalProps> = ({
  isOpen,
  onClose,
  onBackendConfigured
}) => {
  const [activeTab, setActiveTab] = useState<'instructions' | 'code' | 'test'>('instructions');
  const [copied, setCopied] = useState(false);
  const [testUrl, setTestUrl] = useState(
    localStorage.getItem('CNE_CUSTOM_APPS_SCRIPT_URL') ||
      (import.meta as any).env?.VITE_APPS_SCRIPT_URL ||
      ''
  );
  const [envMode, setEnvMode] = useState<'production' | 'sandbox'>(() => ApiService.getEnvironmentMode());
  const [isTesting, setIsTesting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const { success, error, info } = useToast();

  useEffect(() => {
    setTestUrl(
      localStorage.getItem('CNE_CUSTOM_APPS_SCRIPT_URL') ||
        (import.meta as any).env?.VITE_APPS_SCRIPT_URL ||
        ''
    );
    setEnvMode(ApiService.getEnvironmentMode());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopied(true);
    success('Google Apps Script backend code copied to clipboard.', 'Code Copied');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleModeChange = (mode: 'production' | 'sandbox') => {
    setEnvMode(mode);
    ApiService.setEnvironmentMode(mode);
    if (mode === 'production') {
      info('Switched to Production Mode: Google Apps Script Web App is required.', 'Production Mode Active');
    } else {
      info('Switched to Sandbox Mode: Local offline simulation active.', 'Sandbox Mode Active');
    }
    if (onBackendConfigured) onBackendConfigured();
  };

  const handleSaveAndTest = async () => {
    const cleanUrl = testUrl.trim();
    if (!cleanUrl) {
      error('Please enter a valid Google Apps Script Web App URL.');
      return;
    }

    if (!cleanUrl.endsWith('/exec')) {
      info('Note: Google Apps Script Web App URLs usually end with "/exec". Checking connection...', 'URL Notice');
    }

    setIsTesting(true);
    setTestResult(null);

    // Save into localStorage for dynamic override
    ApiService.setAppsScriptUrl(cleanUrl);

    try {
      const res = await ApiService.testConnection(cleanUrl);
      setTestResult(res);
      if (res.success) {
        success(res.message, 'Connection Verified');
        if (onBackendConfigured) onBackendConfigured();
      } else {
        error(res.message || 'Connection test failed.');
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || 'Error executing connection request.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleInitializeSheetTabs = async () => {
    setIsInitializing(true);
    try {
      const res = await ApiService.initializeSheets();
      if (res.success) {
        success('All CNE Sheet tabs and headers have been initialized successfully.', 'Sheets Ready');
      } else {
        error(res.message || 'Failed to initialize sheets.');
      }
    } catch (e: any) {
      error('Error initializing sheets.');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Google Sheets Backend & Deployment
              </h2>
              <p className="text-xs text-slate-500">
                Institutional Google Apps Script + Google Drive integration for AIIMS Rishikesh CNE
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Environment Mode Switcher Banner */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-slate-800 block">Application Environment Mode</span>
            <span className="text-slate-500 text-[11px]">
              {envMode === 'production'
                ? 'Production Mode: Requires real Google Apps Script backend. No silent fallback to mock data.'
                : 'Sandbox Mode: Local offline simulation enabled for development testing.'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleModeChange('production')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                envMode === 'production'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Production Mode
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('sandbox')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                envMode === 'sandbox'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Sandbox (Offline Test)
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pt-3">
          <button
            onClick={() => setActiveTab('instructions')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'instructions'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Setup Guide (3 Steps)
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'code'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Apps Script Code (Code.gs)
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'test'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Connect & Test Backend
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {activeTab === 'instructions' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900">
                <h3 className="font-bold text-sm flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Production Architecture Overview
                </h3>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  The CNE System connects directly to your Google Spreadsheet and Google Drive via a secure Google Apps Script Web App API. Follow the 3 steps below to deploy.
                </p>
              </div>

              {/* Step 1 */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">
                    1
                  </span>
                  Open Google Sheets & Paste Apps Script
                </div>
                <p className="text-slate-600 pl-8 leading-relaxed">
                  Open your Google Sheet (e.g. <code>CNE Management Master</code>). In the top menu, click <strong>Extensions &gt; Apps Script</strong>. Delete any placeholder code in <code>Code.gs</code>, then copy and paste the code from the <strong>Apps Script Code</strong> tab into <code>Code.gs</code>. Click <strong>Save</strong> (disk icon).
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">
                    2
                  </span>
                  Configure Script Properties (Optional if using single Sheet)
                </div>
                <div className="text-slate-600 pl-8 space-y-1 leading-relaxed">
                  <p>In Apps Script, click <strong>Project Settings (gear icon) &gt; Script Properties &gt; Add script property</strong>:</p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700">
                    <li><code>DROPDOWN_SPREADSHEET_ID</code>: ID of Spreadsheet containing <code>Rosters Master Data</code> (leave empty if in same sheet).</li>
                    <li><code>CNE_SPREADSHEET_ID</code>: ID of Spreadsheet containing CNE tabs (leave empty if in same sheet).</li>
                    <li><code>DRIVE_FOLDER_ID</code>: Google Drive Folder ID for storing uploaded CNE activity photos.</li>
                  </ul>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">
                    3
                  </span>
                  Deploy as Web App & Connect URL
                </div>
                <div className="text-slate-600 pl-8 space-y-1.5 leading-relaxed">
                  <p>
                    In Apps Script, click <strong>Deploy &gt; New deployment</strong>:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-700">
                    <li>Select type: <strong>Web app</strong></li>
                    <li>Execute as: <strong>Me (your account)</strong></li>
                    <li>Who has access: <strong>Anyone</strong></li>
                  </ul>
                  <p className="pt-1">
                    Click <strong>Deploy</strong>, authorize permissions, and copy the <strong>Web App URL</strong> (ends in <code>/exec</code>). Paste it into the <strong>Connect & Test Backend</strong> tab.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Full Apps Script Backend (Code.gs)
                </span>
                <button
                  id="btn-copy-gas-code"
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy All Code'}</span>
                </button>
              </div>

              <div className="relative rounded-xl bg-slate-950 p-4 font-mono text-[11px] text-slate-200 max-h-[360px] overflow-y-auto border border-slate-800 leading-relaxed select-all">
                <pre>{GOOGLE_APPS_SCRIPT_CODE}</pre>
              </div>
            </div>
          )}

          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label
                  htmlFor="input-gas-url"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Google Apps Script Web App URL (/exec)
                </label>
                <div className="flex gap-2">
                  <input
                    id="input-gas-url"
                    type="url"
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                  <button
                    id="btn-test-gas-url"
                    type="button"
                    disabled={isTesting}
                    onClick={handleSaveAndTest}
                    className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Testing...' : 'Save & Test'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  This URL will be stored securely in your browser and used for all CNE queries and updates.
                </p>
              </div>

              {/* Test Result Box */}
              {testResult && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="font-bold text-xs">
                      {testResult.success ? 'Google Apps Script Connected' : 'Connection Failed'}
                    </div>
                    <div className="text-xs">{testResult.message}</div>
                    {testResult.latencyMs && (
                      <div className="text-[11px] text-emerald-700 font-semibold">
                        Round-trip latency: {testResult.latencyMs} ms
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Initialization Utility */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-slate-700" />
                      Auto-Bootstrap Sheet Tabs & Headers
                    </h4>
                    <p className="text-slate-500 text-[11px]">
                      Automatically creates all 7 necessary tabs (<code>Data</code>, <code>Area</code>, <code>Role</code>, <code>Upcoming Classes</code>, <code>CNE Applications</code>, <code>Gallery</code>, <code>User Credentials</code>) with bold headers.
                    </p>
                  </div>

                  <button
                    id="btn-init-sheets-tab"
                    type="button"
                    disabled={isInitializing}
                    onClick={handleInitializeSheetTabs}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg border border-slate-300 text-xs transition-colors shrink-0 cursor-pointer"
                  >
                    {isInitializing ? 'Initializing...' : 'Initialize Tabs'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            CNE Management System • AIIMS Rishikesh
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 text-xs transition-colors"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
