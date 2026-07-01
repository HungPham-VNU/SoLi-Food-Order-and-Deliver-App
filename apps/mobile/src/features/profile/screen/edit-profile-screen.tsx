import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  TextInputProps,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Camera,
  Lock,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LinearGradient } from 'expo-linear-gradient';
import { useSession, authClient } from '@/src/lib/auth-client';
import { KeyboardAwareScrollView } from '@/src/components/keyboard-aware-scroll-view';
import { keyboardAvoidingBehavior } from '@/src/lib/keyboard';
import Toast from 'react-native-toast-message';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
});

type FormData = z.infer<typeof schema>;

// ─── ProfileField ─────────────────────────────────────────────────────────────

interface ProfileFieldProps extends TextInputProps {
  label: string;
  icon: React.ReactNode;
  error?: string;
}

function ProfileField({
  label,
  icon,
  error,
  ...inputProps
}: ProfileFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-1.5">
      <Text className="ml-1 font-inter text-xs font-medium uppercase tracking-wider text-on-surface-variant">
        {label}
      </Text>
      <View
        className="flex-row items-center overflow-hidden rounded-xl"
        style={{
          height: 56,
          backgroundColor: focused ? '#ffffff' : '#e8e8e8',
          borderWidth: focused ? 2 : error ? 1.5 : 0,
          borderColor: focused
            ? 'rgba(13,99,27,0.3)'
            : error
              ? '#ba1a1a'
              : 'transparent',
        }}
      >
        <View className="pl-4 pr-2">{icon}</View>
        <TextInput
          className="flex-1 pr-4 text-on-surface"
          style={{ fontFamily: 'Inter_400Regular', fontSize: 16 }}
          placeholderTextColor="#707a6c"
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          {...inputProps}
        />
      </View>
      {error ? (
        <Text className="ml-1 font-inter text-xs text-error">{error}</Text>
      ) : null}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: session, isPending, refetch } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  });

  // Hydrate form from session; also re-syncs after refetch()
  useEffect(() => {
    if (session?.user) {
      reset({ name: session.user.name, email: session.user.email });
    }
  }, [session?.user, reset]);

  const currentPhone =
    typeof (session?.user as Record<string, unknown>)?.phoneNumber === 'string'
      ? ((session?.user as Record<string, unknown>).phoneNumber as string)
      : '';

  const onSubmit = async (data: FormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const nameChanged = data.name !== session?.user.name;
    const emailChanged = data.email !== session?.user.email;
    let nameErr: string | null = null;
    let emailErr: string | null = null;
    let emailMsg: string | null = null;

    try {
      if (nameChanged) {
        const { error } = await authClient.updateUser({ name: data.name });
        if (error) nameErr = error.message ?? 'Could not update name.';
      }
      if (emailChanged) {
        // POST /api/auth/change-email — confirmed via Scalar docs
        // Response: { status: boolean, message?: "Email updated" | "Verification email sent" }
        const { data: res, error } = await authClient.changeEmail({
          newEmail: data.email,
          callbackURL: 'uitfood://edit-profile',
        });
        if (error) emailErr = error.message ?? 'Could not update email.';
        else
          emailMsg =
            ((res as Record<string, unknown>)?.message as string) ?? null;
      }
      await refetch();
    } catch (err) {
      console.error('[EditProfile] mutation error:', err);
    } finally {
      setIsSubmitting(false);
    }

    if (nameErr && emailErr) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: nameErr });
    } else if (nameErr) {
      Toast.show({
        type: 'error',
        text1: 'Name update failed',
        text2: nameErr,
      });
    } else if (emailErr) {
      Toast.show({
        type: 'error',
        text1: 'Email update failed',
        text2: emailErr,
      });
    } else if (nameChanged || emailChanged) {
      const text2 =
        emailMsg ??
        (emailChanged ? 'Email updated.' : 'Your changes have been saved.');
      Toast.show({ type: 'success', text1: 'Profile updated', text2 });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={keyboardAvoidingBehavior}
      className="flex-1 bg-surface"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="h-16 flex-row items-center bg-surface px-4 border-b border-outline-variant/40">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-container-low"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color="#0d631b" />
        </TouchableOpacity>
        <Text className="flex-1 pr-10 text-center font-jakarta-sans text-lg font-bold text-primary-container">
          Edit Profile
        </Text>
      </View>

      {isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0d631b" />
        </View>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + 32,
            paddingTop: 32,
            paddingHorizontal: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View className="mb-10 items-center">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                Alert.alert(
                  'Coming Soon',
                  'Photo upload will be available in a future update.',
                )
              }
              accessibilityLabel="Change profile photo"
            >
              <View>
                <View
                  className="h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-surface-container-high"
                  style={{
                    borderWidth: 4,
                    borderColor: '#f9f9f9',
                    elevation: 2,
                  }}
                >
                  <User size={64} color="#00490e" />
                </View>
                <View
                  className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full bg-primary-container"
                  style={{ elevation: 4 }}
                >
                  <Camera size={16} color="#ffffff" />
                </View>
              </View>
            </TouchableOpacity>
            <Text className="mt-3 font-inter text-sm text-outline">
              Tap to change photo
            </Text>
          </View>

          {/* Name + Email form */}
          <View className="gap-6">
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <ProfileField
                  label="Full Name"
                  icon={<User size={20} color="#707a6c" />}
                  placeholder="Enter your full name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.name?.message}
                  autoCapitalize="words"
                  autoComplete="name"
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <ProfileField
                  label="Email Address"
                  icon={<Mail size={20} color="#707a6c" />}
                  placeholder="Enter your email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              )}
            />

            {/* Read-only phone number */}
            <View className="gap-1.5">
              <Text className="ml-1 font-inter text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                Phone Number
              </Text>
              <View
                className="flex-row items-center overflow-hidden rounded-xl"
                style={{ height: 56, backgroundColor: '#dadada' }}
              >
                <View className="pl-4 pr-2">
                  <Phone size={20} color="#707a6c" />
                </View>
                <Text
                  className="flex-1 text-on-surface-variant"
                  style={{ fontFamily: 'Inter_400Regular', fontSize: 16 }}
                >
                  {currentPhone || 'Not set'}
                </Text>
                <View className="pr-4">
                  <Lock size={16} color="#707a6c" />
                </View>
              </View>
              <Text className="ml-1 font-inter text-xs text-outline">
                Contact support to change your phone number
              </Text>
            </View>

            <View className="h-2" />

            {/* Save Changes */}
            <TouchableOpacity
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting || !isDirty}
              activeOpacity={0.88}
              className="overflow-hidden rounded-full"
              style={{
                shadowColor: '#0d631b',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isSubmitting || !isDirty ? 0.08 : 0.25,
                shadowRadius: 14,
                elevation: isSubmitting || !isDirty ? 1 : 6,
                opacity: isSubmitting || !isDirty ? 0.65 : 1,
              }}
            >
              <LinearGradient
                colors={['#0d631b', '#00490e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  height: 56,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : null}
                <Text
                  className="text-on-primary text-lg font-bold"
                  style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-12 items-center justify-center rounded-full active:bg-surface-container-low"
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text className="font-jakarta-sans text-sm font-semibold text-primary-container">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
