import { isLocalDataMode } from '@services/dataProvider';
import { supabaseClient } from '@sb/supabaseClient';

const LOCAL_LOG_KEY = 'perfilsolo_local_logs';

export interface LogEvento {
  tipo: 'error' | 'warning' | 'info';
  mensagem: string;
  origem?: string;
  usuario_id?: string | null;
  detalhes?: Record<string, any>;
}

function appendLocalLog(entry: Record<string, any>) {
  try {
    const current = localStorage.getItem(LOCAL_LOG_KEY);
    const parsed = current ? (JSON.parse(current) as Record<string, any>[]) : [];
    parsed.push(entry);
    localStorage.setItem(LOCAL_LOG_KEY, JSON.stringify(parsed.slice(-500)));
  } catch {
    // Mantem fluxo principal sem quebrar em caso de localStorage indisponivel.
  }
}

export async function registrarLog(evento: LogEvento) {
  const data = {
    tipo: evento.tipo,
    mensagem: evento.mensagem,
    origem: evento.origem || window.location.pathname,
    usuario_id: evento.usuario_id || null,
    detalhes: evento.detalhes || {},
    timestamp: new Date().toISOString(),
  };

  console.groupCollapsed(`[LOG ${evento.tipo.toUpperCase()}]`);
  console.table(data);
  console.groupEnd();

  if (isLocalDataMode) {
    appendLocalLog(data);
    return;
  }

  try {
    const { error } = await supabaseClient.from('logs_sistema').insert([data]);
    if (error) {
      console.warn('Falha ao enviar log para o Supabase:', error.message);
    }
  } catch (err) {
    console.error('Erro interno no loggerService:', err);
  }
}
