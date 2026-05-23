import { useState } from 'react';
import { deliveryZonesApi } from '../api/delivery-zones.api';
import { formatVND } from '@/features/orders/utils/timeFormat';
import type { DeliveryEstimate } from '../types';

interface DeliveryEstimatorProps {
  restaurantId: string;
}

// Parse "10.7769, 106.7009" or "lat,lon" strings.
function parseLatLon(input: string): { lat: number; lon: number } | null {
  const cleaned = input.replace(/\s+/g, '');
  const match = cleaned.match(/^(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lon = parseFloat(match[3]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export function DeliveryEstimator({ restaurantId }: DeliveryEstimatorProps) {
  const [input, setInput] = useState('');
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEstimate = async () => {
    setError(null);
    const coords = parseLatLon(input);
    if (!coords) {
      setError('Enter coordinates as "lat, lon" (e.g., 10.7769, 106.7009)');
      setEstimate(null);
      return;
    }
    setLoading(true);
    try {
      const result = await deliveryZonesApi.estimate(restaurantId, coords);
      setEstimate(result);
    } catch (e: any) {
      setEstimate(null);
      setError(e?.response?.data?.message || 'Out of delivery range or no zone available');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10">
      <h3 className="font-headline font-bold text-lg mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary">calculate</span>
        Try Estimator
      </h3>

      <div className="relative mb-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleEstimate()}
          placeholder="lat, lon (e.g., 10.7769, 106.7009)"
          className="w-full bg-surface-container-high border-none rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-on-surface-variant/50 outline-none"
        />
        <button
          type="button"
          onClick={handleEstimate}
          disabled={loading || !input.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center shadow-md active:scale-90 transition-transform disabled:opacity-50"
          aria-label="Estimate"
        >
          <span className="material-symbols-outlined text-sm">search</span>
        </button>
      </div>

      {error && (
        <div className="bg-error/5 border border-error/20 rounded-xl p-3 text-sm text-error">
          {error}
        </div>
      )}

      {estimate && !error && (
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-primary font-bold text-sm">
              Within delivery range
            </span>
          </div>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Zone</span>
              <span className="font-bold text-on-surface">{estimate.zone.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Distance</span>
              <span className="font-bold text-on-surface">
                {estimate.distanceKm.toFixed(2)} km
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Estimated Time</span>
              <span className="font-bold text-on-surface">
                ~{estimate.estimatedMinutes} min
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-primary/10">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-on-surface-variant">
                Total Delivery Fee
              </span>
              <span className="font-black text-lg text-secondary">
                {formatVND(estimate.deliveryFee)}
              </span>
            </div>
            <p className="text-[10px] text-on-surface-variant/70 italic text-right">
              {formatVND(estimate.breakdown.baseFee)} base +{' '}
              {estimate.distanceKm.toFixed(1)} km ×{' '}
              {formatVND(
                Math.round(estimate.breakdown.distanceFee / estimate.distanceKm),
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
