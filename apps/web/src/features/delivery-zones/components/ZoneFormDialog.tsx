import { useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { PriceInput } from '@/components/ui/price-input';
import type { DeliveryZone } from '../types';
import {
  useCreateDeliveryZone,
  useUpdateDeliveryZone,
} from '../hooks/useDeliveryZones';

const schema = z.object({
  name: z.string().min(1, 'Zone name is required'),
  radiusKm: z
    .number({ invalid_type_error: 'Must be a number' })
    .min(0.1, 'Min 0.1 km')
    .max(30, 'Max 30 km'),
  baseFee: z
    .number({ invalid_type_error: 'Must be a number' })
    .int('Must be whole VND')
    .min(0)
    .refine((v) => v % 1000 === 0, 'Must be a multiple of 1,000 ₫'),
  perKmRate: z
    .number({ invalid_type_error: 'Must be a number' })
    .int()
    .min(0)
    .refine((v) => v % 1000 === 0, 'Must be a multiple of 1,000 ₫'),
  avgSpeedKmh: z.number().int().min(1).max(120).optional(),
  prepTimeMinutes: z.number().int().min(0).optional(),
  bufferMinutes: z.number().int().min(0).optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface ZoneFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  /** Pass an existing zone to edit; omit to create. */
  zone?: DeliveryZone | null;
}

const defaultValues: FormValues = {
  name: '',
  radiusKm: 5,
  baseFee: 20000,
  perKmRate: 5000,
  avgSpeedKmh: 25,
  prepTimeMinutes: 15,
  bufferMinutes: 5,
  isActive: true,
};

export function ZoneFormDialog({
  open,
  onOpenChange,
  restaurantId,
  zone,
}: ZoneFormDialogProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isEdit = !!zone;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const { mutateAsync: createZone } = useCreateDeliveryZone(restaurantId);
  const { mutateAsync: updateZone } = useUpdateDeliveryZone(restaurantId);

  const radiusKm = useWatch({ control, name: 'radiusKm' });
  const isActive = useWatch({ control, name: 'isActive' });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (zone) {
      reset({
        name: zone.name,
        radiusKm: zone.radiusKm,
        baseFee: zone.baseFee,
        perKmRate: zone.perKmRate,
        avgSpeedKmh: zone.avgSpeedKmh,
        prepTimeMinutes: zone.prepTimeMinutes,
        bufferMinutes: zone.bufferMinutes,
        isActive: zone.isActive,
      });
    } else {
      reset(defaultValues);
    }

  }, [open, reset, zone]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (isEdit && zone) {
      await updateZone({ id: zone.id, data: values });
    } else {
      const createDto: Omit<FormValues, 'isActive'> = {
        name: values.name,
        radiusKm: values.radiusKm,
        baseFee: values.baseFee,
        perKmRate: values.perKmRate,
        avgSpeedKmh: values.avgSpeedKmh,
        prepTimeMinutes: values.prepTimeMinutes,
        bufferMinutes: values.bufferMinutes,
      };
      await createZone(createDto);
    }
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 max-w-lg sm:max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-outline-variant/10 flex justify-between items-center">
          <h2 className="font-headline font-extrabold text-2xl text-primary">
            {isEdit ? 'Edit Delivery Zone' : 'New Delivery Zone'}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-surface-container-high rounded-full transition-colors active:scale-90"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="flex flex-col">
          <div className="px-8 py-6 space-y-7 max-h-[60vh] overflow-y-auto">
            {/* Zone Name */}
            <div className="space-y-2">
              <label className="font-label font-bold text-sm text-on-surface-variant ml-1">
                Zone Name
              </label>
              <input
                type="text"
                placeholder="e.g., Riverside District"
                {...register('name')}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/30 focus:bg-surface-container-lowest transition-all placeholder:text-outline outline-none"
              />
              {errors.name && (
                <p className="text-xs text-error ml-1">{errors.name.message}</p>
              )}
            </div>

            {/* Radius Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="font-label font-bold text-sm text-on-surface-variant">
                  Coverage Radius
                </label>
                <span className="text-primary font-bold text-lg">
                  {radiusKm?.toFixed(1) ?? '5.0'} km
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={30}
                step={0.5}
                value={radiusKm ?? 5}
                onChange={(e) =>
                  setValue('radiusKm', parseFloat(e.target.value), {
                    shouldValidate: true,
                  })
                }
                className="w-full h-2 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-primary"
              />
              {errors.radiusKm && (
                <p className="text-xs text-error ml-1">{errors.radiusKm.message}</p>
              )}
            </div>

            {/* Fees */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-label font-bold text-sm text-on-surface-variant ml-1">
                  Base Fee (₫)
                </label>
                <Controller
                  name="baseFee"
                  control={control}
                  render={({ field: { value, onChange, ref, ...field } }) => (
                    <PriceInput
                      {...field}
                      value={value}
                      onChange={onChange}
                      className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/30 focus:bg-surface-container-lowest transition-all outline-none"
                    />
                  )}
                />
                {errors.baseFee && (
                  <p className="text-xs text-error ml-1">{errors.baseFee.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="font-label font-bold text-sm text-on-surface-variant ml-1">
                  Per-Kilometer Rate (₫/km)
                </label>
                <Controller
                  name="perKmRate"
                  control={control}
                  render={({ field: { value, onChange, ref, ...field } }) => (
                    <PriceInput
                      {...field}
                      value={value}
                      onChange={onChange}
                      className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/30 focus:bg-surface-container-lowest transition-all outline-none"
                    />
                  )}
                />
                {errors.perKmRate && (
                  <p className="text-xs text-error ml-1">
                    {errors.perKmRate.message}
                  </p>
                )}
              </div>
            </div>

            {/* Advanced */}
            <div className="bg-surface-container-low rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                className="w-full px-6 py-4 flex justify-between items-center hover:bg-surface-container-high transition-colors"
              >
                <span className="font-bold text-on-surface">Advanced Settings</span>
                <span
                  className={`material-symbols-outlined transition-transform ${
                    showAdvanced ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </button>
              {showAdvanced && (
                <div className="px-6 pb-6 pt-2 space-y-4">
                  <div className="space-y-2">
                    <label className="font-label font-medium text-xs text-on-surface-variant">
                      Avg Delivery Speed (km/h)
                    </label>
                    <input
                      type="number"
                      placeholder="25"
                      {...register('avgSpeedKmh', { valueAsNumber: true })}
                      className="w-full bg-surface-container-highest border-none rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="font-label font-medium text-xs text-on-surface-variant">
                        Prep Time (min)
                      </label>
                      <input
                        type="number"
                        placeholder="15"
                        {...register('prepTimeMinutes', { valueAsNumber: true })}
                        className="w-full bg-surface-container-highest border-none rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="font-label font-medium text-xs text-on-surface-variant">
                        Buffer Time (min)
                      </label>
                      <input
                        type="number"
                        placeholder="5"
                        {...register('bufferMinutes', { valueAsNumber: true })}
                        className="w-full bg-surface-container-highest border-none rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="font-bold text-on-surface">Activate immediately</p>
                <p className="text-xs text-on-surface-variant">
                  Orders will be accepted as soon as created.
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={(v) =>
                  setValue('isActive', v, { shouldValidate: true })
                }
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-surface-container-low/50 flex gap-4 border-t border-outline-variant/10">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 py-3 text-primary font-bold hover:bg-surface-container-highest transition-colors rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] bg-gradient-to-r from-primary to-primary-container text-white py-3 font-bold rounded-full shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {isSubmitting
                ? isEdit
                  ? 'Saving…'
                  : 'Creating…'
                : isEdit
                ? 'Save Changes'
                : 'Create Zone'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
