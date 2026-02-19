import { PropsWithChildren, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import { $currUser } from '../global-state/user';
import {
  getUserAppMode,
  subscribeUserPreferences,
  type AppUserMode,
} from '@services/userPreferencesService';

export default function SuperModeGuard({ children }: PropsWithChildren) {
  const currentUser = useStore($currUser);
  const currentUserId = String(currentUser?.id ?? '').trim();
  const [mode, setMode] = useState<AppUserMode>(() => getUserAppMode(currentUserId));

  useEffect(() => {
    if (!currentUserId) {
      setMode('normal');
      return;
    }

    setMode(getUserAppMode(currentUserId));
    const unsubscribe = subscribeUserPreferences(currentUserId, (prefs) => {
      setMode(prefs.mode);
    });

    return unsubscribe;
  }, [currentUserId]);

  if (mode !== 'super') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
