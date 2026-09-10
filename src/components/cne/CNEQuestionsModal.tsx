import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Plus,
  Trash2,
  Lock,
  CheckCircle2,
  Loader2,
  Save,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  Edit3,
  FileWarning,
  CheckCheck,
  BookOpen,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { UpcomingClass, CNEQuestion, CNEAiQuotaInfo } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';

interface CNEQuestionsModalProps {
  cne: UpcomingClass;
  isAuthorized: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const CNEQuestionsModal: React.FC<CNEQuestionsModalProps> = ({
  cne,
  isAuthorized,
  onClose,
  onUpdated
}) => {
  const cneId = cne.cneId || cne.classId || '';
  const [questions, setQuestions] = useState<CNEQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Authoritative AI Quota & Material State
  const [quotaInfo, setQuotaInfo] = useState<CNEAiQuotaInfo | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [hasMaterial, setHasMaterial] = useState<boolean | null>(null);

  const { success, error, warning } = useToast();

  useEffect(() => {
    loadQuestions();
    loadQuotaAndMaterial();
  }, [cneId]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getCNEQuestions(cneId);
      if (res.success && res.data) {
        setQuestions(res.data);
        const locked = res.data.some((q) => q.isLocked);
        setIsLocked(locked);
      }
    } catch (e: any) {
      console.warn('Failed to load CNE questions:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadQuotaAndMaterial = async () => {
    setLoadingQuota(true);
    try {
      const [quotaRes, refRes] = await Promise.all([
        ApiService.getAiQuota(cneId),
        ApiService.getReferenceMaterial(cneId)
      ]);

      if (quotaRes.success && quotaRes.data) {
        setQuotaInfo(quotaRes.data);
      }

      const materialText = (refRes.data?.unifiedContent || refRes.data?.referenceText || '').trim();
      setHasMaterial(materialText.length >= 15);
    } catch (e) {
      console.warn('Failed to load AI quota or reference material:', e);
    } finally {
      setLoadingQuota(false);
    }
  };

  // Is the one-time initial AI generation already completed?
  const isAiGenerationUsed = Boolean(
    quotaInfo && (quotaInfo.status === 'USED' || quotaInfo.attemptsUsed >= 1)
  );

  const handleGenerateAi = async () => {
    if (isGenerating || isLocked || !isAuthorized) return;

    // 1. One-time allowance check
    if (isAiGenerationUsed) {
      error('AI question generation has already been completed for this CNE. The one-time allowance is used.');
      return;
    }

    // 2. Material-First Rule: Material grounding check
    const refRes = await ApiService.getReferenceMaterial(cneId);
    const materialText = (refRes.data?.unifiedContent || refRes.data?.referenceText || '').trim();

    if (!materialText || materialText.length < 15) {
      setHasMaterial(false);
      error('CNE Class Content / Learning Material is required before generating AI questions. Please enter and save learning material first.');
      return;
    }
    setHasMaterial(true);

    setIsGenerating(true);
    try {
      // 3. Atomically Reserve Quota attempt with Apps Script LockService
      const reserveRes = await ApiService.reserveAiQuota(cneId);
      if (!reserveRes.success || !reserveRes.data?.reservationToken) {
        error(reserveRes.message || 'Failed to reserve AI generation allowance.');
        if (reserveRes.data) {
          setQuotaInfo(reserveRes.data);
        }
        return;
      }

      const reservationToken = reserveRes.data.reservationToken;

      // 4. Generate EXACTLY 5 MCQs via Gemini 2.5 Flash on Express backend
      let aiRes: any;
      try {
        aiRes = await ApiService.generateAiQuestions({
          cneId: cneId,
          topic: cne.topic,
          cneMaterial: materialText,
          reservationToken: reservationToken
        });
      } catch (genErr: any) {
        // Exception during Gemini generation: release reservation so allowance is not consumed
        try {
          await ApiService.releaseAiQuota(cneId, reservationToken);
        } catch (rErr) {}
        error('AI question generation failed. No AI generation allowance was consumed.');
        return;
      }

      // Exact 5 MCQs validation
      if (!aiRes || !aiRes.success || !aiRes.data || !Array.isArray(aiRes.data) || aiRes.data.length !== 5) {
        try {
          await ApiService.releaseAiQuota(cneId, reservationToken);
        } catch (rErr) {}
        error(aiRes?.message || 'AI question generation failed: Expected exactly 5 complete MCQs. Allowance was not consumed.');
        return;
      }

      // 5. Commit Quota and save questions atomically
      const commitRes = await ApiService.commitAiQuota(cneId, reservationToken, aiRes.data);

      if (commitRes && commitRes.success && commitRes.data) {
        setQuotaInfo(commitRes.data);
        setQuestions(aiRes.data);
        success(
          'Successfully generated and saved exactly 5 clinical MCQs via AI. One-time generation completed and post-test is ready.'
        );
        if (onUpdated) onUpdated();
      } else {
        error(
          commitRes?.message ||
          'AI questions were generated, but saving to Google Sheets could not be verified. Please retry or contact administrator.'
        );
        // Refresh quota from server
        try {
          const freshQuota = await ApiService.getAiQuota(cneId);
          if (freshQuota.success && freshQuota.data) {
            setQuotaInfo(freshQuota.data);
          }
        } catch (qErr) {}
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred during AI question generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalizeAll = () => {
    if (isLocked || !isAuthorized) return;
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.status === 'INACTIVE' || q.status === 'REPLACED') return q;
        return { ...q, isFinalized: true };
      })
    );
    success('All active questions marked as Finalized.');
  };

  const handleAddManualQuestion = () => {
    if (isLocked || !isAuthorized) return;
    const newQ: CNEQuestion = {
      id: `q_manual_${Date.now()}`,
      question: '',
      options: {
        A: '',
        B: '',
        C: '',
        D: ''
      },
      correctOption: 'A',
      explanation: '',
      authoritativeSource: 'Clinical Nursing Protocol / INC Standards',
      status: 'ACTIVE',
      isFinalized: true
    };
    setQuestions((prev) => [...prev, newQ]);
    setEditingIndex(questions.length);
  };

  const handleReplaceQuestion = (idx: number) => {
    if (isLocked || !isAuthorized) return;
    const targetQ = questions[idx];
    if (!targetQ) return;

    // Mark current question as REPLACED and add a new replacement question
    const replacementQ: CNEQuestion = {
      id: `q_rep_${Date.now()}`,
      question: '',
      options: {
        A: '',
        B: '',
        C: '',
        D: ''
      },
      correctOption: 'A',
      explanation: '',
      authoritativeSource: targetQ.authoritativeSource || 'Clinical Nursing Protocol / INC Standards',
      status: 'ACTIVE',
      isFinalized: true
    };

    setQuestions((prev) => {
      const copy = [...prev];
      // Mark old question as REPLACED
      copy[idx] = { ...copy[idx], status: 'REPLACED', isFinalized: false };
      // Insert replacement question immediately after it
      copy.splice(idx + 1, 0, replacementQ);
      return copy;
    });

    setEditingIndex(idx + 1);
    success('Previous question preserved in history as Replaced. Please configure replacement question.');
  };

  const handleUpdateQuestion = (idx: number, updated: Partial<CNEQuestion>) => {
    if (isLocked || !isAuthorized) return;
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updated };
      return copy;
    });
  };

  const handleOptionChange = (idx: number, optKey: 'A' | 'B' | 'C' | 'D', value: string) => {
    if (isLocked || !isAuthorized) return;
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        options: {
          ...copy[idx].options,
          [optKey]: value
        }
      };
      return copy;
    });
  };

  const handleDeleteQuestion = (idx: number) => {
    if (isLocked || !isAuthorized) return;
    // Mark as REPLACED/INACTIVE to preserve question history
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], status: 'REPLACED', isFinalized: false };
      return copy;
    });
    if (editingIndex === idx) setEditingIndex(null);
    warning('Question marked as Replaced/Inactive in history.');
  };

  const handleToggleFinalized = (idx: number) => {
    if (isLocked || !isAuthorized) return;
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], isFinalized: !copy[idx].isFinalized };
      return copy;
    });
  };

  const handleSaveQuestions = async () => {
    if (isSaving || isLocked || !isAuthorized) return;

    const activeQuestions = questions.filter(
      (q) => q.status !== 'INACTIVE' && q.status !== 'REPLACED'
    );

    if (activeQuestions.length < 5) {
      error(`A minimum of 5 active questions is required. Currently active: ${activeQuestions.length}`);
      return;
    }

    // Validate that all active questions are complete
    for (let i = 0; i < activeQuestions.length; i++) {
      const q = activeQuestions[i];
      if (!q.question.trim() || q.question.trim().length < 8) {
        error(`Active Question #${i + 1} has insufficient text (minimum 8 characters).`);
        return;
      }
      if (
        !q.options.A.trim() ||
        !q.options.B.trim() ||
        !q.options.C.trim() ||
        !q.options.D.trim()
      ) {
        error(`Active Question #${i + 1} must have all 4 options (A, B, C, D) filled.`);
        return;
      }
      if (!q.explanation || q.explanation.trim().length < 5) {
        error(`Active Question #${i + 1} requires a clinical explanation / rationale.`);
        return;
      }
      if (!q.authoritativeSource || q.authoritativeSource.trim().length < 3) {
        q.authoritativeSource = 'Clinical Nursing Protocol / INC Standards';
      }
    }

    setIsSaving(true);
    try {
      const res = await ApiService.saveCNEQuestions({
        cneId: cneId,
        questions: questions
      });

      if (res.success) {
        success(`Saved question set (${activeQuestions.length} active questions). Post-test is ready.`);
        if (onUpdated) onUpdated();
        onClose();
      } else {
        error(res.message || 'Failed to save question bank.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while saving questions.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeQuestions = questions.filter(
    (q) => q.status !== 'INACTIVE' && q.status !== 'REPLACED'
  );
  const replacedQuestions = questions.filter(
    (q) => q.status === 'INACTIVE' || q.status === 'REPLACED'
  );
  const activeFinalizedCount = activeQuestions.filter((q) => q.isFinalized).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[94vw] max-w-[1440px] max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                  Post-Test Question Bank
                </span>
                {isLocked ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                    <Lock className="w-2.5 h-2.5" />
                    Locked (Submissions Received)
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeFinalizedCount >= 5
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {activeFinalizedCount} of {activeQuestions.length} Active Finalized (Min 5)
                  </span>
                )}

                {/* Authoritative AI Quota Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    isAiGenerationUsed
                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                      : 'bg-purple-50 text-purple-700 border-purple-200'
                  }`}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  AI Generation: {isAiGenerationUsed ? 'GENERATED / USED' : 'NOT GENERATED'}
                </span>

                <span className="text-[11px] font-mono text-slate-400">
                  ({cneId})
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 truncate max-w-2xl">
                {cne.topic} &mdash; Clinical Evaluation &amp; Assessment Setup
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving || isGenerating}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 disabled:opacity-40 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Missing Material Inline Alert */}
        {hasMaterial === false && !isLocked && isAuthorized && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900 shrink-0">
            <div className="flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Learning Material Missing:</strong> CNE Class Content must be entered and saved in the Reference Material modal before AI questions can be generated.
              </span>
            </div>
          </div>
        )}

        {/* AI & Manual Action Bar */}
        {!isLocked && isAuthorized && (
          <div className="px-6 py-2.5 bg-purple-50/50 border-b border-purple-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-purple-950 font-medium">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>AI Question Synthesizer:</span>
              <span className="text-purple-700 text-[11px]">
                {isAiGenerationUsed
                  ? 'One-time initial AI generation completed. Use manual Add/Replace to adjust questions.'
                  : 'Generates exactly 5 standardized clinical MCQs strictly from saved CNE learning material (one-time allowance)'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeQuestions.length > 0 && activeFinalizedCount < activeQuestions.length && (
                <button
                  type="button"
                  onClick={handleFinalizeAll}
                  disabled={isGenerating || isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-lg font-bold text-xs cursor-pointer shadow-xs transition-colors"
                  title="Include all draft questions in post-test"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Finalize All ({activeQuestions.length - activeFinalizedCount} Drafts)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleGenerateAi}
                disabled={isGenerating || isSaving || isAiGenerationUsed || hasMaterial === false}
                title={
                  isAiGenerationUsed
                    ? 'Initial AI generation already completed for this CNE (one-time allowance)'
                    : hasMaterial === false
                    ? 'Please enter CNE Class Content first'
                    : 'Generate exactly 5 clinical MCQs from learning material'
                }
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-xs transition-colors ${
                  isAiGenerationUsed
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                    : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer disabled:opacity-50'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing 5 MCQs...</span>
                  </>
                ) : isAiGenerationUsed ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>AI Generation Completed (Used)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Generate 5 MCQs</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleAddManualQuestion}
                disabled={isGenerating || isSaving}
                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-bold text-xs cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-purple-600" />
                <span>+ Add Manual Question</span>
              </button>
            </div>
          </div>
        )}

        {isLocked && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-900 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Question Bank is Locked:</strong> Participants have already submitted post-test responses. Questions, options, and answer keys are permanently immutable to preserve evaluation integrity.
            </span>
          </div>
        )}

        {/* Question List Content - 2-Column Wide Grid on Desktop */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/40 text-xs">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <span>Loading questions...</span>
            </div>
          ) : activeQuestions.length === 0 && replacedQuestions.length === 0 ? (
            <div className="py-16 text-center p-8 bg-white rounded-2xl border border-dashed border-slate-300 space-y-3 max-w-xl mx-auto my-8">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">No Post-Test Questions Configured</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Save CNE Class Content in the Reference Material modal and click <strong>Auto-Generate 5 MCQs</strong> to synthesize evidence-based questions, or click <strong>+ Add Manual Question</strong> to craft custom assessment items.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Questions Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                {questions.map((q, idx) => {
                  if (q.status === 'INACTIVE' || q.status === 'REPLACED') return null;
                  const isEditing = editingIndex === idx;

                  return (
                    <div
                      key={q.id || idx}
                      className={`p-4 rounded-xl border transition-all ${
                        q.isFinalized
                          ? 'border-purple-200 bg-white shadow-xs'
                          : 'border-amber-200 bg-amber-50/30 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                            {idx + 1}
                          </span>
                          {q.isFinalized ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Active in Post-Test
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              Draft (Review Required)
                            </span>
                          )}

                          {q.authoritativeSource && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 max-w-[220px] truncate" title={`Source: ${q.authoritativeSource}`}>
                              <BookOpen className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                              <span className="truncate">{q.authoritativeSource}</span>
                            </span>
                          )}
                        </div>

                        {!isLocked && isAuthorized && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleFinalized(idx)}
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                                q.isFinalized
                                  ? 'text-slate-600 hover:bg-slate-100'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {q.isFinalized ? 'Revert to Draft' : 'Mark Finalized'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleReplaceQuestion(idx)}
                              className="px-2 py-0.5 text-[11px] font-medium text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-md cursor-pointer"
                              title="Replace this question manually"
                            >
                              Replace
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingIndex(isEditing ? null : idx)}
                              className="p-1 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-md cursor-pointer"
                              title="Edit Question"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                              title="Mark as Replaced"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Question Text & Options */}
                      {isEditing && !isLocked ? (
                        <div className="space-y-3 mt-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Question Stem:
                            </label>
                            <textarea
                              rows={2}
                              value={q.question}
                              onChange={(e) => handleUpdateQuestion(idx, { question: e.target.value })}
                              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(['A', 'B', 'C', 'D'] as const).map((optKey) => (
                              <div key={optKey} className="flex items-center gap-2">
                                <span className="font-bold text-slate-700 w-4">{optKey}:</span>
                                <input
                                  type="text"
                                  value={q.options[optKey]}
                                  onChange={(e) => handleOptionChange(idx, optKey, e.target.value)}
                                  className="flex-1 p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center gap-3 pt-1">
                            <label className="text-[11px] font-bold text-slate-700">Correct Option:</label>
                            <div className="flex gap-2">
                              {(['A', 'B', 'C', 'D'] as const).map((optKey) => (
                                <label key={optKey} className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`correct_${idx}`}
                                    checked={q.correctOption === optKey}
                                    onChange={() => handleUpdateQuestion(idx, { correctOption: optKey })}
                                    className="text-purple-600 focus:ring-purple-500"
                                  />
                                  <span className="font-bold">{optKey}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Authoritative Clinical Source:
                            </label>
                            <input
                              type="text"
                              value={q.authoritativeSource || ''}
                              onChange={(e) => handleUpdateQuestion(idx, { authoritativeSource: e.target.value })}
                              placeholder="e.g. AIIMS Nursing Procedure Manual / INC Curriculum / AHA 2025"
                              className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Clinical Explanation / Rationale:
                            </label>
                            <input
                              type="text"
                              value={q.explanation || ''}
                              onChange={(e) => handleUpdateQuestion(idx, { explanation: e.target.value })}
                              placeholder="Evidence-based reasoning shown to participants in review..."
                              className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                            />
                          </div>

                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingIndex(null)}
                              className="px-3 py-1 bg-purple-600 text-white rounded-md text-xs font-bold"
                            >
                              Done Editing
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-slate-900 leading-relaxed mb-2.5">
                            {q.question}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                              const isCorrect = q.correctOption === optKey;
                              return (
                                <div
                                  key={optKey}
                                  className={`p-2 rounded-lg border flex items-start gap-2 ${
                                    isCorrect
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                                      : 'bg-slate-50/80 border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span className={`font-bold shrink-0 ${isCorrect ? 'text-emerald-700' : 'text-slate-500'}`}>
                                    {optKey}.
                                  </span>
                                  <span className="flex-1 leading-snug">{q.options[optKey]}</span>
                                  {isCorrect && (
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase shrink-0">
                                      ✓ Key
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg mt-2 border border-slate-100">
                              <strong>Rationale:</strong> {q.explanation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Collapsible Replaced Questions History */}
              {replacedQuestions.length > 0 && (
                <div className="mt-4 border border-slate-200 rounded-xl bg-slate-100/60 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-slate-500" />
                      <span>Replaced Questions History ({replacedQuestions.length})</span>
                    </div>
                    {showHistory ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  {showHistory && (
                    <div className="p-4 border-t border-slate-200 space-y-3 bg-white">
                      {replacedQuestions.map((rq, rIdx) => (
                        <div
                          key={rq.id || rIdx}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 opacity-75"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                              {rq.status || 'REPLACED'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{rq.id}</span>
                          </div>
                          <p className="text-xs line-through text-slate-500 mb-1">{rq.question}</p>
                          {rq.authoritativeSource && (
                            <p className="text-[10px] text-slate-400">Source: {rq.authoritativeSource}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {activeQuestions.length < 5 ? (
              <span className="text-rose-600 font-semibold">
                ⚠ Minimum 5 active questions required. Currently active: {activeQuestions.length}
              </span>
            ) : activeFinalizedCount < 5 ? (
              <span className="text-amber-600 font-semibold">
                ⚠ Please finalize at least 5 active questions for post-test activation. Finalized: {activeFinalizedCount}/5
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">
                ✓ Evaluation ready: <strong>{activeFinalizedCount}</strong> active finalized questions ready for participant post-test
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isGenerating}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-xs disabled:opacity-40 cursor-pointer transition-colors"
            >
              Close
            </button>

            {!isLocked && isAuthorized && (
              <button
                type="button"
                onClick={handleSaveQuestions}
                disabled={isSaving || isGenerating || activeQuestions.length < 5}
                className="flex items-center gap-1.5 px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Questions...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save &amp; Publish Question Bank</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
