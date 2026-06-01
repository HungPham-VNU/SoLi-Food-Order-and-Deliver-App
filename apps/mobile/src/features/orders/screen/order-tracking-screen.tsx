import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  ChefHat,
  ClipboardList,
  Star,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { formatCurrency } from '@/src/lib/format-utils';
import { useMyOrderDetail } from '../hooks/use-order-history';
import type { OrderDetail, OrderStatus } from '../types';
import {
  ALLOWED_REVIEW_TAGS,
  type ReviewTag,
  TAG_LABELS,
  REVIEWABLE_ORDER_STATUSES,
} from '@/src/features/review/api/review.api';
import {
  useMyReview,
  useSubmitReview,
} from '@/src/features/review/hooks/use-review';
import { useMenuItemImage } from '@/src/features/restaurants/api';

// ─── Status rank map ─────────────────────────────────────────────────────────

const STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  pending: 0,
  paid: 1,
  confirmed: 2,
  preparing: 3,
  ready_for_pickup: 4,
  picked_up: 5,
  delivering: 6,
  delivered: 7,
};

const TERMINAL_STATUSES: OrderStatus[] = ['cancelled', 'refunded'];

// ─── Step definitions ─────────────────────────────────────────────────────────

type StepState = 'completed' | 'active' | 'pending';

interface StepConfig {
  id: string;
  title: string;
  getTitle?: (state: StepState, order: OrderDetail) => string;
  getSubtitle: (state: StepState, order: OrderDetail) => string;
  completedAtRank: number;
  activeAtRanks: number[];
}

const STEPS: StepConfig[] = [
  {
    id: 'accepted',
    title: 'Order Accepted',
    getTitle: (state) =>
      state === 'active' ? 'Waiting for restaurant to accept' : 'Order Accepted',
    getSubtitle: (state, order) => {
      if (state === 'active') return 'Please be patient, this usually takes a few minutes';
      const entry = order.timeline.find(
        (e) => (STATUS_RANK[e.toStatus] ?? -1) >= 2,
      );
      return entry ? formatTime(entry.createdAt) : '';
    },
    completedAtRank: 2,
    activeAtRanks: [0, 1],
  },
  {
    id: 'preparing',
    title: 'Preparing',
    getSubtitle: (_state, order) => {
      if ((STATUS_RANK[order.status] ?? -1) >= 4) {
        const entry = order.timeline.find(
          (e) => (STATUS_RANK[e.toStatus] ?? -1) >= 4,
        );
        return entry ? formatTime(entry.createdAt) : 'Food is ready';
      }
      if (order.estimatedDeliveryMinutes) {
        const expected = new Date(
          new Date(order.createdAt).getTime() +
            order.estimatedDeliveryMinutes * 60 * 1000,
        );
        return `Expected by ${expected.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })}`;
      }
      return 'Restaurant is preparing your food';
    },
    completedAtRank: 4,
    activeAtRanks: [2, 3],
  },
  {
    id: 'done',
    title: 'Done',
    getSubtitle: (_state, order) => {
      const entry = order.timeline.find(
        (e) => (STATUS_RANK[e.toStatus] ?? -1) >= 4,
      );
      return entry ? formatTime(entry.createdAt) : 'Your order is complete';
    },
    completedAtRank: 4,
    activeAtRanks: [],
  },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStepState(step: StepConfig, currentRank: number): StepState {
  if (currentRank >= step.completedAtRank) return 'completed';
  if (step.activeAtRanks.includes(currentRank)) return 'active';
  return 'pending';
}

// ─── Pulse ring for active step ───────────────────────────────────────────────

function PulseRing() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.5] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0.2, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#8b5000',
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

// ─── Step indicator dot ───────────────────────────────────────────────────────

const STEP_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  accepted: ClipboardList,
  preparing: ChefHat,
  done: ClipboardList,
};

