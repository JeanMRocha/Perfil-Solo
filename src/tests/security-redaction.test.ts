import { describe, expect, it } from 'vitest';
import {
  redactSensitiveData,
  sanitizeTextForLogs,
} from '@services/securityRedaction';

describe('securityRedaction', () => {
  it('mascara email, cpf e token em texto livre', () => {
    const input =
      'email user@example.com cpf 123.456.789-10 token=abc123 Bearer eyJ.a.b';
    const sanitized = sanitizeTextForLogs(input);

    expect(sanitized).not.toContain('user@example.com');
    expect(sanitized).not.toContain('123.456.789-10');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('remove campos sensiveis por chave', () => {
    const payload = {
      name: 'Usuário',
      email: 'user@example.com',
      token: 'abc',
      nested: {
        cpf: '12345678910',
        notes: 'ok',
      },
    };

    const result = redactSensitiveData(payload);

    expect(result.name).toBe('Usuário');
    expect(result.email).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.nested.cpf).toBe('[REDACTED]');
    expect(result.nested.notes).toBe('ok');
  });

  it('suporta estruturas circulares sem quebrar', () => {
    const a: Record<string, unknown> = { name: 'root' };
    a.self = a;

    const result = redactSensitiveData(a);
    expect(result.self).toBe('[Circular]');
  });
});
