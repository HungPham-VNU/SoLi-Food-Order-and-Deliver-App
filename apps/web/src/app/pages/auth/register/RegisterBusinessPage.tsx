import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { RegisterBusinessForm } from '@/features/auth/components/register/RegisterBusinessForm';
import { RegisterBusinessMap } from '@/features/auth/components/register/RegisterBusinessMap';
import { RegisterBusinessFooter } from '@/features/auth/components/register/RegisterBusinessFooter';
import { useCreateRestaurant } from '@/features/restaurant';
import {
  restaurantFormSchema,
  type RestaurantFormValues,
} from '@/features/restaurant/schemas/restaurant.schema';

export function RegisterLocationPage() {
  const navigate = useNavigate();
  const { mutate: createRestaurant, isPending, error } = useCreateRestaurant();

  const methods = useForm<RestaurantFormValues>({
    resolver: zodResolver(restaurantFormSchema),
  });

  const onSubmit = (data: RestaurantFormValues) => {
    createRestaurant(data, {
      onSuccess: () => navigate('/auth/register/pending', { state: { step2Completed: true } }),
    });
  };

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
              <RegisterBusinessForm />
              <RegisterBusinessMap />
            </div>
          </main>
        </div>

        <RegisterBusinessFooter isPending={isPending} />
      </form>
    </FormProvider>
  );
}
