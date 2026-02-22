import { lazy } from 'react';
import { shouldCaptureObservability } from '../services/observabilityConfig';
import { sanitizeTextForLogs } from '../services/securityRedaction';

function logLazyImportFallback(name: string, err: unknown) {
  console.error('Falha no lazy import', {
    name,
    err: sanitizeTextForLogs(String(err)),
  });
}

// Resolve "Cannot convert object to primitive value" e falhas no lazy import.
// Loga com detalhes e repropaga para o errorElement do React Router.
export function lazyWithBoundary<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  name: string,
) {
  return lazy(async () => {
    try {
      const mod = await importer();
      return mod;
    } catch (err) {
      // log local + console seguro
      if (shouldCaptureObservability('error')) {
        try {
          const { registrarLogLocal } = await import('../services/loggerLocal');
          await registrarLogLocal({
            tipo: 'error',
            mensagem: `Falha ao carregar modulo lazy: ${name}`,
            origem: `router/lazyWithBoundary.ts -> ${name}`,
            stack: (err as Error)?.stack,
            detalhes: { name, err: sanitizeTextForLogs(String(err)) },
          });
        } catch {
          logLazyImportFallback(name, err);
        }
      } else {
        logLazyImportFallback(name, err);
      }
      throw err; // deixa o React Router tratar via errorElement
    }
  });
}
