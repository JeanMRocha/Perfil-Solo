const REDACTED = '[REDACTED]';
const TRUNCATED = '[TRUNCATED]';

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|cpf|cnpj|email|phone|telefone|nfe_token)/i;

function maskEmail(match: string): string {
  const parts = match.split('@');
  if (parts.length !== 2) return REDACTED;
  const local = parts[0] ?? '';
  const domain = parts[1] ?? '';
  const keep = local.length <= 2 ? 1 : 2;
  const safeLocal = `${local.slice(0, keep)}***`;
  return `${safeLocal}@${domain}`;
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(String(key ?? '').trim());
}

export function sanitizeTextForLogs(input: unknown): string {
  const raw = String(input ?? '');
  if (!raw) return '';

  return raw
    .replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      (match) => maskEmail(match),
    )
    .replace(
      /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
      '***.***.***-**',
    )
    .replace(
      /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
      '**.***.***/****-**',
    )
    .replace(
      /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g,
      '(**) *****-****',
    )
    .replace(
      /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
      'Bearer [REDACTED]',
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9._-]{8,}\.[A-Za-z0-9._-]{8,}\b/g,
      REDACTED,
    )
    .replace(
      /([?&](?:token|api[_-]?key|secret|password)=)[^&\s]+/gi,
      `$1${REDACTED}`,
    )
    .replace(
      /\b(token|api[_-]?key|secret|password|authorization)\s*[:=]\s*[^\s,;]+/gi,
      (_, key: string) => `${key}=${REDACTED}`,
    );
}

export function sanitizeErrorMessage(input: unknown): string {
  if (input instanceof Error) {
    return sanitizeTextForLogs(input.message);
  }
  return sanitizeTextForLogs(input);
}

function sanitizePrimitive(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeTextForLogs(value);
  if (
    value == null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') return '[symbol]';
  if (typeof value === 'function') return '[function]';
  return undefined;
}

export function redactSensitiveData<T>(
  input: T,
  maxDepth = 6,
): T {
  const seen = new WeakSet<object>();

  function walk(value: unknown, depth: number): unknown {
    const primitive = sanitizePrimitive(value);
    if (primitive !== undefined) return primitive;

    if (depth >= maxDepth) return TRUNCATED;

    if (value instanceof Error) {
      return {
        name: value.name,
        message: sanitizeTextForLogs(value.message),
        stack: sanitizeTextForLogs(value.stack ?? ''),
      };
    }

    if (Array.isArray(value)) {
      return value.map((item) => walk(item, depth + 1));
    }

    if (!value || typeof value !== 'object') {
      return sanitizeTextForLogs(value);
    }

    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);

    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(source)) {
      if (isSensitiveKey(key)) {
        output[key] = REDACTED;
      } else {
        output[key] = walk(nestedValue, depth + 1);
      }
    }
    return output;
  }

  return walk(input, 0) as T;
}
