import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Modal,
  MultiSelect,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@nanostores/react';
import PageHeader from '../../components/PageHeader';
import ContactInfoModal from '../../components/modals/ContactInfoModal';
import { $currUser } from '../../global-state/user';
import {
  PERSON_TYPE_META_LIST,
  getPersonTypeColor,
  getPersonTypeLabel,
  normalizePersonTypes,
  type PersonTypeIdentifier,
} from '../../modules/people';
import { isLocalDataMode } from '../../services/dataProvider';
import {
  createPerson,
  deletePerson,
  listPeopleByUser,
  removePersonType,
  type PersonRecord,
  updatePerson,
} from '../../services/peopleService';
import type { ContactInfo } from '../../types/contact';

interface PessoasProps {
  startInCreateMode?: boolean;
  fixedType?: PersonTypeIdentifier | null;
}

type FilterType = 'all' | PersonTypeIdentifier;

function titleFromType(type: PersonTypeIdentifier | null): string {
  if (!type) return 'Pessoas';
  if (type === 'customer') return 'Clientes';
  return getPersonTypeLabel(type);
}

function descriptionFromType(type: PersonTypeIdentifier | null): string {
  if (!type) {
    return 'Modulo central de pessoas para reutilizar em clientes, fornecedores e perfis.';
  }
  if (type === 'customer') {
    return 'Cadastro de clientes reutilizavel em relatorios e propriedades.';
  }
  return `Cadastro de ${getPersonTypeLabel(type).toLowerCase()} reutilizavel em outros modulos.`;
}

function fixedTypesOrDraft(
  fixedType: PersonTypeIdentifier | null,
  draftTypes: string[],
): PersonTypeIdentifier[] {
  if (fixedType) return [fixedType];
  return normalizePersonTypes(draftTypes, ['customer']);
}

