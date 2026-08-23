import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import Agenda from './pages/Agenda';
import DayView from './pages/DayView';
import CaptureDetail from './pages/CaptureDetail';
import Clients from './pages/Clients';
import Team from './pages/Team';
import Settings from './pages/Settings';

function Private({ children, adminOnly = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <RealtimeProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/agenda" element={<Private><Agenda /></Private>} />
              <Route path="/agenda/:data" element={<Private><DayView /></Private>} />
              <Route path="/captacoes/:id" element={<Private><CaptureDetail /></Private>} />
              <Route path="/clientes" element={<Private><Clients /></Private>} />
              <Route path="/equipe" element={<Private><Team /></Private>} />
              <Route path="/configuracoes" element={<Private><Settings /></Private>} />
              <Route path="/" element={<Navigate to="/agenda" replace />} />
              <Route path="*" element={<Navigate to="/agenda" replace />} />
            </Routes>
          </RealtimeProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
