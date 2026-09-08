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
  Edit3
} from 'lucide-react';
import { UpcomingClass, CNEQuestion } from '../../types';
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
  const [questions, setQuestions] = useState<CNEQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [aiQuestionCount, setAiQuestionCount] = useState(10);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { success, error, warning } = useToast();

  useEffect(() => {
    loadQuestions();
  }, [cne.classId]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getCNEQuestions(cne.classId);
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

  const handleGenerateAi = async () => {
    if (isGenerating || isLocked || !isAuthorized) return;

    setIsGenerating(true);
    try {
      // 1. Fetch reference material to ground the prompt
      let refText = '';
      let syllabus = cne.description || '';
      try {
        const refRes = await ApiService.getReferenceMaterial(cne.classId);
        if (refRes.success && refRes.data) {
          refText = refRes.data.referenceText || '';
          if (refRes.data.syllabus) syllabus = refRes.data.syllabus;
        }
      } catch (e) {}

      // 2. Call Gemini AI question generator on the backend
      const aiRes = await ApiService.generateAiQuestions({
        topic: cne.topic,
        referenceMaterial: refText,
        syllabus: syllabus,
        count: aiQuestionCount
      });

      if (aiRes.success && aiRes.data && aiRes.data.length > 0) {
        // Mark them finalized by default for review
        const newQs: CNEQuestion[] = aiRes.data.map((q, idx) => ({
          ...q,
          id: q.id || `q_${Date.now()}_${idx + 1}`,
          isFinalized: true
        }));

        setQuestions(newQs);
        success(`Generated ${newQs.length} clinical MCQs via AI. Review and save.`);
      } else {
        error(aiRes.message || 'Failed to generate AI questions.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while communicating with AI service.');
    } finally {
      setIsGenerating(false);
    }
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
      isFinalized: true
    };
    setQuestions((prev) => [...prev, newQ]);
    setEditingIndex(questions.length);
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
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) setEditingIndex(null);
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

    if (questions.length === 0) {
      warning('Please add or generate at least one question.');
      return;
    }

    // Validate that questions are not blank
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        error(`Question #${i + 1} has empty text.`);
        return;
      }
      if (!q.options.A.trim() || !q.options.B.trim() || !q.options.C.trim() || !q.options.D.trim()) {
        error(`Question #${i + 1} must have all 4 options (A, B, C, D) filled.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await ApiService.saveCNEQuestions({
        cneId: cne.classId,
        questions
      });

      if (res.success) {
        success(`Saved ${questions.length} questions. Post-test is ready.`);
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

  const finalizedCount = questions.filter((q) => q.isFinalized).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[92vw] max-w-[1440px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
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
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {finalizedCount} of {questions.length} Finalized
                  </span>
                )}
                <span className="text-[11px] font-mono text-slate-400">
                  ({cne.classId})
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

        {/* AI & Manual Action Bar */}
        {!isLocked && isAuthorized && (
          <div className="px-6 py-2.5 bg-purple-50/50 border-b border-purple-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-purple-950 font-medium">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Grounded Question Synthesizer:</span>
              <span className="text-purple-700 text-[11px]">Generate evidence-based clinical MCQs from syllabus &amp; notes</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={aiQuestionCount}
                onChange={(e) => setAiQuestionCount(parseInt(e.target.value, 10))}
                disabled={isGenerating || isSaving}
                className="bg-white border border-purple-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-semibold shadow-xs"
              >
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions</option>
                <option value={8}>8 Questions</option>
                <option value={10}>10 Questions</option>
              </select>

              <button
                type="button"
                onClick={handleGenerateAi}
                disabled={isGenerating || isSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing MCQs...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Generate AI MCQs</span>
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
          ) : questions.length === 0 ? (
            <div className="py-16 text-center p-8 bg-white rounded-2xl border border-dashed border-slate-300 space-y-3 max-w-xl mx-auto my-8">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">No Post-Test Questions Configured</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Use the AI Generator above to formulate instant scenario-based questions from the topic, or click <strong>+ Add Manual Question</strong> to enter your own assessment items.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              {questions.map((q, idx) => {
                const isEditing = editingIndex === idx;

                return (
                  <div
                    key={q.id || idx}
                    className={`p-4 rounded-xl border transition-all ${
                      q.isFinalized
                        ? 'border-purple-200 bg-white shadow-xs'
                        : 'border-slate-200 bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                          {idx + 1}
                        </span>
                        {q.isFinalized ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Included in Post-Test
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                            Draft (Excluded)
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
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                          >
                            {q.isFinalized ? 'Exclude' : 'Finalize'}
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
                            title="Delete Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Question Text */}
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
                            Clinical Explanation / Rationales:
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
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {finalizedCount === 0 ? (
              <span className="text-amber-600 font-semibold">
                ⚠ Please finalize at least 1 question for the post-test to become available.
              </span>
            ) : (
              <span>Evaluation ready: <strong>{finalizedCount}</strong> questions active in question bank</span>
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
                disabled={isSaving || isGenerating || questions.length === 0}
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
