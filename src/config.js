import Constants from 'expo-constants';

export const API_RECOGNIZE_URL = Constants.expoConfig?.extra?.apiUrl || '';
export const API_BASE = API_RECOGNIZE_URL.replace(/\/recognize$/, '').replace(/\/$/, '').replace(/^https?:\/\//, 'https://');

export const REGISTER_STUDENT_URL = API_BASE ? `${API_BASE}/register` : '';
export const REGISTER_TEACHER_URL = API_BASE ? `${API_BASE}/register-teacher` : '';
export const LOGIN_TEACHER_URL = API_BASE ? `${API_BASE}/login-teacher` : '';
export const LOGIN_STUDENT_URL = API_BASE ? `${API_BASE}/login-student` : '';
export const LOGIN_ADMIN_URL = API_BASE ? `${API_BASE}/login-admin` : '';
export const CREATE_CLASS_URL = API_BASE ? `${API_BASE}/create-class` : '';
export const UPDATE_CLASS_URL = API_BASE ? `${API_BASE}/update-class` : '';
export const JOIN_CLASS_URL = API_BASE ? `${API_BASE}/join-class` : '';
export const MY_CLASSES_URL = API_BASE ? `${API_BASE}/my-classes` : '';
export const CLASS_DETAILS_URL = API_BASE ? `${API_BASE}/class-details` : '';
export const REGENERATE_CLASS_QR_URL = API_BASE ? `${API_BASE}/regenerate-class-qr` : '';
export const REMOVE_STUDENT_FROM_CLASS_URL = API_BASE ? `${API_BASE}/remove-student-from-class` : '';
export const RECOGNIZE_CLASS_URL = API_BASE ? `${API_BASE}/recognize-class` : '';
export const CREATE_ATTENDANCE_QR_URL = API_BASE ? `${API_BASE}/create-attendance-qr` : '';
export const MARK_ATTENDANCE_URL = API_BASE ? `${API_BASE}/mark-attendance` : '';
export const ATTENDANCE_DETAILS_URL = API_BASE ? `${API_BASE}/attendance-details` : '';
export const CONFIRM_ATTENDANCE_PHOTO_URL = API_BASE ? `${API_BASE}/confirm-attendance-photo` : '';
export const ATTENDANCE_REPORT_URL = API_BASE ? `${API_BASE}/attendance-report` : '';
export const DELETE_CLASS_URL = API_BASE ? `${API_BASE}/delete-class` : '';

export const STUDENT_DAILY_SUMMARY_URL = API_BASE ? `${API_BASE}/student-daily-summary` : '';
export const STUDENT_NOTIFICATIONS_URL = API_BASE ? `${API_BASE}/student-notifications` : '';

export const SET_CONSENT_URL = API_BASE ? `${API_BASE}/set-consent` : '';

export const ADMIN_STUDENTS_URL = API_BASE ? `${API_BASE}/admin-students` : '';
export const ADMIN_STUDENTS_BY_CLASS_URL = API_BASE ? `${API_BASE}/admin-students-by-class` : '';
export const ADMIN_TEACHERS_URL = API_BASE ? `${API_BASE}/admin-teachers` : '';
export const ADMIN_LOGS_URL = API_BASE ? `${API_BASE}/admin-logs` : '';
export const ADMIN_CONSENTS_URL = API_BASE ? `${API_BASE}/admin-consents` : '';
export const ADMIN_CREATE_TEACHER_URL = API_BASE ? `${API_BASE}/admin-create-teacher` : '';
export const ADMIN_DASHBOARD_STATS_URL = API_BASE ? `${API_BASE}/admin-dashboard-stats` : '';
export const ADMIN_UPDATE_STUDENT_URL = API_BASE ? `${API_BASE}/admin-update-student` : '';
export const ADMIN_DELETE_STUDENT_URL = API_BASE ? `${API_BASE}/admin-delete-student` : '';
export const ADMIN_UPDATE_TEACHER_URL = API_BASE ? `${API_BASE}/admin-update-teacher` : '';
export const ADMIN_DELETE_TEACHER_URL = API_BASE ? `${API_BASE}/admin-delete-teacher` : '';
