import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { SignInScreen, authApi } from '@/src/features/auth';
import type { SignInFormData } from '@/src/features/auth';
import { useState } from 'react';
import { trackMobileEvent } from '@/src/lib/analytics';

export default function SignInPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleSignIn = async (data: SignInFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await authApi.signIn(data);

      if (error) {
        trackMobileEvent('login_failure', {
          method: 'email',
          code: error.code ?? 'AUTH_ERROR',
          status: error.status ?? 401,
        });
        Alert.alert('Sign In Failed', error.message || 'Check your credentials and try again.');
        return;
      }

      trackMobileEvent('login_success', { method: 'email' });
      router.replace('/(customer)/(tabs)');
    } catch (err) {
      trackMobileEvent('login_failure', {
        method: 'email',
        code: 'UNEXPECTED_ERROR',
      });
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    // TODO: Navigate to Forgot Password screen
    console.log('Forgot Password pressed');
  };

  const handleGoogleSignIn = async () => {
    try {
      await authApi.signInWithGoogle();
      trackMobileEvent('login_success', { method: 'google' });
    } catch (err) {
      trackMobileEvent('login_failure', {
        method: 'google',
        code: 'OAUTH_ERROR',
      });
      Alert.alert('Error', 'Google sign-in failed.');
      console.error(err);
    }
  };

  const handleSignUp = () => {
    router.navigate('/(auth)/sign-up');
  };

  return (
    <SignInScreen
      isLoading={isSubmitting}
      onBack={handleBack}
      onSignIn={handleSignIn}
      onForgotPassword={handleForgotPassword}
      onGoogleSignIn={handleGoogleSignIn}
      onSignUp={handleSignUp}
    />
  );
}
