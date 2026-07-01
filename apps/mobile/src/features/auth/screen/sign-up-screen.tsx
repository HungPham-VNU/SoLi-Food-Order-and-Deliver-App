import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  User,
  Mail,
  Lock,
  Phone,
  ChevronRight,
  Check,
  Sprout,
} from 'lucide-react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { SignUpField } from '@/src/features/auth/components';
import type {
  SignUpScreenProps,
  SignUpFormData,
} from '@/src/features/auth/types';
import { signUpSchema } from '@/src/features/auth/types';
import { keyboardAvoidingBehavior } from '@/src/lib/keyboard';
import { KeyboardAwareScrollView } from '@/src/components/keyboard-aware-scroll-view';
import { useState } from 'react';

// ─── Component ───────────────────────────────────────────────────────────────

export function SignUpScreen({
  isLoading,
  onBack,
  onContinue,
  onLogIn,
  onTermsPress,
  onPrivacyPress,
}: SignUpScreenProps) {
  const insets = useSafeAreaInsets();
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      phone: '',
      termsAccepted: false,
    },
    mode: 'onBlur',
  });

  const handleContinue = (data: SignUpFormData) => {
    if (isLoading) return;
    onContinue?.(data);
  };

  return (
    <KeyboardAvoidingView
      behavior={keyboardAvoidingBehavior}
      className="flex-1 bg-surface"
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      {/* ── Header ───────────────────────────────────────────────────── */}
      <View
        className="flex-row items-center justify-between px-6 bg-surface"
        style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
      >
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={24} color="#1a6b20" />
        </TouchableOpacity>

        <Text
          className="text-lg text-[#1a4d20] absolute left-0 right-0 text-center"
          style={{
            fontFamily: 'PlusJakartaSans_700Bold',
            top: insets.top + 16,
          }}
          pointerEvents="none"
        >
          UIT Food
        </Text>

        {/* Symmetry spacer */}
        <View className="w-10" />
      </View>

      {/* ── Scrollable Body ──────────────────────────────────────────── */}
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero / Branding */}
        <View className="items-center mb-10 mt-6">
          <View
            className="w-20 h-20 rounded-2xl bg-primary-fixed items-center justify-center mb-6"
            style={{
              shadowColor: '#1a1c1c',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Sprout size={40} color="#0d631b" />
          </View>

          <Text
            className="text-[#1a1c1c] text-3xl font-bold text-center mb-2"
            style={{
              fontFamily: 'PlusJakartaSans_700Bold',
              letterSpacing: -0.5,
            }}
          >
            Create your account
          </Text>
          <Text
            className="text-[#40493d] text-center leading-relaxed px-4"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}
          >
            Join our community of fresh produce lovers and local growers.
          </Text>
        </View>

        {/* Form Fields */}
        <View className="gap-y-5">
          <Controller
            control={control}
            name="fullName"
            render={({ field: { onChange, onBlur, value } }) => (
              <SignUpField
                label="Full Name"
                icon={<User size={20} color="#707a6c" />}
                isFocused={focusedField === 'name'}
                placeholder="Enter your full name"
                value={value}
                onChangeText={onChange}
                onFocus={() => setFocusedField('name')}
                onBlur={() => {
                  onBlur();
                  setFocusedField(null);
                }}
                error={errors.fullName?.message}
                autoCapitalize="words"
                autoComplete="name"
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <SignUpField
                label="Email Address"
                icon={<Mail size={20} color="#707a6c" />}
                isFocused={focusedField === 'email'}
                placeholder="name@example.com"
                value={value}
                onChangeText={onChange}
                onFocus={() => setFocusedField('email')}
                onBlur={() => {
                  onBlur();
                  setFocusedField(null);
                }}
                error={errors.email?.message}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <SignUpField
                label="Password"
                icon={<Lock size={20} color="#707a6c" />}
                isFocused={focusedField === 'password'}
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                onFocus={() => setFocusedField('password')}
                onBlur={() => {
                  onBlur();
                  setFocusedField(null);
                }}
                error={errors.password?.message}
                secureTextEntry
                autoComplete="password-new"
              />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <SignUpField
                label="Phone Number"
                icon={<Phone size={20} color="#707a6c" />}
                isFocused={focusedField === 'phone'}
                placeholder="0912 345 678"
                value={value}
                onChangeText={onChange}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => {
                  onBlur();
                  setFocusedField(null);
                }}
                error={errors.phone?.message}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            )}
          />

          {/* Terms & Conditions */}
          <Controller
            control={control}
            name="termsAccepted"
            render={({ field: { onChange, value } }) => (
              <View className="gap-y-1">
                <View className="flex-row items-start gap-x-3 px-1 py-2">
                  <TouchableOpacity
                    onPress={() => onChange(!value)}
                    activeOpacity={0.8}
                    className="mt-0.5"
                  >
                    <View
                      className="w-5 h-5 rounded items-center justify-center"
                      style={{
                        backgroundColor: value ? '#0d631b' : '#e8e8e8',
                        borderWidth: value ? 0 : 1.5,
                        borderColor: '#bfcaba',
                      }}
                    >
                      {value && (
                        <Check size={12} color="#ffffff" strokeWidth={3} />
                      )}
                    </View>
                  </TouchableOpacity>

                  <Text
                    className="flex-1 text-[#40493d] leading-relaxed"
                    style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
                  >
                    I agree to the{' '}
                    <Text
                      className="text-[#0d631b] underline"
                      style={{ fontFamily: 'Inter_600SemiBold' }}
                      onPress={onTermsPress}
                    >
                      Terms & Conditions
                    </Text>{' '}
                    and{' '}
                    <Text
                      className="text-[#0d631b] underline"
                      style={{ fontFamily: 'Inter_600SemiBold' }}
                      onPress={onPrivacyPress}
                    >
                      Privacy Policy
                    </Text>{' '}
                    of UIT Food.
                  </Text>
                </View>
                {!!errors.termsAccepted && (
                  <Text
                    className="text-[#ff4d4d] text-xs ml-9"
                    style={{ fontFamily: 'Inter_500Medium' }}
                  >
                    {errors.termsAccepted.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* Continue CTA */}
          <View className="pt-2">
            <TouchableOpacity
              onPress={handleSubmit(handleContinue)}
              activeOpacity={0.88}
              className="rounded-full overflow-hidden"
              style={{
                shadowColor: '#0d631b',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <LinearGradient
                colors={['#0d631b', '#2e7d32']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Text
                  className="text-white text-[15px] font-bold"
                  style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
                >
                  {isLoading ? 'Creating Account...' : 'Continue'}
                </Text>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <ChevronRight size={20} color="#ffffff" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer — Log in link */}
        <View className="mt-8 items-center">
          <Text
            className="text-[#40493d] text-sm"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            Already have an account?{' '}
            <Text
              className="text-[#0d631b]"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
              onPress={onLogIn}
            >
              Log in
            </Text>
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}
