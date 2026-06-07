import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import RequireRole from './auth/RequireRole';
import Login from './auth/Login';
import AuthCallback from './auth/AuthCallback';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import Competencies from './pages/Competencies';
import Trainings from './pages/Trainings';
import Consultants from './pages/Consultants';
import System from './pages/System';
import NoAccess from './pages/NoAccess';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/no-access" element={<NoAccess />} />

          <Route
            element={
              <RequireRole>
                <AppShell />
              </RequireRole>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="competencies" element={<Competencies />} />
            <Route path="trainings" element={<Trainings />} />
            <Route path="consultants" element={<Consultants />} />
            <Route
              path="system"
              element={
                <RequireRole allow={['superadmin']}>
                  <System />
                </RequireRole>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
