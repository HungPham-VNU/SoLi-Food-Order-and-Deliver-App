import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '@/lib/auth-client';

export function useLogout() {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const finishLogout = () => {
    navigate('/login', { replace: true });
  };

  async function logout() {
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
  }

  return { logout, isLoggingOut };
}
