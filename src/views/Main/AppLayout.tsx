import {
  AppShell,
  Box,
  Group,
  Text,
} from '@mantine/core';
import {
  IconApiApp,
  IconBook2,
  IconBriefcase2,
  IconBuildingFactory2,
  IconCodeDots,
  IconFileAnalytics,
  IconHome,
  IconMapPin2,
  IconPackage,
  IconPlant2,
  IconPhotoUp,
  IconSchool,
  IconSettings,
  IconTestPipe2,
  IconUser,
  IconUsersGroup,
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
  listCreditTransactionsForUser,
  registerAndEnsureUserCredits,
  type CreditTransaction,
} from '../../services/creditsService';
import {
  APP_NOTIFICATIONS_UPDATED_EVENT,
  ensureTemporaryProgressNotifications,
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
import { subscribeBrandTheme } from '../../services/brandThemeService';
import { trackGamificationEvent } from '../../services/gamificationService';
import { getBrandPalette } from '../../mantine/brand';
import HeaderBar from './components/HeaderBar';
import MainDrawer from './components/MainDrawer';

function normalizePlanLabel(input: unknown): string {
  const raw = String(input ?? 'free').trim().toLowerCase();
  if (!raw) return 'FREE';
  return raw.toUpperCase();
}

function resolveUserName(profile: UserProfile | null, user: any): string {
  const candidate =
    profile?.producer?.nome_exibicao?.trim() ??
    profile?.name?.trim() ??
    user?.user_metadata?.name ??
    user?.user_metadata?.full_name ??
    user?.email ??
    'Usuario';
  return String(candidate);
}

const HEADER_HEIGHT = 60;

type CreditsBreakdown = {
  purchased: number;
  earned: number;
  spent: number;
};

const EMPTY_CREDITS_BREAKDOWN: CreditsBreakdown = {
  purchased: 0,
  earned: 0,
  spent: 0,
};

function normalizeCredits(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function deriveCreditsBreakdown(
  rows: CreditTransaction[],
): CreditsBreakdown {
  return rows.reduce<CreditsBreakdown>(
    (acc, row) => {
      const amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount === 0) return acc;

      if (amount < 0) {
        acc.spent += Math.abs(amount);
        return acc;
      }

      if (row.type === 'purchase_approved') {
        acc.purchased += amount;
        return acc;
      }

      acc.earned += amount;
      return acc;
    },
    { ...EMPTY_CREDITS_BREAKDOWN },
  );
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
  const [creditsBreakdown, setCreditsBreakdown] = useState<CreditsBreakdown>(
    EMPTY_CREDITS_BREAKDOWN,
  );
  const [avatarSrc, setAvatarSrc] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('');
  const [appMode, setAppMode] = useState<AppUserMode>(() => getUserAppMode());
  const [brand, setBrand] = useState<SystemBrandConfig>(() => getSystemBrand());
  const [menuTextVisible, setMenuTextVisible] = useState<boolean>(() =>
    getUserMenuTextVisible(),
  );
  const [, setBrandThemeVersion] = useState(0);
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
      await ensureTemporaryProgressNotifications(currentUserId);
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
    const currentUserName = resolveUserName(profile, user);
    if (!currentUserId || !currentUserEmail) {
      setWalletCredits(0);
      setCreditsBreakdown(EMPTY_CREDITS_BREAKDOWN);
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
      const transactions = listCreditTransactionsForUser(currentUserId);
      setCreditsBreakdown(deriveCreditsBreakdown(transactions));
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
  }, [user?.id, user?.email, user?.user_metadata?.name, profile?.name, profile?.producer?.nome_exibicao]);

  useEffect(() => {
    if (!currentUserId) return;
    void trackGamificationEvent(currentUserId, 'app_open').catch(() => null);
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    if (location.pathname === '/dashboard') {
      void trackGamificationEvent(currentUserId, 'visit_dashboard').catch(() => null);
      return;
    }

    if (location.pathname === '/user') {
      void trackGamificationEvent(currentUserId, 'visit_user_center').catch(() => null);
    }
  }, [currentUserId, location.pathname]);

  useEffect(() => {
    const unsubscribe = subscribeBrandTheme(() => {
      setBrandThemeVersion((current) => current + 1);
    });

    return unsubscribe;
  }, []);

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

  const userName = resolveUserName(profile, user);
  const planLabel = normalizePlanLabel(
    (user as any)?.plan_id ?? (user as any)?.user_metadata?.plan_id,
  );
  const brandPalette = getBrandPalette(tema);
  const creditsNumber = normalizeCredits(walletCredits);
  const avatarSource = avatarSrc || profile?.avatar_url || profile?.logo_url || '';
  const companyName = profile?.company_name?.trim() || brand.name;
  const isSuperMode = appMode === 'super';
  const brandDisplayName = brand.name.trim() || 'PerfilSolo';
  const appVersionLabel = formatAppVersion();
  const headerBg = brandPalette.header.background;
  const headerText = brandPalette.header.text;
  const footerBg = brandPalette.footer.background;
  const footerBorder = brandPalette.footer.border;
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
      height: 32,
      paddingInline: 10,
      boxShadow: softShadow,
      transition: 'transform 0.16s ease, box-shadow 0.16s ease',
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: hoverShadow,
      },
    },
    label: {
      fontSize: 12,
      lineHeight: 1.1,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
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
      label: 'Culturas',
      path: '/cadastros/culturas/busca',
      icon: IconPlant2,
    },
    {
      label: 'Laboratorios',
      path: '/cadastros/laboratorios/busca',
      icon: IconBuildingFactory2,
    },
    {
      label: 'Pessoas',
      path: '/cadastros/pessoas/busca',
      icon: IconUsersGroup,
    },
    {
      label: 'Produtos',
      path: '/cadastros/produtos/busca',
      icon: IconPackage,
    },
    {
      label: 'Servicos',
      path: '/cadastros/servicos/busca',
      icon: IconBriefcase2,
    },
    {
      label: 'Analises de Solo',
      path: '/analise-solo',
      icon: IconTestPipe2,
    },
    {
      label: 'Relatorios',
      path: '/relatorios',
      icon: IconFileAnalytics,
    },
    {
      label: 'Propriedade',
      path: '/propriedades',
      icon: IconMapPin2,
    },
    {
      label: 'Modo API',
      path: '/integracoes/api',
      icon: IconApiApp,
    },
    {
      label: 'Aulas',
      path: '/aulas',
      icon: IconSchool,
    },
    {
      label: 'Conhecimento',
      path: '/conhecimento',
      icon: IconBook2,
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
      icon: IconCodeDots,
    },
  ];

  const closeHeaderOverlays = () => {
    closeDrawer();
    setNotificationsOpened(false);
    setNotificationExpandedId(null);
  };

  const go = (path: string) => {
    closeHeaderOverlays();
    navigate(path);
  };

  const toggleMenuRoute = (path: string) => {
    const normalizedPath = path.split('?')[0] ?? path;
    if (isActive(normalizedPath)) {
      go('/dashboard');
      return;
    }
    go(path);
  };

  const toggleMainMenu = () => {
    if (drawerOpened) {
      closeDrawer();
      return;
    }
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
      footer={{ height: 42 }}
      padding="md"
      styles={{
        header: {
          background: headerBg,
          borderBottom: `1px solid ${brandPalette.header.border}`,
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
          creditsNumber={creditsNumber}
          purchasedCredits={creditsBreakdown.purchased}
          earnedCredits={creditsBreakdown.earned}
          spentCredits={creditsBreakdown.spent}
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
          onNavigate={toggleMenuRoute}
          onOpenUserCenter={() => toggleMenuRoute('/user?tab=perfil')}
          onOpenBilling={() => toggleMenuRoute('/user?tab=plano')}
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
        onGo={toggleMenuRoute}
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
