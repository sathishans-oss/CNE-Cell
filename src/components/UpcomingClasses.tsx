import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Edit3,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  ClipboardCheck
} from 'lucide-react';
import { SessionUser, UpcomingClass, CNEActivityProgress } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';
import {
  formatCneDateRangeDisplay,
  formatResourcePersonsDisplay,
  isCneAuthorized,
  canManageCneActions,
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
import { ConfirmDatePicker } from './cne/ConfirmDatePicker';
import { loadOfficersSingleFlight, getCachedOfficers } from '../services/officerLoader';

interface UpcomingClassesProps {
  user: SessionUser | null;
  onRequireLogin?: (cneId?: string) => void;
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
  const [scheduleFromDate, setScheduleFromDate] = useState('');
  const [scheduleFromTime, setScheduleFromTime] = useState('09:00');
  const [scheduleToDate, setScheduleToDate] = useState('');
  const [scheduleToTime, setScheduleToTime] = useState('10:30');
  const [newDuration, setNewDuration] = useState('00:00:00');
  const [selectedRpEmpIds, setSelectedRpEmpIds] = useState<string[]>([]);
  const [rpSearchQuery, setRpSearchQuery] = useState('');
  const [newExternalRpList, setNewExternalRpList] = useState<string[]>([]);
  const [newExternalRpInput, setNewExternalRpInput] = useState('');
  const [newMode, setNewMode] = useState('Lecture Cum Discussion');
  const [newDescription, setNewDescription] = useState('');
  const [newMaxParticipants, setNewMaxParticipants] = useState(40);
  const [areasList, setAreasList] = useState<string[]>([]);
  const [officersList, setOfficersList] = useState<any[]>(() => getCachedOfficers() || []);
  const [isResourcePersonsLoading, setIsResourcePersonsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Part 2 Active Modals
  const [selectedDetailCne, setSelectedDetailCne] = useState<UpcomingClass | null>(null);
  const [activeReferenceCne, setActiveReferenceCne] = useState<UpcomingClass | null>(null);
  const [activeQuestionsCne, setActiveQuestionsCne] = useState<UpcomingClass | null>(null);
  const [activeQRCne, setActiveQRCne] = useState<UpcomingClass | null>(null);
  const [activeParticipantsCne, setActiveParticipantsCne] = useState<UpcomingClass | null>(null);
  const [activeFinalizeCne, setActiveFinalizeCne] = useState<UpcomingClass | null>(null);
  const [activePostTest, setActivePostTest] = useState<{ cneId?: string; qrToken?: string } | null>(null);

  // CNE Activity Progress State
  const [activityProgress, setActivityProgress] = useState<CNEActivityProgress | null>(null);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

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
  const editSubmittingRef = useRef(false);

  const { success, error } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const isAreaIncharge = user?.role === 'AREA_INCHARGE';
  const canScheduleCne = isAdmin || isAreaIncharge;
  const todayStr = new Date().toISOString().split('T')[0];
  const isFromComplete = Boolean(scheduleFromDate && scheduleFromTime);

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

  const fetchActivityProgress = useCallback((cneId: string) => {
    setIsActivityLoading(true);
    setActivityError(null);
    setActivityProgress(null);

    ApiService.getCNEActivityProgress(cneId)
      .then((res) => {
        if (res && res.success && res.data) {
          setActivityProgress(res.data);
          setActivityError(null);
        } else {
          setActivityProgress(null);
          setActivityError(res?.message || 'Unable to load CNE progress');
        }
      })
      .catch((err: any) => {
        setActivityProgress(null);
        setActivityError(err?.message || 'Unable to load CNE progress');
      })
      .finally(() => {
        setIsActivityLoading(false);
      });
  }, []);

  // Fetch real-time CNE Activity Progress whenever a CNE details modal is opened
  useEffect(() => {
    if (!selectedDetailCne?.cneId) {
      setActivityProgress(null);
      setIsActivityLoading(false);
      setActivityError(null);
      return;
    }

    fetchActivityProgress(selectedDetailCne.cneId);
  }, [selectedDetailCne?.cneId, fetchActivityProgress]);

  const loadData = async (): Promise<UpcomingClass[] | undefined> => {
    setLoading(true);
    if (officersList.length === 0) {
      setIsResourcePersonsLoading(true);
    }
    try {
      const [clsRes, areasRes, officers] = await Promise.all([
        ApiService.getUpcomingClasses(),
        ApiService.getAreas(),
        user ? loadOfficersSingleFlight() : Promise.resolve([])
      ]);

      if (clsRes.success && clsRes.data) {
        setClasses(clsRes.data);
      }
      if (areasRes.success && areasRes.data) {
        setAreasList(areasRes.data.filter((a) => a.status === 'ACTIVE').map((a) => a.name));
      }
      if (officers && officers.length > 0) {
        setOfficersList(officers);
      }
      return clsRes.data;
    } catch (e: any) {
      error(e?.message || 'Failed to load CNE schedule.');
    } finally {
      setLoading(false);
      setIsResourcePersonsLoading(false);
    }
  };

  // On-demand fetch of officers when Central CNE Add or Edit modal opens if not yet loaded
  useEffect(() => {
    if ((isAddClassOpen || Boolean(editingCne)) && officersList.length === 0 && !isResourcePersonsLoading) {
      let cancelled = false;
      setIsResourcePersonsLoading(true);
      loadOfficersSingleFlight()
        .then((officers) => {
          if (!cancelled && officers && officers.length > 0) {
            setOfficersList(officers);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) {
            setIsResourcePersonsLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [isAddClassOpen, editingCne, officersList.length, isResourcePersonsLoading]);

  const handleChildModalUpdated = async (targetCneId?: string) => {
    const cneId = targetCneId || selectedDetailCne?.cneId || selectedDetailCne?.classId;
    if (cneId) {
      // Immediately refresh activity progress so checks, readiness counter & progress bar update
      fetchActivityProgress(cneId);
    }
    try {
      const freshClasses = await loadData();
      if (cneId && freshClasses) {
        const fresh = freshClasses.find((c) => (c.cneId || c.classId) === cneId);
        if (fresh) {
          setSelectedDetailCne(fresh);
        }
      }
    } catch (err) {
      console.warn('Failed to refresh CNE modal after child update:', err);
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

  const syncNewDatesAndDuration = (fromDate: string, fromTime: string, toDate: string, toTime: string) => {
    const fullFrom = fromDate && fromTime ? `${fromDate}T${fromTime}` : '';
    const fullTo = toDate && toTime ? `${toDate}T${toTime}` : '';
    setNewDate(fullFrom);
    setNewToDate(fullTo);
    if (fullFrom && fullTo) {
      const dFrom = new Date(fullFrom);
      const dTo = new Date(fullTo);
      if (!isNaN(dFrom.getTime()) && !isNaN(dTo.getTime()) && dTo >= dFrom) {
        const autoDur = calculateCneDuration(fullFrom, fullTo);
        if (autoDur) setNewDuration(autoDur);
      }
    }
  };

  const handleConfirmFromDate = (val: string) => {
    setScheduleFromDate(val);
    let updatedToDate = scheduleToDate;
    let updatedToTime = scheduleToTime;

    // If To Date was already selected but is earlier than the new From Date, bump or sync to new From Date
    if (updatedToDate && updatedToDate < val) {
      updatedToDate = val;
      setScheduleToDate(val);
      if (updatedToTime < scheduleFromTime) {
        updatedToTime = scheduleFromTime;
        setScheduleToTime(scheduleFromTime);
      }
    } else if (updatedToDate === val && updatedToTime < scheduleFromTime) {
      updatedToTime = scheduleFromTime;
      setScheduleToTime(scheduleFromTime);
    }

    syncNewDatesAndDuration(val, scheduleFromTime, updatedToDate, updatedToTime);
  };

  const handleFromTimeChange = (val: string) => {
    setScheduleFromTime(val);
    let updatedToTime = scheduleToTime;

    // If scheduled on same day, To Time must not be earlier than From Time
    if (scheduleToDate === scheduleFromDate && updatedToTime && updatedToTime < val) {
      updatedToTime = val;
      setScheduleToTime(val);
    }

    syncNewDatesAndDuration(scheduleFromDate, val, scheduleToDate, updatedToTime);
  };

  const handleConfirmToDate = (val: string) => {
    setScheduleToDate(val);
    let updatedToTime = scheduleToTime;

    // If To Date equals From Date, ensure To Time is not earlier than From Time
    if (val === scheduleFromDate && updatedToTime && updatedToTime < scheduleFromTime) {
      updatedToTime = scheduleFromTime;
      setScheduleToTime(scheduleFromTime);
    }

    syncNewDatesAndDuration(scheduleFromDate, scheduleFromTime, val, updatedToTime);
  };

  const handleToTimeChange = (val: string) => {
    // If To Date equals From Date, prevent To Time earlier than From Time
    if (scheduleToDate === scheduleFromDate && scheduleFromTime && val && val < scheduleFromTime) {
      error(`To Time cannot be earlier than From Time (${scheduleFromTime}).`);
      setScheduleToTime(scheduleFromTime);
      syncNewDatesAndDuration(scheduleFromDate, scheduleFromTime, scheduleToDate, scheduleFromTime);
      return;
    }

    setScheduleToTime(val);
    syncNewDatesAndDuration(scheduleFromDate, scheduleFromTime, scheduleToDate, val);
  };

  const handleCreateUpcomingClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

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

    submittingRef.current = true;
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
        setScheduleFromDate('');
        setScheduleFromTime('09:00');
        setScheduleToDate('');
        setScheduleToTime('10:30');
        setNewDate('');
        setNewToDate('');
        setNewDuration('00:00:00');
        setSelectedRpEmpIds([]);
        setRpSearchQuery('');
        setNewExternalRpList([]);
        setNewExternalRpInput('');
        setNewMode('Lecture Cum Discussion');
        loadData();
      } else {
        error(res.message || 'Failed to schedule CNE.');
      }
    } catch (err: any) {
      error(err?.message || 'Error creating CNE.');
    } finally {
      submittingRef.current = false;
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
    if (!editingCne || editSubmittingRef.current || isEditSubmitting) return;

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

    editSubmittingRef.current = true;
    setIsEditSubmitting(true);
    try {
      // NOTE: CNE ID is permanently immutable and cannot be changed or overwritten.
      const targetCneId = editingCne.cneId || editingCne.classId || '';
      const res = await ApiService.updateUpcomingClass(targetCneId, {
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
          cneId: targetCneId,
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
          prev.map((c) => (c.cneId === targetCneId ? updatedRecord : c))
        );
        if (selectedDetailCne?.cneId === targetCneId) {
          setSelectedDetailCne(updatedRecord);
        }
        setEditingCne(null);
      } else {
        error(res.message || 'Failed to update CNE workshop.');
      }
    } catch (err: any) {
      error(err?.message || 'Error updating CNE.');
    } finally {
      editSubmittingRef.current = false;
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
      (c.cneId || c.classId || '').toLowerCase().includes(q) ||
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
            {/* Dedicated Departmental Schedule Button (opens batch modal with 1 blank row) */}
            <button
              id="btn-schedule-departmental-cne"
              type="button"
              onClick={() => setIsDeptScheduleOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4 text-teal-200" />
              <span>Departmental CNE</span>
            </button>

            {/* Central CNE Schedule Button (Admin only) */}
            {isAdmin && (
              <button
                id="btn-admin-add-upcoming-class"
                type="button"
                onClick={() => {
                  setNewDuration('00:00:00');
                  setIsAddClassOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>Central CNE</span>
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
            <span className="text-xs font-medium">Loading data</span>
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
                    <th className="py-3.5 px-4 whitespace-nowrap">Type of CNE</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Topic</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Area/Ward</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Date &amp; Time</th>
                    <th className="py-3.5 px-4 min-w-[180px]">Resource Person</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {availableClasses.map((cls) => {
                    const rpDisplay = formatResourcePersonsDisplay({
                      resourcePersonEmpId: cls.resourcePersonEmpId,
                      resourcePersonName: cls.resourcePersonName,
                      externalResourcePersons: cls.externalResourcePersons,
                      officers: officersList
                    });

                    return (
                      <tr
                        key={cls.cneId}
                        onClick={() => setSelectedDetailCne(cls)}
                        className="hover:bg-slate-50/90 cursor-pointer transition-colors group"
                      >
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
                        </td>
                        <td className="py-3 px-4">
                          <div className="line-clamp-2 max-w-[220px] text-slate-600 text-xs leading-relaxed" title={rpDisplay}>
                            {rpDisplay}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                              (cls.status || '').toLowerCase() === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : (cls.status || '').toLowerCase().includes('cancel')
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {(cls.status || '').toLowerCase() === 'completed'
                              ? 'Completed'
                              : (cls.status || '').toLowerCase().includes('cancel')
                              ? 'Canceled'
                              : 'Scheduled'}
                          </span>
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
                    Schedule Central CNE
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
                        Mode of Teaching
                      </label>
                      <select
                        value={newMode}
                        onChange={(e) => setNewMode(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        <option value="Lecture Cum Discussion">Lecture Cum Discussion</option>
                        <option value="Demonstration">Demonstration</option>
                        <option value="Hands-on Training">Hands-on Training</option>
                        <option value="Workshop">Workshop</option>
                        <option value="Case Study Presentation">Case Study Presentation</option>
                        <option value="Simulation">Simulation</option>
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

                    <div className="space-y-3">
                      {/* From Date & Time */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                            From Date &amp; Time *
                          </label>
                          <span className="text-[10px] text-indigo-600 font-medium">Calendar + Time</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                          <div className="sm:col-span-3">
                            <ConfirmDatePicker
                              id="central-cne-from-date"
                              value={scheduleFromDate}
                              onChange={handleConfirmFromDate}
                              minDate={todayStr}
                              placeholder="Select From Date..."
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              type="time"
                              required
                              id="central-cne-from-time"
                              value={scheduleFromTime}
                              onChange={(e) => handleFromTimeChange(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              title="From Time"
                            />
                          </div>
                        </div>
                      </div>

                      {/* To Date & Time */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                            To Date &amp; Time *
                          </label>
                          {!isFromComplete ? (
                            <span className="text-[10px] text-amber-600 font-medium">Select From Date &amp; Time first</span>
                          ) : scheduleToDate === scheduleFromDate ? (
                            <span className="text-[10px] text-indigo-600 font-medium">Same day (Min time: {scheduleFromTime})</span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-medium">Multi-day workshop</span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                          <div className="sm:col-span-3">
                            <ConfirmDatePicker
                              id="central-cne-to-date"
                              value={scheduleToDate}
                              onChange={handleConfirmToDate}
                              minDate={scheduleFromDate || todayStr}
                              disabled={!isFromComplete}
                              placeholder={isFromComplete ? 'Select To Date...' : 'Select From Date first'}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              type="time"
                              required
                              id="central-cne-to-time"
                              disabled={!isFromComplete || !scheduleToDate}
                              min={scheduleToDate === scheduleFromDate ? scheduleFromTime : undefined}
                              value={scheduleToTime}
                              onChange={(e) => handleToTimeChange(e.target.value)}
                              className={`w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                                !isFromComplete || !scheduleToDate
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                                  : ''
                              }`}
                              title={scheduleToDate === scheduleFromDate ? `To Time (Min: ${scheduleFromTime})` : 'To Time'}
                            />
                          </div>
                        </div>
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
                        placeholder="00:00:00"
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
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span>Internal Faculty</span>
                          {isResourcePersonsLoading && (
                            <Loader2 className="w-3 h-3 text-teal-600 animate-spin" />
                          )}
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
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={isResourcePersonsLoading ? "Loading Resource Persons..." : "Filter officers by name or ID..."}
                          disabled={isResourcePersonsLoading}
                          value={rpSearchQuery}
                          onChange={(e) => setRpSearchQuery(e.target.value)}
                          className="w-full p-2 pr-8 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                        />
                        {isResourcePersonsLoading && (
                          <Loader2 className="w-3.5 h-3.5 text-teal-600 animate-spin absolute right-2.5 top-2.5" />
                        )}
                      </div>

                      {/* Officers Dropdown / Selection List */}
                      <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 flex-1">
                        {isResourcePersonsLoading ? (
                          <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                            <span>Loading Resource Persons...</span>
                          </div>
                        ) : filteredRpOfficers.length === 0 ? (
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
                          External Resource Persons
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
              <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-end bg-slate-50/70 shrink-0">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Publishing Schedule...</span>
                    </>
                  ) : (
                    <span>Publish Schedule</span>
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
          <div className="bg-white rounded-2xl w-[92vw] max-w-[1280px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Compact Header: CNE ID • CNE TYPE • STATUS */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80">
              <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base font-bold text-slate-900">
                <span className="font-mono text-slate-800">{selectedDetailCne.cneId}</span>
                <span className="text-slate-400 font-sans">•</span>
                <span className="text-slate-700 uppercase">
                  {(selectedDetailCne.cneType || 'CENTRAL').toUpperCase() === 'CENTRAL' ? 'CENTRAL CNE' : 'DEPARTMENTAL CNE'}
                </span>
                <span className="text-slate-400 font-sans">•</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    selectedDetailCne.status === 'Completed'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : selectedDetailCne.status === 'Canceled'
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {selectedDetailCne.status || 'Scheduled'}
                </span>
                {selectedDetailCne.isLocked && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Questions Locked
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {(() => {
                  const canFinalize = isCneAuthorized(user, selectedDetailCne.area, selectedDetailCne.cneType);
                  const isCompleted = selectedDetailCne.status === 'Completed';
                  const isCanceled = selectedDetailCne.status === 'Canceled';
                  const canEdit = canFinalize && !isCompleted && !isCanceled;

                  if (!canEdit) return null;

                  return (
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenEditModal(selectedDetailCne);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                      title="Edit CNE workshop details"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                      <span>Edit CNE</span>
                    </button>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => setSelectedDetailCne(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 cursor-pointer transition-colors rounded-lg hover:bg-slate-100"
                  title="Close popup"
                  aria-label="Close popup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content Body (Wide Horizontal Landscape Layout) */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Schedule Date & Time Display (Duration is strictly omitted) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span className="text-[11px] uppercase tracking-wider text-slate-500">Schedule:</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 font-semibold text-slate-800">
                  <span>{formatCneDateTimeDisplay(selectedDetailCne.date)}</span>
                  {selectedDetailCne.toDate && selectedDetailCne.toDate !== selectedDetailCne.date && (
                    <>
                      <span className="text-slate-400">to</span>
                      <span>{formatCneDateTimeDisplay(selectedDetailCne.toDate)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* 2-Column Landscape Split: Left = Topic & Faculty, Right = CNE Progress */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column (7 cols): CNE Details */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1.5">
                      Topic &amp; Clinical Scope
                    </span>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {selectedDetailCne.topic}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-white text-teal-800 border border-teal-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-teal-600" />
                        <span>{selectedDetailCne.area}</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-white text-slate-700 border border-slate-200 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-slate-500" />
                        <span>{selectedDetailCne.modeOfTeaching || 'Lecture Cum Discussion'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1.5">
                      Resource Persons &amp; Faculty
                    </span>

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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Max Capacity: ONLY for Central CNE */}
                      {(selectedDetailCne.cneType || 'CENTRAL').toUpperCase() === 'CENTRAL' && (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Max Capacity</span>
                          <div className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            <span>{selectedDetailCne.maxParticipants || 40} Seats</span>
                          </div>
                        </div>
                      )}

                      <div className={`bg-white p-2.5 rounded-lg border border-slate-200 ${(selectedDetailCne.cneType || 'CENTRAL').toUpperCase() !== 'CENTRAL' ? 'sm:col-span-2' : ''}`}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description</span>
                        <div className="text-slate-800 text-xs mt-0.5 leading-relaxed break-words" title={selectedDetailCne.description || 'No description provided'}>
                          {selectedDetailCne.description || 'No description provided'}
                        </div>
                      </div>
                    </div>

                    {selectedDetailCne.adminRemarks && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Admin Remarks</span>
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-700 italic">
                          {selectedDetailCne.adminRemarks}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column (5 cols): CNE Progress (Live Visual Status Tracker) */}
                <div className="lg:col-span-5 flex flex-col">
                  <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 h-full flex flex-col justify-between">
                    {/* Header with Title and Dynamic "X of 6 Ready" */}
                    {(() => {
                      const isMaterialReady = activityProgress?.materialStatus === 'Added';
                      const isQuestionsReady = activityProgress?.questionsStatus === 'Generated';
                      const isQrReady = activityProgress?.qrStatus === 'Generated';
                      const isParticipantsReady = (activityProgress?.participantsCount || 0) > 0;
                      const isPostTestReady = activityProgress?.postTestStatus === 'Available' || activityProgress?.postTestStatus === 'Completed';
                      const isFinalizationReady = activityProgress?.finalizationStatus === 'Finalized';

                      const readyCount = activityProgress
                        ? (isMaterialReady ? 1 : 0) +
                          (isQuestionsReady ? 1 : 0) +
                          (isQrReady ? 1 : 0) +
                          (isParticipantsReady ? 1 : 0) +
                          (isPostTestReady ? 1 : 0) +
                          (isFinalizationReady ? 1 : 0)
                        : 0;

                      const readyPercentage = Math.round((readyCount / 6) * 100);

                      return (
                        <>
                          <div className="border-b border-slate-200 pb-2.5 mb-3 flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                  CNE Progress
                                </span>
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live status" />
                              </div>
                              <span className="text-[10px] text-slate-500">Live readiness status</span>
                            </div>

                            {activityProgress && !isActivityLoading && (
                              <div
                                className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-2xs ${
                                  readyCount === 6
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : readyCount >= 4
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : readyCount >= 2
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {readyCount === 6 ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                ) : readyCount === 0 ? (
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                                )}
                                <span className="whitespace-nowrap">{readyCount} of 6 Ready</span>
                              </div>
                            )}
                          </div>

                          {isActivityLoading ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-3">
                              <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
                              <div className="text-xs font-medium text-slate-500">
                                Loading CNE progress...
                              </div>
                            </div>
                          ) : activityProgress ? (
                            <div className="flex-1 flex flex-col justify-between space-y-3">
                              {/* 2-Row Diagrammatic Stage Tracker */}
                              <div className="space-y-2">
                                 {/* Stage 1: Proposal (Material, Questions, QR Code) */}
                                <div className="grid grid-cols-3 gap-2">
                                  {/* 1. Material */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveReferenceCne(selectedDetailCne);
                                    }}
                                    title={isMaterialReady ? "Material ready • Click to view or upload material" : "Material attention required • Click to upload material"}
                                    aria-label={isMaterialReady ? "Material completed. Click to view or upload material" : "Material attention required. Click to upload material"}
                                    className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between min-h-[66px] text-left cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-[0.98] ${
                                      isMaterialReady
                                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-2xs'
                                        : 'bg-rose-50/80 border-rose-200 text-rose-950 shadow-2xs'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <BookOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <span>Material</span>
                                      </span>
                                    </div>
                                    <div className="mt-auto flex items-center justify-between">
                                      {isMaterialReady ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" aria-label="Completed" />
                                      ) : (
                                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-label="Attention required" />
                                      )}
                                    </div>
                                  </button>

                                  {/* 2. Questions */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveQuestionsCne(selectedDetailCne);
                                    }}
                                    title={isQuestionsReady ? "Questions ready • Click to view or edit questions" : "Questions attention required • Click to generate questions"}
                                    aria-label={isQuestionsReady ? "Questions completed. Click to view or edit questions" : "Questions attention required. Click to generate questions"}
                                    className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between min-h-[66px] text-left cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-[0.98] ${
                                      isQuestionsReady
                                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-2xs'
                                        : 'bg-rose-50/80 border-rose-200 text-rose-950 shadow-2xs'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <span>Questions</span>
                                      </span>
                                    </div>
                                    <div className="mt-auto flex items-center justify-between">
                                      {isQuestionsReady ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" aria-label="Completed" />
                                      ) : (
                                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-label="Attention required" />
                                      )}
                                    </div>
                                  </button>

                                  {/* 3. QR Code */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveQRCne(selectedDetailCne);
                                    }}
                                    title={isQrReady ? "QR Code ready • Click to view or print QR code" : "QR Code attention required • Click to generate QR code"}
                                    aria-label={isQrReady ? "QR Code completed. Click to view or print QR code" : "QR Code attention required. Click to generate QR code"}
                                    className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between min-h-[66px] text-left cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-[0.98] ${
                                      isQrReady
                                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-2xs'
                                        : 'bg-rose-50/80 border-rose-200 text-rose-950 shadow-2xs'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <QrCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <span>QR Code</span>
                                      </span>
                                    </div>
                                    <div className="mt-auto flex items-center justify-between">
                                      {isQrReady ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" aria-label="Completed" />
                                      ) : (
                                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-label="Attention required" />
                                      )}
                                    </div>
                                  </button>
                                </div>

                                {/* Subtle Connecting Track / Stage Bridge */}
                                <div className="relative flex items-center justify-center py-1">
                                  <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-dashed border-slate-300" />
                                  </div>
                                  <div className="relative bg-white px-2.5 py-0.5 rounded-full text-[9px] font-bold text-slate-500 border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                    <span>Proposal ➔ Completion</span>
                                  </div>
                                </div>

                                {/* Stage 2: Completion (Post Test, Participants, Finalization) */}
                                <div className="grid grid-cols-3 gap-2">
                                  {/* 4. Post Test */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePostTest({ cneId: selectedDetailCne.cneId, qrToken: selectedDetailCne.qrToken });
                                    }}
                                    title={isPostTestReady ? "Post Test ready • Click to view or take evaluation test" : "Post Test attention required • Click to configure post test"}
                                    aria-label={isPostTestReady ? "Post Test ready. Click to view or take test" : "Post Test attention required. Click to configure"}
                                    className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between min-h-[66px] text-left cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-[0.98] ${
                                      isPostTestReady
                                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-2xs'
                                        : 'bg-rose-50/80 border-rose-200 text-rose-950 shadow-2xs'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <ClipboardCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <span>Post Test</span>
                                      </span>
                                    </div>
                                    <div className="mt-auto flex items-center justify-between">
                                      {isPostTestReady ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" aria-label="Completed" />
                                      ) : (
                                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-label="Attention required" />
                                      )}
                                    </div>
                                  </button>

                                  {/* 5. Participants */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveParticipantsCne(selectedDetailCne);
                                    }}
                                    title={isParticipantsReady ? `${activityProgress.participantsCount} participants registered • Click to view participants and attendance` : "0 participants registered • Click to view participants"}
                                    aria-label={isParticipantsReady ? `${activityProgress.participantsCount} participants registered. Click to view` : "Attention required: 0 participants registered. Click to view"}
                                    className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between min-h-[66px] text-left cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-[0.98] ${
                                      isParticipantsReady
                                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-2xs'
                                        : 'bg-rose-50/80 border-rose-200 text-rose-950 shadow-2xs'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <span>Participants</span>
                                      </span>
                                    </div>
                                    <div className="mt-auto flex items-center justify-between">
                                      {isParticipantsReady ? (
                                        <div className="flex items-center gap-1.5">
                                          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" aria-label="Completed" />
                                          <span className="font-mono text-xs font-bold text-slate-800">
                                            ({activityProgress.participantsCount})
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-label="Attention required" />
                                          <span className="font-mono text-xs font-bold text-slate-600">(0)</span>
                                        </div>
                                      )}
                                    </div>
                                  </button>

                                  {/* 6. Finalization */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveFinalizeCne(selectedDetailCne);
                                    }}
                                    title={isFinalizationReady ? "CNE Finalized • Click to view final record" : "CNE not finalized • Click to finalize CNE"}
                                    aria-label={isFinalizationReady ? "Finalization completed. Click to view record" : "Finalization attention required. Click to finalize CNE"}
                                    className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between min-h-[66px] text-left cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-[0.98] ${
                                      isFinalizationReady
                                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-2xs'
                                        : 'bg-rose-50/80 border-rose-200 text-rose-950 shadow-2xs'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <span>Finalization</span>
                                      </span>
                                    </div>
                                    <div className="mt-auto flex items-center justify-between">
                                      {isFinalizationReady ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" aria-label="Completed" />
                                      ) : (
                                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-label="Attention required" />
                                      )}
                                    </div>
                                  </button>
                                </div>
                              </div>

                              {/* Progress Bar & Percentage */}
                              <div className="pt-3 border-t border-slate-200/90 mt-auto space-y-1.5">
                                <div className="flex items-center justify-end text-xs">
                                  <span
                                    className={`font-extrabold text-xs ${
                                      readyPercentage >= 80
                                        ? 'text-emerald-700'
                                        : readyPercentage >= 40
                                        ? 'text-amber-700'
                                        : 'text-rose-700'
                                    }`}
                                  >
                                    {readyPercentage}% READY
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      readyPercentage >= 80
                                        ? 'bg-emerald-500'
                                        : readyPercentage >= 40
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${readyPercentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center space-y-2 text-slate-400">
                              <AlertTriangle className="w-6 h-6 text-amber-500" />
                              <p className="text-xs text-slate-600 font-medium">
                                {activityError || 'Unable to load CNE progress'}
                              </p>
                              {selectedDetailCne?.cneId && (
                                <button
                                  type="button"
                                  onClick={() => fetchActivityProgress(selectedDetailCne.cneId)}
                                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Retry</span>
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit CNE (Wide Horizontal Layout) */}
      {editingCne && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
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
                      <span>CNE ID: {editingCne.cneId} (Immutable)</span>
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

                    {/* CNE Category / Type (Read-only during edit) */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        CNE Category / Type
                      </label>
                      <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            {editCneType === 'CENTRAL' ? 'Central CNE' : 'Departmental CNE'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {editCneType === 'CENTRAL' ? 'Hospital-wide clinical seminar' : 'Ward / ICU / Unit-specific'}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
                          Read-only
                        </span>
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

                    {/* Max Capacity: ONLY for Central CNE */}
                    {editCneType === 'CENTRAL' ? (
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
                    ) : (
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
                    )}
                  </div>

                  {/* Column 3: Resource Persons Selection */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 border-b border-teal-100 pb-2 flex items-center justify-between">
                      <span>3. Resource Persons</span>
                      <span className="text-[10px] text-slate-500 font-semibold lowercase">
                        {editSelectedRpEmpIds.length} internal selected
                      </span>
                    </h4>

                    <div className="space-y-2 flex-1 flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                        <span>Internal Faculty:</span>
                        {isResourcePersonsLoading && (
                          <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                        )}
                      </span>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={isResourcePersonsLoading ? "Loading Resource Persons..." : "Search officer by name or ID..."}
                          disabled={isResourcePersonsLoading}
                          value={editRpSearchQuery}
                          onChange={(e) => setEditRpSearchQuery(e.target.value)}
                          className="w-full px-2.5 py-1.5 pr-8 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                        />
                        {isResourcePersonsLoading && (
                          <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin absolute right-2.5 top-2" />
                        )}
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-1 bg-white border border-slate-200 rounded-lg p-2 flex-1">
                        {isResourcePersonsLoading ? (
                          <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                            <span>Loading Resource Persons...</span>
                          </div>
                        ) : filteredEditRpOfficers.length === 0 ? (
                          <div className="p-2 text-center text-xs text-slate-400">No officers found</div>
                        ) : (
                          filteredEditRpOfficers.slice(0, 40).map((o) => {
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
                          })
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-600 block">
                        External Resource Persons:
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
              <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-end bg-slate-50/70 shrink-0">
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
          onUpdated={() => handleChildModalUpdated(activeReferenceCne.cneId || activeReferenceCne.classId)}
        />
      )}

      {activeQuestionsCne && (
        <CNEQuestionsModal
          cne={activeQuestionsCne}
          isAuthorized={isCneAuthorized(user, activeQuestionsCne.area, activeQuestionsCne.cneType)}
          onClose={() => setActiveQuestionsCne(null)}
          onUpdated={() => handleChildModalUpdated(activeQuestionsCne.cneId || activeQuestionsCne.classId)}
        />
      )}

      {activeQRCne && (
        <CNEQRModal
          cne={activeQRCne}
          onClose={() => {
            const targetId = activeQRCne.cneId || activeQRCne.classId;
            setActiveQRCne(null);
            handleChildModalUpdated(targetId);
          }}
          onOpenPostTest={(tok) => {
            const targetId = activeQRCne.cneId || activeQRCne.classId;
            setActiveQRCne(null);
            setActivePostTest({ cneId: targetId, qrToken: tok });
          }}
        />
      )}

      {activeParticipantsCne && (
        <CNEParticipantsModal
          cne={activeParticipantsCne}
          isAuthorized={isCneAuthorized(user, activeParticipantsCne.area, activeParticipantsCne.cneType)}
          officersList={officersList}
          onClose={() => setActiveParticipantsCne(null)}
          onUpdated={() => handleChildModalUpdated(activeParticipantsCne.cneId || activeParticipantsCne.classId)}
        />
      )}

      {activePostTest && (
        <CNEPostTestModal
          cneId={activePostTest.cneId}
          qrToken={activePostTest.qrToken}
          user={user}
          onClose={() => setActivePostTest(null)}
          onSubmitted={() => handleChildModalUpdated(activePostTest.cneId)}
          onRequireLogin={() => onRequireLogin && onRequireLogin()}
        />
      )}

      {activeFinalizeCne && (
        <CNEFinalizeModal
          cne={activeFinalizeCne}
          isAuthorized={isCneAuthorized(user, activeFinalizeCne.area, activeFinalizeCne.cneType)}
          onClose={() => setActiveFinalizeCne(null)}
          onCompleted={() => handleChildModalUpdated(activeFinalizeCne.cneId || activeFinalizeCne.classId)}
        />
      )}

      {isDeptScheduleOpen && (
        <DepartmentalScheduleModal
          isOpen={isDeptScheduleOpen}
          onClose={() => setIsDeptScheduleOpen(false)}
          user={user}
          areasList={areasList}
          officersList={officersList}
          isOfficersLoading={isResourcePersonsLoading}
          onOfficersLoaded={(fresh) => setOfficersList(fresh)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};
