import { useEffect, useState, useCallback } from 'react';
import {
  Container,
  Tabs,
  Stack,
  Button,
  Group,
  Table,
  Badge,
  Text,
  Card,
  Alert,
  Loader,
  Center,
  Grid,
  ActionIcon,
  CopyButton,
  Tooltip,
  Modal,
  NumberInput,
} from '@mantine/core';
import {
  IconRefresh,
  IconCheck,
  IconAlertCircle,
  IconClock,
  IconDatabase,
  IconCopy,
  IconDownload,
  IconSettings,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import PageHeader from '../../components/PageHeader';
import {
  bulkSyncRncRecords,
  getSyncLogs,
  getSyncState,
  scheduleNextSync,
  type SyncLog,
} from '../../services/cultureBulkSyncService';
import {
  cleanupExpiredLogs,
  cleanupStaleHashes,
  getRetentionStats,
  runAllCleanupJobs,
  markImportLogResolved,
  deleteImportLog,
  getUnresolvedErrorsStats,
} from '../../services/dataRetentionService';
import { fullImportRncDatabase } from '../../services/cultureImportService';
import { searchRncCultivars } from '../../services/rncCultivarService';
import { isOwnerSuperUser } from '../../services/superAccessService';
import { supabaseClient } from '../../supabase/supabaseClient';

interface CultureSyncAdminProps {
  isEmbedded?: boolean;
}

export default function CultureSyncAdmin({
  isEmbedded = false,
}: CultureSyncAdminProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('status');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [syncState, setSyncState] = useState<{
    last_sync_at: string | null;
    total_synced: number;
    next_sync: string | null;
    is_enabled: boolean;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncInterval, setSyncInterval] = useState(168); // 1 semana em horas
  const [cleanupStats, setCleanupStats] = useState<any>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [logsRetention, setLogsRetention] = useState(90);
  const [fullImportModalOpen, setFullImportModalOpen] = useState(false);
  const [fullImporting, setFullImporting] = useState(false);
  const [fullImportProgress, setFullImportProgress] = useState(0);
  const [fullImportMessage, setFullImportMessage] = useState('');
  const [lastImportErrors, setLastImportErrors] = useState<
    Array<{ record: string; error: string }>
  >([]);
  const [lastImportStats, setLastImportStats] = useState<any>(null);
  const [processingLogId, setProcessingLogId] = useState<string | null>(null);
  const [unresolvedErrorsStats, setUnresolvedErrorsStats] = useState<any>(null);

  // Verifica se é super usuário (apenas quando não está embutido)
  useEffect(() => {
    if (isEmbedded) {
      setIsAdmin(true);
      return;
    }

    (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      const super_user = user ? isOwnerSuperUser(user) : false;
      setIsAdmin(super_user);
      if (!super_user) {
        notifications.show({
          title: 'Acesso Negado',
          message: 'Apenas super usuários podem acessar este painel.',
          color: 'red',
        });
      }
    })();
  }, [isEmbedded]);

  // Carrega dados de sincronização
  const loadSyncData = useCallback(async () => {
    try {
      setLoading(true);
      const [logsData, stateData] = await Promise.all([
        getSyncLogs(20),
        getSyncState(),
      ]);
      setLogs(logsData);
      setSyncState(stateData);
    } catch (error) {
      console.error('Erro ao carregar dados de sync:', error);
      notifications.show({
        title: 'Erro',
        message: 'Falha ao carregar dados de sincronização',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega dados ao montar
  useEffect(() => {
    void loadSyncData();
    const interval = setInterval(() => loadSyncData(), 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, [loadSyncData]);

  // Carrega estatísticas de limpeza
  const loadCleanupStats = useCallback(async () => {
    try {
      setCleanupLoading(true);
      const stats = await getRetentionStats();
      setCleanupStats(stats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas de limpeza:', error);
      notifications.show({
        title: 'Erro',
        message: 'Falha ao carregar estatísticas de retenção',
        color: 'red',
      });
    } finally {
      setCleanupLoading(false);
    }
  }, []);

  // Executa todas as limpezas
  const handleRunAllCleanup = async () => {
    try {
      setCleaning(true);
      notifications.show({
        title: 'Limpeza Iniciada',
        message: 'Executando rotinas de limpeza...',
        color: 'blue',
        autoClose: false,
      });

      const result = await runAllCleanupJobs();

      notifications.show({
        title: '✓ Limpeza Concluída',
        message: `Total de ${result.total_deleted} registro${result.total_deleted !== 1 ? 's' : ''} apagado${result.total_deleted !== 1 ? 's' : ''}`,
        color: 'green',
      });

      await loadCleanupStats();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      notifications.show({
        title: '✗ Erro na Limpeza',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setCleaning(false);
    }
  };

  // Executa limpeza de logs expirados
  const handleCleanupLogs = async () => {
    try {
      setCleaning(true);
      const result = await cleanupExpiredLogs();
      notifications.show({
        title: '✓ Limpeza de Logs Concluída',
        message: `${result.deleted_count} registros de log apagados`,
        color: 'green',
      });
      await loadCleanupStats();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      notifications.show({
        title: '✗ Erro ao limpar logs',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setCleaning(false);
    }
  };

  // Executa limpeza de hashes obsoletos
  const handleCleanupHashes = async () => {
    try {
      setCleaning(true);
      const result = await cleanupStaleHashes();
      notifications.show({
        title: '✓ Limpeza de Hashes Concluída',
        message: `${result.deleted_count} registros de hash removidos`,
        color: 'green',
      });
      await loadCleanupStats();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      notifications.show({
        title: '✗ Erro ao limpar hashes',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setCleaning(false);
    }
  };

  // Executa importação completa do RNC
  const handleFullImportRnc = async () => {
    try {
      setFullImporting(true);
      setFullImportProgress(0);
      setFullImportMessage('Iniciando importação...');
      setFullImportModalOpen(true);

      notifications.show({
        title: 'Importação Iniciada',
        message:
          'Buscando todas as culturas do RNC. Isto pode levar alguns minutos...',
        color: 'blue',
        autoClose: false,
      });

      const result = await fullImportRncDatabase((current, total, message) => {
        setFullImportMessage(message);
        if (total > 0) {
          setFullImportProgress(
            Math.min(100, Math.round((current / total) * 100)),
          );
        }
      });

      // Salva os erros para visualização
      setLastImportErrors(result.sample_errors);
      setLastImportStats({
        total_processed: result.total_processed,
        total_imported: result.total_imported,
        total_skipped: result.total_skipped,
        total_errors: result.total_errors,
        pages_processed: result.pages_processed,
        groups_imported: result.groups_imported.length,
        duration_seconds: result.duration_seconds,
        started_at: result.started_at,
        completed_at: result.completed_at,
      });

      // Log detalhado no console
      console.log('═══════════════════════════════════════════');
      console.log('📊 RESULTADO DA IMPORTAÇÃO COMPLETA DO RNC');
      console.log('═══════════════════════════════════════════');
      console.log(`✓ Importados: ${result.total_imported}`);
      console.log(`⊘ Ignorados: ${result.total_skipped}`);
      console.log(`✗ Erros: ${result.total_errors}`);
      console.log(`📄 Páginas processadas: ${result.pages_processed}`);
      console.log(`🌾 Grupos únicos: ${result.groups_imported.length}`);
      console.log(`⏱️  Tempo total: ${result.duration_seconds}s`);
      if (result.sample_errors.length > 0) {
        console.log('⚠️  Amostra de Erros:');
        result.sample_errors.forEach((err) => {
          console.error(`  - ${err.record}: ${err.error}`);
        });
      }
      console.log('═══════════════════════════════════════════');

      if (result.success) {
        notifications.show({
          title: '✓ Importação Completa Concluída',
          message: `Importados: ${result.total_imported} | Ignorados: ${result.total_skipped} | Erros: ${result.total_errors} | Tempo: ${result.duration_seconds}s`,
          color: 'green',
        });
      } else {
        notifications.show({
          title: '⚠ Importação Concluída com Problemas',
          message: `Importados: ${result.total_imported} | Erros: ${result.total_errors}`,
          color: 'yellow',
          autoClose: false,
        });
      }

      setFullImportProgress(100);
      setFullImportMessage(
        `Concluído! Importados: ${result.total_imported}, Grupos: ${result.groups_imported.length}`,
      );

      await loadSyncData();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('❌ Erro na importação completa:', errorMessage);
      notifications.show({
        title: '✗ Erro na Importação',
        message: errorMessage,
        color: 'red',
        autoClose: false,
      });
      setFullImportMessage(`Erro: ${errorMessage}`);
    } finally {
      setFullImporting(false);
    }
  };

  // Executa sincronização manual
  const handleManualSync = async () => {
    try {
      setSyncing(true);
      notifications.show({
        title: 'Sincronização Iniciada',
        message: 'Buscando dados do RNC...',
        color: 'blue',
        autoClose: false,
      });

      // Busca dados do RNC (amostra para testes)
      const rncResponse = await searchRncCultivars({
        pageSize: 500,
      });

      if (rncResponse.items.length === 0) {
        throw new Error('Nenhum registro encontrado no RNC');
      }

      // Sincroniza em lote
      const result = await bulkSyncRncRecords(rncResponse.items, 'manual');

      notifications.show({
        title: '✓ Sincronização Concluída',
        message: `Importados: ${result.imported} | Atualizados: ${result.updated} | Ignorados: ${result.skipped} | Erros: ${result.errors}`,
        color: result.errors === 0 ? 'green' : 'yellow',
      });

      await loadSyncData();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      notifications.show({
        title: '✗ Erro na Sincronização',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Salva configurações de intervalo
  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      await scheduleNextSync(syncInterval);
      notifications.show({
        title: '✓ Configurações Salvas',
        message: `Próxima sincronização em ${syncInterval} horas`,
        color: 'green',
      });
      setSettingsOpen(false);
      await loadSyncData();
    } catch (error) {
      notifications.show({
        title: 'Erro',
        message: 'Falha ao salvar configurações',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <Container size="xl" mt="xl">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Acesso Negado"
          color="red"
        >
          Apenas super usuários podem acessar este painel de administração.
        </Alert>
      </Container>
    );
  }

  const lastSync = syncState?.last_sync_at
    ? new Date(syncState.last_sync_at)
    : null;
  const nextSync = syncState?.next_sync ? new Date(syncState.next_sync) : null;

  return (
    <Container
      size={isEmbedded ? 'md' : 'xl'}
      mt={isEmbedded ? 0 : 'xl'}
      p={isEmbedded ? 0 : 'md'}
    >
      {!isEmbedded && <PageHeader title="Administração de Culturas (RNC)" />}

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="status" leftSection={<IconDatabase size={14} />}>
            Status
          </Tabs.Tab>
          <Tabs.Tab value="historico" leftSection={<IconClock size={14} />}>
            Histórico
          </Tabs.Tab>
          <Tabs.Tab value="logs" leftSection={<IconAlertCircle size={14} />}>
            Logs de Erros
          </Tabs.Tab>
          <Tabs.Tab value="limpeza" leftSection={<IconAlertCircle size={14} />}>
            Limpeza de Dados
          </Tabs.Tab>
          <Tabs.Tab
            value="configuracoes"
            leftSection={<IconSettings size={14} />}
          >
            Configurações
          </Tabs.Tab>
        </Tabs.List>

        {/* ABA 1: STATUS */}
        <Tabs.Panel value="status" pt="lg">
          {loading ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : (
            <Stack gap="lg">
              {/* CARDS DE ESTATÍSTICAS */}
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card withBorder>
                    <Stack gap="xs" align="center">
                      <Text fw={500} size="sm" c="dimmed">
                        Total Sincronizado
                      </Text>
                      <Text fw={700} size="xl">
                        {syncState?.total_synced || 0}
                      </Text>
                      <IconCheck size={18} color="blue" />
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card withBorder>
                    <Stack gap="xs" align="center">
                      <Text fw={500} size="sm" c="dimmed">
                        Última Sync
                      </Text>
                      <Text fw={700} size="sm">
                        {lastSync ? lastSync.toLocaleDateString('pt-BR') : '-'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {lastSync
                          ? lastSync.toLocaleTimeString('pt-BR')
                          : 'Nunca'}
                      </Text>
                      <IconClock size={18} color="teal" />
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card withBorder>
                    <Stack gap="xs" align="center">
                      <Text fw={500} size="sm" c="dimmed">
                        Próxima Sync
                      </Text>
                      <Text fw={700} size="sm">
                        {nextSync ? nextSync.toLocaleDateString('pt-BR') : '-'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {nextSync
                          ? nextSync.toLocaleTimeString('pt-BR')
                          : 'Aguardando'}
                      </Text>
                      <IconClock
                        size={18}
                        color={
                          nextSync && nextSync > new Date() ? 'green' : 'red'
                        }
                      />
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card withBorder>
                    <Stack gap="xs" align="center">
                      <Text fw={500} size="sm" c="dimmed">
                        Status
                      </Text>
                      <Badge
                        color={syncState?.is_enabled ? 'green' : 'red'}
                        size="lg"
                      >
                        {syncState?.is_enabled ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {syncState?.is_enabled ? (
                        <IconCheck size={18} color="green" />
                      ) : (
                        <IconAlertCircle size={18} color="red" />
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>
              </Grid>

              {/* AÇÕES */}
              <Card withBorder>
                <Card.Section withBorder inheritPadding py="md">
                  <Text fw={700}>Ações de Sincronização</Text>
                </Card.Section>
                <Card.Section inheritPadding py="md">
                  <Stack gap="md">
                    <Alert icon={<IconDownload size={16} />} color="blue">
                      A sincronização automática ocorre toda semana. Você pode
                      disparar uma sincronização manual a qualquer momento
                      abaixo.
                    </Alert>

                    <Group justify="space-between">
                      <div>
                        <Text fw={500}>Sincronização Manual</Text>
                        <Text size="sm" c="dimmed">
                          Busca novos dados do RNC e sincroniza com todas as
                          contas usuário
                        </Text>
                      </div>
                      <Button
                        leftSection={<IconRefresh size={14} />}
                        onClick={handleManualSync}
                        loading={syncing}
                        disabled={syncing || !syncState?.is_enabled}
                      >
                        {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                      </Button>
                    </Group>

                    {/* IMPORTAÇÃO COMPLETA */}
                    <div
                      style={{
                        borderTop: '1px solid var(--mantine-color-gray-3)',
                        paddingTop: '16px',
                      }}
                    >
                      <Group justify="space-between">
                        <div>
                          <Text fw={500}>Importação Completa do RNC</Text>
                          <Text size="sm" c="dimmed">
                            Importa TODAS as culturas registradas no RNC para
                            seu banco de dados
                          </Text>
                        </div>
                        <Button
                          color="green"
                          leftSection={<IconDownload size={14} />}
                          onClick={handleFullImportRnc}
                          loading={fullImporting}
                          disabled={fullImporting}
                        >
                          {fullImporting ? 'Importando...' : 'Importar Tudo'}
                        </Button>
                      </Group>
                    </div>
                  </Stack>
                </Card.Section>
              </Card>

              {/* ÚLTIMO LOG */}
              {logs.length > 0 && (
                <Card withBorder>
                  <Card.Section withBorder inheritPadding py="md">
                    <Text fw={700}>Último Log de Sincronização</Text>
                  </Card.Section>
                  <Card.Section inheritPadding py="md">
                    {(() => {
                      const lastLog = logs[0];
                      return (
                        <Stack gap="sm">
                          <Group justify="space-between" align="flex-start">
                            <div>
                              <Text fw={500}>{lastLog.sync_batch_id}</Text>
                              <Text size="sm" c="dimmed">
                                {new Date(lastLog.started_at).toLocaleString(
                                  'pt-BR',
                                )}
                              </Text>
                            </div>
                            <Badge
                              color={
                                lastLog.status === 'completed' ? 'green' : 'red'
                              }
                            >
                              {lastLog.status === 'completed'
                                ? 'Completo'
                                : 'Erro'}
                            </Badge>
                          </Group>

                          <Grid>
                            <Grid.Col span={{ base: 6, sm: 3 }}>
                              <div>
                                <Text size="sm" c="dimmed">
                                  Importados
                                </Text>
                                <Text fw={700} size="lg">
                                  {lastLog.imported_count}
                                </Text>
                              </div>
                            </Grid.Col>
                            <Grid.Col span={{ base: 6, sm: 3 }}>
                              <div>
                                <Text size="sm" c="dimmed">
                                  Atualizados
                                </Text>
                                <Text fw={700} size="lg">
                                  {lastLog.updated_count}
                                </Text>
                              </div>
                            </Grid.Col>
                            <Grid.Col span={{ base: 6, sm: 3 }}>
                              <div>
                                <Text size="sm" c="dimmed">
                                  Ignorados
                                </Text>
                                <Text fw={700} size="lg">
                                  {lastLog.skipped_count}
                                </Text>
                              </div>
                            </Grid.Col>
                            <Grid.Col span={{ base: 6, sm: 3 }}>
                              <div>
                                <Text size="sm" c="dimmed">
                                  Erros
                                </Text>
                                <Text
                                  fw={700}
                                  size="lg"
                                  c={lastLog.error_count > 0 ? 'red' : 'green'}
                                >
                                  {lastLog.error_count}
                                </Text>
                              </div>
                            </Grid.Col>
                          </Grid>

                          {lastLog.error_message && (
                            <Alert
                              icon={<IconAlertCircle size={16} />}
                              color="red"
                              title="Erro"
                            >
                              {lastLog.error_message}
                            </Alert>
                          )}
                        </Stack>
                      );
                    })()}
                  </Card.Section>
                </Card>
              )}
            </Stack>
          )}
        </Tabs.Panel>

        {/* ABA 2: HISTÓRICO */}
        <Tabs.Panel value="historico" pt="lg">
          {loading ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Batch ID</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Data/Hora</Table.Th>
                  <Table.Th>Importados</Table.Th>
                  <Table.Th>Atualizados</Table.Th>
                  <Table.Th>Erros</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {logs.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="sm" ff="monospace">
                          {log.sync_batch_id.substring(0, 20)}...
                        </Text>
                        <CopyButton value={log.sync_batch_id}>
                          {({ copied }) => (
                            <Tooltip
                              label={copied ? 'Copiado' : 'Copiar'}
                              withArrow
                              position="right"
                            >
                              <ActionIcon
                                color={copied ? 'teal' : 'gray'}
                                variant="subtle"
                                size="xs"
                              >
                                <IconCopy size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light">
                        {log.sync_type === 'auto' ? 'Automática' : 'Manual'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(log.started_at).toLocaleString('pt-BR')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{log.imported_count}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{log.updated_count}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500} c={log.error_count > 0 ? 'red' : 'green'}>
                        {log.error_count}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={log.status === 'completed' ? 'green' : 'red'}
                        variant="light"
                      >
                        {log.status === 'completed' ? 'Completo' : 'Erro'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        {/* ABA 3: LOGS DE ERROS */}
        <Tabs.Panel value="logs" pt="lg">
          {lastImportStats ? (
            <Stack gap="lg">
              {/* RESUMO DA IMPORTAÇÃO */}
              <Card withBorder>
                <Card.Section withBorder inheritPadding py="md">
                  <Text fw={700}>Último Processamento de Importação</Text>
                </Card.Section>
                <Card.Section inheritPadding py="md">
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <div>
                        <Text size="sm" c="dimmed">
                          Total Processado
                        </Text>
                        <Text fw={700} size="xl">
                          {lastImportStats.total_processed}
                        </Text>
                      </div>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <div>
                        <Text size="sm" c="dimmed">
                          Importados com Sucesso
                        </Text>
                        <Text fw={700} size="xl" c="green">
                          {lastImportStats.total_imported}
                        </Text>
                      </div>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <div>
                        <Text size="sm" c="dimmed">
                          Ignorados
                        </Text>
                        <Text fw={700} size="xl" c="blue">
                          {lastImportStats.total_skipped}
                        </Text>
                      </div>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <div>
                        <Text size="sm" c="dimmed">
                          Erros
                        </Text>
                        <Text fw={700} size="xl" c="red">
                          {lastImportStats.total_errors}
                        </Text>
                      </div>
                    </Grid.Col>
                  </Grid>

                  <Group
                    justify="space-between"
                    mt="md"
                    pt="md"
                    style={{
                      borderTop: '1px solid var(--mantine-color-gray-3)',
                    }}
                  >
                    <div>
                      <Text size="sm" c="dimmed">
                        Páginas Processadas
                      </Text>
                      <Text fw={700}>{lastImportStats.pages_processed}</Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">
                        Grupos Únicos
                      </Text>
                      <Text fw={700}>{lastImportStats.groups_imported}</Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">
                        Tempo Total
                      </Text>
                      <Text fw={700}>{lastImportStats.duration_seconds}s</Text>
                    </div>
                  </Group>
                </Card.Section>
              </Card>

              {/* TABELA DE ERROS */}
              {lastImportErrors.length > 0 ? (
                <Card withBorder>
                  <Card.Section withBorder inheritPadding py="md">
                    <Group justify="space-between">
                      <Text fw={700}>Amostra de Erros (máx. 10)</Text>
                      <Badge color="red">
                        {lastImportErrors.length} erro
                        {lastImportErrors.length !== 1 ? 's' : ''}
                      </Badge>
                    </Group>
                  </Card.Section>
                  <Card.Section inheritPadding py="md">
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Registro</Table.Th>
                          <Table.Th>Mensagem de Erro</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {lastImportErrors.map((err, idx) => (
                          <Table.Tr key={idx}>
                            <Table.Td>
                              <Text size="sm" ff="monospace" fw={500}>
                                {err.record}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="red">
                                {err.error}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Card.Section>
                </Card>
              ) : (
                <Alert
                  icon={<IconCheck size={16} />}
                  color="green"
                  title="Sem Erros"
                >
                  A última importação foi concluída sem problemas!
                </Alert>
              )}

              {/* DICAS DE DEBUG */}
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="blue"
                title="Dica de Debug"
              >
                Abra o console do navegador (F12) para ver logs detalhados da
                importação com informações específicas sobre cada etapa.
              </Alert>
            </Stack>
          ) : (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="gray"
              title="Nenhum Processamento"
            >
              Ainda não há nenhuma importação realizada nesta sessão. Clique em
              "Importar Tudo" na aba Status para ver os logs de erro aqui.
            </Alert>
          )}
        </Tabs.Panel>

        {/* ABA 4: LIMPEZA DE DADOS */}
        <Tabs.Panel value="limpeza" pt="lg">
          <Stack gap="lg">
            {/* AVISO IMPORTANTE */}
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="orange"
              title="Atenção"
            >
              Operações de limpeza são irreversíveis. Os dados apagados não
              poderão ser recuperados. Certifique-se antes de executar.
            </Alert>

            {/* ESTATÍSTICAS DE RETENÇÃO */}
            <Card withBorder>
              <Card.Section withBorder inheritPadding py="md">
                <Group justify="space-between" align="center">
                  <Text fw={700}>Estimativa de Dados a Serem Apagados</Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => loadCleanupStats()}
                    loading={cleanupLoading}
                  >
                    Atualizar
                  </Button>
                </Group>
              </Card.Section>
              <Card.Section inheritPadding py="md">
                {cleanupLoading ? (
                  <Center py="xl">
                    <Loader size={32} />
                  </Center>
                ) : cleanupStats ? (
                  <Stack gap="lg">
                    {/* Logs */}
                    <div>
                      <Group justify="space-between" mb="xs">
                        <div>
                          <Text fw={500}>Logs de Sincronização</Text>
                          <Text size="sm" c="dimmed">
                            Registros com mais de {logsRetention} dias
                          </Text>
                        </div>
                        <Badge size="lg" color="red">
                          {cleanupStats.expired_logs_count || 0} registro
                          {cleanupStats.expired_logs_count !== 1 ? 's' : ''}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        Período: até{' '}
                        {new Date(
                          cleanupStats.oldest_log_date || Date.now(),
                        ).toLocaleDateString('pt-BR')}
                      </Text>
                    </div>

                    {/* Hashes */}
                    <div>
                      <Group justify="space-between" mb="xs">
                        <div>
                          <Text fw={500}>Hashes Obsoletos</Text>
                          <Text size="sm" c="dimmed">
                            Registros não sincronizados há mais de 180 dias
                          </Text>
                        </div>
                        <Badge size="lg" color="orange">
                          {cleanupStats.stale_hashes_count || 0} registro
                          {cleanupStats.stale_hashes_count !== 1 ? 's' : ''}
                        </Badge>
                      </Group>
                    </div>

                    {/* Total */}
                    <div
                      style={{
                        borderTop: '1px solid var(--mantine-color-gray-3)',
                        paddingTop: '12px',
                      }}
                    >
                      <Group justify="space-between">
                        <Text fw={600}>Total de Registros a Apagar</Text>
                        <Badge size="xl" color="red" variant="filled">
                          {(cleanupStats.expired_logs_count || 0) +
                            (cleanupStats.stale_hashes_count || 0)}
                        </Badge>
                      </Group>
                    </div>
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    Clique em "Atualizar" para carregar estatísticas
                  </Text>
                )}
              </Card.Section>
            </Card>

            {/* AÇÕES DE LIMPEZA */}
            <Card withBorder>
              <Card.Section withBorder inheritPadding py="md">
                <Text fw={700}>Operações de Limpeza</Text>
              </Card.Section>
              <Card.Section inheritPadding py="md">
                <Stack gap="md">
                  {/* Executar Todas */}
                  <div
                    style={{
                      borderBottom: '1px solid var(--mantine-color-gray-3)',
                      paddingBottom: '16px',
                    }}
                  >
                    <Group justify="space-between" align="flex-start" mb="md">
                      <div>
                        <Text fw={500}>Executar Todas as Limpezas</Text>
                        <Text size="sm" c="dimmed">
                          Remove logs expirados e hashes obsoletos em uma única
                          operação
                        </Text>
                      </div>
                      <Button
                        color="red"
                        onClick={handleRunAllCleanup}
                        loading={cleaning}
                      >
                        Executar Tudo
                      </Button>
                    </Group>
                  </div>

                  {/* Limpar Logs */}
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text fw={500}>Limpar Logs de Sincronização</Text>
                      <Text size="sm" c="dimmed">
                        Remove registros de log com mais de {logsRetention} dias
                      </Text>
                    </div>
                    <Button
                      variant="light"
                      color="orange"
                      onClick={handleCleanupLogs}
                      loading={cleaning}
                      disabled={
                        !cleanupStats || cleanupStats.expired_logs_count === 0
                      }
                    >
                      Limpar Logs
                    </Button>
                  </Group>

                  {/* Limpar Hashes */}
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text fw={500}>Limpar Hashes Obsoletos</Text>
                      <Text size="sm" c="dimmed">
                        Remove registros de hash não sincronizados há 180+ dias
                      </Text>
                    </div>
                    <Button
                      variant="light"
                      color="yellow"
                      onClick={handleCleanupHashes}
                      loading={cleaning}
                      disabled={
                        !cleanupStats || cleanupStats.stale_hashes_count === 0
                      }
                    >
                      Limpar Hashes
                    </Button>
                  </Group>
                </Stack>
              </Card.Section>
            </Card>

            {/* CONFIGURAÇÃO DE PERÍODOS */}
            <Card withBorder>
              <Card.Section withBorder inheritPadding py="md">
                <Text fw={700}>Políticas de Retenção</Text>
              </Card.Section>
              <Card.Section inheritPadding py="md">
                <Stack gap="md">
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="blue"
                    title="Automático"
                  >
                    A limpeza ocorre automaticamente toda semana às
                    quartas-feiras, 03:00 UTC.
                  </Alert>

                  <div>
                    <Text fw={500} mb="xs">
                      Retenção de Logs de Sincronização
                    </Text>
                    <Text size="sm" c="dimmed" mb="sm">
                      Logs com mais de {logsRetention} dias serão apagados
                      automaticamente
                    </Text>
                    <NumberInput
                      label="Dias"
                      value={logsRetention}
                      onChange={(val) =>
                        setLogsRetention(typeof val === 'number' ? val : 90)
                      }
                      min={30}
                      max={365}
                      step={1}
                      description="Padrão: 90 dias"
                      disabled
                    />
                    <Text size="xs" c="dimmed" mt="xs">
                      💡 Para alterar este período, modifique a migration SQL
                    </Text>
                  </div>

                  <div>
                    <Text fw={500} mb="xs">
                      Retenção de Hashes
                    </Text>
                    <Text size="sm" c="dimmed" mb="sm">
                      Hashes não sincronizados por mais de 180 dias serão
                      removidos
                    </Text>
                    <Text size="sm" ff="monospace" c="gray">
                      180 dias (6 meses)
                    </Text>
                  </div>
                </Stack>
              </Card.Section>
            </Card>
          </Stack>
        </Tabs.Panel>

        {/* ABA 5: CONFIGURAÇÕES */}
        <Tabs.Panel value="configuracoes" pt="lg">
          <Stack gap="lg">
            <Card withBorder>
              <Card.Section withBorder inheritPadding py="md">
                <Text fw={700}>Intervalo de Sincronização Automática</Text>
              </Card.Section>
              <Card.Section inheritPadding py="md">
                <Stack gap="md">
                  <Text size="sm" c="dimmed">
                    Configure com que frequência a sincronização automática deve
                    ocorrer
                  </Text>

                  <NumberInput
                    label="Horas entre sincronizações"
                    value={syncInterval}
                    onChange={(val) =>
                      setSyncInterval(typeof val === 'number' ? val : 168)
                    }
                    min={1}
                    max={8760}
                    step={24}
                    description="Padrão: 168 horas (1 semana)"
                  />

                  <Text size="xs" c="dimmed">
                    Presets comuns:
                    <br />
                    • 24 horas = Diariamente
                    <br />
                    • 168 horas = Semanalmente
                    <br />• 720 horas = Mensalmente
                  </Text>

                  <Group justify="flex-end">
                    <Button
                      variant="default"
                      onClick={() => setSyncInterval(168)}
                    >
                      Redefinir
                    </Button>
                    <Button onClick={handleSaveSettings} loading={loading}>
                      Salvar Configurações
                    </Button>
                  </Group>
                </Stack>
              </Card.Section>
            </Card>

            <Card withBorder>
              <Card.Section withBorder inheritPadding py="md">
                <Text fw={700}>Deploy da Edge Function</Text>
              </Card.Section>
              <Card.Section inheritPadding py="md">
                <Stack gap="md">
                  <Text size="sm">
                    Para ativar a sincronização automática semanal, deploy a
                    edge function com cron trigger:
                  </Text>

                  <pre style={{ background: '#f5f5f5', padding: '12px' }}>
                    {`# 1. Deploy da edge function
supabase functions deploy culture-sync-cron --project-id <project-id>

# 2. Registrar cron trigger (via painel Supabase)
# Painel > Edge Functions > culture-sync-cron
# Cron: 0 2 * * 0 (domingo, 02:00 UTC)`}
                  </pre>

                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    title="Verificação de Deploy"
                  >
                    Após deploy, verifique no painel de Status se os logs
                    começam a aparecer automaticamente a cada semana.
                  </Alert>
                </Stack>
              </Card.Section>
            </Card>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* MODAL: CONFIGURAÇÕES */}
      <Modal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Configurar Sincronização"
      >
        <Stack gap="md">
          <NumberInput
            label="Intervalo de sincronização (horas)"
            value={syncInterval}
            onChange={(val) =>
              setSyncInterval(typeof val === 'number' ? val : 168)
            }
            min={1}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setSettingsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings} loading={loading}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL: IMPORTAÇÃO COMPLETA DO RNC */}
      <Modal
        opened={fullImportModalOpen}
        onClose={() => {
          if (!fullImporting) setFullImportModalOpen(false);
        }}
        title="Importação Completa do RNC"
        size="md"
        centered
        closeButtonProps={{ disabled: fullImporting }}
      >
        <Stack gap="md">
          {fullImporting ? (
            <>
              <div style={{ textAlign: 'center' }}>
                <Loader size="lg" />
              </div>
              <div>
                <Text size="sm" fw={500} mb="xs">
                  {fullImportMessage}
                </Text>
                <div
                  style={{ backgroundColor: '#f0f0f0', borderRadius: '4px' }}
                >
                  <div
                    style={{
                      height: '20px',
                      backgroundColor: '#4CAF50',
                      borderRadius: '4px',
                      width: `${fullImportProgress}%`,
                      transition: 'width 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    {fullImportProgress > 10 ? `${fullImportProgress}%` : ''}
                  </div>
                </div>
              </div>
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="blue"
                title="Em Progresso"
              >
                Não feche esta janela. A importação pode levar alguns minutos...
              </Alert>
            </>
          ) : (
            <>
              <Alert
                icon={<IconDownload size={16} />}
                color="green"
                title="Importação Concluída"
              >
                {fullImportMessage}
              </Alert>
              <Group justify="flex-end">
                <Button onClick={() => setFullImportModalOpen(false)}>
                  Fechar
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Container>
  );
}
