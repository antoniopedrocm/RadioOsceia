import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import { firebaseInitializationError } from '@/lib/firebase';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

if (firebaseInitializationError) {
  root.render(
    <React.StrictMode>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Configuração Firebase inválida ou ausente</h1>
        <p>Verifique as variáveis de ambiente VITE_FIREBASE_* e gere o build novamente.</p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{firebaseInitializationError.message}</pre>
      </div>
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <AdminAuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
      </AdminAuthProvider>
    </React.StrictMode>
  );
}
