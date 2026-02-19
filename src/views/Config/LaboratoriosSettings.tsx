import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import {
  deleteLaboratory,
  listLaboratories,
  type LaboratoryRecord,
  type LaboratoryService,
  upsertLaboratory,
} from '../../services/laboratoriesService';
import { $currUser } from '../../global-state/user';
import { isLocalDataMode } from '../../services/dataProvider';

type ServiceDraft = {
  id: string;
  nome: string;
  preco: number | '';
  descricao: string;
};

type LabDraft = {
  id?: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  servicos: ServiceDraft[];
};

function createId(prefix = 'srv') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyServiceDraft(): ServiceDraft {
  return {
    id: createId('srv'),
    nome: '',
    preco: '',
    descricao: '',
  };
}

function createEmptyLabDraft(): LabDraft {
  return {
    nome: '',
    cnpj: '',
    email: '',
    telefone: '',
    endereco: '',
    servicos: [],
  };
}

function toDraft(lab: LaboratoryRecord): LabDraft {
  return {
    id: lab.id,
    nome: lab.nome,
    cnpj: lab.cnpj ?? '',
    email: lab.email ?? '',
    telefone: lab.telefone ?? '',
    endereco: lab.endereco ?? '',
    servicos: lab.servicos.map((row) => ({
      id: row.id,
      nome: row.nome,
      preco: Number.isFinite(row.preco) ? row.preco : '',
      descricao: row.descricao ?? '',
    })),
  };
}

