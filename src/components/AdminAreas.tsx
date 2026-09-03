import React, { useState, useEffect } from 'react';
import {
  MapPin,
  PlusCircle,
  Search,
  Edit2,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  AlertCircle
} from 'lucide-react';
import { Area, SessionUser } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface AdminAreasProps {
  user: SessionUser;
}

export const AdminAreas: React.FC<AdminAreasProps> = () => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Add Area Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Area Inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const { success, error } = useToast();

  useEffect(() => {
    loadAreas();
  }, []);

  const loadAreas = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getAreas();
      if (res.success && res.data) {
        setAreas(res.data);
      }
    } catch (e: any) {
      error('Failed to load areas.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await ApiService.addArea(newAreaName.trim());
      if (res.success && res.data) {
        success(`Area "${newAreaName.trim()}" added successfully.`, 'Area Added');
        setAreas((prev) => [...prev, res.data!]);
        setIsAddOpen(false);
        setNewAreaName('');
      } else {
        error(res.message || 'Failed to add area.');
      }
    } catch (err: any) {
      error(err?.message || 'Error adding area.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (area: Area) => {
    const newStatus = area.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await ApiService.updateArea(area.name, area.name, newStatus);
      if (res.success) {
        success(`Area marked as ${newStatus}.`, 'Status Updated');
        setAreas((prev) =>
          prev.map((a) => (a.id === area.id ? { ...a, status: newStatus } : a))
        );
      }
    } catch (err: any) {
      error('Error updating area status.');
    }
  };

  const handleSaveEdit = async (area: Area) => {
    if (!editName.trim()) return;
    try {
      const res = await ApiService.updateArea(area.name, editName.trim(), area.status);
      if (res.success) {
        success('Area name updated successfully.', 'Area Updated');
        setAreas((prev) =>
          prev.map((a) => (a.id === area.id ? { ...a, name: editName.trim() } : a))
        );
        setEditingId(null);
      }
    } catch (err: any) {
      error('Error updating area name.');
    }
  };

  const filteredAreas = areas.filter((a) => {
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    if (searchTerm.trim() && !(a.name || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Area Master Management</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800">
              Total Areas: {areas.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage hospital departments, wards, OT complexes, ICUs, and outpatient training areas.
          </p>
        </div>

        <button
          id="btn-admin-add-area"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <span>Add New Area</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search ward or clinical area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 w-full sm:w-auto">
          <span>Filter Status:</span>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg ${statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg ${statusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            Active Only
          </button>
          <button
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-3 py-1.5 rounded-lg ${statusFilter === 'INACTIVE' ? 'bg-rose-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Areas Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading areas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4 w-16 text-center">Sr.</th>
                  <th className="py-3 px-4">Ward / Area Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAreas.map((area, index) => {
                  const isEditing = editingId === area.id;

                  return (
                    <tr key={area.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-center font-medium text-slate-500">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="px-2 py-1 border border-slate-300 rounded text-xs w-full max-w-sm"
                            />
                            <button
                              onClick={() => handleSaveEdit(area)}
                              className="p-1 text-emerald-700 hover:bg-emerald-100 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-200 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span>{area.name}</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            area.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {area.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingId(area.id);
                              setEditName(area.name);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                            title="Edit area name"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(area)}
                            className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                              area.status === 'ACTIVE'
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                          >
                            {area.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Clinical Area</h3>
                <p className="text-xs text-slate-500">Adds area to master dropdown choices</p>
              </div>
            </div>

            <form onSubmit={handleAddArea} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Area / Ward Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 248A(IPD)-(Vascular Surgery)"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
