import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from './src/state/auth';

import SplashScreen from './src/pages/auth/SplashScreen';
import WelcomeScreen from './src/pages/auth/WelcomeScreen';
import LoginScreen from './src/pages/auth/LoginScreen';
import RegisterScreen from './src/pages/auth/RegisterScreen';
import StudentHome from './src/pages/student/StudentHome';
import StudentQr from './src/pages/student/QRScanner';
import StudentSchedule from './src/pages/student/ScheduleScreen';
import StudentNotifications from './src/pages/student/Notifications';
import StudentProfile from './src/pages/student/StudentProfile';
import StudentAttendanceHistory from './src/pages/student/AttendanceHistory';
import TeacherHome from './src/pages/teacher/TeacherDashboard';
import TeacherCreateClass from './src/pages/teacher/CreateClass';
import TeacherMyClasses from './src/pages/teacher/MyClasses';
import TeacherClassDetails from './src/pages/teacher/ClassDetails';
import TeacherAttendanceQr from './src/pages/teacher/AttendanceQr';
import TeacherCreateSession from './src/pages/teacher/CreateSession';
import TeacherClassQRScreen from './src/pages/teacher/ClassQRScreen';
import TeacherLiveAttendanceDashboard from './src/pages/teacher/LiveAttendanceDashboard';
import SessionHistory from './src/pages/teacher/SessionHistory';
import InformeSessionsList from './src/pages/teacher/InformeSessionsList';
import TeacherFaceRecognitionScreen from './src/pages/teacher/FaceRecognitionScreen';
import TeacherManualCorrection from './src/pages/teacher/ManualCorrection';
import ReportsDashboard from './src/pages/reports/ReportsDashboard';
import ReportPreview from './src/pages/reports/ReportPreview';
import ReportActions from './src/pages/reports/ReportActions';
import ReportHistory from './src/pages/reports/ReportHistory';
import AdminDashboard from './src/pages/admin/AdminDashboard';
import AdminStudents from './src/pages/admin/EstudiantesPage';
import AdminTeachers from './src/pages/admin/DocentesPage';
import AdminBulkUpload from './src/pages/admin/CargaMasivaPage';
import AdminQrInstitutional from './src/pages/admin/QRInstitucionalPage';
import AdminLogs from './src/pages/admin/LogsPage';
import AdminAudit from './src/pages/admin/AuditoriaPage';
import AdminConsents from './src/pages/admin/ConsentimientosPage';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />

          <Stack.Screen name="StudentHome" component={StudentHome} />
          <Stack.Screen name="StudentQr" component={StudentQr} />
          <Stack.Screen name="StudentSchedule" component={StudentSchedule} />
          <Stack.Screen name="StudentNotifications" component={StudentNotifications} />
          <Stack.Screen name="StudentProfile" component={StudentProfile} />
          <Stack.Screen name="StudentAttendanceHistory" component={StudentAttendanceHistory} />

          <Stack.Screen name="TeacherHome" component={TeacherHome} />
          <Stack.Screen name="TeacherCreateClass" component={TeacherCreateClass} />
          <Stack.Screen name="TeacherMyClasses" component={TeacherMyClasses} />
          <Stack.Screen name="TeacherClassDetails" component={TeacherClassDetails} />
          <Stack.Screen name="TeacherAttendanceQr" component={TeacherAttendanceQr} />
          <Stack.Screen name="TeacherCreateSession" component={TeacherCreateSession} />
          <Stack.Screen name="TeacherClassQRScreen" component={TeacherClassQRScreen} />
          <Stack.Screen name="TeacherLiveAttendanceDashboard" component={TeacherLiveAttendanceDashboard} />
          <Stack.Screen name="SessionHistory" component={SessionHistory} />
          <Stack.Screen name="InformeSessionsList" component={InformeSessionsList} />
          <Stack.Screen name="TeacherFaceRecognitionScreen" component={TeacherFaceRecognitionScreen} />
          <Stack.Screen name="TeacherManualCorrection" component={TeacherManualCorrection} />

          <Stack.Screen name="ReportsDashboard" component={ReportsDashboard} />
          <Stack.Screen name="ReportPreview" component={ReportPreview} />
          <Stack.Screen name="ReportActions" component={ReportActions} />
          <Stack.Screen name="ReportHistory" component={ReportHistory} />

          <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
          <Stack.Screen name="AdminStudents" component={AdminStudents} />
          <Stack.Screen name="AdminTeachers" component={AdminTeachers} />
          <Stack.Screen name="AdminBulkUpload" component={AdminBulkUpload} />
          <Stack.Screen name="AdminQrInstitutional" component={AdminQrInstitutional} />
          <Stack.Screen name="AdminLogs" component={AdminLogs} />
          <Stack.Screen name="AdminAudit" component={AdminAudit} />
          <Stack.Screen name="AdminConsents" component={AdminConsents} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
