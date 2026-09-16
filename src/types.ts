export type UserRole = 'ADMIN' | 'AREA_INCHARGE' | 'EMPLOYEE';

export type ViewMode =
  | 'home'
  | 'dashboard'
  | 'my-cne'
  | 'calendar'
  | 'upcoming'
  | 'learning-resources'
  | 'gallery'
  | 'admin-areas'
  | 'admin-roles'
  | 'admin-content'
  | 'admin-reports';

export interface NewsEventItem {
  id: string;
  title: string;
  date: string;
  category: 'Workshop' | 'Circular' | 'Conference' | 'Training' | 'Update' | 'Notice';
  summary: string;
  content?: string;
  venue?: string;
  speaker?: string;
  isImportant?: boolean;
}

export interface ChairpersonMessageData {
  name: string;
  designation: string;
  institution: string;
  photoUrl: string;
  title: string;
  message: string[];
  keyHighlights: string[];
  driveFileId?: string;
  driveUrl?: string;
}

export interface QuickLinkItem {
  id: string;
  title: string;
  description: string;
  iconName: string;
  target: string;
  badge?: string;
  actionType: 'navigate' | 'modal' | 'external';
  modalContent?: {
    title: string;
    body: string[];
  };
}

export interface Employee {
  srNo?: number;
  employeeId: string;
  name: string;
  designation: string;
  contactNo?: string;
  employmentType?: string;
  typeOfEmployment?: string;
  email?: string;
  dob?: string;
  doj?: string;
}

