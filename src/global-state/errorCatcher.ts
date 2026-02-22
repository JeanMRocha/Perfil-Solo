import { registrarLogLocal } from '@services/loggerLocal';
import { isObservabilityKindEnabled } from '@services/observabilityConfig';
import { redactSensitiveData, sanitizeTextForLogs } from '@services/securityRedaction';

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
    console.error(
      '🔥 Erro global detectado:',
      sanitizeTextForLogs(err?.message || event.message),
    );

    registrarLogLocal({
      tipo: 'error',
      mensagem: sanitizeTextForLogs(err.message || 'Erro global desconhecido'),
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
    const reasonText = sanitizeTextForLogs(
      event.reason?.message || event.reason || 'Promise rejeitada sem tratamento',
    );
    console.error('⚠️ Rejeição não tratada:', reasonText);

    registrarLogLocal({
      tipo: 'error',
      mensagem: reasonText,
      origem: window.location.pathname,
      arquivo: 'global',
      stack: event.reason?.stack,
      detalhes: {
        tipo: 'unhandledrejection',
        motivo: redactSensitiveData(event.reason),
      },
    });
  });

  console.log('✅ Global Error Catcher inicializado');
}
