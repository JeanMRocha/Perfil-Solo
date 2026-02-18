import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  listLaboratories,
  type LaboratoryRecord,
  type LaboratoryService,
  upsertLaboratory,
} from '../../services/laboratoriesService';

interface ServicosManagerProps {
  startInCreateMode?: boolean;
}

interface ServiceDraft {
  id?: string;
  nome: string;
  preco: number | '';
  descricao: string;
  lab_id: string;
}

interface FlatServiceRow {
  lab_id: string;
  lab_label: string;
  service: LaboratoryService;
}

function createServiceId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `srv-${crypto.randomUUID()}`;
  }
  return `srv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toEmptyDraft(labId = ''): ServiceDraft {
  return {
    nome: '',
    preco: '',
    descricao: '',
    lab_id: labId,
  };
}

function toLabLabel(lab: LaboratoryRecord): string {
  return lab.nome;
}

async function persistLabServices(
  lab: LaboratoryRecord,
  services: LaboratoryService[],
) {
  await upsertLaboratory({
    id: lab.id,
    nome: lab.nome,
    cnpj: lab.cnpj,
    email: lab.email,
    telefone: lab.telefone,
    endereco: lab.endereco,
    servicos: services,
  });
}

export default function ServicosManager({
  startInCreateMode = false,
}: ServicosManagerProps) {
  const [labs, setLabs] = useState<LaboratoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [labFilter, setLabFilter] = useState<string>('all');
  const [modalOpened, setModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ServiceDraft>(toEmptyDraft());
  const [sourceLabId, setSourceLabId] = useState<string | null>(null);
  const [createOpenedOnce, setCreateOpenedOnce] = useState(false);

  const reloadLabs = async () => {
    setLabs(await listLaboratories());
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const rows = await listLaboratories();
        if (!alive) return;
        setLabs(rows);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!startInCreateMode || createOpenedOnce) return;
    if (labs.length === 0) return;
    setCreateOpenedOnce(true);
    setSourceLabId(null);
    setDraft(toEmptyDraft(labs[0]?.id ?? ''));
    setModalOpened(true);
  }, [startInCreateMode, createOpenedOnce, labs]);

  const labOptions = useMemo(
    () =>
      labs.map((lab) => ({
        value: lab.id,
        label: toLabLabel(lab),
      })),
    [labs],
  );

  const allRows = useMemo<FlatServiceRow[]>(() => {
    const rows: FlatServiceRow[] = [];
    labs.forEach((lab) => {
      (lab.servicos ?? []).forEach((service) => {
        rows.push({
          lab_id: lab.id,
          lab_label: toLabLabel(lab),
          service,
        });
      });
    });
    return rows;
  }, [labs]);

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return allRows.filter((row) => {
      if (labFilter !== 'all' && row.lab_id !== labFilter) return false;
      if (!query) return true;
      const serviceName = row.service.nome?.toLowerCase() ?? '';
      const description = row.service.descricao?.toLowerCase() ?? '';
      return (
        serviceName.includes(query) ||
        description.includes(query) ||
        row.lab_label.toLowerCase().includes(query)
      );
    });
  }, [allRows, labFilter, searchValue]);

  const openCreate = () => {
    if (labs.length === 0) {
      notifications.show({
        title: 'Sem laboratorios',
        message: 'Cadastre um laboratorio antes de adicionar servicos.',
        color: 'yellow',
      });
      return;
    }
    setSourceLabId(null);
    setDraft(toEmptyDraft(labs[0]?.id ?? ''));
    setModalOpened(true);
  };

  const openEdit = (row: FlatServiceRow) => {
    setSourceLabId(row.lab_id);
    setDraft({
      id: row.service.id,
      nome: row.service.nome ?? '',
      preco:
        row.service.preco == null || !Number.isFinite(row.service.preco)
          ? ''
          : row.service.preco,
      descricao: row.service.descricao ?? '',
      lab_id: row.lab_id,
    });
    setModalOpened(true);
  };

  const handleDelete = async (row: FlatServiceRow) => {
    const confirmed = window.confirm('Excluir este servico do laboratorio?');
    if (!confirmed) return;

    const lab = labs.find((item) => item.id === row.lab_id);
    if (!lab) return;

    const nextServices = (lab.servicos ?? []).filter(
      (item) => item.id !== row.service.id,
    );
    await persistLabServices(lab, nextServices);
    await reloadLabs();
    notifications.show({
      title: 'Servico removido',
      message: 'Cadastro excluido com sucesso.',
      color: 'green',
    });
  };

  const handleSave = async () => {
    const selectedLab = labs.find((item) => item.id === draft.lab_id);
    if (!selectedLab) {
      notifications.show({
        title: 'Laboratorio obrigatorio',
        message: 'Selecione o laboratorio para vincular o servico.',
        color: 'yellow',
      });
      return;
    }

    const serviceName = draft.nome.trim();
    const servicePrice = Number(draft.preco);
    if (serviceName.length < 2) {
      notifications.show({
        title: 'Nome invalido',
        message: 'Informe pelo menos 2 caracteres no nome do servico.',
        color: 'yellow',
      });
      return;
    }
    if (!Number.isFinite(servicePrice) || servicePrice < 0) {
      notifications.show({
        title: 'Preco invalido',
        message: 'Informe um preco valido para o servico.',
        color: 'yellow',
      });
      return;
    }

    try {
      setSaving(true);
      const normalizedService: LaboratoryService = {
        id: draft.id ?? createServiceId(),
        nome: serviceName,
        preco: servicePrice,
        descricao: draft.descricao.trim() || undefined,
      };

      const sourceLab = sourceLabId
        ? labs.find((item) => item.id === sourceLabId) ?? null
        : null;

      if (sourceLab && draft.id) {
        const sourceWithout = (sourceLab.servicos ?? []).filter(
          (item) => item.id !== draft.id,
        );
        if (sourceLab.id !== selectedLab.id) {
          await persistLabServices(sourceLab, sourceWithout);
        }
      }

      const targetBase =
        sourceLab && sourceLab.id === selectedLab.id
          ? (selectedLab.servicos ?? []).filter((item) => item.id !== draft.id)
          : [...(selectedLab.servicos ?? [])];
      const targetServices = [...targetBase, normalizedService];
      await persistLabServices(selectedLab, targetServices);

      await reloadLabs();
      setModalOpened(false);
      notifications.show({
        title: 'Servico salvo',
        message: 'Cadastro atualizado com sucesso.',
        color: 'green',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack>
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        centered
        title={draft.id ? 'Editar servico' : 'Novo servico'}
      >
        <Stack gap="sm">
          <Select
            label="Laboratorio vinculado"
            data={labOptions}
            value={draft.lab_id || null}
            onChange={(value) => setDraft((prev) => ({ ...prev, lab_id: value ?? '' }))}
            searchable
            nothingFoundMessage="Nenhum laboratorio cadastrado"
          />
          <TextInput
            label="Nome do servico"
            value={draft.nome}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, nome: event.currentTarget.value }))
            }
          />
          <NumberInput
            label="Preco"
            value={draft.preco}
            min={0}
            decimalScale={2}
            onChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                preco:
                  Number.isFinite(Number(value)) && value !== '' ? Number(value) : '',
              }))
            }
          />
          <TextInput
            label="Descricao"
            value={draft.descricao}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, descricao: event.currentTarget.value }))
            }
          />
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setModalOpened(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={handleSave}>
              Salvar servico
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Card withBorder>
        <Stack>
          <Group justify="space-between">
            <Text fw={700}>Busca de Servicos</Text>
            <Button onClick={openCreate}>Novo servico</Button>
          </Group>
          <Group grow>
            <TextInput
              label="Buscar"
              placeholder="Servico, descricao ou laboratorio"
              value={searchValue}
              onChange={(event) => setSearchValue(event.currentTarget.value)}
            />
            <Select
              label="Laboratorio"
              data={[{ value: 'all', label: 'Todos' }, ...labOptions]}
              value={labFilter}
              onChange={(value) => setLabFilter(value ?? 'all')}
            />
          </Group>
        </Stack>
      </Card>

      <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <Badge color="indigo">{filteredRows.length} encontrados</Badge>
            <Badge color="teal">{allRows.length} no total</Badge>
          </Group>
        </Group>
        {loading ? (
          <Text c="dimmed" size="sm">
            Carregando laboratorios...
          </Text>
        ) : filteredRows.length === 0 ? (
          <Text c="dimmed" size="sm">
            Nenhum servico encontrado.
          </Text>
        ) : (
          <Table highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Servico</Table.Th>
                <Table.Th>Laboratorio</Table.Th>
                <Table.Th>Preco</Table.Th>
                <Table.Th>Descricao</Table.Th>
                <Table.Th>Acoes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredRows.map((row) => (
                <Table.Tr key={`${row.lab_id}-${row.service.id}`}>
                  <Table.Td>{row.service.nome}</Table.Td>
                  <Table.Td>{row.lab_label}</Table.Td>
                  <Table.Td>
                    {row.service.preco.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </Table.Td>
                  <Table.Td>{row.service.descricao ?? '-'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" variant="light" onClick={() => openEdit(row)}>
                        Editar
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        variant="light"
                        onClick={() => void handleDelete(row)}
                      >
                        Excluir
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
