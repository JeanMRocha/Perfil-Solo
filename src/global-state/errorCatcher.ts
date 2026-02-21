import { registrarLogLocal } from '@services/loggerLocal';
import { isObservabilityKindEnabled } from '@services/observabilityConfig';

/**
 * 🌍 Captura global de erros fora do ciclo do React.
 * Inclui falhas de inicialização, Supabase, e promessas rejeitadas.
 */

export function initGlobalErrorCatcher() {
  if (!isObservabilityKindEnabled('error')) {
    console.log('Global Error Catcher inicializado em modo observabilidade off.');
    return;
  }

  window.addEventListener('error', (event) => {
    const err = event.error || new Error(event.message);
    console.error('🔥 Erro global detectado:', err);

    registrarLogLocal({
      tipo: 'error',
      mensagem: err.message || 'Erro global desconhecido',
      origem: window.location.pathname,
      arquivo: 'global',
      stack: err.stack,
      detalhes: {
        tipo: 'window.onerror',
        col: event.colno,
        linha: event.lineno,
        arquivo: event.filename,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('⚠️ Rejeição não tratada:', event.reason);

    registrarLogLocal({
      tipo: 'error',
      mensagem: event.reason?.message || 'Promise rejeitada sem tratamento',
      origem: window.location.pathname,
      arquivo: 'global',
      stack: event.reason?.stack,
      detalhes: {
        tipo: 'unhandledrejection',
        motivo: event.reason,
      },
    });
  });

  console.log('✅ Global Error Catcher inicializado');
}
