import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  PlusCircle,
  X,
  Search,
  Loader2,
  BookOpen,
  QrCode,
  Award,
  Lock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Eye,
  Edit3
} from 'lucide-react';
import { SessionUser, UpcomingClass } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';
import {
  formatCneDateRangeDisplay,
  formatResourcePersonsDisplay,
  isCneAuthorized,
  getUserAssignedAreas,
  formatCneDateTimeDisplay,
  calculateCneDuration,
  validateCneDuration,
  toDateTimeLocalString
} from '../utils';
import { CNEReferenceModal } from './cne/CNEReferenceModal';
import { CNEQuestionsModal } from './cne/CNEQuestionsModal';
import { CNEQRModal } from './cne/CNEQRModal';
import { CNEParticipantsModal } from './cne/CNEParticipantsModal';
import { CNEPostTestModal } from './cne/CNEPostTestModal';
import { CNEFinalizeModal } from './cne/CNEFinalizeModal';
import { DepartmentalScheduleModal } from './cne/DepartmentalScheduleModal';

interface UpcomingClassesProps {
  user: SessionUser | null;
  onRequireLogin?: (classId?: string) => void;
}

export const UpcomingClasses: React.FC<UpcomingClassesProps> = ({
  user,
  onRequireLogin
}) => {
  const [classes, setClasses] = useState<UpcomingClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CENTRAL' | 'DEPARTMENTAL' | 'MY_WARDS'>('ALL');

  // Schedule Class Modal State
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isDeptScheduleOpen, setIsDeptScheduleOpen] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newToDate, setNewToDate] = useState('');
  const [newDuration, setNewDuration] = useState('01:30:00');
  const [selectedRpEmpIds, setSelectedRpEmpIds] = useState<string[]>([]);
  const [rpSearchQuery, setRpSearchQuery] = useState('');
  const [newExternalRpList, setNewExternalRpList] = useState<string[]>([]);
  const [newExternalRpInput, setNewExternalRpInput] = useState('');
  const [newMode, setNewMode] = useState('Lecture Cum Discussion');
  const [newDescription, setNewDescription] = useState('');
  const [newMaxParticipants, setNewMaxParticipants] = useState(40);
  const [areasList, setAreasList] = useState<string[]>([]);
  const [officersList, setOfficersList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Part 2 Active Modals
  const [selectedDetailCne, setSelectedDetailCne] = useState<UpcomingClass | null>(null);
  const [activeReferenceCne, setActiveReferenceCne] = useState<UpcomingClass | null>(null);
  const [activeQuestionsCne, setActiveQuestionsCne] = useState<UpcomingClass | null>(null);
  const [activeQRCne, setActiveQRCne] = useState<UpcomingClass | null>(null);
  const [activeParticipantsCne, setActiveParticipantsCne] = useState<UpcomingClass | null>(null);
  const [activeFinalizeCne, setActiveFinalizeCne] = useState<UpcomingClass | null>(null);
  const [activePostTest, setActivePostTest] = useState<{ cneId?: string; qrToken?: string } | null>(null);

  // Edit CNE Modal State
  const [editingCne, setEditingCne] = useState<UpcomingClass | null>(null);
  const [editCneType, setEditCneType] = useState<'CENTRAL' | 'DEPARTMENTAL'>('CENTRAL');
  const [editTopic, setEditTopic] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editToDate, setEditToDate] = useState('');
  const [editDuration, setEditDuration] = useState('01:30:00');
  const [editSelectedRpEmpIds, setEditSelectedRpEmpIds] = useState<string[]>([]);
  const [editRpSearchQuery, setEditRpSearchQuery] = useState('');
  const [editExternalRpList, setEditExternalRpList] = useState<string[]>([]);
  const [editExternalRpInput, setEditExternalRpInput] = useState('');
  const [editMode, setEditMode] = useState('Lecture Cum Discussion');
  const [editDescription, setEditDescription] = useState('');
  const [editMaxParticipants, setEditMaxParticipants] = useState(40);
  const [editAdminRemarks, setEditAdminRemarks] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const { success, error } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const isAreaIncharge = user?.role === 'AREA_INCHARGE';
  const canScheduleCne = isAdmin || isAreaIncharge;
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    // Check for QR postTest URL query parameter
    const params = new URLSearchParams(window.location.search);
    const token = params.get('postTest');
    if (token) {
      setActivePostTest({ qrToken: token });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clsRes, areasRes, officersRes] = await Promise.all([
        ApiService.getUpcomingClasses(),
        ApiService.getAreas(),
        isAdmin ? ApiService.getOfficersDropdown() : Promise.resolve({ success: true, data: [] })
      ]);

      if (clsRes.success && clsRes.data) setClasses(clsRes.data);
      if (areasRes.success && areasRes.data) {
        setAreasList(areasRes.data.filter((a) => a.status === 'ACTIVE').map((a) => a.name));
      }
      if (officersRes.success && officersRes.data) setOfficersList(officersRes.data);
    } catch (e: any) {
      error(e?.message || 'Failed to load CNE schedule.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExternalRp = () => {
    const val = newExternalRpInput.trim();
    if (!val) return;
    if (!newExternalRpList.includes(val)) {
      setNewExternalRpList((prev) => [...prev, val]);
    }
    setNewExternalRpInput('');
  };

  const handleRemoveExternalRp = (idx: number) => {
    setNewExternalRpList((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleRpSelection = (empId: string) => {
    setSelectedRpEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const filteredRpOfficers = officersList.filter((o) => {
    if (!rpSearchQuery.trim()) return true;
    const q = rpSearchQuery.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.employeeId.toLowerCase().includes(q) ||
      (o.designation || '').toLowerCase().includes(q)
    );
  });

  const handleNewFromDateChange = (val: string) => {
    setNewDate(val);
    if (val && newToDate) {
      const dFrom = new Date(val);
      const dTo = new Date(newToDate);
      if (!isNaN(dFrom.getTime()) && !isNaN(dTo.getTime()) && dTo >= dFrom) {
        const autoDur = calculateCneDuration(val, newToDate);
        if (autoDur) setNewDuration(autoDur);
      }
    }
  };

  const handleNewToDateChange = (val: string) => {
    setNewToDate(val);
    if (newDate && val) {
      const dFrom = new Date(newDate);
      const dTo = new Date(val);
      if (!isNaN(dFrom.getTime()) && !isNaN(dTo.getTime()) && dTo >= dFrom) {
        const autoDur = calculateCneDuration(newDate, val);
        if (autoDur) setNewDuration(autoDur);
      }
    }
  };

  const handleCreateUpcomingClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim() || !newArea.trim() || !newDate.trim()) {
      error('Please fill in all required fields (Topic, Area, From Date & Time).');
      return;
    }

    if (!newToDate.trim()) {
      error('To Date & Time is required.');
      return;
    }

    const dFrom = new Date(newDate);
    const dTo = new Date(newToDate);
    if (isNaN(dFrom.getTime()) || isNaN(dTo.getTime())) {
      error('Please enter valid From Date & Time and To Date & Time.');
      return;
    }

    if (dTo < dFrom) {
      error('To Date & Time cannot be earlier than From Date & Time.');
      return;
    }

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const checkFrom = new Date(dFrom);
    checkFrom.setHours(0, 0, 0, 0);
    if (checkFrom < todayDate) {
      error('Scheduled From Date cannot be in the past. Please select today or a future date.');
      return;
    }

    const durVal = validateCneDuration(newDuration, newDate, newToDate);
    if (!durVal.isValid) {
      error(durVal.message);
      return;
    }

    if (selectedRpEmpIds.length === 0 && newExternalRpList.length === 0) {
      error('Please select at least one Resource Person (Internal or External).');
      return;
    }

    const rpNames = selectedRpEmpIds.map((id) => {
      const off = officersList.find((o) => o.employeeId === id);
      return off ? off.name : id;
    });
    if (newExternalRpList.length > 0) {
      rpNames.push(...newExternalRpList.map((n) => `${n} (External)`));
    }

    setIsSubmitting(true);
    try {
      // The Schedule New CNE workflow MUST ALWAYS submit cneType: 'CENTRAL'
      const res = await ApiService.addUpcomingClass({
        topic: newTopic.trim(),
        area: newArea,
        cneType: 'CENTRAL',
        date: newDate,
        toDate: newToDate,
        time: '',
        duration: newDuration.trim(),
        resourcePersonEmpId: selectedRpEmpIds.join(', '),
        resourcePersonEmpIds: selectedRpEmpIds,
        resourcePersonName: rpNames.join(', '),
        externalResourcePersons: newExternalRpList,
        modeOfTeaching: newMode,
        description: newDescription.trim(),
        maxParticipants: newMaxParticipants,
        proposedByEmpId: user?.employeeId,
        proposedByName: user?.name,
        status: 'Scheduled'
      } as any);

      if (res.success) {
        success('Upcoming Central CNE workshop created and published successfully.', 'CNE Scheduled');
        setIsAddClassOpen(false);
        // Reset form
        setNewTopic('');
        setNewDescription('');
        setNewDate('');
        setNewToDate('');
        setNewDuration('01:30:00');
        setSelectedRpEmpIds([]);
        setRpSearchQuery('');
        setNewExternalRpList([]);
        setNewExternalRpInput('');
        loadData();
      } else {
        error(res.message || 'Failed to schedule CNE.');
      }
    } catch (err: any) {
      error(err?.message || 'Error creating CNE.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditFromDateChange = (val: string) => {
    setEditDate(val);
    if (val && editToDate) {
      const dFrom = new Date(val);
      const dTo = new Date(editToDate);
      if (!isNaN(dFrom.getTime()) && !isNaN(dTo.getTime()) && dTo >= dFrom) {
        const autoDur = calculateCneDuration(val, editToDate);
        if (autoDur) setEditDuration(autoDur);
      }
    }
  };

  const handleEditToDateChange = (val: string) => {
    setEditToDate(val);
    if (editDate && val) {
      const dFrom = new Date(editDate);
      const dTo = new Date(val);
      if (!isNaN(dFrom.getTime()) && !isNaN(dTo.getTime()) && dTo >= dFrom) {
        const autoDur = calculateCneDuration(editDate, val);
        if (autoDur) setEditDuration(autoDur);
      }
    }
  };

  const handleOpenEditModal = (cls: UpcomingClass) => {
    setEditingCne(cls);
    setEditTopic(cls.topic || '');
    setEditArea(cls.area || '');
    setEditCneType(((cls.cneType || 'CENTRAL').toUpperCase() as 'CENTRAL' | 'DEPARTMENTAL'));
    setEditDate(toDateTimeLocalString(cls.date));
    setEditToDate(toDateTimeLocalString(cls.toDate || cls.date));
    setEditDuration(cls.duration || '01:30:00');

    const parsedRpIds = (cls.resourcePersonEmpId || '')
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setEditSelectedRpEmpIds(parsedRpIds);
    setEditRpSearchQuery('');
    setEditExternalRpList(cls.externalResourcePersons ? [...cls.externalResourcePersons] : []);
    setEditExternalRpInput('');
    setEditMode(cls.modeOfTeaching || 'Lecture Cum Discussion');
    setEditDescription(cls.description || '');
    setEditMaxParticipants(cls.maxParticipants || 40);
    setEditAdminRemarks(cls.adminRemarks || '');
  };

  const handleAddEditExternalRp = () => {
    const val = editExternalRpInput.trim();
    if (!val) return;
    if (!editExternalRpList.includes(val)) {
      setEditExternalRpList((prev) => [...prev, val]);
    }
    setEditExternalRpInput('');
  };

  const handleRemoveEditExternalRp = (idx: number) => {
    setEditExternalRpList((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleEditRpSelection = (empId: string) => {
    setEditSelectedRpEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const filteredEditRpOfficers = officersList.filter((o) => {
    if (!editRpSearchQuery.trim()) return true;
    const q = editRpSearchQuery.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.employeeId.toLowerCase().includes(q) ||
      (o.designation || '').toLowerCase().includes(q)
    );
  });

  const handleUpdateClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCne) return;

    if (!editTopic.trim() || !editArea.trim() || !editDate.trim()) {
      error('Please fill in all required fields (Topic, Area, From Date & Time).');
      return;
    }
    if (!editToDate.trim()) {
      error('To Date & Time is required.');
      return;
    }

    const dFrom = new Date(editDate);
    const dTo = new Date(editToDate);
    if (isNaN(dFrom.getTime()) || isNaN(dTo.getTime())) {
      error('Please enter valid From Date & Time and To Date & Time.');
      return;
    }
    if (dTo < dFrom) {
      error('To Date & Time cannot be earlier than From Date & Time.');
      return;
    }

    const durVal = validateCneDuration(editDuration, editDate, editToDate);
    if (!durVal.isValid) {
      error(durVal.message);
      return;
    }

    if (editSelectedRpEmpIds.length === 0 && editExternalRpList.length === 0) {
      error('Please select at least one Resource Person (Internal or External).');
      return;
    }

    const rpNames = editSelectedRpEmpIds.map((id) => {
      const off = officersList.find((o) => o.employeeId === id);
      return off ? off.name : id;
    });
    if (editExternalRpList.length > 0) {
      rpNames.push(...editExternalRpList.map((n) => `${n} (External)`));
    }

    setIsEditSubmitting(true);
    try {
      // NOTE: CNE ID is permanently immutable and cannot be changed or overwritten.
      const res = await ApiService.updateUpcomingClass(editingCne.classId, {
        topic: editTopic.trim(),
        area: editArea,
        cneType: editCneType,
        date: editDate,
        toDate: editToDate,
        time: '',
        duration: editDuration.trim(),
        resourcePersonEmpId: editSelectedRpEmpIds.join(', '),
        resourcePersonEmpIds: editSelectedRpEmpIds,
        resourcePersonName: rpNames.join(', '),
        externalResourcePersons: editExternalRpList,
        modeOfTeaching: editMode,
        description: editDescription.trim(),
        maxParticipants: editMaxParticipants,
        adminRemarks: editAdminRemarks.trim()
      } as any);

      if (res.success) {
        success('Upcoming CNE workshop updated successfully.', 'CNE Updated');
        const updatedRecord: UpcomingClass = {
          ...editingCne,
          topic: editTopic.trim(),
          area: editArea,
          cneType: editCneType,
          date: editDate,
          toDate: editToDate,
          time: '',
          duration: editDuration.trim(),
          resourcePersonEmpId: editSelectedRpEmpIds.join(', '),
          resourcePersonName: rpNames.join(', '),
          externalResourcePersons: editExternalRpList,
          modeOfTeaching: editMode,
          description: editDescription.trim(),
          maxParticipants: editMaxParticipants,
          adminRemarks: editAdminRemarks.trim()
        };
        setClasses((prev) =>
          prev.map((c) => (c.classId === editingCne.classId ? updatedRecord : c))
        );
        if (selectedDetailCne?.classId === editingCne.classId) {
          setSelectedDetailCne(updatedRecord);
        }
        setEditingCne(null);
      } else {
        error(res.message || 'Failed to update CNE workshop.');
      }
    } catch (err: any) {
      error(err?.message || 'Error updating CNE.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const getResourcePersonsDisplay = (cls: UpcomingClass) => {
    const internalNames = (cls.resourcePersonEmpId || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => {
        const off = officersList.find((o) => o.employeeId === id);
        return off ? `${off.name} (${id})` : id;
      });
    const externalNames = (cls.externalResourcePersons || []).map((p) => `${p} (Ext)`);
    const all = [...internalNames, ...externalNames];
    return all.length > 0 ? all.join(', ') : cls.resourcePersonName || 'TBD';
  };

  const userAssignedAreas = getUserAssignedAreas(user);
  const myWardsClassesCount = classes.filter((c) =>
    (c.cneType || '').toUpperCase() === 'DEPARTMENTAL' &&
    userAssignedAreas.some((a) => a.toLowerCase() === (c.area || '').trim().toLowerCase())
  ).length;

  const filteredClasses = classes.filter((c) => {
    if (typeFilter === 'MY_WARDS') {
      const cType = (c.cneType || '').toUpperCase();
      if (cType !== 'DEPARTMENTAL') return false;
      if (!userAssignedAreas.some((a) => a.toLowerCase() === (c.area || '').trim().toLowerCase())) return false;
    } else if (typeFilter !== 'ALL') {
      const cType = (c.cneType || 'CENTRAL').toUpperCase();
      if (cType !== typeFilter) return false;
    }
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const rpDisplay = getResourcePersonsDisplay(c).toLowerCase();
    return (
      (c.classId || '').toLowerCase().includes(q) ||
      c.topic.toLowerCase().includes(q) ||
      c.area.toLowerCase().includes(q) ||
      (c.resourcePersonName || '').toLowerCase().includes(q) ||
      rpDisplay.includes(q)
    );
  });

  const availableClasses = filteredClasses;
  const centralCount = classes.filter((c) => (c.cneType || 'CENTRAL').toUpperCase() === 'CENTRAL').length;
  const deptCount = classes.filter((c) => (c.cneType || '').toUpperCase() === 'DEPARTMENTAL').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CNE Schedule</h1>
          <p className="text-xs text-slate-500 mt-1">
            Scheduled clinical skill stations, continuing nursing seminars, and simulation lab workshops.
          </p>
        </div>

        {canScheduleCne && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Dedicated Departmental Schedule Button (opens batch modal with 2 blank rows) */}
            <button
              id="btn-schedule-departmental-cne"
              type="button"
              onClick={() => setIsDeptScheduleOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4 text-teal-200" />
              <span>Schedule Departmental CNE</span>
            </button>

            {/* Central CNE Schedule Button (Admin only) */}
            {isAdmin && (
              <button
                id="btn-admin-add-upcoming-class"
                type="button"
                onClick={() => {
                  setIsAddClassOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>Schedule Central CNE</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* Search & Category Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search CNE topic, department, or instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl shadow-xs"
            />
          </div>

          {/* Type Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({classes.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('CENTRAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                typeFilter === 'CENTRAL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Central ({centralCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('DEPARTMENTAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                typeFilter === 'DEPARTMENTAL'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Departmental ({deptCount})
            </button>
            {isAreaIncharge && userAssignedAreas.length > 0 && (
              <button
                type="button"
                onClick={() => setTypeFilter('MY_WARDS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  typeFilter === 'MY_WARDS'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View CNEs for your assigned wards"
              >
                My Assigned Areas ({myWardsClassesCount})
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <span className="text-xs font-medium">Loading CNE schedule from Google Sheets...</span>
          </div>
        ) : availableClasses.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
            <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No CNE classes scheduled</h3>
            <p className="text-xs text-slate-500">Check back soon for the upcoming CNE training schedule.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 whitespace-nowrap">CNE ID</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Type of CNE</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Topic</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Area/Department</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                    <th className="py-3.5 px-4 min-w-[180px]">Resource Persons</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {availableClasses.map((cls) => {
                    const isCompleted = cls.status === 'Completed';
                    const isCanceled = cls.status === 'Canceled';
                    const rpDisplay = formatResourcePersonsDisplay({
                      resourcePersonEmpId: cls.resourcePersonEmpId,
                      resourcePersonName: cls.resourcePersonName,
                      externalResourcePersons: cls.externalResourcePersons,
                      officers: officersList
                    });

                    return (
                      <tr
                        key={cls.classId}
                        onClick={() => setSelectedDetailCne(cls)}
                        className="hover:bg-slate-50/90 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-200 inline-block">
                            {cls.classId}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                              (cls.cneType || 'CENTRAL').toUpperCase() === 'CENTRAL'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}
                          >
                            {(cls.cneType || 'CENTRAL').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 line-clamp-2 max-w-xs md:max-w-sm" title={cls.topic}>
                            {cls.topic}
                          </div>
                          {cls.isLocked && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 mt-0.5">
                              <Lock className="w-2.5 h-2.5" /> Questions Locked
                            </span>
                          )}
                          {cls.description && (
                            <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {cls.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {cls.area}
                          </span>
                          {isAreaIncharge && isCneAuthorized(user, cls.area, cls.cneType) && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                              Your Ward
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">
                            {formatCneDateTimeDisplay(cls.date, cls.toDate, cls.time)}
                          </div>
                          <div className="text-[11px] text-slate-500">Duration: {cls.duration || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="line-clamp-2 max-w-[220px] text-slate-600 text-xs leading-relaxed" title={rpDisplay}>
                            {rpDisplay}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isCompleted ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Completed
                            </span>
                          ) : isCanceled ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              Canceled
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              Scheduled
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDetailCne(cls);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Admin Schedule Class */}
      {isAddClassOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl w-[92vw] max-w-[1440px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Schedule New CNE
                  </h3>
                  <p className="text-xs text-slate-500">
                    Publish training session to the institutional CNE Schedule
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddClassOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUpcomingClass} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Column 1: Classification & Topic */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 border-b border-purple-100 pb-2 flex items-center gap-1.5">
                      <span>1. Category & Curriculum</span>
                    </h4>

                    {/* CNE Type: Always Central for Schedule New CNE */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        CNE Category / Type
                      </label>
                      <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-900 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                            Central CNE
                          </div>
                          <div className="text-[10px] text-blue-700 font-normal">Hospital-wide clinical seminar (Admin Authoritative)</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
                          Central
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Topic / Skills Training Subject *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Pediatric Advanced Life Support & Defibrillator Handling"
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Clinical Ward / Area *
                      </label>
                      <select
                        required
                        value={newArea}
                        onChange={(e) => setNewArea(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        <option value="">Select Area...</option>
                        {areasList.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Description / Prerequisites
                      </label>
                      <textarea
                        rows={3}
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Outline syllabus, target audience, or lab preparations..."
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Column 2: Date, Time & Logistics */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-100 pb-2 flex items-center gap-1.5">
                      <span>2. Date & Schedule</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                          From Date &amp; Time *
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={newDate}
                          onChange={(e) => handleNewFromDateChange(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                          To Date &amp; Time *
                        </label>
                        <input
                          type="datetime-local"
                          required
                          min={newDate}
                          value={newToDate}
                          onChange={(e) => handleNewToDateChange(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Duration (HH:MM:SS) *
                        </label>
                        <span className="text-[10px] text-indigo-600 font-semibold">Auto-calculated • Editable</span>
                      </div>
                      <input
                        type="text"
                        required
                        value={newDuration}
                        onChange={(e) => setNewDuration(e.target.value)}
                        placeholder="01:30:00"
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Calculated from From/To dates. Max 8 hours per calendar day. Format: HH:MM:SS
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Max Participant Seats
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={200}
                        value={newMaxParticipants}
                        onChange={(e) => setNewMaxParticipants(parseInt(e.target.value, 10))}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Column 3: Resource Persons Multi-Select */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 border-b border-teal-100 pb-2 flex items-center justify-between">
                      <span>3. Resource Persons</span>
                      <span className="text-[10px] text-slate-500 font-semibold lowercase">
                        {selectedRpEmpIds.length} selected
                      </span>
                    </h4>

                    {/* Internal Resource Persons Multi-Select */}
                    <div className="space-y-2 flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          Internal Faculty (AIIMS Staff)
                        </label>
                      </div>

                      {/* Selected RP Tags */}
                      {selectedRpEmpIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                          {selectedRpEmpIds.map((empId) => {
                            const officer = officersList.find((o) => o.employeeId === empId);
                            return (
                              <span
                                key={empId}
                                className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200"
                              >
                                <span>{empId} - {officer ? officer.name : ''}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleRpSelection(empId)}
                                  className="hover:text-rose-600 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Search input for officers */}
                      <input
                        type="text"
                        placeholder="Filter officers by name or ID..."
                        value={rpSearchQuery}
                        onChange={(e) => setRpSearchQuery(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />

                      {/* Officers Dropdown / Selection List */}
                      <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 flex-1">
                        {filteredRpOfficers.length === 0 ? (
                          <div className="p-2 text-center text-xs text-slate-400">No officers found</div>
                        ) : (
                          filteredRpOfficers.slice(0, 50).map((officer) => {
                            const isSelected = selectedRpEmpIds.includes(officer.employeeId);
                            return (
                              <div
                                key={officer.employeeId}
                                onClick={() => toggleRpSelection(officer.employeeId)}
                                className={`flex items-center justify-between p-1.5 text-xs cursor-pointer transition-colors ${
                                  isSelected ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="rounded text-emerald-600 pointer-events-none"
                                  />
                                  <span className="truncate">
                                    {officer.employeeId} - {officer.name}
                                  </span>
                                </div>
                                {isSelected && <span className="text-[10px] text-emerald-600 font-bold shrink-0">Selected</span>}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* External Resource Persons */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          External Resource Persons (Guest Faculty)
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Dr. A. Sen (Visiting Faculty)..."
                          value={newExternalRpInput}
                          onChange={(e) => setNewExternalRpInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddExternalRp();
                            }
                          }}
                          className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleAddExternalRp}
                          className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 font-semibold rounded-lg text-xs cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                      {newExternalRpList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {newExternalRpList.map((rp, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200"
                            >
                              <span>{rp} (External)</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveExternalRp(idx)}
                                className="hover:text-rose-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50/70 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl font-medium text-xs disabled:opacity-40 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <span>Schedule New CNE</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Part 2 Modals */}
      {/* Modal: CNE Details & Actions (Wide Horizontal Layout) */}
      {selectedDetailCne && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl w-[92vw] max-w-[1440px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 shadow-2xs">
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span>{selectedDetailCne.classId}</span>
                </span>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    (selectedDetailCne.cneType || 'CENTRAL').toUpperCase() === 'CENTRAL'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-teal-50 text-teal-700 border border-teal-200'
                  }`}
                >
                  {(selectedDetailCne.cneType || 'CENTRAL').toUpperCase()} CNE
                </span>

                {selectedDetailCne.status === 'Completed' ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    ✓ Completed
                  </span>
                ) : selectedDetailCne.status === 'Canceled' ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                    Canceled
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Scheduled
                  </span>
                )}

                {selectedDetailCne.isLocked && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Questions Locked
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedDetailCne(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 cursor-pointer transition-colors rounded-lg hover:bg-slate-100"
                title="Close popup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Row 1: Key Metadata Highlights Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CNE ID</span>
                  <div className="font-mono font-bold text-slate-900 text-sm mt-0.5 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedDetailCne.classId}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category / Type</span>
                  <div className="font-bold text-slate-800 text-xs mt-1">
                    {(selectedDetailCne.cneType || 'CENTRAL').toUpperCase()} CNE
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                  <div className="font-bold text-slate-800 text-xs mt-1">
                    {selectedDetailCne.status || 'Scheduled'}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date &amp; Schedule</span>
                  <div className="font-bold text-slate-800 text-xs mt-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{formatCneDateTimeDisplay(selectedDetailCne.date, selectedDetailCne.toDate, selectedDetailCne.time)}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                  <div className="font-bold text-slate-800 text-xs mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{selectedDetailCne.duration || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Comprehensive 3-Column Content Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Column 1: Topic & Scope */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1.5">
                    Topic & Clinical Scope
                  </span>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {selectedDetailCne.topic}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-white text-teal-800 border border-teal-200 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-teal-600" />
                      <span>{selectedDetailCne.area}</span>
                    </span>

                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-white text-slate-700 border border-slate-200 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-500" />
                      <span>{selectedDetailCne.modeOfTeaching || 'Lecture Cum Discussion'}</span>
                    </span>
                  </div>

                  {selectedDetailCne.description ? (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Curriculum & Description</span>
                      <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                        {selectedDetailCne.description}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No syllabus notes provided.</p>
                  )}
                </div>

                {/* Column 2: Resource Persons & Faculty */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1.5">
                    Resource Persons & Faculty
                  </span>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Faculty / Speakers</span>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-800 leading-relaxed flex items-start gap-2">
                      <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        {formatResourcePersonsDisplay({
                          resourcePersonEmpId: selectedDetailCne.resourcePersonEmpId,
                          resourcePersonName: selectedDetailCne.resourcePersonName,
                          externalResourcePersons: selectedDetailCne.externalResourcePersons,
                          officers: officersList
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Capacity</span>
                      <div className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>{selectedDetailCne.maxParticipants || 40} Seats</span>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Proposed By</span>
                      <div className="font-semibold text-slate-800 truncate mt-0.5" title={selectedDetailCne.proposedByName || 'Coordinator'}>
                        {selectedDetailCne.proposedByName || 'Coordinator'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 3: Administration & Remarks */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1.5">
                    Administration & Observations
                  </span>

                  {selectedDetailCne.adminRemarks ? (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Admin Remarks</span>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-700 italic">
                        {selectedDetailCne.adminRemarks}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No administrative remarks logged.</p>
                  )}

                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Portal Readiness</span>
                    <div className="flex flex-col gap-1 text-[11px] text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>QR Attendance token generated</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${selectedDetailCne.isLocked ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        <span>{selectedDetailCne.isLocked ? 'Question bank locked' : 'Question bank active'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Actions Bar at bottom */}
            {(() => {
              const isAuthorized = isCneAuthorized(user, selectedDetailCne.area, selectedDetailCne.cneType);
              const isCompleted = selectedDetailCne.status === 'Completed';
              const isCanceled = selectedDetailCne.status === 'Canceled';
              const canEdit = isAuthorized && !isCompleted && !isCanceled;

              return (
                <div className="px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center gap-2 bg-slate-50/70 shrink-0">
                  {/* Post Test */}
                  {!isCanceled && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedDetailCne;
                        setSelectedDetailCne(null);
                        setActivePostTest({ cneId: target.classId, qrToken: target.qrToken });
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
                    >
                      <Award className="w-4 h-4" />
                      <span>{isCompleted ? 'View Evaluation / Test' : 'Take Post-Test'}</span>
                    </button>
                  )}

                  {/* QR Code */}
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedDetailCne;
                      setSelectedDetailCne(null);
                      setActiveQRCne(target);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                    title="Display or print Post-Test QR code"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>QR Code</span>
                  </button>

                  {/* Materials */}
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedDetailCne;
                      setSelectedDetailCne(null);
                      setActiveReferenceCne(target);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                    title="View or edit reference notes and syllabus"
                  >
                    <BookOpen className="w-4 h-4 text-teal-600" />
                    <span>Materials</span>
                  </button>

                  {/* Edit - only when existing permission/state rules allow it */}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedDetailCne;
                        setSelectedDetailCne(null);
                        handleOpenEditModal(target);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                      title="Edit CNE workshop details"
                    >
                      <Edit3 className="w-4 h-4 text-amber-700" />
                      <span>Edit CNE</span>
                    </button>
                  )}

                  {/* Questions */}
                  {isAuthorized && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedDetailCne;
                        setSelectedDetailCne(null);
                        setActiveQuestionsCne(target);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                      title="Generate AI questions or edit question bank"
                    >
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>Questions</span>
                    </button>
                  )}

                  {/* Roster */}
                  {isAuthorized && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedDetailCne;
                        setSelectedDetailCne(null);
                        setActiveParticipantsCne(target);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                      title="View attendee list, post-test scores, and record attendance"
                    >
                      <Users className="w-4 h-4 text-teal-600" />
                      <span>Roster</span>
                    </button>
                  )}

                  {/* Finalize */}
                  {isAuthorized && !isCompleted && !isCanceled && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedDetailCne;
                        setSelectedDetailCne(null);
                        setActiveFinalizeCne(target);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                      title="Complete and archive CNE into institutional master"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-200" />
                      <span>Finalize</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedDetailCne(null)}
                    className="ml-auto px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Close
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal: Edit CNE (Wide Horizontal Layout) */}
      {editingCne && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl w-[92vw] max-w-[1440px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Edit CNE Workshop
                    </h3>
                    <span className="font-mono text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-700" />
                      <span>ID: {editingCne.classId} (Immutable)</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Update workshop curriculum and resource persons. The CNE ID is permanently immutable.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingCne(null)}
                disabled={isEditSubmitting}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateClassSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Column 1: Classification & Topic */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 border-b border-amber-100 pb-2 flex items-center gap-1.5">
                      <span>1. Topic & Department</span>
                    </h4>

                    {/* CNE Type */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        CNE Category / Type *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => setEditCneType('CENTRAL')}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            editCneType === 'CENTRAL'
                              ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50'
                          }`}
                        >
                          <div className="text-xs">Central CNE</div>
                          <div className="text-[10px] text-slate-500 font-normal">Hospital-wide clinical seminar</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditCneType('DEPARTMENTAL')}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            editCneType === 'DEPARTMENTAL'
                              ? 'bg-teal-50 border-teal-400 text-teal-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs">Departmental CNE</div>
                          <div className="text-[10px] text-slate-500 font-normal">Ward / ICU / Unit-specific</div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Topic Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={editTopic}
                        onChange={(e) => setEditTopic(e.target.value)}
                        placeholder="e.g., Advanced Ventilator Nursing Protocols"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Target Area / Department *
                      </label>
                      <select
                        required
                        value={editArea}
                        onChange={(e) => setEditArea(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-xs"
                      >
                        <option value="">Select Area / Unit</option>
                        {(isAdmin ? areasList : (userAssignedAreas.length > 0 ? userAssignedAreas : areasList)).map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Session Description / Objectives
                      </label>
                      <textarea
                        rows={3}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Clinical objectives, scope, target audience..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Column 2: Date, Time & Logistics */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-100 pb-2 flex items-center gap-1.5">
                      <span>2. Scheduling & Logistics</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                          From Date &amp; Time *
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={editDate}
                          onChange={(e) => handleEditFromDateChange(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                          To Date &amp; Time *
                        </label>
                        <input
                          type="datetime-local"
                          required
                          min={editDate}
                          value={editToDate}
                          onChange={(e) => handleEditToDateChange(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Duration (HH:MM:SS) *
                        </label>
                        <span className="text-[10px] text-amber-700 font-semibold">Auto-calculated • Editable</span>
                      </div>
                      <input
                        type="text"
                        required
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        placeholder="01:30:00"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-xs font-mono"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Calculated from From/To dates. Max 8 hours per calendar day. Format: HH:MM:SS
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Mode of Teaching
                      </label>
                      <input
                        type="text"
                        value={editMode}
                        onChange={(e) => setEditMode(e.target.value)}
                        placeholder="Lecture Cum Discussion"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                          Max Capacity
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={editMaxParticipants}
                          onChange={(e) => setEditMaxParticipants(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                          Admin Remarks
                        </label>
                        <input
                          type="text"
                          value={editAdminRemarks}
                          onChange={(e) => setEditAdminRemarks(e.target.value)}
                          placeholder="Internal notes..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Resource Persons Selection */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 border-b border-teal-100 pb-2 flex items-center justify-between">
                      <span>3. Resource Persons</span>
                      <span className="text-[10px] text-slate-500 font-semibold lowercase">
                        {editSelectedRpEmpIds.length} internal selected
                      </span>
                    </h4>

                    {officersList.length > 0 && (
                      <div className="space-y-2 flex-1 flex flex-col">
                        <span className="text-[11px] font-semibold text-slate-600 block">
                          Internal Staff (AIIMS Faculty):
                        </span>
                        <input
                          type="text"
                          placeholder="Search officer by name or ID..."
                          value={editRpSearchQuery}
                          onChange={(e) => setEditRpSearchQuery(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                        <div className="max-h-28 overflow-y-auto space-y-1 bg-white border border-slate-200 rounded-lg p-2 flex-1">
                          {filteredEditRpOfficers.slice(0, 40).map((o) => {
                            const isSelected = editSelectedRpEmpIds.includes(o.employeeId);
                            return (
                              <div
                                key={o.employeeId}
                                onClick={() => toggleEditRpSelection(o.employeeId)}
                                className={`flex items-center justify-between p-1.5 rounded cursor-pointer text-xs ${
                                  isSelected ? 'bg-amber-50 text-amber-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <span className="truncate">
                                  {o.name} ({o.employeeId})
                                </span>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  readOnly
                                  className="rounded text-amber-600 pointer-events-none"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-600 block">
                        External Resource Persons (Optional):
                      </span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Enter external faculty name"
                          value={editExternalRpInput}
                          onChange={(e) => setEditExternalRpInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddEditExternalRp();
                            }
                          }}
                          className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddEditExternalRp}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                      {editExternalRpList.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {editExternalRpList.map((p, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md"
                            >
                              {p} (Ext)
                              <button
                                type="button"
                                onClick={() => handleRemoveEditExternalRp(idx)}
                                className="text-slate-500 hover:text-rose-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50/70 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingCne(null)}
                  disabled={isEditSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isEditSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {activeReferenceCne && (
        <CNEReferenceModal
          cne={activeReferenceCne}
          isAuthorized={isCneAuthorized(user, activeReferenceCne.area, activeReferenceCne.cneType)}
          onClose={() => setActiveReferenceCne(null)}
          onUpdated={loadData}
        />
      )}

      {activeQuestionsCne && (
        <CNEQuestionsModal
          cne={activeQuestionsCne}
          isAuthorized={isCneAuthorized(user, activeQuestionsCne.area, activeQuestionsCne.cneType)}
          onClose={() => setActiveQuestionsCne(null)}
          onUpdated={loadData}
        />
      )}

      {activeQRCne && (
        <CNEQRModal
          cne={activeQRCne}
          onClose={() => setActiveQRCne(null)}
          onOpenPostTest={(tok) => {
            setActiveQRCne(null);
            setActivePostTest({ qrToken: tok });
          }}
        />
      )}

      {activeParticipantsCne && (
        <CNEParticipantsModal
          cne={activeParticipantsCne}
          isAuthorized={isCneAuthorized(user, activeParticipantsCne.area, activeParticipantsCne.cneType)}
          officersList={officersList}
          onClose={() => setActiveParticipantsCne(null)}
          onUpdated={loadData}
        />
      )}

      {activePostTest && (
        <CNEPostTestModal
          cneId={activePostTest.cneId}
          qrToken={activePostTest.qrToken}
          user={user}
          onClose={() => setActivePostTest(null)}
          onSubmitted={loadData}
          onRequireLogin={() => onRequireLogin && onRequireLogin()}
        />
      )}

      {activeFinalizeCne && (
        <CNEFinalizeModal
          cne={activeFinalizeCne}
          isAuthorized={isCneAuthorized(user, activeFinalizeCne.area, activeFinalizeCne.cneType)}
          onClose={() => setActiveFinalizeCne(null)}
          onCompleted={loadData}
        />
      )}

      {isDeptScheduleOpen && (
        <DepartmentalScheduleModal
          isOpen={isDeptScheduleOpen}
          onClose={() => setIsDeptScheduleOpen(false)}
          user={user}
          areasList={areasList}
          officersList={officersList}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};
