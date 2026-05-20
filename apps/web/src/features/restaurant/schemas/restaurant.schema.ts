import { z } from 'zod';

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().url('Must be a valid URL').optional(),
);

export const restaurantFormSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  address: z.string().trim().min(5, 'Address is required'),
  phone: z.string().trim().min(7, 'Phone number is required'),
  description: z.string().trim().optional(),
  cuisineType: z.string().trim().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  logoUrl: optionalUrl,
  coverImageUrl: optionalUrl,
});

export const restaurantSchema = restaurantFormSchema;

export const updateRestaurantFormSchema = restaurantFormSchema.partial().extend({
  isOpen: z.boolean().optional(),
});

export type RestaurantFormValues = z.infer<typeof restaurantFormSchema>;
export type UpdateRestaurantFormValues = z.infer<
  typeof updateRestaurantFormSchema
>;
