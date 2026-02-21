export type ObservabilityMode = 'off' | 'local' | 'remote';
export type ObservabilityKind = 'error' | 'event' | 'audit';

function normalizeBoolean(input: unknown, fallback = false): boolean {
  const raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function normalizeMode(input: unknown): ObservabilityMode {
  const raw = String(input ?? '').trim().toLowerCase();
  if (raw === 'local') return 'local';
  if (raw === 'remote') return 'remote';
  return 'off';
}

function normalizeSampleRate(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1, Math.max(0, parsed));
}

const mode = normalizeMode(import.meta.env.VITE_OBSERVABILITY_MODE);
const sampleRate = normalizeSampleRate(import.meta.env.VITE_OBSERVABILITY_SAMPLE_RATE);

export const observabilityConfig = {
  mode,
  sampleRate,
  captureErrors: normalizeBoolean(import.meta.env.VITE_OBSERVABILITY_CAPTURE_ERRORS, true),
  captureEvents: normalizeBoolean(import.meta.env.VITE_OBSERVABILITY_CAPTURE_EVENTS, true),
  captureAudit: normalizeBoolean(import.meta.env.VITE_OBSERVABILITY_CAPTURE_AUDIT, true),
  localAutoDownload: normalizeBoolean(
    import.meta.env.VITE_OBSERVABILITY_LOCAL_AUTO_DOWNLOAD,
    false,
  ),
} as const;

function shouldCaptureByKind(kind: ObservabilityKind): boolean {
  if (kind === 'error') return observabilityConfig.captureErrors;
  if (kind === 'event') return observabilityConfig.captureEvents;
  return observabilityConfig.captureAudit;
}

function shouldSample(): boolean {
  if (observabilityConfig.sampleRate >= 1) return true;
  if (observabilityConfig.sampleRate <= 0) return false;
  return Math.random() <= observabilityConfig.sampleRate;
}

export function getObservabilityMode(): ObservabilityMode {
  return observabilityConfig.mode;
}

export function isObservabilityEnabled(): boolean {
  return observabilityConfig.mode !== 'off';
}

export function isLocalObservabilityEnabled(): boolean {
  return observabilityConfig.mode === 'local';
}

export function isRemoteObservabilityEnabled(): boolean {
  return observabilityConfig.mode === 'remote';
}

export function shouldCaptureObservability(kind: ObservabilityKind): boolean {
  if (!isObservabilityKindEnabled(kind)) return false;
  return shouldSample();
}

export function shouldAutoDownloadLocalErrorLog(): boolean {
  return observabilityConfig.localAutoDownload;
}

export function isObservabilityKindEnabled(kind: ObservabilityKind): boolean {
  if (!isObservabilityEnabled()) return false;
  return shouldCaptureByKind(kind);
}
