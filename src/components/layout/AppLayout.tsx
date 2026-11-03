import { Outlet } from 'react-router-dom';
import { BottomNavigation } from '../navigation/BottomNavigation';

export function AppLayout() {
  return (
    <div
      className="app-main-layout"
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#F5F5F5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 402,
          minHeight: '100vh',
          backgroundColor: '#FFFFFF',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        <main style={{ minHeight: '100vh' }}>
          <Outlet />
        </main>
        <BottomNavigation />
      </div>
    </div>
  );
}
