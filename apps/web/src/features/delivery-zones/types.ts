// Mirrors DeliveryZoneResponseDto from the API.
export interface DeliveryZone {
  id: string;
  restaurantId: string;
  name: string;
  radiusKm: number;
  baseFee: number;
  perKmRate: number;
  avgSpeedKmh: number;
  prepTimeMinutes: number;
  bufferMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Mirrors CreateDeliveryZoneDto.
export interface CreateDeliveryZoneInput {
  name: string;
  radiusKm: number;
  baseFee: number;
  perKmRate: number;
  avgSpeedKmh?: number;
  prepTimeMinutes?: number;
  bufferMinutes?: number;
}

// Mirrors UpdateDeliveryZoneDto.
export interface UpdateDeliveryZoneInput extends Partial<CreateDeliveryZoneInput> {
  isActive?: boolean;
}

// Mirrors DeliveryEstimateResponseDto.
export interface DeliveryFeeBreakdown {
  baseFee: number;
  distanceFee: number;
  prepTimeMinutes: number;
  travelTimeMinutes: number;
  bufferMinutes: number;
}

export interface DeliveryEstimate {
  restaurantId: string;
  distanceKm: number;
  zone: { id: string; name: string; radiusKm: number };
  deliveryFee: number;
  estimatedMinutes: number;
  breakdown: DeliveryFeeBreakdown;
}

export interface DeliveryEstimateQuery {
  lat: number;
  lon: number;
}
