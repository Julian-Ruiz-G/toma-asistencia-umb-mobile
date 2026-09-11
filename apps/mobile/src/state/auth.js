import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { clearPersistedSession, loadPersistedSession, savePersistedSession } from '../utils/sessionStore';

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
      clearPersistedSession();
    }
  }), [ready, authToken, role, email, fullName, studentCode, teacherCode, program, semester, phone]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
