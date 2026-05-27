import ReactDOM from 'react-dom/client';
import React from 'react';
import { App } from './app/app';
import './index.css';
import { initObservability, Sentry } from './lib/observability';
import { initAnalytics, trackPageView } from './lib/analytics';
import { router } from './app/router';

initObservability();
initAnalytics(() => trackPageView(router.state.location));
router.subscribe((state) => trackPageView(state.location));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={<p>An unexpected error occurred. Please refresh the page.</p>}
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
