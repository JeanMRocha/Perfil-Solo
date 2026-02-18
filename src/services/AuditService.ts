import { isLocalDataMode } from './dataProvider';
import { supabaseClient } from '../supabase/supabaseClient';

const LOCAL_AUDIT_KEY = 'perfilsolo_local_audit_logs';

export interface AuditLogEntry {
  admin_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_data?: any;
  new_data?: any;
}

function appendLocalAudit(entry: AuditLogEntry) {
  try {
    const current = localStorage.getItem(LOCAL_AUDIT_KEY);
    const parsed = current ? (JSON.parse(current) as AuditLogEntry[]) : [];
    parsed.push(entry);
    localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(parsed.slice(-500)));
  } catch {
    // Evita quebra do fluxo em navegadores com storage bloqueado.
  }
}

export class AuditService {
  static async log(entry: AuditLogEntry) {
    if (isLocalDataMode) {
      appendLocalAudit(entry);
      console.log(
        `[Audit][local] ${entry.action} em ${entry.table_name} (${entry.record_id}) registrado.`,
      );
      return;
    }

    try {
      const { error } = await supabaseClient.from('audit_logs').insert([
        {
          admin_id: entry.admin_id,
          action: entry.action,
          table_name: entry.table_name,
          record_id: entry.record_id,
          old_data: entry.old_data,
          new_data: entry.new_data,
        },
      ]);

      if (error) throw error;

      console.log(
        `[Audit] ${entry.action} em ${entry.table_name} (${entry.record_id}) registrado.`,
      );
    } catch (err) {
      console.warn('[Audit] Falha ao registrar log no DB. Detalhes:', entry, err);
    }
  }
}