function buildServices(rows: ServiceDraft[]): LaboratoryService[] {
  return rows
    .map((row) => ({
      id: row.id,
      nome: row.nome.trim(),
      preco: Number(row.preco),
      descricao: row.descricao.trim() || undefined,
    }))
    .filter(
      (row) =>
        row.nome.length > 0 && Number.isFinite(row.preco) && row.preco >= 0,
    );
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

interface LaboratoriosSettingsProps {
  startInCreateMode?: boolean;
}

export default function LaboratoriosSettings({
  startInCreateMode = false,
}: LaboratoriosSettingsProps) {
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);
  const [rows, setRows] = useState<LaboratoryRecord[]>(() => []);
  const [modalOpened, setModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<LabDraft>(createEmptyLabDraft);

  useEffect(() => {
    let alive = true;
    if (!currentUserId) {
      setRows([]);
      return () => {
        alive = false;
      };
    }
    void listLaboratories(currentUserId).then((data) => {
      if (!alive) return;
      setRows(data);
    });
    return () => {
      alive = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!startInCreateMode) return;
    setDraft(createEmptyLabDraft());
    setModalOpened(true);
  }, [startInCreateMode]);

  const openCreate = () => {
    setDraft(createEmptyLabDraft());
    setModalOpened(true);
  };

  const openEdit = (row: LaboratoryRecord) => {
    setDraft(toDraft(row));
    setModalOpened(true);
  };

  const addService = () => {
    setDraft((prev) => ({
      ...prev,
      servicos: [...prev.servicos, createEmptyServiceDraft()],
    }));
  };

  const updateService = (serviceId: string, patch: Partial<ServiceDraft>) => {
    setDraft((prev) => ({
      ...prev,
      servicos: prev.servicos.map((service) =>
        service.id === serviceId ? { ...service, ...patch } : service,
      ),
    }));
  };

  const removeService = (serviceId: string) => {
    setDraft((prev) => ({
      ...prev,
      servicos: prev.servicos.filter((service) => service.id !== serviceId),
    }));
  };

  const reloadRows = async () => {
    if (!currentUserId) {
      setRows([]);
      return;
    }
    setRows(await listLaboratories(currentUserId));
  };

  const handleSave = async () => {
    if (!currentUserId) {
      notifications.show({
        title: 'Usuario nao identificado',
        message: 'Nao foi possivel identificar o usuario para salvar laboratorio.',
        color: 'red',
      });
      return;
    }

    const nome = draft.nome.trim();
    if (nome.length < 3) {
      notifications.show({
        title: 'Nome invalido',
        message: 'Informe pelo menos 3 caracteres para o laboratorio.',
        color: 'yellow',
      });
      return;
    }

    try {
      setSaving(true);
      await upsertLaboratory({
        id: draft.id,
        userId: currentUserId ?? undefined,
        nome,
        cnpj: draft.cnpj,
        email: draft.email,
        telefone: draft.telefone,
        endereco: draft.endereco,
        servicos: buildServices(draft.servicos),
      });
      await reloadRows();
      setModalOpened(false);
      notifications.show({
        title: 'Laboratorio salvo',
        message: 'Cadastro do laboratorio atualizado com sucesso.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar',
        message: err?.message ?? 'Nao foi possivel salvar laboratorio.',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (labId: string) => {
    const confirmed = window.confirm(
      'Excluir laboratorio e toda a lista de servicos?',
    );
    if (!confirmed) return;
    await deleteLaboratory(labId);
    await reloadRows();
    notifications.show({
      title: 'Laboratorio removido',
      message: 'Cadastro excluido com sucesso.',
      color: 'green',
    });
  };

  return (
    <Stack>
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        centered
        size="xl"
        title={draft.id ? 'Editar laboratorio' : 'Novo laboratorio'}
      >
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <TextInput
              label="Nome do laboratorio"
              value={draft.nome}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, nome: event.currentTarget.value }))
              }
              data-autofocus
            />
            <TextInput
              label="CNPJ"
              value={draft.cnpj}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, cnpj: event.currentTarget.value }))
              }
            />
            <TextInput
              label="Email"
              value={draft.email}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, email: event.currentTarget.value }))
              }
            />
            <TextInput
              label="Telefone"
              value={draft.telefone}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, telefone: event.currentTarget.value }))
              }
            />
          </SimpleGrid>

          <TextInput
            label="Endereco"
            value={draft.endereco}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, endereco: event.currentTarget.value }))
            }
          />

          <Card withBorder p="sm">
            <Group justify="space-between" mb="xs">
              <div>
                <Text fw={600}>Servicos e precos</Text>
                <Text size="xs" c="dimmed">
                  Use esta lista para estimar custos ao montar pedidos de analise.
                </Text>
              </div>
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={addService}
              >
                Adicionar servico
              </Button>
            </Group>

            {draft.servicos.length === 0 ? (
              <Text size="sm" c="dimmed">
                Nenhum servico cadastrado.
              </Text>
            ) : (
              <Stack gap="xs">
                {draft.servicos.map((service) => (
                  <Card key={service.id} withBorder p="xs">
                    <Group align="flex-end" wrap="nowrap">
                      <TextInput
                        label="Servico"
                        value={service.nome}
                        onChange={(event) =>
                          updateService(service.id, {
                            nome: event.currentTarget.value,
                          })
                        }
                        style={{ flex: 2 }}
                      />
                      <NumberInput
                        label="Preco"
                        value={service.preco}
                        min={0}
                        decimalScale={2}
                        onChange={(value) =>
                          updateService(service.id, {
                            preco:
                              Number.isFinite(Number(value)) && value !== ''
                                ? Number(value)
                                : '',
                          })
                        }
                        style={{ width: 140 }}
                      />
                      <TextInput
                        label="Descricao"
                        value={service.descricao}
                        onChange={(event) =>
                          updateService(service.id, {
                            descricao: event.currentTarget.value,
                          })
                        }
                        style={{ flex: 2 }}
                      />
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => removeService(service.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Card>

          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              onClick={() => setModalOpened(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Salvar laboratorio
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Group justify="space-between">
        <div>
          <Text fw={700}>Laboratorios</Text>
          <Text size="sm" c="dimmed">
            Cadastro de laboratorios, contatos e servicos prestados.
          </Text>
        </div>
        <Button onClick={openCreate}>Novo laboratorio</Button>
      </Group>

      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nenhum laboratorio cadastrado ainda.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {rows.map((row) => {
            const minPrice = row.servicos.length
              ? Math.min(...row.servicos.map((service) => service.preco))
              : null;
            return (
              <Card key={row.id} withBorder p="md">
                <Stack gap={6}>
                  <Group justify="space-between">
                    <Text fw={700}>{row.nome}</Text>
                    <Group gap={6}>
                      <Badge color="indigo">{row.servicos.length} servicos</Badge>
                      {minPrice != null ? (
                        <Badge color="teal">a partir de {formatMoney(minPrice)}</Badge>
                      ) : null}
                    </Group>
                  </Group>
                  <Text size="sm" c="dimmed">
                    CNPJ: {row.cnpj || '-'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Email: {row.email || '-'} | Telefone: {row.telefone || '-'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Endereco: {row.endereco || '-'}
                  </Text>
                  <Group mt="xs">
                    <Button size="xs" variant="light" onClick={() => openEdit(row)}>
                      Editar
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="light"
                      onClick={() => handleDelete(row.id)}
                    >
                      Excluir
                    </Button>
                  </Group>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
}