function StepDot({
  stepId,
  state,
}: {
  stepId: string;
  state: StepState;
}) {
  const Icon = STEP_ICONS[stepId] ?? ClipboardList;

  if (state === 'completed') {
    return (
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: '#0d631b',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Check size={14} color="#ffffff" strokeWidth={3} />
      </View>
    );
  }

  if (state === 'active') {
    return (
      <View
        style={{
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PulseRing />
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#8b5000',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <Icon size={13} color="#ffffff" />
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#bfcaba',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#bfcaba' }}
      />
    </View>
  );
}

// ─── Single step row ──────────────────────────────────────────────────────────

function TrackStep({
  step,
  state,
  title,
  subtitle,
  isLast,
}: {
  step: StepConfig;
  state: StepState;
  title: string;
  subtitle: string;
  isLast: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 16,
        opacity: state === 'pending' ? 0.5 : 1,
      }}
    >
      {/* Icon column + connector */}
      <View style={{ alignItems: 'center', width: 24 }}>
        <StepDot stepId={step.id} state={state} />
        {!isLast && (
          <View
            style={{
              flex: 1,
              width: 2,
              backgroundColor: '#e2e2e2',
              marginTop: 6,
              minHeight: 32,
            }}
          />
        )}
      </View>

      {/* Text column */}
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 8 }}>
        <Text
          style={{
            fontFamily:
              state === 'active'
                ? 'PlusJakartaSans_700Bold'
                : 'PlusJakartaSans_600SemiBold',
            fontSize: 15,
            color: '#1a1c1c',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            color: '#40493d',
            marginTop: 2,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

// ─── Inline rating section ────────────────────────────────────────────────────


function RateSection({ orderId }: { orderId: string }) {
  const {
    data: existing,
    isLoading,
    isError: reviewLoadError,
  } = useMyReview(orderId, !!orderId);
  const submit = useSubmitReview();

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<ReviewTag[]>([]);

  const alreadyReviewed = existing != null;

  const displayStars = alreadyReviewed && existing ? existing.stars : stars;
  const displayComment = alreadyReviewed && existing ? (existing.comment ?? '') : comment;
  const displayTags: ReviewTag[] =
    alreadyReviewed && existing ? ((existing.tags || []) as ReviewTag[]) : tags;

  const canSubmit = stars >= 1 && stars <= 5 && !submit.isPending && !alreadyReviewed && !reviewLoadError;
  const tagLimitReached = tags.length >= 5;

  const toggleTag = (tag: ReviewTag) => {
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 5) return prev;
      return [...prev, tag];
    });
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    submit.mutate(
      {
        orderId,
        stars,
        comment: comment.trim() || undefined,
        tags: tags.length ? tags : undefined,
      },
      {
        onSuccess: () => {
          Alert.alert('Thank you!', 'Your review has been submitted.');
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error
              ? err.message.split('\n')[0]
              : 'Failed to submit review.';
          Alert.alert('Submission failed', msg);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <View className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/15 items-center">
        <ActivityIndicator size="small" color="#0d631b" />
      </View>
    );
  }

  if (reviewLoadError) {
    return (
      <View className="bg-error/10 rounded-xl p-6 border border-outline-variant/15">
        <Text className="text-error text-sm" style={{ fontFamily: 'Inter_600SemiBold' }}>
          Could not load your review. Please go back and try again.
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/15 gap-5">
      {/* Header */}
      <View className="flex-row items-center gap-2">
        <Star size={20} color="#f5a524" fill="#f5a524" />
        <Text className="text-lg text-on-surface" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
          {alreadyReviewed ? 'Your Review' : 'Rate Your Order'}
        </Text>
      </View>

      {/* Stars */}
      <View>
        <Text className="text-on-surface text-sm mb-3" style={{ fontFamily: 'Inter_600SemiBold' }}>
          How was your experience?
        </Text>
        <View className="flex-row gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= displayStars;
            return (
              <TouchableOpacity
                key={n}
                accessibilityLabel={`${n} star`}
                disabled={alreadyReviewed}
                onPress={() => setStars(n)}
                className="p-1"
              >
                <Star
                  size={36}
                  color={filled ? '#f5a524' : '#cbd5e1'}
                  fill={filled ? '#f5a524' : 'transparent'}
                />
              </TouchableOpacity>
            );
          })}
        </View>
        {!alreadyReviewed && (
          <Text className="text-on-surface-variant text-xs mt-1" style={{ fontFamily: 'Inter_400Regular' }}>
            Tap a star to rate
          </Text>
        )}
      </View>

      {/* Tags */}
      <View>
        <Text className="text-on-surface text-sm mb-2" style={{ fontFamily: 'Inter_600SemiBold' }}>
          Tags{alreadyReviewed ? '' : ' (optional, up to 5)'}
        </Text>
        <View className="flex-row flex-wrap gap-y-2">
          {ALLOWED_REVIEW_TAGS.map((tag) => {
            const active = displayTags.includes(tag);
            const disabled = alreadyReviewed || (tagLimitReached && !active);
            return (
              <TouchableOpacity
                key={tag}
                disabled={disabled}
                onPress={() => toggleTag(tag)}
                className={`px-3 py-1.5 mr-2 rounded-full border ${
                  active ? 'bg-primary border-primary' : 'bg-surface border-surface-container-high'
                } ${disabled && !active ? 'opacity-40' : ''}`}
              >
                <Text
                  className={active ? 'text-on-primary' : 'text-on-surface'}
                  style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12 }}
                >
                  {TAG_LABELS[tag]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Comment */}
      <View>
        <Text className="text-on-surface text-sm mb-2" style={{ fontFamily: 'Inter_600SemiBold' }}>
          Comment{alreadyReviewed ? '' : ' (optional)'}
        </Text>
        {alreadyReviewed ? (
          <Text className="text-on-surface-variant" style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}>
            {displayComment || '—'}
          </Text>
        ) : (
          <>
            <TextInput
              value={comment}
              onChangeText={(t) => { if (t.length <= 1000) setComment(t); }}
              multiline
              numberOfLines={3}
              placeholder="Share more details about your experience…"
              className="border border-surface-container-high rounded-xl p-3 text-on-surface"
              style={{ fontFamily: 'Inter_400Regular', textAlignVertical: 'top', minHeight: 80 }}
            />
            <Text
              className="text-on-surface-variant text-xs mt-1 text-right"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {comment.length}/1000
            </Text>
          </>
        )}
      </View>

      {/* Submit */}
      {!alreadyReviewed && (
        <TouchableOpacity
          disabled={!canSubmit}
          onPress={handleSubmit}
          className={`rounded-2xl py-3.5 items-center ${canSubmit ? 'bg-primary' : 'bg-surface-container-high'}`}
        >
          {submit.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              className={canSubmit ? 'text-on-primary' : 'text-on-surface-variant'}
              style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 }}
            >
              Submit Review
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

function OrderTrackingItemCard({
  item,
}: {
  item: OrderDetail['items'][number];
}) {
  const { data: menuItemImageUrl } = useMenuItemImage(item.menuItemId);

  return (
    <View className="bg-surface-container-lowest flex-row items-start p-4 rounded-3xl gap-4 border border-outline-variant/15">
      <View className="w-14 h-14 rounded-xl bg-surface-container items-center justify-center flex-shrink-0 overflow-hidden">
        {menuItemImageUrl ? (
          <Image
            source={{ uri: menuItemImageUrl }}
            className="w-full h-full"
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <Text
            className="text-primary text-xl"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
          >
            {item.itemName.charAt(0)}
          </Text>
        )}
      </View>

      <View className="flex-1">
        <Text
          className="text-base text-on-surface"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          numberOfLines={2}
        >
          {item.itemName}
        </Text>
        {item.modifiers.length > 0 && (
          <View className="mt-1 gap-0.5">
            {item.modifiers.map((mod) => (
              <Text
                key={mod.optionId}
                className="text-xs text-on-surface-variant"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                + {mod.optionName}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View className="items-end">
        <Text
          className="text-base text-primary"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          {formatCurrency(item.subtotal)}
        </Text>
        <Text
          className="text-xs text-on-surface-variant mt-1"
          style={{ fontFamily: 'Inter_500Medium' }}
        >
          Qty: {item.quantity}
        </Text>
      </View>
    </View>
  );
}

export function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: order, isLoading, isError } = useMyOrderDetail(id ?? '');

  const shortId = order?.orderId.slice(0, 8).toUpperCase() ?? '';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 h-16 w-full bg-surface/80 z-50">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full"
        >
          <ArrowLeft size={24} color="#0d631b" />
        </TouchableOpacity>
        <Text
          className="text-lg text-on-surface ml-2 flex-1"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          {shortId ? `Order #${shortId}` : 'Track Order'}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0d631b" />
        </View>
      ) : isError || !order ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text
            className="text-error text-center"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Failed to load order details.
          </Text>
        </View>
      ) : (
        <OrderTrackingContent order={order} insets={insets} />
      )}
    </View>
  );
}

function OrderTrackingContent({
  order,
  insets,
}: {
  order: OrderDetail;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const currentRank = STATUS_RANK[order.status] ?? -1;
  const isCancelled = TERMINAL_STATUSES.includes(order.status);

  const subtotal = order.subtotal;
  const discount = Math.max(0, subtotal + order.shippingFee - order.totalAmount);

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        paddingBottom: insets.bottom + 24,
        paddingTop: 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 gap-6">
        {/* ── Order Items ── */}
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-xl text-on-surface"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              Order Details
            </Text>
            <View className="bg-surface-container-highest px-3 py-1 rounded-full">
              <Text
                className="text-xs text-on-surface-variant"
                style={{ fontFamily: 'Inter_700Bold' }}
              >
                {order.items.length} ITEM{order.items.length !== 1 ? 'S' : ''}
              </Text>
            </View>
          </View>

          {order.items.map((item) => (
            <OrderTrackingItemCard key={item.orderItemId} item={item} />
          ))}
        </View>

        {/* ── Price Details ── */}
        <View className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/15 gap-3">
          <Text
            className="text-base text-on-surface mb-1"
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            Price Details
          </Text>

          <View className="flex-row justify-between">
            <Text
              className="text-sm text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              Subtotal
            </Text>
            <Text
              className="text-sm text-on-surface-variant"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              {formatCurrency(subtotal)}
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text
              className="text-sm text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              Delivery Fee
            </Text>
            <Text
              className="text-sm text-on-surface-variant"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              {formatCurrency(order.shippingFee)}
            </Text>
          </View>

          {discount > 0 && (
            <View className="flex-row justify-between">
              <Text
                className="text-sm text-primary"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                Discount
              </Text>
              <Text
                className="text-sm text-primary"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                -{formatCurrency(discount)}
              </Text>
            </View>
          )}

          <View className="border-t border-outline-variant/20 pt-4 mt-1 flex-row items-center justify-between">
            <Text
              className="text-lg text-on-surface"
              style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
            >
              Total
            </Text>
            <Text
              className="text-2xl text-secondary"
              style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
            >
              {formatCurrency(order.totalAmount)}
            </Text>
          </View>
        </View>

        {/* ── Order Status ── */}
        <View className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/15 gap-6 mb-2">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-lg text-on-surface"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              Order Status
            </Text>
            {isCancelled && (
              <View className="bg-error/10 px-3 py-1 rounded-full">
                <Text
                  className="text-xs text-error"
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                >
                  {order.status === 'refunded' ? 'REFUNDED' : 'CANCELLED'}
                </Text>
              </View>
            )}
          </View>

          {isCancelled ? (
            <View className="gap-2">
              <Text
                className="text-on-surface-variant"
                style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}
              >
                This order has been {order.status}.
              </Text>
              {order.timeline.length > 0 && (
                <Text
                  className="text-on-surface-variant text-xs"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  Last updated:{' '}
                  {formatTime(order.timeline[order.timeline.length - 1].createdAt)}
                </Text>
              )}
            </View>
          ) : (
            <View style={{ gap: 0 }}>
              {STEPS.map((step, index) => {
                const state = getStepState(step, currentRank);
                return (
                  <TrackStep
                    key={step.id}
                    step={step}
                    state={state}
                    title={step.getTitle?.(state, order) ?? step.title}
                    subtitle={step.getSubtitle(state, order)}
                    isLast={index === STEPS.length - 1}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* ── Rate & Review section (done/delivered) ── */}
        {(REVIEWABLE_ORDER_STATUSES as readonly string[]).includes(order.status) && (
          <RateSection orderId={order.orderId} />
        )}
      </View>
    </ScrollView>
  );
}
