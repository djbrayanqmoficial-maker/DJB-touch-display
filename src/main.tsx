import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register Service Worker for full Offline support & automatic cache updates
try {
  registerSW({
    immediate: true,
  });
} catch {
  // Ignore SW registration error in environments where HMR/SW is disabled
}

createRoot(document.getElementById('root')!).render(<App />);
