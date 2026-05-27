import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Tag,
  Percent,
  DollarSign,
  Truck,
  Gift,
  Globe,
  Store,
  Zap,
  Ticket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreatePromotion,
  useUpdatePromotion,
  usePromotion,
  useActivatePromotion,
} from '@/features/promotions/hooks/usePromotions';
import type {
  CreatePromotionDto,
  Promotion,
  PromotionScope,
  PromotionTrigger,
  PromotionType,
  StackingMode,
} from '@/features/promotions/api/promotions.api';
import { ApiError } from '@/lib/api-client';

const TYPE_OPTIONS: { value: PromotionType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'percentage', label: 'Percentage off', icon: <Percent className="h-4 w-4" />, description: 'e.g. 15% off' },
  { value: 'fixed_amount', label: 'Fixed amount off', icon: <DollarSign className="h-4 w-4" />, description: 'e.g. ₫50,000 off' },
  { value: 'free_delivery', label: 'Free delivery', icon: <Truck className="h-4 w-4" />, description: 'Waive shipping fee' },
  { value: 'reduced_delivery', label: 'Reduced delivery', icon: <Truck className="h-4 w-4" />, description: 'e.g. ₫10,000 off shipping' },
  { value: 'buy_x_get_y', label: 'Buy X get Y', icon: <Gift className="h-4 w-4" />, description: 'Buy-one-get-one promo' },
  { value: 'free_item', label: 'Free item', icon: <Gift className="h-4 w-4" />, description: 'Free menu item' },
];

const STACKING_OPTIONS: { value: StackingMode; label: string; description: string }[] = [
  { value: 'non_stackable', label: 'Non-stackable', description: 'Cannot combine with other promotions' },
  { value: 'stackable', label: 'Stackable', description: 'Can combine with other stackable promotions' },
  { value: 'exclusive', label: 'Exclusive', description: 'Blocks all other promotions' },
];

// Convert ISO 8601 → "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

// Default to "now" + 1 hour
function defaultStartsAt(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toLocalDateTimeInput(d.toISOString());
}

// Default to "now" + 30 days
function defaultEndsAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setHours(23, 59, 0, 0);
  return toLocalDateTimeInput(d.toISOString());
}

export function PromotionFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: existing, isLoading: loadingExisting } = usePromotion(id ?? null);

  if (isEdit && loadingExisting) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-3xl">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <PromotionFormContent
      key={existing?.id ?? 'new'}
      id={id ?? null}
      existing={existing ?? null}
    />
  );
}

