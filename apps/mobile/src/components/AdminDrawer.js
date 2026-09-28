import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { StackActions } from '@react-navigation/native';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Menu,
  QrCode,
  ShieldCheck,
  Upload,
  User,
  Users,
} from 'lucide-react-native';

import { SideDrawer } from './SideDrawer';
import { useAuth } from '../state/auth';
import { personDisplayName } from '../utils/displayName';
import { loadLocalProfile } from '../utils/sessionStore';

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

/**
 * Panel lateral del admin para cualquier pantalla.
 * Devuelve el elemento a renderizar (`drawer`) y la función para abrirlo desde el botón de menú.
 * Entre secciones se reemplaza la pantalla actual, así "atrás" siempre vuelve al tablero
 * y la pila no crece al navegar por el menú.
 */
export function useAdminDrawer(navigation, currentRoute) {
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
      if (route === 'AdminDashboard' || currentRoute === 'AdminDashboard' || !currentRoute) {
        navigation.navigate(route);
        return;
      }
      navigation.dispatch(StackActions.replace(route));
    },
    [navigation, currentRoute]
  );

  const items = useMemo(
    () => ADMIN_MENU.map((item) => ({
      label: item.label,
      Icon: item.Icon,
      active: item.route === currentRoute,
      onPress: () => goTo(item.route),
    })),
    [currentRoute, goTo]
  );

  const openDrawer = useCallback(() => setVisible(true), []);

  // Volver a la pantalla anterior; si no hay (p. ej. tras reemplazar desde el menú), al tablero.
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('AdminDashboard');
  }, [navigation]);

  const drawer = (
    <SideDrawer
      visible={visible}
      onClose={() => setVisible(false)}
      onOpen={openDrawer}
      photoUri={photoUri}
      fallbackSource={require('../../assets/escudo_umb.png')}
      roleLabel="Administrador"
      name={personDisplayName(fullName, 'Administrador')}
      items={items}
      onLogout={() => {
        logout();
        navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
      }}
    />
  );

  return { drawer, openDrawer, goBack, goTo };
}

/**
 * Botones de cabecera del admin, siempre en el mismo orden y lado: volver y luego menú.
 * `buttonStyle`, `size` y `color` se toman del estilo de cada pantalla.
 */
export function AdminNavButtons({ onBack, onMenu, buttonStyle, size = 20, color }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {onBack ? (
        <Pressable onPress={onBack} style={buttonStyle} accessibilityRole="button" accessibilityLabel="Volver">
          <ArrowLeft size={size} color={color} />
        </Pressable>
      ) : null}
      <Pressable onPress={onMenu} style={buttonStyle} accessibilityRole="button" accessibilityLabel="Abrir menú">
        <Menu size={size} color={color} />
      </Pressable>
    </View>
  );
}
