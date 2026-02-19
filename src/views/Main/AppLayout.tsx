import {
  AppShell,
  Box,
  Group,
  Text,
} from '@mantine/core';
import {
  IconApi,
  IconBook,
  IconHome,
  IconMap,
  IconPhotoUp,
  IconSchool,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { $tema, alternarTema } from '@global/themeStore';
import { $loading } from '@global/loadingStore';
import { LoaderGlobal } from '@components/loaders';
import { $currUser } from '../../global-state/user';
import {
  getProfile,
  PROFILE_UPDATED_EVENT,
  type UserProfile,
} from '../../services/profileService';
import {
  AVATAR_MARKET_UPDATED_EVENT,
  resolveUserAvatarDisplay,
} from '../../services/avatarMarketplaceService';
import {
  CREDITS_UPDATED_EVENT,
  getUserCredits,
  registerAndEnsureUserCredits,
} from '../../services/creditsService';
import {
  APP_NOTIFICATIONS_UPDATED_EVENT,
  getUnreadNotificationsCount,
  listNotifications,
  markNotificationRead,
  type AppNotification,
} from '../../services/notificationsService';
import {
  getSystemBrand,
  subscribeSystemConfig,
  type SystemBrandConfig,
} from '../../services/systemConfigService';
import {
  getUserAppMode,
  getUserMenuTextVisible,
  subscribeUserPreferences,
  updateUserAppMode,
  updateUserMenuTextVisible,
  type AppUserMode,
} from '../../services/userPreferencesService';
import HeaderBar from './components/HeaderBar';
import MainDrawer from './components/MainDrawer';
import SidebarNav from './components/SidebarNav';
import UserDrawer from './components/UserDrawer';

function normalizePlanLabel(input: unknown): string {
  const raw = String(input ?? 'free').trim().toLowerCase();
  if (!raw) return 'FREE';
  return raw.toUpperCase();
}

function resolveUserName(user: any): string {
  const candidate =
    user?.user_metadata?.name ??
    user?.user_metadata?.full_name ??
    user?.email ??
    'Usuario';
  return String(candidate);
}

const CREDITS_PROGRESS_BASELINE = 1000;
const HEADER_HEIGHT = 60;

function normalizeCredits(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function resolveCreditsScaleMax(credits: number): number {
  if (credits <= CREDITS_PROGRESS_BASELINE) return CREDITS_PROGRESS_BASELINE;
  const bucket = Math.ceil(credits / CREDITS_PROGRESS_BASELINE);
  return bucket * CREDITS_PROGRESS_BASELINE;
}

function formatCreditsNumber(input: number): string {
  return new Intl.NumberFormat('pt-BR').format(input);
}

function formatAppVersion(): string {
  const version =
    typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
      ? __APP_VERSION__
      : '0.0.0';
  return `v${version}`;
}

function notificationToTime(dateLike: string | null | undefined): number {
  if (!dateLike) return 0;
  const time = new Date(dateLike).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isNotificationExpired(notification: AppNotification): boolean {
  const expiry = notificationToTime(notification.expires_at);
  return expiry > 0 && Date.now() >= expiry;
}

function notificationLevelColor(level: AppNotification['level']): string {
  if (level === 'success') return 'green';
  if (level === 'warning') return 'yellow';
  if (level === 'error') return 'red';
  return 'blue';
}

function formatNotificationDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AppLayout() {
  const tema = useStore($tema);
  const loading = useStore($loading);
  const user = useStore($currUser);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] =
    useDisclosure(false);
  const [userDrawerOpened, { open: openUserDrawer, close: closeUserDrawer }] =
    useDisclosure(false);
  const [notificationsOpened, setNotificationsOpened] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationRows, setNotificationRows] = useState<AppNotification[]>([]);
  const [notificationExpandedId, setNotificationExpandedId] = useState<
    string | null
  >(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [walletCredits, setWalletCredits] = useState(0);
  const [avatarSrc, setAvatarSrc] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('');
  const [appMode, setAppMode] = useState<AppUserMode>(() => getUserAppMode());
  const [brand, setBrand] = useState<SystemBrandConfig>(() => getSystemBrand());
  const [menuTextVisible, setMenuTextVisible] = useState<boolean>(() =>
    getUserMenuTextVisible(),
  );
  const currentUserId = String(user?.id ?? '').trim();

  useEffect(() => {
    let alive = true;

    const loadProfile = async () => {
      const data = await getProfile();
      if (!alive) return;
      setProfile(data);
    };

    const onProfileUpdated = (event: Event) => {
      const custom = event as CustomEvent<UserProfile>;
      if (custom.detail) {
        setProfile(custom.detail);
        return;
      }
      void loadProfile();
    };

    void loadProfile();
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    window.addEventListener('storage', onProfileUpdated);

    return () => {
      alive = false;
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
      window.removeEventListener('storage', onProfileUpdated);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!currentUserId) {
      setUnreadNotifications(0);
      setNotificationRows([]);
      setNotificationsOpened(false);
      setNotificationExpandedId(null);
      return () => {
        alive = false;
      };
    }

    const refreshUnread = async () => {
      const total = await getUnreadNotificationsCount(currentUserId);
      if (!alive) return;
      setUnreadNotifications(total);
    };

    const onUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const eventUserId = custom.detail?.userId;
      if (eventUserId && eventUserId !== currentUserId) return;
      void refreshUnread();
    };

    const onStorage = () => {
      void refreshUnread();
    };

    void refreshUnread();
    window.addEventListener(APP_NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    const intervalId = window.setInterval(() => {
      void refreshUnread();
    }, 60 * 1000);

    return () => {
      alive = false;
      window.removeEventListener(APP_NOTIFICATIONS_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(intervalId);
    };
  }, [currentUserId]);

  useEffect(() => {
    let alive = true;
    if (!currentUserId || !notificationsOpened) {
      setNotificationExpandedId(null);
      return () => {
        alive = false;
      };
    }

    const refreshPreview = async () => {
      setNotificationsLoading(true);
      try {
        const rows = await listNotifications(currentUserId);
        if (!alive) return;
        setNotificationRows(rows.slice(0, 7));
      } finally {
        if (!alive) return;
        setNotificationsLoading(false);
      }
    };

    const onUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const eventUserId = custom.detail?.userId;
      if (eventUserId && eventUserId !== currentUserId) return;
      void refreshPreview();
    };

    const onStorage = () => {
      void refreshPreview();
    };

    void refreshPreview();
    window.addEventListener(APP_NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);

    return () => {
      alive = false;
      window.removeEventListener(APP_NOTIFICATIONS_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [currentUserId, notificationsOpened]);

  useEffect(() => {
    const currentUserId = String(user?.id ?? '').trim();
    const currentUserEmail = String(user?.email ?? '').trim();
    const currentUserName = resolveUserName(user);
    if (!currentUserId || !currentUserEmail) {
      setWalletCredits(0);
      setAvatarSrc('');
      setAvatarEmoji('');
      return;
    }

    registerAndEnsureUserCredits({
      id: currentUserId,
      email: currentUserEmail,
      name: currentUserName,
    });

    const refresh = () => {
      setWalletCredits(getUserCredits(currentUserId));
      const resolved = resolveUserAvatarDisplay(currentUserId);
      setAvatarSrc(resolved.src ?? '');
      setAvatarEmoji(resolved.emoji ?? '');
    };

    const onCreditsUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const changedFor = custom.detail?.userId;
      if (changedFor && changedFor !== currentUserId) return;
      refresh();
    };

    const onAvatarUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const changedFor = custom.detail?.userId;
      if (changedFor && changedFor !== currentUserId) return;
      refresh();
    };

    const onStorage = () => refresh();

    refresh();
    window.addEventListener(CREDITS_UPDATED_EVENT, onCreditsUpdated);
    window.addEventListener(AVATAR_MARKET_UPDATED_EVENT, onAvatarUpdated);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(CREDITS_UPDATED_EVENT, onCreditsUpdated);
      window.removeEventListener(AVATAR_MARKET_UPDATED_EVENT, onAvatarUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [user?.id, user?.email, user?.user_metadata?.name]);

  useEffect(() => {
    const unsubscribe = subscribeSystemConfig((config) => {
      setBrand(config.brand);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setAppMode(getUserAppMode());
      setMenuTextVisible(getUserMenuTextVisible());
      return;
    }

    setAppMode(getUserAppMode(currentUserId));
    setMenuTextVisible(getUserMenuTextVisible(currentUserId));

    const unsubscribe = subscribeUserPreferences(currentUserId, (prefs) => {
      setAppMode(prefs.mode);
      setMenuTextVisible(prefs.view.menu_text_visible);
    });

    return unsubscribe;
  }, [currentUserId]);

  const userName = resolveUserName(user);
  const userEmail = String(profile?.email ?? user?.email ?? 'usuario@local');
  const planLabel = normalizePlanLabel(
    (user as any)?.plan_id ?? (user as any)?.user_metadata?.plan_id,
  );
  const creditsNumber = normalizeCredits(walletCredits);
  const creditsScaleMax = resolveCreditsScaleMax(creditsNumber);
  const creditsLabel = formatCreditsNumber(creditsNumber);
  const creditsProgress = Math.min(100, (creditsNumber / creditsScaleMax) * 100);
  const avatarSource = avatarSrc || profile?.avatar_url || profile?.logo_url || '';
  const companyName = profile?.company_name?.trim() || brand.name;
  const isSuperMode = appMode === 'super';
  const brandDisplayName = brand.name.trim() || 'PerfilSolo';
  const appVersionLabel = formatAppVersion();
  const headerBg = tema === 'dark' ? '#111827' : '#f0fdf4';
  const headerText = tema === 'dark' ? '#f3f4f6' : '#0f172a';
  const navBg = tema === 'dark' ? '#0b1220' : '#ffffff';
  const footerBg = tema === 'dark' ? '#0b1220' : '#f8fafc';
  const footerBorder = tema === 'dark' ? '#1f2937' : '#e5e7eb';
  const softShadow =
    tema === 'dark'
      ? '0 8px 18px rgba(0, 0, 0, 0.35)'
      : '0 8px 18px rgba(15, 23, 42, 0.16)';
  const hoverShadow =
    tema === 'dark'
      ? '0 10px 20px rgba(0, 0, 0, 0.45)'
      : '0 10px 20px rgba(15, 23, 42, 0.22)';
  const menuPillButtonStyles = {
    root: {
      marginTop: 4,
      boxShadow: softShadow,
      transition: 'transform 0.16s ease, box-shadow 0.16s ease',
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: hoverShadow,
      },
    },
    section: {
      marginTop: 2,
    },
  };
  const headerActionIconStyles = {
    root: {
      marginTop: 4,
      boxShadow: softShadow,
      transition: 'transform 0.16s ease, box-shadow 0.16s ease',
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: hoverShadow,
      },
    },
  };
  const userTriggerStyles = {
    root: {
      minWidth: 190,
      maxWidth: 320,
      overflow: 'hidden',
      borderRadius: 10,
      padding: '8px 8px 6px',
      cursor: 'pointer',
      transition: 'transform 0.16s ease, box-shadow 0.16s ease',
      boxShadow: softShadow,
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: hoverShadow,
      },
    },
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const topMenuItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: IconHome,
    },
    {
      label: 'Propriedade',
      path: '/propriedades',
      icon: IconMap,
    },
    {
      label: 'Modo API',
      path: '/integracoes/api',
      icon: IconApi,
    },
    {
      label: 'Aulas',
      path: '/aulas',
      icon: IconSchool,
    },
    {
      label: 'Conhecimento',
      path: '/conhecimento',
      icon: IconBook,
    },
  ];
  const superMenuItems = [
    {
      label: 'Sistema',
      path: '/super/sistema',
      icon: IconSettings,
    },
    {
      label: 'Branding',
      path: '/super/logo',
      icon: IconPhotoUp,
    },
    {
      label: 'Usuarios',
      path: '/super/usuarios',
      icon: IconUser,
    },
    {
      label: 'API Docs',
      path: '/integracoes/api',
      icon: IconApi,
    },
  ];

  const closeHeaderOverlays = () => {
    closeDrawer();
    closeUserDrawer();
    setNotificationsOpened(false);
    setNotificationExpandedId(null);
  };

  const go = (path: string) => {
    closeHeaderOverlays();
    navigate(path);
  };

  const toggleUserMenu = () => {
    if (userDrawerOpened) {
      closeUserDrawer();
      return;
    }
    closeDrawer();
    setNotificationsOpened(false);
    setNotificationExpandedId(null);
    openUserDrawer();
  };

  const toggleMainMenu = () => {
    if (drawerOpened) {
      closeDrawer();
      return;
    }
    closeUserDrawer();
    setNotificationsOpened(false);
    setNotificationExpandedId(null);
    openDrawer();
  };

  const toggleNotificationsMenu = () => {
    if (notificationsOpened) {
      setNotificationsOpened(false);
      setNotificationExpandedId(null);
      return;
    }
    closeDrawer();
    closeUserDrawer();
    setNotificationsOpened(true);
  };

  const openNotificationsCenter = () => {
    setNotificationsOpened(false);
    setNotificationExpandedId(null);
    navigate('/notificacoes');
  };

  const handleNotificationRowClick = async (row: AppNotification) => {
    if (!currentUserId) return;
    const nextExpanded = notificationExpandedId === row.id ? null : row.id;
    setNotificationExpandedId(nextExpanded);

    if (row.read_at || isNotificationExpired(row)) return;

    setNotificationRows((prev) =>
      prev.map((item) =>
        item.id === row.id
          ? {
              ...item,
              read_at: item.read_at ?? new Date().toISOString(),
            }
          : item,
      ),
    );

    try {
      await markNotificationRead(currentUserId, row.id);
    } catch {
      setNotificationRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                read_at: row.read_at ?? null,
              }
            : item,
        ),
      );
    }
  };

  const handleModeToggle = (checked: boolean) => {
    const nextMode: AppUserMode = checked ? 'super' : 'normal';
    const nextPrefs = updateUserAppMode(nextMode, currentUserId);
    setAppMode(nextPrefs.mode);
  };

  const handleMenuTextToggle = (checked: boolean) => {
    const nextPrefs = updateUserMenuTextVisible(checked, currentUserId);
    setMenuTextVisible(nextPrefs.view.menu_text_visible);
  };
  const headerRows = isSuperMode ? 3 : 2;
  const headerTotalHeight = HEADER_HEIGHT * headerRows;

  return (
    <AppShell
      header={{ height: headerTotalHeight }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      footer={{ height: 42 }}
      padding="md"
      styles={{
        header: {
          background: headerBg,
          borderBottom: tema === 'dark' ? '1px solid #1f2937' : '1px solid #d1fae5',
        },
        navbar: {
          background: navBg,
          borderRight: tema === 'dark' ? '1px solid #1f2937' : '1px solid #e5e7eb',
          '& .mantine-NavLink-root': {
            paddingTop: 10,
            paddingBottom: 10,
            borderRadius: 10,
            marginBottom: 4,
            transition: 'transform 0.16s ease, box-shadow 0.16s ease',
          },
          '& .mantine-NavLink-root:hover': {
            transform: 'translateY(-1px)',
            boxShadow: hoverShadow,
          },
          '& .mantine-NavLink-section': {
            marginTop: 2,
          },
        },
        footer: {
          background: footerBg,
          borderTop: `1px solid ${footerBorder}`,
        },
      }}
    >
      <AppShell.Header>
        <HeaderBar
          themeMode={tema}
          headerHeight={HEADER_HEIGHT}
          headerText={headerText}
          userName={userName}
          companyName={companyName}
          avatarSource={avatarSource}
          avatarEmoji={avatarEmoji}
          planLabel={planLabel}
          creditsLabel={creditsLabel}
          creditsProgress={creditsProgress}
          creditsNumber={creditsNumber}
          isSuperMode={isSuperMode}
          menuTextVisible={menuTextVisible}
          brandDisplayName={brandDisplayName}
          brandLogoUrl={brand.logo_url}
          topMenuItems={topMenuItems}
          superMenuItems={superMenuItems}
          userTriggerStyles={userTriggerStyles}
          menuPillButtonStyles={menuPillButtonStyles}
          headerActionIconStyles={headerActionIconStyles}
          isActive={isActive}
          onNavigate={(path) => navigate(path)}
          onToggleUserMenu={toggleUserMenu}
          onToggleMainMenu={toggleMainMenu}
          onModeToggle={handleModeToggle}
          notificationsOpened={notificationsOpened}
          unreadNotifications={unreadNotifications}
          notificationsLoading={notificationsLoading}
          notificationRows={notificationRows}
          notificationExpandedId={notificationExpandedId}
          onNotificationsOpenedChange={setNotificationsOpened}
          onToggleNotifications={toggleNotificationsMenu}
          onOpenNotificationsCenter={openNotificationsCenter}
          onNotificationRowClick={(row) => void handleNotificationRowClick(row)}
          onNotificationExpandedIdChange={setNotificationExpandedId}
          isNotificationExpired={isNotificationExpired}
          notificationLevelColor={notificationLevelColor}
          formatNotificationDate={formatNotificationDate}
        />
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <SidebarNav isActive={isActive} onNavigate={navigate} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer>
        <Group justify="space-between" px="md" h="100%" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <Text
              size="sm"
              c={tema === 'dark' ? 'gray.4' : 'dimmed'}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/legal/privacidade')}
            >
              Privacidade
            </Text>
            <Text
              size="sm"
              c={tema === 'dark' ? 'gray.4' : 'dimmed'}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/legal/cookies')}
            >
              Cookies
            </Text>
            <Text
              size="sm"
              c={tema === 'dark' ? 'gray.4' : 'dimmed'}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/legal/lgpd')}
            >
              LGPD
            </Text>
          </Group>
          <Text size="sm" ff="monospace" c={tema === 'dark' ? 'gray.4' : 'dimmed'}>
            {appVersionLabel}
          </Text>
        </Group>
      </AppShell.Footer>

      <MainDrawer
        opened={drawerOpened}
        themeMode={tema}
        menuTextVisible={menuTextVisible}
        isSuperMode={isSuperMode}
        onClose={closeDrawer}
        onToggleTheme={alternarTema}
        onMenuTextToggle={handleMenuTextToggle}
        onGo={go}
      />

      <UserDrawer
        opened={userDrawerOpened}
        userName={userName}
        companyName={companyName}
        userEmail={userEmail}
        avatarSource={avatarSource}
        avatarEmoji={avatarEmoji}
        planLabel={planLabel}
        creditsLabel={creditsLabel}
        onClose={closeUserDrawer}
        onGo={go}
      />

      {loading && (
        <Box
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background:
              tema === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <LoaderGlobal message="Carregando dados..." />
        </Box>
      )}
    </AppShell>
  );
}