function PromotionFormContent({
  id,
  existing,
}: {
  id: string | null;
  existing: Promotion | null;
}) {
  const isEdit = !!id;
  const navigate = useNavigate();
  const createMutation = useCreatePromotion();
  const updateMutation = useUpdatePromotion();
  const activateMutation = useActivatePromotion();

  // ---- form state ----
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [type, setType] = useState<PromotionType>(
    existing?.type ?? 'percentage',
  );
  const [scope, setScope] = useState<PromotionScope>(
    existing?.scope ?? 'platform',
  );
  const [restaurantId, setRestaurantId] = useState(
    existing?.restaurantId ?? '',
  );
  const [trigger, setTrigger] = useState<PromotionTrigger>(
    existing?.trigger ?? 'auto_apply',
  );
  const [stackingMode, setStackingMode] = useState<StackingMode>(
    existing?.stackingMode ?? 'non_stackable',
  );
  const [discountValue, setDiscountValue] = useState<string>(
    existing ? String(existing.discountValue) : '',
  );
  const [minOrderAmount, setMinOrderAmount] = useState<string>(
    existing?.minOrderAmount ? String(existing.minOrderAmount) : '',
  );
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<string>(
    existing?.maxDiscountAmount ? String(existing.maxDiscountAmount) : '',
  );
  const [maxTotalUses, setMaxTotalUses] = useState<string>(
    existing?.maxTotalUses ? String(existing.maxTotalUses) : '',
  );
  const [maxUsesPerUser, setMaxUsesPerUser] = useState<string>(
    existing?.maxUsesPerUser ? String(existing.maxUsesPerUser) : '',
  );
  const [startsAt, setStartsAt] = useState<string>(
    existing ? toLocalDateTimeInput(existing.startsAt) : defaultStartsAt(),
  );
  const [endsAt, setEndsAt] = useState<string>(
    existing ? toLocalDateTimeInput(existing.endsAt) : defaultEndsAt(),
  );

  // ---- derived ----
  const isPercentage = type === 'percentage';
  const usesVNDValue = type === 'fixed_amount' || type === 'reduced_delivery';
  const showDiscountField = type !== 'free_delivery' && type !== 'buy_x_get_y' && type !== 'free_item';

  // ---- validation ----
  const [validationError, setValidationError] = useState<string | null>(null);

  function buildDto(): CreatePromotionDto | null {
    if (name.trim().length < 2) return setValidationError('Name must be at least 2 characters'), null;
    if (scope === 'restaurant' && !restaurantId.trim()) {
      return setValidationError('Restaurant ID is required for restaurant-scope promotions'), null;
    }

    const value = parseInt(discountValue, 10);
    if (showDiscountField) {
      if (!Number.isFinite(value) || value < 1) {
        return setValidationError('Discount value is required'), null;
      }
      if (isPercentage && (value < 1 || value > 100)) {
        return setValidationError('Percentage must be between 1 and 100'), null;
      }
      if (usesVNDValue && value % 1000 !== 0) {
        return setValidationError('VND amounts must be multiples of 1,000'), null;
      }
    }

    const start = new Date(startsAt).toISOString();
    const end = new Date(endsAt).toISOString();
    if (new Date(end) <= new Date(start)) {
      return setValidationError('End date must be after start date'), null;
    }

    setValidationError(null);

    const dto: CreatePromotionDto = {
      name: name.trim(),
      ...(description.trim() && { description: description.trim() }),
      type,
      scope,
      trigger,
      stackingMode,
      ...(scope === 'restaurant' && { restaurantId: restaurantId.trim() }),
      discountValue: showDiscountField ? value : 0,
      ...(minOrderAmount && { minOrderAmount: parseInt(minOrderAmount, 10) }),
      ...(isPercentage && maxDiscountAmount && {
        maxDiscountAmount: parseInt(maxDiscountAmount, 10),
      }),
      ...(maxTotalUses && { maxTotalUses: parseInt(maxTotalUses, 10) }),
      ...(maxUsesPerUser && { maxUsesPerUser: parseInt(maxUsesPerUser, 10) }),
      startsAt: start,
      endsAt: end,
    };
    return dto;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>, publish: boolean) {
    e.preventDefault();
    const dto = buildDto();
    if (!dto) return;

    try {
      if (isEdit && id) {
        // Editing — type/scope/trigger are immutable, send only the editable fields
        const { type: _t, scope: _s, trigger: _tr, ...editable } = dto;
        void _t; void _s; void _tr;
        await updateMutation.mutateAsync({ id, dto: editable });
      } else {
        const created = await createMutation.mutateAsync(dto);
        if (publish) {
          await activateMutation.mutateAsync(created.id);
        }
      }
      navigate('/promotions');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save promotion';
      setValidationError(message);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending || activateMutation.isPending;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to="/promotions">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-on-surface">
          {isEdit ? 'Edit promotion' : 'New promotion'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isEdit
            ? 'Update the details of this promotion. Type, scope, and trigger cannot be changed.'
            : 'Create a promotion to attract customers to the platform.'}
        </p>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* ── Basics ───────────────────────────────────────────────────── */}
        <Section title="Basics" icon={<Tag className="h-4 w-4" />}>
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Sale 15% Off"
              required
              minLength={2}
            />
          </Field>
          <Field
            label="Description"
            hint="Optional marketing copy shown to customers."
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Get 15% off all orders above ₫100,000 this summer!"
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </Field>
        </Section>

        {/* ── Type & Scope ─────────────────────────────────────────────── */}
        <Section title="Type & scope" icon={<Tag className="h-4 w-4" />}>
          <Field label="Discount type" required>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isEdit}
                    onClick={() => setType(opt.value)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      active
                        ? 'border-primary bg-primary-50/40 ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-surface-container/50'
                    } ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                      {opt.icon}
                      {opt.label}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Scope" required>
            <div className="grid grid-cols-2 gap-2">
              <ChoiceCard
                active={scope === 'platform'}
                disabled={isEdit}
                icon={<Globe className="h-4 w-4" />}
                title="Platform-wide"
                description="Applies to all restaurants on the platform."
                onClick={() => setScope('platform')}
              />
              <ChoiceCard
                active={scope === 'restaurant'}
                disabled={isEdit}
                icon={<Store className="h-4 w-4" />}
                title="Single restaurant"
                description="Applies only to one specific restaurant."
                onClick={() => setScope('restaurant')}
              />
            </div>
            {scope === 'restaurant' && (
              <div className="mt-3">
                <Label htmlFor="restaurantId" className="text-xs">
                  Restaurant ID *
                </Label>
                <Input
                  id="restaurantId"
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  placeholder="UUID"
                  className="font-mono text-xs"
                  disabled={isEdit}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Find the restaurant's UUID on the Restaurants page.
                </p>
              </div>
            )}
          </Field>

          <Field label="Trigger" required>
            <div className="grid grid-cols-2 gap-2">
              <ChoiceCard
                active={trigger === 'auto_apply'}
                disabled={isEdit}
                icon={<Zap className="h-4 w-4" />}
                title="Auto-apply"
                description="Applied automatically when conditions are met."
                onClick={() => setTrigger('auto_apply')}
              />
              <ChoiceCard
                active={trigger === 'coupon_code'}
                disabled={isEdit}
                icon={<Ticket className="h-4 w-4" />}
                title="Coupon code"
                description="Customer must enter a code at checkout."
                onClick={() => setTrigger('coupon_code')}
              />
            </div>
          </Field>
        </Section>

        {/* ── Discount value ───────────────────────────────────────────── */}
        {showDiscountField && (
          <Section title="Discount value" icon={<Percent className="h-4 w-4" />}>
            <Field
              label={isPercentage ? 'Percentage off (%)' : 'Amount off (₫)'}
              required
              hint={
                isPercentage
                  ? 'Whole number between 1 and 100.'
                  : 'VND amount — must be a multiple of 1,000.'
              }
            >
              <Input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={isPercentage ? '15' : '50000'}
                min={1}
                max={isPercentage ? 100 : undefined}
                step={usesVNDValue ? 1000 : 1}
                required
              />
            </Field>

            {isPercentage && (
              <Field
                label="Max discount cap (₫)"
                hint="Optional. Caps the discount for high-value orders. Multiple of 1,000."
              >
                <Input
                  type="number"
                  value={maxDiscountAmount}
                  onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  placeholder="50000"
                  min={0}
                  step={1000}
                />
              </Field>
            )}
          </Section>
        )}

        {/* ── Limits ───────────────────────────────────────────────────── */}
        <Section title="Eligibility & limits" icon={<Tag className="h-4 w-4" />}>
          <Field
            label="Minimum order amount (₫)"
            hint="Optional. Order subtotal must be at least this much. Multiple of 1,000."
          >
            <Input
              type="number"
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              placeholder="100000"
              min={0}
              step={1000}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Max total uses" hint="Leave empty for unlimited.">
              <Input
                type="number"
                value={maxTotalUses}
                onChange={(e) => setMaxTotalUses(e.target.value)}
                placeholder="1000"
                min={1}
              />
            </Field>
            <Field label="Max uses per customer" hint="Leave empty for unlimited.">
              <Input
                type="number"
                value={maxUsesPerUser}
                onChange={(e) => setMaxUsesPerUser(e.target.value)}
                placeholder="1"
                min={1}
              />
            </Field>
          </div>

          <Field label="Stacking mode">
            <div className="space-y-2">
              {STACKING_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    stackingMode === opt.value
                      ? 'border-primary bg-primary-50/40'
                      : 'border-border hover:bg-surface-container/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="stackingMode"
                    value={opt.value}
                    checked={stackingMode === opt.value}
                    onChange={() => setStackingMode(opt.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium text-on-surface">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </Field>
        </Section>

        {/* ── Schedule ─────────────────────────────────────────────────── */}
        <Section title="Schedule" icon={<Tag className="h-4 w-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Starts at" required>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </Field>
            <Field label="Ends at" required>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
            </Field>
          </div>
        </Section>

        {/* ── Error banner ─────────────────────────────────────────────── */}
        {validationError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* ── Footer actions ───────────────────────────────────────────── */}
        <div className="sticky bottom-0 -mx-4 lg:-mx-6 bg-background border-t px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
          <Button asChild variant="ghost" type="button">
            <Link to="/promotions">Cancel</Link>
          </Button>
          <div className="flex items-center gap-2">
            {!isEdit && (
              <>
                <Button type="submit" variant="outline" disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save as Draft'}
                </Button>
                <Button
                  type="button"
                  onClick={(e) => handleSubmit(e as any, true)}
                  disabled={isSaving}
                >
                  {isSaving ? 'Publishing…' : 'Publish Promotion'}
                </Button>
              </>
            )}
            {isEdit && (
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save changes'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-primary">{icon}</span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ChoiceCard({
  active,
  disabled,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-colors ${
        active
          ? 'border-primary bg-primary-50/40 ring-1 ring-primary'
          : 'border-border bg-card hover:bg-surface-container/50'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
        {icon}
        {title}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </button>
  );
}
