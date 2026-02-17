// src/services/AuditService.ts
import { supabaseClient } from '../supabase/supabaseClient';

export interface AuditLogEntry {
    admin_id: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    table_name: string;
    record_id: string;
    old_data?: any;
    new_data?: any;
}

/**
 * AuditService
 * Registra mudanças em parâmetros críticos para conformidade técnica e segurança.
 */
export class AuditService {
    /**
     * Registra um evento de auditoria no Supabase.
     * Caso o Supabase falhe (ex: offline), registra no console para diagnóstico.
     */
    static async log(entry: AuditLogEntry) {
        try {
            const { error } = await supabaseClient
                .from('audit_logs')
                .insert([{
                    admin_id: entry.admin_id,
                    action: entry.action,
                    table_name: entry.table_name,
                    record_id: entry.record_id,
                    old_data: entry.old_data,
                    new_data: entry.new_data,
                }]);

            if (error) throw error;

            console.log(`[Audit] ${entry.action} em ${entry.table_name} (${entry.record_id}) registrado.`);
        } catch (err) {
            console.warn('[Audit] Falha ao registrar log no DB. Detalhes:', entry, err);
            // Aqui poderíamos salvar em um LocalStorage fallback de auditoria
        }
    }
}
