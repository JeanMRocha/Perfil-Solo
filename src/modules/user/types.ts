export const USER_CENTER_TABS = [
  'perfil',
  'seguranca',
  'empresa',
  'jornada',
  'plano',
  'creditos',
  'cupons',
] as const;

export type UserCenterTab = (typeof USER_CENTER_TABS)[number];
