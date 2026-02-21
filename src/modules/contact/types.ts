export type ContactPointKind = 'email' | 'phone' | 'website' | 'social';

export interface CanonicalContactPoint {
  id?: string;
  label?: string;
  kind: ContactPointKind;
  network?: string;
  value: string;
  valueNormalized?: string;
  isPrimary?: boolean;
  metadata?: Record<string, unknown>;
}
