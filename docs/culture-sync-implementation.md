# Implementação: Sistema de Sincronização Automática de Culturas (RNC)

**Data**: 22 de Fevereiro de 2026  
**Versão**: Phase 10  
**Recorrência**: Semanal (cron)

---

## 📋 Visão Geral

Implementação de sincronização automática e semanal de dados do **Registro Nacional de Cultivares (RNC/MAPA)** com o banco de dados local. 

### Fluxo

1. **Edge Function (Cron)** dispara automaticamente toda semana (domingo, 02:00 UTC)
2. **Busca dados do RNC** via API oficial
3. **Compara com dados locais** usando hashes MD5
4. **Importa novos** registros para todos os usuários
5. **Atualiza registros** existentes que mudaram
6. **Registra logs** detalhados de cada sincronização
7. **Super usuário** gerencia via painel / usuário comum apenas consome resultado

---

## 🗄️ Schema do Banco (Phase 10)

### Tabelas Criadas

#### `culture_import_logs`
- Auditoria completa de sincronizações
- Status: running → completed / failed
- Campos: imported_count, updated_count, skipped_count, error_count

#### `culture_sync_state`
- Estado global de sincronização (singleton)
- Rastreia: last_full_sync_at, next_scheduled_sync, sync_interval_hours

#### `culture_import_hashes`
- Hashes de registros para detecção de mudanças
- Evita re-sincronizar dados inalterados
- UNIQUE(user_id, rnc_uid)

---

## 🚀 Serviços Backend

### 1. `cultureBulkSyncService.ts`
Serviço otimizado de sincronização em **lote** (batch-based).

**Funções principais:**

```typescript
// Sincroniza múltiplos registros do RNC
bulkSyncRncRecords(
  records: RncCultivarRecord[],
  type: 'auto' | 'manual'
): Promise<SyncResult>

// Obtém logs de sincronização (super usuários)
getSyncLogs(limit?: number): Promise<SyncLog[]>

// Obtém estado global de sincronização
getSyncState(): Promise<SyncState | null>

// Agenda próxima sincronização
scheduleNextSync(intervalHours?: number): Promise<void>
```

### 2. `culture-sync-cron/index.ts` (Edge Function)
Executa automaticamente via cron trigger.

**Lógica:**
1. Busca dados CSV do RNC
2. Cria novo log de sincronização
3. Para cada usuário ativo:
   - Compara hashes com registros locais
   - Importa novos registros
   - Atualiza registros alterados
4. Finaliza log com estatísticas
5. Agenda próxima sincronização

**Cron Expression**: `0 2 * * 0` (Domingo, 02:00 UTC)

---

## 🎛️ Interface de Super Usuário

### Localização
`/super/culture-sync` (nova rota)

**Componente**: `CultureSyncAdmin.tsx`

### Abas

#### 1. **Status**
- Estatísticas em cards (total sincronizado, última sync, próxima sync)
- Botão de sincronização manual
- Últimas estatísticas do log

#### 2. **Histórico**
- Tabela de todos os logs de sincronização
- Filtragem por tipo (auto/manual)
- Detalhe de erros
- Copiar batch_id

#### 3. **Configurações**
- Alterar intervalo de sincronização
- Instruções de deploy do cron
- Verificação de status

---

## 🔄 Fluxo de Prioridade

**Para cada usuário:**

1. **Se cultivar especificado**: usar cultivar profiles
2. **Se apenas espécie**: usar species profiles
3. **Se nenhum**: nenhuma recomendação técnica

Implementado via `resolvePriority()` em `cultureImportService.ts`.

---

## 🔐 Segurança

### RLS Policies
- `culture_import_logs`: **Apenas super usuários** podem ler
- `culture_sync_state`: **Sem RLS** (global)
- `culture_import_hashes`: **Sem RLS** (sistema)

### Validações
- Autenticação obrigatória
- Super user check no painel admin
- Service role key apenas para cron job

---

## 📊 Detecção de Mudanças (Hash)

Cada registro RNC é hashificado usando:

```typescript
{
  especie_nome_comum: normalized,
  especie_nome_cientifico: normalized,
  cultivar: normalized,
  tipo_registro: normalized,
  grupo_especie: normalized,
  situacao: normalized
}
```

**Benefícios:**
- Evita re-sincronizar dados iguais
- Detecta mudanças em qualquer campo
- Performance otimizada para lotes grandes

---

## 🧩 Integração com Fluxo Existente

### Usuários Comuns
```typescript
import { useCultureProfile } from '@/hooks/useCulture';

const { profile, loading } = useCultureProfile({
  especie_nome_comum: 'Abacate',
  cultivar_nome: 'Hass'
});
// Retorna dados sincronizados automaticamente
```

### Talhão (TalhaoDetailModal)
- Vincula cultura (RNC) + dados técnicos já sincronizados
- Se cultivar: dados do cultivar (prioridade)
- Se espécie: dados genéricos da espécie

---

## 🛠️ Deploy & Configuração

### 1. Aplicar Migrations

```bash
cd supabase
supabase db reset  # Development
# OU
supabase db push --project-id <project-id>  # Production
```

### 2. Deploy da Edge Function

```bash
supabase functions deploy culture-sync-cron --project-id <project-id>
```

### 3. Configurar Cron Trigger

No **Painel Supabase**:
1. Ir para: **Edge Functions > culture-sync-cron**
2. Ativar "Cron"
3. Expressão: `0 2 * * 0` (domingo 02:00 UTC)
4. Salvar

### 4. Adicionar Rota no Router

```typescript
// router.tsx
{
  path: '/super/culture-sync',
  lazy: () => import('@/views/Super/CultureSyncAdmin'),
  element: <ProtectedPath minLevel="super"><CultureSyncAdmin /></ProtectedPath>
}
```

---

## 📋 Checklist de Verificação

- [ ] Migrations aplicadas (3 tabelas criadas)
- [ ] `cultureBulkSyncService.ts` compilando
- [ ] `culture-sync-cron` edge function deployada
- [ ] `CultureSyncAdmin.tsx` acessível para super usuários
- [ ] Cron job configurado no painel Supabase
- [ ] Primeira sincronização manual testada
- [ ] Logs aparecem no painel de admin
- [ ] Usuários comuns veem dados sincronizados
- [ ] Próxima sincronização agendada

---

## 🐛 Troubleshooting

### "Nenhum log aparece"
- Verificar se cron foi ativado no painel Supabase
- Verificar logs da edge function em: **Edge Functions > Logs**
- Conferir se há usuários ativos na tabela `users_registry`

### "Hashes não atualizam"
- Verificar permissões na tabela `culture_import_hashes`
- Conferir se usuário está autenticado

### "Erros na sincronização"
- Verificar conexão com RNC (pode estar offline)
- Revisar erros no log: `culture_import_logs.error_message`
- Aumentar `SYNC_CHUNK_SIZE` se timeout

---

## 📈 Próximos Passos

1. **Análise de Performance**: monitorar tempo de sincronização para 10k+ registros
2. **Notificações Opcionais**: enviar email para super usuário com resumo de sync
3. **Webhook**: disparar ação quando nova cultura é sincronizada
4. **Atualização Incremental**: sincronizar apenas mudanças (não todo CSV)

---

## Contato & Suporte

Para dúvidas sobre:
- Schema: revisar `supabase/migrations/20260222_phase10_culture_sync_system.sql`
- Serviço: revisar `cultureBulkSyncService.ts`
- Cron: revisar `supabase/functions/culture-sync-cron/index.ts`
- UI: revisar `CultureSyncAdmin.tsx`
