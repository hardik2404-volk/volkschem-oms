import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';

import ErrorBoundary from './ErrorBoundary';

function App() {
  useEffect(() => {
    const handleWheel = (e) => {
      if (document.activeElement && document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
        <Toaster 
          position="top-right" 
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
              fontSize: '14px',
              borderRadius: '8px',
            },
            success: {
              style: {
                background: '#E8F5E9',
                color: '#1B5E20',
                border: '1px solid #C8E6C9',
              },
              iconTheme: {
                primary: '#388E3C',
                secondary: '#E8F5E9',
              },
            },
            error: {
              style: {
                background: '#FFEBEE',
                color: '#D32F2F',
                border: '1px solid #FFCDD2',
              },
              iconTheme: {
                primary: '#D32F2F',
                secondary: '#FFEBEE',
              },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
