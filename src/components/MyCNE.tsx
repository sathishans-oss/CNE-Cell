import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Calendar,
  Search,
  FileDown,
  Filter,
  Clock,
  User,
  Info,
  X,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { CNERecord, SessionUser } from '../types';
import { ApiService } from '../services/api';
import { generateAnnualCNEPdf } from '../services/pdfGenerator';
import { useToast } from './Toast';
import { formatCneDateDisplay, formatCneDateRangeDisplay } from '../utils';

interface MyCNEProps {
  user: SessionUser;
}

export const MyCNE: React.FC<MyCNEProps> = ({ user }) => {
  const [records, setRecords] = useState<CNERecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('2026-2027');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<CNERecord | null>(null);

  const { success, error } = useToast();

  useEffect(() => {
    loadMyRecords();
  }, []);

  const loadMyRecords = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getCNERecords();
      if (res.success && res.data) {
        setRecords(res.data);
      } else {
        error(res.message || 'Failed to load CNE records.');
      }
    } catch (e: any) {
      error(e?.message || 'Error loading records.');
    } finally {
      setLoading(false);
    }
  };

  // Assessment Year helper (1 April to 31 March)
  const isDateInAssessmentYear = (dateStr: string, ayKey: string): boolean => {
    if (ayKey === 'ALL') return true;
    const startYear = parseInt(ayKey.split('-')[0], 10);
    if (isNaN(startYear)) return true;
    const ayStart = `${startYear}-04-01`;
    const ayEnd = `${startYear + 1}-03-31`;
    return dateStr >= ayStart && dateStr <= ayEnd;
  };

  // Filter logic
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Assessment Year filter (1 April - 31 March)
      const recDate = rec.fromDate || rec.toDate || '';
      if (!isDateInAssessmentYear(recDate, selectedYear)) {
        return false;
      }

      // Date Range filter
      if (startDate && rec.fromDate < startDate) return false;
      if (endDate && rec.fromDate > endDate) return false;

      // Global Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTopic = rec.topic.toLowerCase().includes(q);
        const matchArea = rec.area.toLowerCase().includes(q);
        const matchMode = rec.modeOfTeaching.toLowerCase().includes(q);
        const matchRp = (rec.resourcePersonName || rec.resourcePersonEmpId).toLowerCase().includes(q);
        const matchExtRp = rec.externalResourcePersons?.some(p => p.toLowerCase().includes(q));
        if (!matchTopic && !matchArea && !matchMode && !matchRp && !matchExtRp) return false;
      }

      return true;
    });
  }, [records, selectedYear, startDate, endDate, searchTerm]);

  // Compute total duration
  const totalDurationStats = useMemo(() => {
    let totalMinutes = 0;
    filteredRecords.forEach((rec) => {
      const parts = (rec.duration || '1:00:00').split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const mins = parseInt(parts[1], 10) || 0;
      totalMinutes += hours * 60 + mins;
    });
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h ${mins > 0 ? `${mins}m` : ''}`;
  }, [filteredRecords]);

  const handleGeneratePdf = async () => {
    const ayDisplay = selectedYear === 'ALL' ? '2026–2027' : selectedYear.replace('-', '–');
    if (filteredRecords.length === 0) {
      error(`No CNE records found for Assessment Year ${ayDisplay}.`);
      return;
    }
    setIsGeneratingPdf(true);
    try {
      generateAnnualCNEPdf(user, filteredRecords, ayDisplay);
      success(`Annual CNE Record for AY ${ayDisplay} downloaded successfully.`, 'PDF Generated');
    } catch (e: any) {
      error('Failed to generate PDF document.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">My CNE Activities</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">
              Personal CNE Portfolio
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official records of all Continuing Nursing Education sessions attended or conducted by {user.name} ({user.employeeId}).
          </p>
        </div>

        {/* Action Button: Generate Annual CNE PDF */}
        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-my-cne"
            onClick={loadMyRecords}
            disabled={loading || isGeneratingPdf}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-40"
            title="Refresh records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="btn-generate-annual-cne-pdf"
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf || loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 text-emerald-400" />
                <span>Generate Annual CNE Record</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter & Metric Ribbon */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              id="input-my-cne-search"
              type="text"
              placeholder="Search topic, area, instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
            />
          </div>

          {/* Year Filter */}
          <div>
            <select
              id="select-my-cne-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-semibold text-slate-800"
            >
              <option value="2026-2027">Assessment Year 2026–2027 (01-Apr-2026 – 31-Mar-2027)</option>
              <option value="2025-2026">Assessment Year 2025–2026 (01-Apr-2025 – 31-Mar-2026)</option>
              <option value="2024-2025">Assessment Year 2024–2025 (01-Apr-2024 – 31-Mar-2025)</option>
              <option value="2023-2024">Assessment Year 2023–2024 (01-Apr-2023 – 31-Mar-2024)</option>
              <option value="ALL">All Recorded Years</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              title="From Date"
            />
          </div>

          {/* To Date */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              title="To Date"
            />
          </div>
        </div>

        {/* Totals Summary Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-6">
            <span className="text-slate-600">
              Filtered Sessions: <strong className="text-slate-900">{filteredRecords.length}</strong>
            </span>
            <span className="text-slate-600">
              Total Training Duration: <strong className="text-emerald-700">{totalDurationStats}</strong>
            </span>
          </div>

          {(searchTerm || startDate || endDate || selectedYear !== '2026-2027') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedYear('2026-2027');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* CNE Records Data Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading your verified CNE records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center space-y-3 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              No CNE activities found for the selected period.
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Check your date/year filters or contact the CNE In-charge if an activity you attended is missing.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4 w-12 text-center">Sr.</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Area / Ward</th>
                    <th className="py-3.5 px-4">Topic / Skills</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Instructor / Resource Person</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((rec, index) => {
                    const isResourcePerson = (rec.resourcePersonEmpId || '').toLowerCase().includes((user.employeeId || '').toLowerCase());
                    return (
                      <tr
                        key={rec.dataId}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 px-4 text-center font-medium text-slate-500">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                          {formatCneDateRangeDisplay(rec.fromDate, rec.toDate)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {rec.area}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs">
                          {rec.topic}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isResourcePerson
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isResourcePerson ? 'Resource Person' : 'Participant (You)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {rec.resourcePersonName || rec.resourcePersonEmpId}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{rec.duration || '1:00:00'}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            id={`btn-view-rec-${rec.dataId}`}
                            onClick={() => setSelectedRecord(rec)}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredRecords.map((rec, index) => {
                const isResourcePerson = rec.resourcePersonEmpId.toLowerCase() === user.employeeId.toLowerCase();
                return (
                  <div key={rec.dataId} className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-500">#{index + 1} • {formatCneDateRangeDisplay(rec.fromDate, rec.toDate)}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isResourcePerson
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isResourcePerson ? 'Resource Person' : 'Participant'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {rec.topic}
                    </h4>

                    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {rec.area}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3 h-3" />
                        {rec.duration}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-500 truncate max-w-[200px]">
                        Instructor: {rec.resourcePersonName || rec.resourcePersonEmpId}
                      </span>
                      <button
                        onClick={() => setSelectedRecord(rec)}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
                      >
                        Details →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Record Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setSelectedRecord(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">CNE Activity Record</h3>
                <span className="text-xs text-slate-500 font-mono">ID: {selectedRecord.dataId}</span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="block text-slate-500 font-semibold uppercase text-[10px]">Topic / Subject</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedRecord.topic}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-slate-500 font-semibold uppercase text-[10px]">Ward / Area</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">{selectedRecord.area}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-slate-500 font-semibold uppercase text-[10px]">Date & Duration</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">
                    {formatCneDateRangeDisplay(selectedRecord.fromDate, selectedRecord.toDate)} ({selectedRecord.duration || '1 hr'})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-slate-500 font-semibold uppercase text-[10px]">Mode of Teaching</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">{selectedRecord.modeOfTeaching}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-slate-500 font-semibold uppercase text-[10px]">Resource Person(s)</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">
                    {[
                      selectedRecord.resourcePersonName || selectedRecord.resourcePersonEmpId,
                      ...(selectedRecord.externalResourcePersons?.map(p => `${p} (External)`) || [])
                    ].filter(Boolean).join(', ')}
                  </span>
                </div>
              </div>

              {selectedRecord.remarks && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-slate-500 font-semibold uppercase text-[10px]">Remarks / Notes</span>
                  <p className="text-slate-700 mt-0.5">{selectedRecord.remarks}</p>
                </div>
              )}

              {/* Privacy Notice */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <span className="font-semibold">Participation Verified</span>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Your attendance is verified in the Department of Nursing CNE database and certified for your professional training record.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
