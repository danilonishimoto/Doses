import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/global.css';

// Registra o Service Worker do PWA para funcionamento offline e atualização automática de cache
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Força a ativação imediata e recarregamento quando uma nova versão da aplicação for disponibilizada
    updateSW(true);
  },
  onOfflineReady() {
    console.info('[Doses PWA] Aplicativo pronto para funcionar em modo offline.');
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Elemento #root não encontrado no DOM.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
