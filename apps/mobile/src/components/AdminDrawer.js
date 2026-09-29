import {
  Activity,
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  QrCode,
  ShieldCheck,
  Upload,
  User,
  Users,
} from 'lucide-react-native';

import { NavButtons, useRoleDrawer } from './RoleDrawer';

// Menú único del administrador: cada pantalla lo muestra con la sección actual resaltada.
export const ADMIN_MENU = [
  { route: 'AdminDashboard', label: 'Tablero', Icon: LayoutDashboard },
  { route: 'AdminProfile', label: 'Perfil', Icon: User },
  { route: 'AdminStudents', label: 'Estudiantes', Icon: GraduationCap },
  { route: 'AdminTeachers', label: 'Docentes', Icon: Users },
  { route: 'AdminClasses', label: 'Clases', Icon: BookOpen },
  { route: 'AdminJustifications', label: 'Justificaciones', Icon: FileText },
  { route: 'AdminConsents', label: 'Consentimientos', Icon: ShieldCheck },
  { route: 'AdminBulkUpload', label: 'Carga masiva', Icon: Upload },
  { route: 'AdminQrInstitutional', label: 'QR institucional', Icon: QrCode },
  { route: 'AdminLogs', label: 'Logs', Icon: Activity },
  { route: 'AdminAudit', label: 'Auditoría', Icon: ClipboardList },
];

/** Panel lateral del admin (ver `useRoleDrawer`). */
export function useAdminDrawer(navigation, currentRoute) {
  return useRoleDrawer(navigation, currentRoute, {
    menu: ADMIN_MENU,
    homeRoute: 'AdminDashboard',
    roleLabel: 'Administrador',
    fallbackName: 'Administrador',
  });
}

export const AdminNavButtons = NavButtons;
