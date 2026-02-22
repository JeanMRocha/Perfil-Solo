import { PropsWithChildren, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import { $currUser } from '../global-state/user';
import { isOwnerSuperUser } from '@services/superAccessService';
import {
  getUserAppMode,
  subscribeUserPreferences,
  type AppUserMode,
} from '@services/userPreferencesService';

export default function SuperModeGuard({ children }: PropsWithChildren) {
  const currentUser = useStore($currUser);
  const currentUserId = String(currentUser?.id ?? '').trim();
  const canAccessSuper = isOwnerSuperUser(currentUser);
  const [mode, setMode] = useState<AppUserMode>(() =>
    getUserAppMode(currentUserId, currentUser),
  );

  useEffect(() => {
    if (!currentUserId || !canAccessSuper) {
      setMode('normal');
      return;
    }

    setMode(getUserAppMode(currentUserId, currentUser));
    const unsubscribe = subscribeUserPreferences(currentUserId, (prefs) => {
      setMode(prefs.mode);
    }, currentUser);

    return unsubscribe;
  }, [canAccessSuper, currentUser, currentUserId]);

  if (!canAccessSuper || mode !== 'super') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
