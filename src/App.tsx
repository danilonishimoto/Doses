import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { DosesProvider } from './hooks/useDosesData';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { MedicationsPage } from './pages/MedicationsPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <DosesProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/medicamentos" element={<MedicationsPage />} />
            <Route path="/perfis" element={<ProfilesPage />} />
            <Route path="/historico" element={<HistoryPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </DosesProvider>
  );
}

export default App;