export default function PessoasHub({
  startInCreateMode = false,
  fixedType = null,
}: PessoasProps) {
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);
  const fixed = fixedType ?? null;
  const title = titleFromType(fixed);
  const description = descriptionFromType(fixed);

  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDocument, setDraftDocument] = useState('');
  const [draftTypes, setDraftTypes] = useState<string[]>(fixed ? [fixed] : ['customer']);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [contactModalOpened, setContactModalOpened] = useState(false);
  const [contactPersonId, setContactPersonId] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>(fixed ?? 'all');

  const editingPerson = useMemo(
    () => people.find((person) => person.id === editingPersonId) ?? null,
    [people, editingPersonId],
  );
  const contactPerson = useMemo(
    () => people.find((person) => person.id === contactPersonId) ?? null,
    [people, contactPersonId],
  );

  const filteredPeople = useMemo(() => {
    if (fixed) return people.filter((person) => person.types.includes(fixed));
    if (filterType === 'all') return people;
    return people.filter((person) => person.types.includes(filterType));
  }, [people, filterType, fixed]);

  useEffect(() => {
    if (fixed) {
      setFilterType(fixed);
    }
  }, [fixed]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!currentUserId) return;
      setLoading(true);
      try {
        const rows = await listPeopleByUser(currentUserId);
        if (!alive) return;
        setPeople(rows);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!startInCreateMode) return;
    setEditingPersonId(null);
    setDraftName('');
    setDraftDocument('');
    setDraftTypes(fixed ? [fixed] : ['customer']);
    setModalOpened(true);
  }, [startInCreateMode, fixed]);

  const openCreateModal = () => {
    setEditingPersonId(null);
    setDraftName('');
    setDraftDocument('');
    setDraftTypes(fixed ? [fixed] : ['customer']);
    setModalOpened(true);
  };

  const openEditModal = (person: PersonRecord) => {
    setEditingPersonId(person.id);
    setDraftName(person.name);
    setDraftDocument(person.document ?? '');
    setDraftTypes(fixed ? [fixed] : person.types);
    setModalOpened(true);
  };

  const openContactModal = (person: PersonRecord) => {
    setContactPersonId(person.id);
    setContactModalOpened(true);
  };

  const handleSavePerson = async () => {
    if (!currentUserId) return;
    const name = draftName.trim();
    if (name.length < 3) {
      notifications.show({
        title: 'Nome inválido',
        message: 'Use pelo menos 3 caracteres para o nome da pessoa.',
        color: 'yellow',
      });
      return;
    }

    const types = fixedTypesOrDraft(fixed, draftTypes);
    if (!types.length) {
      notifications.show({
        title: 'Tipo obrigatorio',
        message: 'Selecione ao menos um identificador para a pessoa.',
        color: 'yellow',
      });
      return;
    }

    try {
      setSaving(true);
      if (!editingPersonId) {
        const created = await createPerson({
          userId: currentUserId,
          name,
          document: draftDocument.trim(),
          types,
        });
        setPeople((prev) => [created, ...prev]);
        notifications.show({
          title: 'Pessoa criada',
          message: `${created.name} adicionada com sucesso.`,
          color: 'green',
        });
      } else {
        const updated = await updatePerson(editingPersonId, {
          name,
          document: draftDocument.trim(),
          types,
        });
        setPeople((prev) =>
          prev.map((person) => (person.id === updated.id ? updated : person)),
        );
        notifications.show({
          title: 'Pessoa atualizada',
          message: `${updated.name} atualizada com sucesso.`,
          color: 'green',
        });
      }
      setModalOpened(false);
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar pessoa',
        message: err?.message ?? 'Não foi possível salvar pessoa.',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePerson = async (person: PersonRecord) => {
    try {
      if (fixed) {
        await removePersonType(person.id, fixed, { deleteIfNoTypes: true });
      } else {
        await deletePerson(person.id);
      }
      setPeople((prev) => prev.filter((row) => row.id !== person.id));
      notifications.show({
        title: 'Pessoa removida',
        message: 'Pessoa excluida com sucesso.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao excluir pessoa',
        message: err?.message ?? 'Não foi possível excluir pessoa.',
        color: 'red',
      });
    }
  };

  const handleSaveContact = async (contact: ContactInfo) => {
    if (!contactPersonId) return;
    try {
      setSavingContact(true);
      const updated = await updatePerson(contactPersonId, { contact });
      setPeople((prev) =>
        prev.map((person) => (person.id === updated.id ? updated : person)),
      );
      setContactModalOpened(false);
      notifications.show({
        title: 'Contato atualizado',
        message: `Contato de ${updated.name} salvo com sucesso.`,
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar contato',
        message: err?.message ?? 'Não foi possível salvar contato.',
        color: 'red',
      });
    } finally {
      setSavingContact(false);
    }
  };

  const segmentedData = [
    { value: 'all', label: 'Todos' },
    ...PERSON_TYPE_META_LIST.map((row) => ({
      value: row.id,
      label: row.label,
    })),
  ];

  return (
    <Container size="lg" mt="xl">
      <PageHeader title={title} />

      <ContactInfoModal
        opened={contactModalOpened}
        onClose={() => setContactModalOpened(false)}
        onSave={handleSaveContact}
        value={contactPerson?.contact ?? {}}
        saving={savingContact}
        title="Contato da pessoa"
        subtitle="Dados para compartilhamento e reaproveitamento em outros modulos."
      />

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingPerson ? 'Editar pessoa' : 'Nova pessoa'}
        centered
      >
        <Stack>
          <TextInput
            label="Nome"
            value={draftName}
            onChange={(event) => setDraftName(event.currentTarget.value)}
            placeholder="Ex.: Fazenda Boa Esperanca"
          />
          <TextInput
            label="Documento (CPF/CNPJ)"
            value={draftDocument}
            onChange={(event) => setDraftDocument(event.currentTarget.value)}
            placeholder="Opcional"
          />
          <MultiSelect
            label="Identificadores"
            data={PERSON_TYPE_META_LIST.map((row) => ({
              value: row.id,
              label: row.label,
            }))}
            value={fixed ? [fixed] : draftTypes}
            onChange={(value) => setDraftTypes(value)}
            disabled={Boolean(fixed)}
            searchable
            clearable={!fixed}
            placeholder="Selecione os tipos da pessoa"
          />
          {fixed ? (
            <Text size="xs" c="dimmed">
              Este cadastro esta fixo como {getPersonTypeLabel(fixed).toLowerCase()}.
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setModalOpened(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePerson} loading={saving}>
              Salvar pessoa
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Group justify="space-between" mb="sm" mt="sm" wrap="wrap">
        <Text c="dimmed">{description}</Text>
        <Button onClick={openCreateModal}>Nova pessoa</Button>
      </Group>

      {!fixed ? (
        <Group mb="md">
          <SegmentedControl
            value={filterType}
            onChange={(value) => setFilterType(value as FilterType)}
            data={segmentedData}
            size="xs"
          />
        </Group>
      ) : null}

      {loading ? (
        <Text c="dimmed">Carregando pessoas...</Text>
      ) : filteredPeople.length === 0 ? (
        <Text c="dimmed">Nenhuma pessoa cadastrada ainda.</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {filteredPeople.map((person) => (
            <Card key={person.id} withBorder radius="md" p="md">
              <Stack gap={6}>
                <Group justify="space-between">
                  <Text fw={700}>{person.name}</Text>
                  <Group gap={4}>
                    {person.types.map((type) => (
                      <Badge key={`${person.id}-${type}`} color={getPersonTypeColor(type)}>
                        {getPersonTypeLabel(type)}
                      </Badge>
                    ))}
                  </Group>
                </Group>
                <Text size="sm" c="dimmed">
                  Documento: {person.document || '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  Email: {person.contact.email || '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  Telefone: {person.contact.phone || '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  Site: {person.contact.website || '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  Endereco: {person.contact.address || '-'}
                </Text>
                <Group mt="xs">
                  <Button size="xs" variant="light" onClick={() => openEditModal(person)}>
                    Editar
                  </Button>
                  <Button size="xs" variant="light" onClick={() => openContactModal(person)}>
                    Contato
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={() => void handleDeletePerson(person)}
                  >
                    Excluir
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
}
