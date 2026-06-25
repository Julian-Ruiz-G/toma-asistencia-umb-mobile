import React, { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [teacherCode, setTeacherCode] = useState('');

  const value = useMemo(() => ({
    authToken,
    setAuthToken,
    role,
    setRole,
    email,
    setEmail,
    studentCode,
    setStudentCode,
    teacherCode,
    setTeacherCode,
    logout: () => {
      setAuthToken('');
      setRole('');
      setEmail('');
      setStudentCode('');
      setTeacherCode('');
    }
  }), [authToken, role, email, studentCode, teacherCode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
