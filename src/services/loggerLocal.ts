import { shouldAutoDownloadLocalErrorLog, shouldCaptureObservability } from './observabilityConfig';
import { storageReadJson, storageWriteJson } from './safeLocalStorage';

const LOCAL_ERROR_LOG_KEY = 'perfilsolo_local_error_reports_v1';
const MAX_LOCAL_ERROR_LOGS = 300;

export interface LogDetalhado {
  tipo: 'error' | 'warning' | 'info';
  mensagem: string;
  origem?: string;
  arquivo?: string;
  stack?: string;
  detalhes?: Record<string, unknown>;
}

interface StoredLogDetalhado extends LogDetalhado {
  timestamp: string;
  userAgent?: string;
  url?: string;
}

function buildStoredLog(input: LogDetalhado): StoredLogDetalhado {
  return {
    ...input,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    url: typeof window !== 'undefined' ? window.location.href : '',
  };
}

function appendLocalLog(log: StoredLogDetalhado) {
  const rows = storageReadJson<StoredLogDetalhado[]>(LOCAL_ERROR_LOG_KEY, []);
  rows.push(log);
  storageWriteJson(LOCAL_ERROR_LOG_KEY, rows.slice(-MAX_LOCAL_ERROR_LOGS));
}

function formatLogAsMarkdown(log: StoredLogDetalhado): string {
  return [
    '# Relatorio de erro local',
    '',
    `- Data: ${new Date(log.timestamp).toLocaleString()}`,
    `- Tipo: ${log.tipo}`,
    `- Mensagem: ${log.mensagem}`,
    `- Origem: ${log.origem || 'nao informada'}`,
    `- Arquivo: ${log.arquivo || 'nao informado'}`,
    '',
    '## Stack',
    '```',
    log.stack || 'Stack nao disponivel',
    '```',
    '',
    '## Detalhes',
    '```json',
    JSON.stringify(log.detalhes || {}, null, 2),
    '```',
    '',
    '## Ambiente',
    '```json',
    JSON.stringify(
      {
        userAgent: log.userAgent || '',
        url: log.url || '',
      },
      null,
      2,
    ),
    '```',
    '',
  ].join('\n');
}

function downloadLogFile(log: StoredLogDetalhado) {
  if (typeof window === 'undefined') return;
  const timestamp = log.timestamp.replace(/[:.]/g, '-');
  const name = `erro_${timestamp}.md`;
  const blob = new Blob([formatLogAsMarkdown(log)], {
    type: 'text/markdown;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function registrarLogLocal(log: LogDetalhado) {
  if (!shouldCaptureObservability('error')) return;

  try {
    const stored = buildStoredLog(log);
    appendLocalLog(stored);

    if (shouldAutoDownloadLocalErrorLog()) {
      downloadLogFile(stored);
    }

    console.log('[loggerLocal] log registrado localmente.');
  } catch (err) {
    console.error('[loggerLocal] falha ao registrar log local:', err);
  }
}

export function listarLogsLocaisErro(): StoredLogDetalhado[] {
  return storageReadJson<StoredLogDetalhado[]>(LOCAL_ERROR_LOG_KEY, []);
}
