import { useState, useCallback } from 'react';

type NotificationPermissionState = NotificationPermission | 'unsupported';

function readPermission(): NotificationPermissionState {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function useBrowserNotification() {
  const [permission, setPermission] = useState<NotificationPermissionState>(readPermission);

  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (!('Notification' in window)) {
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }, []);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!('Notification' in window)) return null;

    if (Notification.permission === 'granted') {
      try {
        return new Notification(title, options);
      } catch (error) {
        console.error('Error sending notification:', error);
        return null;
      }
    }
    return null;
  }, []);

  return {
    permission,
    requestPermission,
    sendNotification,
    isSupported: permission !== 'unsupported',
  };
}
