import React, { Component, ReactNode } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import { registrarLogLocal } from '@services/loggerLocal';
import { shouldCaptureObservability } from '@services/observabilityConfig';
import {
  redactSensitiveData,
  sanitizeTextForLogs,
} from '@services/securityRedaction';

/**
 * 🌿 ErrorBoundary - PerfilSolo
 * - Aguenta erros que não são instâncias de Error (ex.: objetos crus)
 * - Serialização segura (evita "Cannot convert object to primitive value")
 * - Log remoto (services/loggerService) com fallback local (services/loggerLocal)
 * - UI amigável com opções de recarregar e voltar ao painel
 */

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorInfo?: {
    message: string;
    stack?: string;
    timestamp: string;
    origin: string;
    raw?: unknown; // objeto bruto do erro serializado com segurança
  };
}

/** 🔐 Serializa com segurança qualquer valor (evita throws em String/JSON) */
function toSafeString(value: unknown): string {
  try {
    if (value instanceof Error) {
      return `${value.name}: ${value.message}`;
    }
    if (typeof value === 'string') return value;
    // tenta JSON primeiro com replacer que lida com ciclos
    const seen = new WeakSet();
    const json = JSON.stringify(
      value,
      (_, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      },
      2,
    );
    if (json && json !== '{}') return json;
    return String(value);
  } catch {
    // último recurso
    try {
      return String(value);
    } catch {
      return '[Unserializable value]';
    }
  }
}

/** 🔧 Garante Error a partir de qualquer coisa lançada */
function normalizeToError(errLike: unknown): Error {
  if (errLike instanceof Error) return errLike;
  const msg = toSafeString(errLike);
  const e = new Error(msg);
  // anexa o bruto para inspeção no logger
  (e as any).__raw = errLike;
  return e;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  /** React chama quando um erro acontece durante render/commit de descendentes */
  static getDerivedStateFromError(errorLike: unknown): State {
    const err = normalizeToError(errorLike);
    return {
      hasError: true,
      errorInfo: {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        origin: typeof window !== 'undefined' ? window.location.pathname : '',
        raw: (err as any).__raw ?? errorLike,
      },
    };
  }

  /** Recebe o erro + stack de componentes (somente DEV) */
  async componentDidCatch(errorLike: unknown, info: React.ErrorInfo) {
    const err = normalizeToError(errorLike);

    const logDetalhado = {
      message: sanitizeTextForLogs(err.message),
      stack: sanitizeTextForLogs(err.stack ?? ''),
      componente: info?.componentStack,
      caminho: typeof window !== 'undefined' ? window.location.pathname : '',
      data: new Date().toISOString(),
      raw: redactSensitiveData(this.state?.errorInfo?.raw ?? (err as any).__raw),
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    // 🔊 Console estruturado (sem interpolar objeto em string)
    // Evita "Cannot convert object to primitive value"
    console.groupCollapsed('🚨 [ErrorBoundary]');
    console.error('🧩 Mensagem:', sanitizeTextForLogs(err.message));
    console.error('📍 Caminho:', logDetalhado.caminho);
    console.error('🕒 Data:', logDetalhado.data);
    console.error('🪴 Stack:', sanitizeTextForLogs(info?.componentStack ?? ''));
    console.error('🔹 Raw:', logDetalhado.raw);
    console.groupEnd();

    if (!shouldCaptureObservability('error')) return;

    // 🔹 Tenta logger remoto; se falhar, logger local
    try {
      const { registrarLog } = await import('@services/loggerService');
      await registrarLog({
        tipo: 'error',
        mensagem: sanitizeTextForLogs(err.message),
        detalhes: logDetalhado,
      });
    } catch (erroFallback) {
      console.warn(
        '⚠️ Falha ao registrar log remoto, usando fallback local.',
        sanitizeTextForLogs(
          erroFallback instanceof Error ? erroFallback.message : erroFallback,
        ),
      );
      try {
        await registrarLogLocal({
          tipo: 'error',
          mensagem: sanitizeTextForLogs(err.message),
          origem:
            typeof window !== 'undefined' ? window.location.pathname : 'N/A',
          arquivo: 'ErrorBoundary.tsx',
          stack: err.stack,
          detalhes: logDetalhado,
        });
      } catch (erroLocal) {
        console.error(
          '❌ Falha também no logger local:',
          sanitizeTextForLogs(
            erroLocal instanceof Error ? erroLocal.message : erroLocal,
          ),
        );
      }
    }
  }

  handleReload = () => window.location.reload();
  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  handleCopyLog = () => {
    const { errorInfo } = this.state;
    if (!errorInfo) return;
    const payload = {
      ...errorInfo,
      // corta stack pra não ficar enorme
      stack: errorInfo.stack?.split('\n').slice(0, 12).join('\n'),
    };
    const text = toSafeString(payload);
    void navigator.clipboard?.writeText(text);
    alert('📋 Log copiado para a área de transferência!');
  };

  render() {
    if (this.state.hasError && this.state.errorInfo) {
      const { message, stack, timestamp, origin } = this.state.errorInfo;

      return (
        <div className="flex h-screen items-center justify-center p-6">
          <Card className="max-w-[540px] shadow-lg">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-center">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
              </div>

              <h3 className="text-center text-lg font-semibold text-orange-700 dark:text-orange-400">
                Oops! Algo deu errado 🌱
              </h3>

              <p className="mt-2 text-center text-sm text-muted-foreground">
                Houve um erro inesperado na aplicação. Você pode tentar recarregar
                ou voltar ao painel principal.
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button onClick={this.handleReload}>
                  <RotateCw className="mr-1.5 h-4 w-4" />
                  Recarregar
                </Button>
                <Button variant="secondary" onClick={this.handleGoHome}>
                  <Home className="mr-1.5 h-4 w-4" />
                  Abrir painel
                </Button>
                <Button variant="ghost" onClick={this.handleCopyLog}>
                  Copiar log
                </Button>
              </div>

              <hr className="my-4 border-border" />

              <div className="flex flex-col gap-1">
                <p className="text-sm">
                  <strong>Mensagem:</strong> {message}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Rota:</strong> {origin}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Horário:</strong> {new Date(timestamp).toLocaleString()}
                </p>
                <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs text-red-600 dark:text-red-400">
                  {stack?.split('\n').slice(0, 6).join('\n')}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
