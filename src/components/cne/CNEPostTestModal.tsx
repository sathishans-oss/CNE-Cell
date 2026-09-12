import React, { useState, useEffect, useRef } from 'react';
import {
  Award,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  HelpCircle,
  Send,
  Printer,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { SessionUser, CNEQuestion, PostTestSubmissionResult } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';

interface CNEPostTestModalProps {
  cneId?: string;
  qrToken?: string;
  user: SessionUser | null;
  onClose: () => void;
  onSubmitted?: () => void;
  onRequireLogin?: () => void;
}

export const CNEPostTestModal: React.FC<CNEPostTestModalProps> = ({
  cneId,
  qrToken,
  user,
  onClose,
  onSubmitted,
  onRequireLogin
}) => {
  const [loading, setLoading] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [priorSubmission, setPriorSubmission] = useState<any>(null);
  const [topic, setTopic] = useState('');
  const [area, setArea] = useState('');
  const [resolvedCneId, setResolvedCneId] = useState(cneId || '');
  const [questions, setQuestions] = useState<CNEQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submissionResult, setSubmissionResult] = useState<PostTestSubmissionResult | null>(null);

  // Guest/Manual employee ID input if unauthenticated
  const [empIdInput, setEmpIdInput] = useState(user?.employeeId || '');

  const { success, error, warning } = useToast();

  useEffect(() => {
    loadTest();
  }, [cneId, qrToken, user?.employeeId]);

  const loadTest = async () => {
    setLoading(true);
    try {
      const activeEmpId = user?.employeeId || empIdInput || '';
      const res = await ApiService.getPostTestQuestions({
        cneId: cneId || resolvedCneId,
        qrToken,
        employeeId: activeEmpId
      });

      if (res.success && res.data) {
        setTopic(res.data.topic || '');
        setArea(res.data.area || '');
        setResolvedCneId(res.data.cneId);

        if (res.data.alreadySubmitted) {
          setAlreadySubmitted(true);
          setPriorSubmission(res.data.submission);
        } else {
          setAlreadySubmitted(false);
          setQuestions(res.data.questions || []);
        }
      } else {
        error(res.message || 'Failed to load post-test evaluation.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while loading test questions.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId: string, optionKey: string) => {
    if (submittingRef.current || isSubmitting || submissionResult) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting || submissionResult) return;

    const targetEmpId = (user?.employeeId || empIdInput).trim();
    if (!targetEmpId) {
      warning('Please enter your Employee ID before submitting.');
      return;
    }

    if (questions.length === 0) {
      error('No questions available for this test.');
      return;
    }

    // Check if any unanswered questions
    const unansweredCount = questions.filter((q) => !answers[q.id]).length;
    if (unansweredCount > 0) {
      if (!window.confirm(`You have ${unansweredCount} unanswered questions. Submit anyway?`)) {
        return;
      }
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await ApiService.submitPostTest({
        cneId: resolvedCneId,
        qrToken: qrToken,
        employeeId: targetEmpId,
        answers
      });

      if (res.success && res.data) {
        setSubmissionResult(res.data);
        success(`Post-test submitted! Your score: ${res.data.score}/${res.data.totalQuestions} (${res.data.percentage}%)`);
        if (onSubmitted) onSubmitted();
      } else {
        error(res.message || 'Failed to submit post-test.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while submitting evaluation.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[92vw] max-w-[1440px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                  CNE Post-Test Evaluation
                </span>
                {area && <span className="text-[11px] font-semibold text-slate-600">{area}</span>}
                {resolvedCneId && (
                  <span className="text-[11px] font-mono text-slate-400">
                    ({resolvedCneId})
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 truncate max-w-2xl">
                {topic || 'Clinical Nursing Evaluation'}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 cursor-pointer disabled:opacity-40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/40 text-xs">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <span>Verifying enrollment &amp; loading evaluation questions...</span>
            </div>
          ) : alreadySubmitted ? (
            /* Already Submitted View */
            <div className="py-12 text-center space-y-4 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900">Post-Test Already Completed</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  You have already completed this post-test evaluation. Repeated attempts are restricted to ensure clinical evaluation authenticity.
                </p>
              </div>

              {priorSubmission && (
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2 text-left shadow-xs">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Participant:</span>
                    <span className="font-bold text-slate-800">{priorSubmission.name || priorSubmission.employeeId}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Score:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {priorSubmission.score} / {priorSubmission.totalQuestions}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Percentage:</span>
                    <span className="font-bold text-emerald-700">{priorSubmission.percentage}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Result:</span>
                    <span className="font-bold text-emerald-700">{priorSubmission.status || 'PASSED'}</span>
                  </div>
                  {priorSubmission.submittedAt && (
                    <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200">
                      <span>Completed:</span>
                      <span>{priorSubmission.submittedAt}</span>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer transition-colors"
              >
                Close Window
              </button>
            </div>
          ) : submissionResult ? (
            /* Post-Submission Results & Review View */
            <div className="space-y-6">
              <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center mx-auto">
                  <Award className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-emerald-950">Evaluation Complete!</h4>
                <div className="flex items-center justify-center gap-4 text-xs pt-1">
                  <div className="bg-white px-4 py-2 rounded-xl border border-emerald-200 shadow-xs">
                    <span className="text-slate-500">Score: </span>
                    <strong className="font-mono text-emerald-800">
                      {submissionResult.score} / {submissionResult.totalQuestions}
                    </strong>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-xl border border-emerald-200 shadow-xs">
                    <span className="text-slate-500">Percentage: </span>
                    <strong className="text-emerald-800">{submissionResult.percentage}%</strong>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-xl border border-emerald-200 shadow-xs">
                    <span className="text-slate-500">Status: </span>
                    <strong className={submissionResult.passed ? 'text-emerald-700' : 'text-rose-700'}>
                      {submissionResult.status}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Review Breakdown in 2-Column Wide Grid */}
              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Detailed Answer Review &amp; Clinical Rationales
                </h5>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  {submissionResult.review.map((item, idx) => (
                    <div
                      key={item.questionId || idx}
                      className={`p-4 rounded-xl border text-xs bg-white shadow-xs ${
                        item.isCorrect
                          ? 'border-emerald-200'
                          : 'border-rose-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">Q{idx + 1}.</span>
                          <span className="font-semibold text-slate-900">{item.question}</span>
                        </div>
                        {item.isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> Correct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full shrink-0">
                            <XCircle className="w-3 h-3" /> Incorrect
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] mt-2 pt-2 border-t border-slate-100">
                        <div>
                          <span className="text-slate-500">Your Answer: </span>
                          <strong className={item.isCorrect ? 'text-emerald-800' : 'text-rose-800'}>
                            Option {item.userAnswer || 'None'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Correct Answer: </span>
                          <strong className="text-emerald-800">Option {item.correctAnswer}</strong>
                        </div>
                      </div>

                      {item.explanation && (
                        <p className="mt-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                          <strong>Rationale:</strong> {item.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : questions.length === 0 ? (
            /* No Questions Available */
            <div className="py-20 text-center p-8 bg-white rounded-2xl border border-slate-200 space-y-2 max-w-md mx-auto my-8">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">Post-Test Questions Pending</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                The coordinators have not finalized questions for this CNE yet. Please check back shortly.
              </p>
            </div>
          ) : (
            /* Active Test Form - 2-Column Wide Grid on Desktop */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Employee ID bar if not logged in */}
              {!user && (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5">
                  <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                    Enter Your Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP1042"
                    value={empIdInput}
                    onChange={(e) => setEmpIdInput(e.target.value)}
                    className="w-full max-w-md p-2 bg-white border border-amber-300 rounded-lg text-xs"
                  />
                  <span className="text-[10px] text-amber-800 block">
                    Required to record your official CNE attendance and post-test score in the hospital roster.
                  </span>
                </div>
              )}

              {/* Questions List in Responsive 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {questions.map((q, idx) => {
                  const selectedOption = answers[q.id];

                  return (
                    <div
                      key={q.id || idx}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="font-semibold text-slate-900 text-xs leading-relaxed">
                          {q.question}
                        </p>
                      </div>

                      <div className="space-y-2 pl-8">
                        {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                          const isSelected = selectedOption === optKey;
                          return (
                            <label
                              key={optKey}
                              onClick={() => handleSelectOption(q.id, optKey)}
                              className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-medium'
                                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                checked={isSelected}
                                onChange={() => handleSelectOption(q.id, optKey)}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="font-bold w-4">{optKey}.</span>
                              <span className="flex-1">{q.options[optKey]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  Answered <strong>{Object.keys(answers).length}</strong> of <strong>{questions.length}</strong> questions
                </span>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Grading &amp; Recording Submission...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Post-Test Evaluation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
