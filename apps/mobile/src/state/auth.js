import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { clearPersistedSession, loadLocalProfile, loadPersistedSession, savePersistedSession } from '../utils/sessionStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [program, setProgram] = useState('');
  const [semester, setSemester] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [classesRevision, setClassesRevision] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await loadPersistedSession();
      if (saved) {
        setAuthToken(String(saved.authToken || ''));
        setRole(String(saved.role || ''));
        setEmail(String(saved.email || ''));
        setFullName(String(saved.fullName || ''));
        setStudentCode(String(saved.studentCode || ''));
        setTeacherCode(String(saved.teacherCode || ''));
        setProgram(String(saved.program || ''));
        setSemester(String(saved.semester || ''));
        setPhone(String(saved.phone || ''));
        const local = await loadLocalProfile(saved.email);
        setPhotoUri(String(local?.photoUri || ''));
      }
      setReady(true);
    })();
  }, []);

  const value = useMemo(() => ({
    ready,
    authToken,
    setAuthToken,
    role,
    setRole,
    email,
    setEmail,
    fullName,
    setFullName,
    studentCode,
    setStudentCode,
    teacherCode,
    setTeacherCode,
    program,
    setProgram,
    semester,
    setSemester,
    phone,
    setPhone,
    photoUri,
    setPhotoUri,
    notificationUnread,
    setNotificationUnread,
    classesRevision,
    refreshStudentClasses: () => setClassesRevision((n) => n + 1),
    persistSession: async (session) => {
      await savePersistedSession(session);
    },
    logout: () => {
      setAuthToken('');
      setRole('');
      setEmail('');
      setFullName('');
      setStudentCode('');
      setTeacherCode('');
      setProgram('');
      setSemester('');
      setPhone('');
      setPhotoUri('');
      setNotificationUnread(0);
      setClassesRevision(0);
      clearPersistedSession();
    }
  }), [ready, authToken, role, email, fullName, studentCode, teacherCode, program, semester, phone, photoUri, notificationUnread, classesRevision]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
