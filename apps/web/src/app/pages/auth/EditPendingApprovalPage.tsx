import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { RegisterBusinessForm } from '@/features/auth/components/register/RegisterBusinessForm';
import { RegisterBusinessMap } from '@/features/auth/components/register/RegisterBusinessMap';
import { RegisterBusinessFooter } from '@/features/auth/components/register/RegisterBusinessFooter';
import { useMyRestaurant, useUpdateRestaurant } from '@/features/restaurant/hooks/useRestaurants';
import {
  updateRestaurantFormSchema,
  type UpdateRestaurantFormValues,
} from '@/features/restaurant/schemas/restaurant.schema';

export function EditPendingApprovalPage() {
  const navigate = useNavigate();
  const { data: restaurant, isLoading } = useMyRestaurant();
  const { mutate: updateRestaurant, isPending, error } = useUpdateRestaurant();

  const methods = useForm<UpdateRestaurantFormValues>({
    resolver: zodResolver(updateRestaurantFormSchema),
  });

  useEffect(() => {
    if (restaurant) {
      methods.reset({
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        cuisineType: restaurant.cuisineType ?? undefined,
        latitude: restaurant.latitude ?? undefined,
        longitude: restaurant.longitude ?? undefined,
      });
    }
  }, [restaurant, methods]);

  const onSubmit = (data: UpdateRestaurantFormValues) => {
    if (!restaurant) return;
    updateRestaurant(
      { id: restaurant.id, data },
      {
        onSuccess: () => navigate('/pending-approval', { replace: true }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant font-medium animate-pulse">Loading application details...</p>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="bg-surface text-on-surface antialiased min-h-screen flex flex-col items-center justify-center font-body"
      >
        <div className="w-full flex justify-center py-12 px-4 md:px-8 lg:px-12 pb-32">
          <main className="max-w-6xl w-full">
            {error && (
              <p className="mb-4 text-sm text-destructive text-center">
                {error.message}
              </p>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
              <RegisterBusinessForm 
                title="Edit Application Details"
                description="Update your restaurant information. Note that changes may delay the approval process."
              />
              <RegisterBusinessMap />
            </div>
          </main>
        </div>

        <RegisterBusinessFooter 
          isPending={isPending} 
          backHref="/pending-approval" 
          submitLabel="Save Changes" 
          showArrow={false}
        />
      </form>
    </FormProvider>
  );
}