export interface Area {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

export interface RoleMapping {
  srNo?: number;
  employeeId: string;
  name: string;
  designation: string;
  role: UserRole;
  area?: string;
  assignedAreas?: string[];
  updatedAt?: string;
}

export type RoleConfig = RoleMapping;

/**
 * Authoritative Unified CNE Record
 * Represents a CNE program/session stored directly in the single authoritative 'CNE Schedule' sheet.
 */
export interface CNERecord {
  cneId: string;
  classId?: string; // Backward-compatibility alias for cneId
  dataId?: string; // Backward-compatibility alias for cneId
  topic: string;
  area: string;
  fromDate: string;
  date?: string; // Date alias for fromDate
  toDate?: string;
  time?: string;
  duration: string; // Duration in HH:MM:SS format
  resourcePersonEmpId: string;
  resourcePersonEmpIds?: string[];
  resourcePersonName?: string;
  externalResourcePersons?: string[]; // Outside resource persons without employee ID
  modeOfTeaching: string;
  description?: string;
  maxParticipants?: number;
  currentApplicationsCount?: number;
  status: 'Scheduled' | 'Completed' | 'Canceled' | 'Draft' | 'Pending';
  cneType?: 'CENTRAL' | 'DEPARTMENTAL';
  proposedByEmpId?: string;
  proposedByName?: string;
  adminRemarks?: string;
  remarks?: string;
  staffEmpId?: string; // Comma-separated internal employee IDs
  staffEmpIds?: string[]; // List of internal employee IDs
  staffNames?: string[]; // Populated when authorized
  externalStaffParticipants?: string[]; // Outside staff participants without employee ID
  staffCount?: number;
  finalizedQuestionsCount?: number;
  isLocked?: boolean;
  isUnscheduled?: boolean;
  qrToken?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CNEActivityProgress {
  cneId: string;
  materialStatus: 'Added' | 'Not Added';
  questionsStatus: 'Generated' | 'Not Generated';
  qrStatus: 'Generated' | 'Not Generated';
  participantsCount: number;
  postTestStatus: 'Available' | 'Not Available' | 'Completed';
  finalizationStatus: 'Finalized' | 'Not Finalized';
}

export interface DepartmentalScheduleRow {
  id: string;
  topic: string;
  area: string;
  date: string; // From Date & Time
  toDate?: string; // To Date & Time
  time?: string; // Optional legacy time
  duration: string; // Duration in HH:MM:SS format
  resourcePersonEmpId: string;
  resourcePersonEmpIds?: string[];
  resourcePersonName?: string;
  externalResourcePersons?: string[];
  modeOfTeaching: string;
  description?: string;
  maxParticipants?: number;
  adminRemarks?: string;
}

export interface CNEQuestion {
  id: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  authoritativeSource?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'REPLACED';
  isFinalized?: boolean;
  isLocked?: boolean;
}

export interface CNEReferenceMaterial {
  cneId: string;
  topic: string;
  referenceText: string;
  unifiedContent?: string;
  updatedBy?: string;
  updatedAt?: string;
  linkUrl?: string;
  syllabus?: string;
  driveFileId?: string;
  fileName?: string;
  fileType?: string;
  resourcePersonName?: string;
  fileSize?: number;
  hasFile?: boolean;
}

export interface CNELearningResourceMetadata {
  cneId: string;
  topic: string;
  driveFileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  resourcePersonName: string;
  uploadedAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  hasFile?: boolean;
  visibleToUsers?: boolean;
  indexingStatus?: 'SUCCESS' | 'FAILED' | 'PENDING';
  indexingErrorCode?: string;
  indexingMessage?: string;
  chunksCount?: number;
}

export interface CNEReferenceIndexChunk {
  indexId: string;
  sourceType: 'UPLOADED_CNE' | 'LOCAL_REFERENCE_LIB';
  cneId: string;
  driveFileId: string;
  resourceTitle: string;
  topic: string;
  sectionHeading: string;
  chunkIndex: number;
  chunkText: string;
  clinicalKeywords: string;
  extractionStatus: 'SUCCESS' | 'FAILED';
  updatedAt: string;
}

export interface CNENursingReferenceResource {
  resourceId: string;
  sourceType: 'LOCAL_REFERENCE_LIB';
  resourceTitle: string;
  driveFileId: string;
  authorOrganization: string;
  license: string;
  version: string;
  fileType: string;
  active: boolean;
  visibleToUsers?: boolean;
  indexedAt: string;
  updatedAt: string;
}

export interface CNENursingReferenceDriveFile {
  driveFileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  lastUpdated: string;
  isIndexed: boolean;
  resourceId: string | null;
  resourceTitle: string;
}

export interface CNELearningResourceExtractedContent {
  cneId: string;
  topic: string;
  resourcePersonName: string;
  driveFileId: string;
  fileName: string;
  fileType: string;
  extractedText: string;
  charCount: number;
  isTruncated: boolean;
  originalCharCount: number;
  cached: boolean;
}

export interface CNEAiQuotaInfo {
  cneId: string;
  topic?: string;
  attemptsUsed: number;
  maxQuota: number;
  remaining: number;
  canGenerate: boolean;
  status?: 'AVAILABLE' | 'USED' | 'GENERATED';
  lastAttemptAt?: string;
  lastGeneratedBy?: string;
}

export interface CNEParticipant {
  id: string;
  cneId: string;
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  participantType: 'POST_TEST' | 'MANUAL';
  score: number | null;
  totalQuestions: number | null;
  percentage: number | null;
  status: string;
  submittedAt: string;
  remarks?: string;
}

export interface CNEParticipantsSummary {
  cneId: string;
  topic: string;
  area: string;
  status: string;
  totalParticipants: number;
  postTestCount: number;
  manualCount: number;
  averageScore: number;
  participants: CNEParticipant[];
}

export interface PostTestSubmissionResult {
  participantId: string;
  cneId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  status: string;
  submittedAt: string;
  review: {
    questionId: string;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export type ApplicationStatus = 'Pending' | 'Applied' | 'Approved' | 'Rejected' | 'Attended' | 'Cancelled';

export interface CNEApplication {
  applicationId: string;
  cneId: string;
  classId?: string; // Optional backward-compatibility alias
  classTopic?: string;
  classDate?: string;
  classArea?: string;
  employeeId: string;
  employeeName: string;
  appliedAt: string;
  status: ApplicationStatus;
  remarks?: string;
  adminRemarks?: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  description?: string;
  date: string;
  imageUrl: string;
  driveFileId?: string;
  uploadedBy?: string;
  uploadedAt: string;
  isActive: boolean;
}

export interface SessionUser {
  employeeId: string;
  name: string;
  designation: string;
  email?: string;
  role: UserRole;
  assignedArea?: string;
  assignedAreas?: string[];
  token: string;
  isFirstLogin?: boolean;
  mustChangePassword?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
}

export interface SheetAuditItem {
  tab: string;
  status: string;
  rowCount?: number;
  error?: string;
}

export interface CNEReportStats {
  totalActivities: number;
  currentMonthActivities: number;
  upcomingClassesCount: number;
  totalParticipants: number;
  activeAreasCount: number;
  pendingApplicationsCount: number;
  totalTrainingHours: number;
  monthlyBreakdown: { month: string; count: number; hours: number }[];
  areaBreakdown: { area: string; count: number }[];
  modeBreakdown: { mode: string; count: number }[];
  topResourcePersons: { name: string; count: number; empId: string }[];
}

export interface ProgramImpactStats {
  totalCompletedClasses: number;
  cneDuration?: string;
  totalDuration?: string;
  totalDurationSeconds?: number;
  uniqueStaffTrained: number;
  uniqueWardsCount: number;
  attendanceComplianceRate: string;
  scope: 'institutional' | 'user';
}

export interface CNEPortfolioFilterParams {
  year: number;
  startDate?: string;
  endDate?: string;
}

export type APARFilterParams = CNEPortfolioFilterParams;

export interface CoordinatorDeskInfo {
  note: string;
  coordinators: string[];
  email: string;
}

export interface CNETopicEvidenceChunk {
  indexId: string;
  sourceType: 'UPLOADED_CNE' | 'LOCAL_REFERENCE_LIB';
  resourceTitle: string;
  sectionHeading: string;
  chunkIndex: number;
  chunkText: string;
  relevanceScore: number;
}

export interface CNETopicEvidenceResult {
  cneId: string;
  topic: string;
  totalEvidenceChunks: number;
  uploadedCount: number;
  libraryCount: number;
  evidence: CNETopicEvidenceChunk[];
}

export interface Phase4DTopicValidationReport {
  queryTopic: string;
  uploadedCount: number;
  libraryCount: number;
  totalResults: number;
  top5EvidenceChunks: Array<{
    sourceType: 'UPLOADED_CNE' | 'LOCAL_REFERENCE_LIB';
    resourceTitle: string;
    sectionHeading: string;
    relevanceScore: number;
  }>;
  clinicallyRelevant: boolean;
  falsePositiveMatches: string[];
}

export interface Phase4DValidationResult {
  cneIdTested: string;
  timestamp: string;
  topicReports: Phase4DTopicValidationReport[];
  verifications: {
    sourceOrderingVerified: boolean;
    unauthorizedForbiddenVerified: boolean;
    crossCNEIsolationVerified: boolean;
    inactiveLibraryExcludedVerified: boolean;
    nonexistentTopicReturnsInsufficient: boolean;
    noExternalOrDriveApiUsed: boolean;
  };
  summary: {
    totalTopicsTested: number;
    allSourceOrderingValid: boolean;
    unauthorizedAccessBlocked: boolean;
    nonexistentTopicBlocked: boolean;
    falsePositiveCount: number;
  };
}
