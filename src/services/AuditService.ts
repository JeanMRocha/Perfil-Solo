import { isLocalDataMode } from './dataProvider';
import { supabaseClient } from '../supabase/supabaseClient';
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

const LOCAL_AUDIT_KEY = 'perfilsolo_local_audit_logs';
const MAX_LOCAL_AUDIT_LOGS = 500;

export interface AuditLogEntry {
  admin_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_data?: any;
  new_data?: any;
}

export class AuditService {
  static async log(entry: AuditLogEntry) {
    if (!shouldCaptureObservability('audit')) return;

    const sanitizedEntry: AuditLogEntry = {
      admin_id: sanitizeTextForLogs(entry.admin_id),
      action: entry.action,
      table_name: sanitizeTextForLogs(entry.table_name),
      record_id: sanitizeTextForLogs(entry.record_id),
      old_data: redactSensitiveData(entry.old_data),
      new_data: redactSensitiveData(entry.new_data),
    };

    const shouldPersistLocal = shouldPersistLocalObservability(isLocalDataMode);

    if (shouldPersistLocal) {
      appendBoundedLocalJsonList(
        LOCAL_AUDIT_KEY,
        sanitizedEntry,
        MAX_LOCAL_AUDIT_LOGS,
      );
      console.log(
        `[Audit][local] ${sanitizedEntry.action} em ${sanitizedEntry.table_name} (${sanitizedEntry.record_id}) registrado.`,
      );
      if (!isRemoteObservabilityEnabled()) return;
    }

    try {
      const { error } = await supabaseClient.from('audit_logs').insert([
        {
          admin_id: sanitizedEntry.admin_id,
          action: sanitizedEntry.action,
          table_name: sanitizedEntry.table_name,
          record_id: sanitizedEntry.record_id,
          old_data: sanitizedEntry.old_data,
          new_data: sanitizedEntry.new_data,
        },
      ]);

      if (error) throw error;

      console.log(
        `[Audit] ${sanitizedEntry.action} em ${sanitizedEntry.table_name} (${sanitizedEntry.record_id}) registrado.`,
      );
    } catch (error) {
      const reason = sanitizeErrorMessage(error);
      console.warn('[Audit] Falha ao registrar log no DB.', reason);
    }
  }
}
