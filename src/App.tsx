import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './hooks/useApp';
import { AppContent } from './AppContent';

export function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
