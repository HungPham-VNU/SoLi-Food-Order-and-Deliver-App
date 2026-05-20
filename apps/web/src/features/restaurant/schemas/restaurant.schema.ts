import { z } from 'zod';

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().url('Must be a valid URL').optional(),
);

export const restaurantSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  address: z.string().trim().min(1, 'Address is required'),
  phone: z.string().trim().min(1, 'Phone is required'),
  description: z.string().trim().optional(),
  cuisineType: z.string().trim().optional(),
  logoUrl: optionalUrl,
  coverImageUrl: optionalUrl,
});

export type RestaurantFormValues = z.infer<typeof restaurantSchema>;
export type UpdateRestaurantFormValues = Partial<RestaurantFormValues>;
