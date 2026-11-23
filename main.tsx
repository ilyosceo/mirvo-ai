import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './components/AuthProvider.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { registerMirvoServiceWorker } from './lib/pwa.ts';
import './index.css';

registerMirvoServiceWorker();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>
);
