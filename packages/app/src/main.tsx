import React from 'react';
import {MotionConfig} from 'motion/react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {AppErrorBoundary} from './AppErrorBoundary';
import {suppressNativeContextMenu} from './nativeContextMenu';
import './styles.css';

suppressNativeContextMenu(import.meta.env.PROD);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </MotionConfig>
  </React.StrictMode>
);
