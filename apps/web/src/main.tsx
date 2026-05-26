import ReactDOM from 'react-dom/client';
import React from 'react';
import { App } from './app/app';
import './index.css';
import { initObservability } from './lib/observability';

initObservability();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
