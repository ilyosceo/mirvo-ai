import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { FirebaseAuthProvider } from './contexts/FirebaseAuthContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <FirebaseAuthProvider>
      <App />
    </FirebaseAuthProvider>
  </ErrorBoundary>
);
