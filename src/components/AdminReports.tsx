import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Filter,
  Download,
  Printer,
  Users,
  Award,
  Clock,
  Layers,
  GraduationCap
} from 'lucide-react';
import { CNERecord, SessionUser } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface AdminReportsProps {
  user: SessionUser;
}

export const AdminReports: React.FC<AdminReportsProps> = () => {
  const [records, setRecords] = useState<CNERecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('2026');

  const { success, error } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getCNERecords();
      if (res.success && res.data) {
        setRecords(res.data);
      }
    } catch (e: any) {
      error('Failed to load records for report.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (selectedYear === 'ALL') return records;
    return records.filter((r) => r.fromDate.startsWith(selectedYear));
  }, [records, selectedYear]);

  // Analytics Computations
  const totalActivities = filtered.length;

  let totalTouchpoints = 0;
  let totalMinutes = 0;
  const areaCounts: { [area: string]: number } = {};
  const modeCounts: { [mode: string]: number } = {};
  const instructorCounts: { [name: string]: number } = {};
  const monthlyCounts: { [month: string]: number } = {};

  filtered.forEach((r) => {
    // Participants
    totalTouchpoints += r.staffCount || (r.staffEmpIds ? r.staffEmpIds.length : 0);

    // Duration
    const parts = (r.duration || '1:00:00').split(':');
    const hrs = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    totalMinutes += hrs * 60 + mins;

    // Area
    areaCounts[r.area] = (areaCounts[r.area] || 0) + 1;

    // Mode
    modeCounts[r.modeOfTeaching] = (modeCounts[r.modeOfTeaching] || 0) + 1;

    // Instructor
    const instName = r.resourcePersonName || r.resourcePersonEmpId;
    instructorCounts[instName] = (instructorCounts[instName] || 0) + 1;

    // Month (YYYY-MM)
    const monthKey = r.fromDate.substring(0, 7);
    monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
  });

  const totalTrainingHours = Math.round((totalMinutes / 60) * 10) / 10;
  const uniqueInstructors = Object.keys(instructorCounts).length;
  const uniqueAreas = Object.keys(areaCounts).length;

  const topAreas = Object.entries(areaCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topInstructors = Object.entries(instructorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topModes = Object.entries(modeCounts)
    .sort((a, b) => b[1] - a[1]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Institutional CNE Analytics & Reports</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800">
              Annual Assessment
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Department of Nursing • Clinical education statistics, teaching mode breakdowns, and participation trends.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800"
          >
            <option value="2026">Year 2026</option>
            <option value="2025">Year 2025</option>
            <option value="ALL">All Recorded Years</option>
          </select>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Sessions
          </span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">{totalActivities}</div>
          <div className="text-[11px] text-slate-500 mt-1">Logged CNE workshops</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Training Hours
          </span>
          <div className="text-3xl font-extrabold text-emerald-600 mt-1">{totalTrainingHours} hrs</div>
          <div className="text-[11px] text-slate-500 mt-1">Cumulative education delivery</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Staff Touchpoints
          </span>
          <div className="text-3xl font-extrabold text-sky-600 mt-1">{totalTouchpoints}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total attendee attendances</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Departments
          </span>
          <div className="text-3xl font-extrabold text-purple-600 mt-1">{uniqueAreas}</div>
          <div className="text-[11px] text-slate-500 mt-1">Wards & specialty units</div>
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Active Areas */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Top Wards & Departments</h3>
            <span className="text-xs text-slate-500">Activities</span>
          </div>

          <div className="space-y-3">
            {topAreas.map(([name, count]) => {
              const pct = totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0;
              return (
                <div key={name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 truncate max-w-[200px]">{name}</span>
                    <span className="font-bold text-slate-900">{count} sessions</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Teaching Modes Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Teaching Methodologies</h3>
            <span className="text-xs text-slate-500">Distribution</span>
          </div>

          <div className="space-y-3">
            {topModes.map(([mode, count]) => {
              const pct = totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0;
              return (
                <div key={mode} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{mode}</span>
                    <span className="font-bold text-slate-900">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-sky-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Resource Persons */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Top Resource Persons</h3>
            <span className="text-xs text-slate-500">Sessions</span>
          </div>

          <div className="space-y-3">
            {topInstructors.map(([name, count]) => {
              const pct = totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0;
              return (
                <div key={name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 truncate max-w-[200px]">{name}</span>
                    <span className="font-bold text-slate-900">{count} led</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
