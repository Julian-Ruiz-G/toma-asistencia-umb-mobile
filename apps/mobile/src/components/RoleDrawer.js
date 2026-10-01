import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { StackActions } from '@react-navigation/native';
import {
  ArrowLeft,
  ChartColumn,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  History,
  House,
  Info,
  Menu,
  CirclePlus,
  QrCode,
  User,
} from 'lucide-react-native';

import { SideDrawer } from './SideDrawer';
import { useAuth } from '../state/auth';
import { personDisplayName } from '../utils/displayName';
import { loadLocalProfile } from '../utils/sessionStore';

export const TEACHER_MENU = [
  { route: 'TeacherHome', label: 'Inicio', Icon: House },
  { route: 'TeacherMyClasses', label: 'Mis clases', Icon: BookOpen },
  { route: 'TeacherCreateClass', label: 'Crear clase', Icon: CirclePlus },
  { route: 'TeacherJustifications', label: 'Justificaciones', Icon: FileText },
  { route: 'ReportsDashboard', label: 'Reportes', Icon: ChartColumn },
  { route: 'TeacherNotifications', label: 'Notificaciones', Icon: Bell },
  { route: 'TeacherAttendanceGuide', label: 'Guía de asistencia', Icon: Info },
  { route: 'TeacherProfile', label: 'Perfil', Icon: User },
];

export const STUDENT_MENU = [
  { route: 'StudentHome', label: 'Inicio', Icon: House },
  { route: 'StudentQr', label: 'Escanear QR', Icon: QrCode },
  { route: 'StudentSchedule', label: 'Horario', Icon: CalendarDays },
  { route: 'StudentAttendanceHistory', label: 'Historial de asistencia', Icon: History },
  { route: 'StudentReminders', label: 'Recordatorios', Icon: ClipboardCheck },
  { route: 'StudentNotifications', label: 'Notificaciones', Icon: Bell },
  { route: 'StudentProfile', label: 'Perfil', Icon: User },
];

/**
 * Panel lateral para cualquier pantalla de un rol.
 * Devuelve el elemento a renderizar (`drawer`) y la función para abrirlo desde el botón de menú.
 * Entre secciones se reemplaza la pantalla actual, así "atrás" siempre vuelve al inicio del rol
 * y la pila no crece al navegar por el menú.
 */
export function useRoleDrawer(navigation, currentRoute, { menu, homeRoute, roleLabel, fallbackName }) {
  const { logout, fullName, email, photoUri, setPhotoUri } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (photoUri || !email) return;
    (async () => {
      const local = await loadLocalProfile(email);
      if (local?.photoUri) setPhotoUri(String(local.photoUri));
    })();
  }, [email, photoUri, setPhotoUri]);

  const goTo = useCallback(
    (route) => {
      if (route === currentRoute) return;
      if (route === homeRoute || currentRoute === homeRoute || !currentRoute) {
        navigation.navigate(route);
        return;
      }
      navigation.dispatch(StackActions.replace(route));
    },
    [navigation, currentRoute, homeRoute]
  );

  const items = useMemo(
    () => menu.map((item) => ({
      label: item.label,
      Icon: item.Icon,
      active: item.route === currentRoute,
      onPress: () => goTo(item.route),
    })),
    [menu, currentRoute, goTo]
  );

  const openDrawer = useCallback(() => setVisible(true), []);

  // Volver a la pantalla anterior; si no hay (p. ej. tras reemplazar desde el menú), al inicio del rol.
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate(homeRoute);
  }, [navigation, homeRoute]);

  const drawer = (
    <SideDrawer
      visible={visible}
      onClose={() => setVisible(false)}
      onOpen={openDrawer}
      photoUri={photoUri}
      fallbackSource={require('../../assets/escudo_umb.png')}
      roleLabel={roleLabel}
      name={personDisplayName(fullName, fallbackName)}
      items={items}
      onLogout={() => {
        logout();
        navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
      }}
    />
  );

  return { drawer, openDrawer, goBack, goTo };
}

export function useTeacherDrawer(navigation, currentRoute) {
  return useRoleDrawer(navigation, currentRoute, {
    menu: TEACHER_MENU,
    homeRoute: 'TeacherHome',
    roleLabel: 'Docente',
    fallbackName: 'Docente',
  });
}

export function useStudentDrawer(navigation, currentRoute) {
  return useRoleDrawer(navigation, currentRoute, {
    menu: STUDENT_MENU,
    homeRoute: 'StudentHome',
    roleLabel: 'Estudiante',
    fallbackName: 'Estudiante',
  });
}

/**
 * Botón de volver de la cabecera (a la izquierda). El menú va a la derecha con MenuButton.
 * `buttonStyle`, `size` y `color` se toman del estilo de cada pantalla.
 */
export function NavButtons({ onBack, buttonStyle, size = 20, color }) {
  if (!onBack) return null;
  return (
    <Pressable onPress={onBack} style={buttonStyle} accessibilityRole="button" accessibilityLabel="Volver">
      <ArrowLeft size={size} color={color} />
    </Pressable>
  );
}

/**
 * Botón del menú lateral. Siempre es el último elemento de la cabecera y `marginLeft: 'auto'`
 * lo empuja al extremo derecho, del mismo lado por donde se abre el panel.
 */
export function MenuButton({ onPress, buttonStyle, size = 20, color }) {
  return (
    <Pressable
      onPress={onPress}
      style={[buttonStyle, { marginLeft: 'auto' }]}
      accessibilityRole="button"
      accessibilityLabel="Abrir menú"
    >
      <Menu size={size} color={color} />
    </Pressable>
  );
}
