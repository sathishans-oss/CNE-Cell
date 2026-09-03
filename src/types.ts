export type UserRole = 'ADMIN' | 'EMPLOYEE';

export type ViewMode =
  | 'home'
  | 'dashboard'
  | 'my-cne'
  | 'calendar'
  | 'upcoming'
  | 'my-applications'
  | 'gallery'
  | 'admin-cne'
  | 'admin-areas'
  | 'admin-roles'
  | 'admin-applications'
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
  updatedAt?: string;
}

export type RoleConfig = RoleMapping;

export interface CNERecord {
  dataId: string;
  area: string;
  fromDate: string;
  toDate?: string;
  duration: string; // e.g. "1:00:00" or "01:30"
  topic: string;
  resourcePersonEmpId: string;
  resourcePersonName?: string;
  modeOfTeaching: string;
  staffEmpIds: string[]; // List of employee IDs
  staffNames?: string[]; // Populated when authorized
  staffCount: number;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface UpcomingClass {
  classId: string;
  dataId?: string;
  topic: string;
  area: string;
  date: string;
  time: string;
  duration: string;
  resourcePersonEmpId: string;
  resourcePersonName?: string;
  modeOfTeaching: string;
  description?: string;
  maxParticipants?: number;
  currentApplicationsCount?: number;
  status: 'OPEN' | 'CLOSED' | 'COMPLETED';
  createdAt?: string;
}

export type ApplicationStatus = 'Applied' | 'Approved' | 'Rejected' | 'Attended' | 'Cancelled';

export interface CNEApplication {
  applicationId: string;
  classId: string;
  classTopic?: string;
  classDate?: string;
  classArea?: string;
  employeeId: string;
  employeeName: string;
  appliedAt: string;
  status: ApplicationStatus;
  remarks?: string;
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
  token: string;
  isFirstLogin?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
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

export interface CNEPortfolioFilterParams {
  year: number;
  startDate?: string;
  endDate?: string;
}

export type APARFilterParams = CNEPortfolioFilterParams;
