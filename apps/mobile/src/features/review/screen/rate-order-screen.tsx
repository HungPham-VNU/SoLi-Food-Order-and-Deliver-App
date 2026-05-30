import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Star } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ALLOWED_REVIEW_TAGS,
  ReviewTag,
} from '@/src/features/review/api/review.api';
import {
  useMyReview,
  useSubmitReview,
} from '@/src/features/review/hooks/use-review';
import { useMyOrderDetail } from '@/src/features/orders/hooks/use-order-history';

const TAG_LABELS: Record<ReviewTag, string> = {
  fast_delivery: 'Fast delivery',
  good_packaging: 'Good packaging',
  fresh_food: 'Fresh food',
  accurate_order: 'Accurate order',
  friendly_service: 'Friendly service',
  poor_packaging: 'Poor packaging',
  late_delivery: 'Late delivery',
  wrong_order: 'Wrong order',
  cold_food: 'Cold food',
  missing_items: 'Missing items',
};

export function RateOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = id || '';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: order } = useMyOrderDetail(orderId);
  const { data: existing, isLoading: loadingExisting } = useMyReview(
    orderId,
    !!orderId,
  );

  const [stars, setStars] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [tags, setTags] = useState<ReviewTag[]>([]);

  const submit = useSubmitReview();

  const alreadyReviewed = !!existing && !submit.isError;
  const isDelivered = order?.status === 'delivered';
  const canSubmit =
    stars >= 1 && stars <= 5 && !submit.isPending && !alreadyReviewed && isDelivered;

  const charCount = comment.length;
  const tagLimitReached = tags.length >= 5;

  const headerTitle = useMemo(
    () => (alreadyReviewed ? 'Your Review' : 'Rate Your Order'),
    [alreadyReviewed],
  );

  const toggleTag = (tag: ReviewTag) => {
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 5) return prev;
      return [...prev, tag];
    });
  };

  const handleSubmit = () => {
    if (!canSubmit || !orderId) return;
    submit.mutate(
      {
        orderId,
        stars,
        comment: comment.trim() ? comment.trim() : undefined,
        tags: tags.length ? tags : undefined,
      },
      {
        onSuccess: () => {
          Alert.alert('Thank you!', 'Your review has been submitted.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error ? err.message : 'Failed to submit review.';
          Alert.alert('Submission failed', msg);
        },
      },
    );
  };

  const displayStars = alreadyReviewed && existing ? existing.stars : stars;
  const displayComment =
    alreadyReviewed && existing ? (existing.comment ?? '') : comment;
  const displayTags: ReviewTag[] =
    alreadyReviewed && existing
      ? ((existing.tags || []) as ReviewTag[])
      : tags;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 h-16 w-full bg-surface/80 z-50">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95"
        >
          <ArrowLeft size={24} color="#0d631b" />
        </TouchableOpacity>
        <Text
          className="text-lg text-primary ml-2"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          {headerTitle}
        </Text>
      </View>

      {loadingExisting ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0d631b" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 py-6">
          {!isDelivered && !alreadyReviewed && (
            <View className="bg-error/10 p-4 rounded-2xl mb-4">
              <Text
                className="text-error"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                You can only review delivered orders.
              </Text>
            </View>
          )}

          <View className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm mb-6">
            <Text
              className="text-on-surface text-base mb-4"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              How was your experience?
            </Text>
            <View className="flex-row justify-center mb-2">
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= displayStars;
                return (
                  <TouchableOpacity
                    key={n}
                    accessibilityLabel={`${n} star`}
                    disabled={alreadyReviewed}
                    onPress={() => setStars(n)}
                    className="px-1"
                  >
                    <Star
                      size={40}
                      color={filled ? '#f5a524' : '#cbd5e1'}
                      fill={filled ? '#f5a524' : 'transparent'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            {!alreadyReviewed && (
              <Text
                className="text-on-surface-variant text-center text-sm"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                Tap a star to rate (1-5)
              </Text>
            )}
          </View>

          <View className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm mb-6">
            <Text
              className="text-on-surface text-base mb-3"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              Tags (optional, up to 5)
            </Text>
            <View className="flex-row flex-wrap">
              {ALLOWED_REVIEW_TAGS.map((tag) => {
                const active = displayTags.includes(tag);
                const disabled =
                  alreadyReviewed || (tagLimitReached && !active);
                return (
                  <TouchableOpacity
                    key={tag}
                    disabled={disabled}
                    onPress={() => toggleTag(tag)}
                    className={`px-3 py-2 mr-2 mb-2 rounded-full border ${
                      active
                        ? 'bg-primary border-primary'
                        : 'bg-surface border-surface-container-high'
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

          <View className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm mb-6">
            <Text
              className="text-on-surface text-base mb-3"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              Comment (optional)
            </Text>
            {alreadyReviewed ? (
              <Text
                className="text-on-surface"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                {displayComment || '—'}
              </Text>
            ) : (
              <>
                <TextInput
                  value={comment}
                  onChangeText={(t) => {
                    if (t.length <= 1000) setComment(t);
                  }}
                  multiline
                  numberOfLines={4}
                  placeholder="Share more details about your experience…"
                  className="border border-surface-container-high rounded-xl p-3 text-on-surface"
                  style={{
                    fontFamily: 'Inter_400Regular',
                    textAlignVertical: 'top',
                    minHeight: 96,
                  }}
                />
                <Text
                  className="text-on-surface-variant text-xs mt-2 text-right"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  {charCount}/1000
                </Text>
              </>
            )}
          </View>

          {!alreadyReviewed && (
            <TouchableOpacity
              disabled={!canSubmit}
              onPress={handleSubmit}
              className={`rounded-2xl py-4 items-center mb-10 ${
                canSubmit ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              {submit.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  className={
                    canSubmit ? 'text-on-primary' : 'text-on-surface-variant'
                  }
                  style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 }}
                >
                  Submit Review
                </Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}
