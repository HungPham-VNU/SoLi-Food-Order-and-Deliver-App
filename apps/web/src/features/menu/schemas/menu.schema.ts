import { z } from 'zod';

export const createMenuItemSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  price: z
    .number({ invalid_type_error: 'Price is required' })
    .int('Price must be a whole number')
    .min(1000, 'Minimum price is 1,000₫'),
  itemKind: z.enum(['food', 'beverage', 'mixed'], {
    required_error: 'Item type is required',
  }),
  categoryId: z.string().uuid().optional(),
  description: z.string().optional(),
  sku: z.string().optional(),
  imageUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
});

export type CreateMenuItemFormValues = z.infer<typeof createMenuItemSchema>;
