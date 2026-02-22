import { isLocalDataMode } from '@services/dataProvider';
import { supabaseClient } from '@sb/supabaseClient';
import { appendBoundedLocalJsonList } from './observabilityLocalStore';
import {
  redactSensitiveData,
  sanitizeErrorMessage,
  sanitizeTextForLogs,
} from './securityRedaction';
import {
  shouldCaptureObservability,
  shouldPersistLocalObservability,
  isRemoteObservabilityEnabled,
} from './observabilityConfig';

const LOCAL_LOG_KEY = 'perfilsolo_local_logs';
const MAX_LOCAL_LOGS = 500;

export interface LogEvento {
  tipo: 'error' | 'warning' | 'info';
  mensagem: string;
  origem?: string;
  usuario_id?: string | null;
  detalhes?: Record<string, any>;
}

export async function registrarLog(evento: LogEvento) {
  if (!shouldCaptureObservability('event')) return;

  const data = {
    tipo: evento.tipo,
    mensagem: sanitizeTextForLogs(evento.mensagem),
    origem: sanitizeTextForLogs(evento.origem || window.location.pathname),
    usuario_id: evento.usuario_id || null,
    detalhes: redactSensitiveData(evento.detalhes || {}),
    timestamp: new Date().toISOString(),
  };

  console.groupCollapsed(`[LOG ${evento.tipo.toUpperCase()}]`);
  console.table(data);
  console.groupEnd();

  const shouldPersistLocal = shouldPersistLocalObservability(isLocalDataMode);

  if (shouldPersistLocal) {
    appendBoundedLocalJsonList(LOCAL_LOG_KEY, data, MAX_LOCAL_LOGS);
    if (!isRemoteObservabilityEnabled()) return;
  }

  try {
    const { error } = await supabaseClient.from('logs_sistema').insert([data]);
    if (error) {
      console.warn(
        'Falha ao enviar log para o Supabase:',
        sanitizeErrorMessage(error),
      );
    }
  } catch (err) {
    console.error(
      'Erro interno no loggerService:',
      sanitizeErrorMessage(err),
    );
  }
}
