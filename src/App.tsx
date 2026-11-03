import { AppProvider } from './hooks/useApp';
import { AppContent } from './AppContent';

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
