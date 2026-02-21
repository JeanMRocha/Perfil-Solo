import type { UserCenterTab } from './types';
import { USER_CENTER_TABS } from './types';

const TAB_QUERY_KEY = 'tab';

function isUserCenterTab(value: string): value is UserCenterTab {
  return (USER_CENTER_TABS as readonly string[]).includes(value);
}

export function resolveUserCenterTab(
  search: string,
  fallback: UserCenterTab = 'perfil',
): UserCenterTab {
  const params = new URLSearchParams(search);
  const raw = String(params.get(TAB_QUERY_KEY) ?? '').trim().toLowerCase();
  return isUserCenterTab(raw) ? raw : fallback;
}

export function buildUserCenterPath(tab: UserCenterTab): string {
  return `/user?${TAB_QUERY_KEY}=${tab}`;
}
