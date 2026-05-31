import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export type ConnectivityStatus = 'connected' | 'connecting' | 'disconnected';

interface ConnectivityState {
  status: ConnectivityStatus;
  /** Round-trip time in ms for the last successful ping (null if never succeeded). */
  pingMs: number | null;
  /** ISO timestamp of the last successful ping. */
  lastSuccessAt: string | null;
}

/**
 * Lightweight liveness probe to drive the dashboard "System Connectivity" widget.
 *
 * Pings an authenticated endpoint every `intervalMs` and reports:
 *   - whether the API is reachable + authenticated
 *   - round-trip latency
 *
 * The unread-count endpoint is intentionally chosen — it's small, fast,
 * authenticated, and cached server-side.
 */
export function useApiConnectivity(intervalMs = 15_000): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>({
    status: 'connecting',
    pingMs: null,
    lastSuccessAt: null,    
  });

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      const start = performance.now();
      try {
        await apiClient.get('/api/notifications/my/unread-count');
        if (cancelled) return;
        const rtt = Math.round(performance.now() - start);
        setState({
          status: 'connected',
          pingMs: rtt,
          lastSuccessAt: new Date().toISOString(),
        });
      } catch {
        if (cancelled) return;
        setState((prev) => ({ ...prev, status: 'disconnected' }));
      }
    };

    probe();
    const id = window.setInterval(probe, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return state;
}
