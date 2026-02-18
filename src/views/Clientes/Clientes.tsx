import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Modal,
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
import { isLocalDataMode } from '../../services/dataProvider';
import {
  createClient,
  deleteClient,
  listClientsByUser,
  type ClientRecord,
  updateClient,
} from '../../services/clientsService';
import type { ContactInfo } from '../../types/contact';

interface ClientesProps {
  startInCreateMode?: boolean;
}

export default function Clientes({ startInCreateMode = false }: ClientesProps) {
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [contactModalOpened, setContactModalOpened] = useState(false);
  const [contactClientId, setContactClientId] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);

  const editingClient = useMemo(
    () => clients.find((client) => client.id === editingClientId) ?? null,
    [clients, editingClientId],
  );
  const contactClient = useMemo(
    () => clients.find((client) => client.id === contactClientId) ?? null,
    [clients, contactClientId],
  );

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!currentUserId) return;
      setLoading(true);
      try {
        const rows = await listClientsByUser(currentUserId);
        if (!alive) return;
        setClients(rows);
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
    setEditingClientId(null);
    setDraftName('');
    setModalOpened(true);
  }, [startInCreateMode]);

  const openCreateModal = () => {
    setEditingClientId(null);
    setDraftName('');
    setModalOpened(true);
  };

  const openEditModal = (client: ClientRecord) => {
    setEditingClientId(client.id);
    setDraftName(client.nome);
    setModalOpened(true);
  };

  const openContactModal = (client: ClientRecord) => {
    setContactClientId(client.id);
    setContactModalOpened(true);
  };

  const handleSaveClient = async () => {
    if (!currentUserId) return;
    const nome = draftName.trim();
    if (nome.length < 3) {
      notifications.show({
        title: 'Nome invalido',
        message: 'Use pelo menos 3 caracteres para o nome do cliente.',
        color: 'yellow',
      });
      return;
    }

    try {
      setSaving(true);
      if (!editingClientId) {
        const created = await createClient({ userId: currentUserId, nome });
        setClients((prev) => [created, ...prev]);
        notifications.show({
          title: 'Cliente criado',
          message: `${created.nome} adicionado com sucesso.`,
          color: 'green',
        });
      } else {
        const updated = await updateClient(editingClientId, { nome });
        setClients((prev) =>
          prev.map((client) => (client.id === updated.id ? updated : client)),
        );
        notifications.show({
          title: 'Cliente atualizado',
          message: `${updated.nome} atualizado com sucesso.`,
          color: 'green',
        });
      }
      setModalOpened(false);
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar cliente',
        message: err?.message ?? 'Nao foi possivel salvar cliente.',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await deleteClient(clientId);
      setClients((prev) => prev.filter((client) => client.id !== clientId));
      notifications.show({
        title: 'Cliente removido',
        message: 'Cliente excluido com sucesso.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao excluir cliente',
        message: err?.message ?? 'Nao foi possivel excluir cliente.',
        color: 'red',
      });
    }
  };

  const handleSaveContact = async (contact: ContactInfo) => {
    if (!contactClientId) return;
    try {
      setSavingContact(true);
      const updated = await updateClient(contactClientId, { contact });
      setClients((prev) =>
        prev.map((client) => (client.id === updated.id ? updated : client)),
      );
      setContactModalOpened(false);
      notifications.show({
        title: 'Contato atualizado',
        message: `Contato de ${updated.nome} salvo com sucesso.`,
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar contato',
        message: err?.message ?? 'Nao foi possivel salvar contato.',
        color: 'red',
      });
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <Container size="md" mt="xl">
      <PageHeader title="Clientes" />

      <ContactInfoModal
        opened={contactModalOpened}
        onClose={() => setContactModalOpened(false)}
        onSave={handleSaveContact}
        value={contactClient?.contact ?? {}}
        saving={savingContact}
        title="Contato do cliente"
        subtitle="Dados para compartilhar laudos e resultados."
      />

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingClient ? 'Editar cliente' : 'Novo cliente'}
        centered
      >
        <Stack>
          <TextInput
            label="Nome do cliente"
            value={draftName}
            onChange={(event) => setDraftName(event.currentTarget.value)}
            placeholder="Ex.: Fazenda Boa Esperanca"
          />
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setModalOpened(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveClient} loading={saving}>
              Salvar cliente
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Group justify="space-between" mb="md">
        <Text c="dimmed">
          Cadastro de clientes com contato reaproveitavel nos relatorios.
        </Text>
        <Button onClick={openCreateModal}>Novo cliente</Button>
      </Group>

      {loading ? (
        <Text c="dimmed">Carregando clientes...</Text>
      ) : clients.length === 0 ? (
        <Text c="dimmed">Nenhum cliente cadastrado ainda.</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {clients.map((client) => (
            <Card key={client.id} withBorder radius="md" p="md">
              <Stack gap={6}>
                <Group justify="space-between">
                  <Text fw={700}>{client.nome}</Text>
                  <Badge color="indigo">Cliente</Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  Email: {client.contact.email || '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  Telefone: {client.contact.phone || '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  Endereco: {client.contact.address || '-'}
                </Text>
                <Group mt="xs">
                  <Button size="xs" variant="light" onClick={() => openEditModal(client)}>
                    Editar nome
                  </Button>
                  <Button size="xs" variant="light" onClick={() => openContactModal(client)}>
                    Contato
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={() => handleDeleteClient(client.id)}
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
