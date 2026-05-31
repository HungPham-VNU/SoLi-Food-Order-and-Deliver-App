import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '@/lib/auth-client';
import { resetAnalyticsIdentity } from '@/lib/analytics';
import { resetObservabilityUser, pushObservabilityEvent } from '@/lib/observability';

export function useLogout() {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const finishLogout = () => {
    resetAnalyticsIdentity();
    pushObservabilityEvent('user.sign_out');
    resetObservabilityUser();
    navigate('/auth/login', { replace: true });
  };

  const logout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    let didFinish = false;

    const finishOnce = () => {
      if (didFinish) return;
      didFinish = true;
      finishLogout();
    };

    try {
      await signOut({
        fetchOptions: {
          onSuccess: finishOnce,
        },
      });
    } finally {
      finishOnce();
      setIsLoggingOut(false);
    }
  };

  return { logout, isLoggingOut };
}
