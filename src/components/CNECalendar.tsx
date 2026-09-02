import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  Info,
  X,
  List,
  Grid
} from 'lucide-react';
import { CNERecord, UpcomingClass } from '../types';
import { ApiService } from '../services/api';

type CalendarViewMode = 'month' | 'week' | 'agenda';

export const CNECalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 1)); // Sep 2026 or current
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [cneRecords, setCneRecords] = useState<CNERecord[]>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const [recordsRes, upcomingRes] = await Promise.all([
        ApiService.getCNERecords(),
        ApiService.getUpcomingClasses()
      ]);
      if (recordsRes.success && recordsRes.data) setCneRecords(recordsRes.data);
      if (upcomingRes.success && upcomingRes.data) setUpcomingClasses(upcomingRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Combine CNE records and Upcoming Classes into unified calendar events
  const allEvents = useMemo(() => {
    const list: any[] = [];

    cneRecords.forEach((r) => {
      list.push({
        id: `rec-${r.dataId}`,
        title: r.topic,
        area: r.area,
        date: r.fromDate,
        time: 'Completed Session',
        duration: r.duration,
        instructor: r.resourcePersonName || r.resourcePersonEmpId,
        mode: r.modeOfTeaching,
        type: 'RECORD',
        raw: r
      });
    });

    upcomingClasses.forEach((c) => {
      list.push({
        id: `cls-${c.classId}`,
        title: c.topic,
        area: c.area,
        date: c.date,
        time: c.time,
        duration: c.duration,
        instructor: c.resourcePersonName || c.resourcePersonEmpId,
        mode: c.modeOfTeaching,
        type: 'UPCOMING',
        raw: c
      });
    });

    return list;
  }, [cneRecords, upcomingClasses]);

  // Calendar math for Monthly View
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Group events by day of current month
  const eventsByDay = useMemo(() => {
    const map: { [day: number]: any[] } = {};
    allEvents.forEach((ev) => {
      const d = new Date(ev.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dayNum = d.getDate();
        if (!map[dayNum]) map[dayNum] = [];
        map[dayNum].push(ev);
      }
    });
    return map;
  }, [allEvents, year, month]);

  return (
    <div className="space-y-6 pb-12">
      {/* Calendar Header & View Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CNE Calendar & Schedule</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive schedule for clinical workshops, nursing classes, and department training sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'agenda' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Agenda / List
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              id="btn-calendar-prev-month"
              onClick={prevMonth}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-900 min-w-[140px] text-center">
              {monthNames[month]} {year}
            </span>
            <button
              id="btn-calendar-next-month"
              onClick={nextMonth}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Legend */}
      <div className="flex items-center gap-4 text-xs bg-white px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600">
        <span className="font-semibold text-slate-700">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Completed CNE Records</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          <span>Upcoming Scheduled Classes</span>
        </div>
      </div>

      {/* Monthly Grid View */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold uppercase tracking-wider text-slate-600 py-3">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Days Cells Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {/* Blank leading days */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] p-2 bg-slate-50/50" />
            ))}

            {/* Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayEvents = eventsByDay[dayNum] || [];
              const isToday =
                new Date().getFullYear() === year &&
                new Date().getMonth() === month &&
                new Date().getDate() === dayNum;

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`min-h-[110px] p-2 transition-colors ${
                    isToday ? 'bg-emerald-50/30' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        isToday ? 'bg-slate-900 text-white' : 'text-slate-700'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Day Events */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={`w-full text-left p-1 rounded text-[10px] font-semibold truncate block transition-all ${
                          ev.type === 'UPCOMING'
                            ? 'bg-purple-100 text-purple-900 hover:bg-purple-200 border-l-2 border-purple-600'
                            : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border-l-2 border-emerald-600'
                        }`}
                      >
                        {ev.title}
                      </button>
                    ))}

                    {dayEvents.length > 2 && (
                      <button
                        onClick={() => setSelectedEvent(dayEvents[2])}
                        className="text-[10px] font-bold text-slate-500 hover:underline block text-center"
                      >
                        +{dayEvents.length - 2} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda / List View */}
      {viewMode === 'agenda' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="divide-y divide-slate-100">
            {allEvents
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 p-3 rounded-xl transition-all cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ev.type === 'UPCOMING'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ev.type === 'UPCOMING' ? 'Upcoming Class' : 'Completed CNE'}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {ev.area}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{ev.title}</h4>
                    <p className="text-xs text-slate-500">
                      Instructor: {ev.instructor} • Mode: {ev.mode}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1 sm:justify-end">
                      <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ev.date}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{ev.time}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedEvent.type === 'UPCOMING'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    selectedEvent.type === 'UPCOMING'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {selectedEvent.type === 'UPCOMING' ? 'Upcoming Class' : 'Completed CNE Session'}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedEvent.title}
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Date & Time</span>
                <span className="font-bold text-slate-900">
                  {selectedEvent.date} • {selectedEvent.time}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Clinical Area / Ward</span>
                <span className="font-bold text-slate-900">{selectedEvent.area}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Resource Person / Instructor</span>
                <span className="font-bold text-slate-900">{selectedEvent.instructor}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Mode of Teaching</span>
                <span className="font-bold text-slate-900">{selectedEvent.mode}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Session Duration</span>
                <span className="font-bold text-slate-900">{selectedEvent.duration}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
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
