import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './hooks/useApp';
import { AppContent } from './AppContent';
import { SafariInstallPwaModal } from './components/pwa/SafariInstallPwaModal';

export function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppContent />
        <SafariInstallPwaModal />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
