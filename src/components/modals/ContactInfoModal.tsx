import { useEffect, useMemo, useState } from 'react';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import type { ContactInfo } from '../../types/contact';

type ContactInfoModalProps = {
  opened: boolean;
  onClose: () => void;
  onSave: (contact: ContactInfo) => Promise<void> | void;
  title?: string;
  subtitle?: string;
  value?: ContactInfo | null;
  saving?: boolean;
};

function normalizeContact(contact: ContactInfo): ContactInfo {
  return {
    email: contact.email?.trim() ?? '',
    phone: contact.phone?.trim() ?? '',
    address: contact.address?.trim() ?? '',
  };
}

export default function ContactInfoModal({
  opened,
  onClose,
  onSave,
  title = 'Contato',
  subtitle = 'Informe dados para compartilhamento de resultados.',
  value,
  saving = false,
}: ContactInfoModalProps) {
  const [draft, setDraft] = useState<ContactInfo>({ email: '', phone: '', address: '' });

  useEffect(() => {
    if (!opened) return;
    setDraft(normalizeContact(value ?? {}));
  }, [opened, value]);

  const emailError = useMemo(() => {
    const email = draft.email?.trim();
    if (!email) return null;
    return /^\S+@\S+\.\S+$/.test(email) ? null : 'Email invalido.';
  }, [draft.email]);

  const saveDisabled = Boolean(emailError) || saving;

  const handleSave = async () => {
    if (saveDisabled) return;
    await onSave(normalizeContact(draft));
  };

  return (
    <Modal opened={opened} onClose={onClose} centered title={title}>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {subtitle}
        </Text>

        <TextInput
          label="Email"
          placeholder="contato@empresa.com"
          value={draft.email ?? ''}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, email: event.currentTarget.value }))
          }
          error={emailError}
        />

        <TextInput
          label="Telefone"
          placeholder="(00) 00000-0000"
          value={draft.phone ?? ''}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, phone: event.currentTarget.value }))
          }
        />

        <TextInput
          label="Endereco"
          placeholder="Rua, numero, bairro, cidade"
          value={draft.address ?? ''}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, address: event.currentTarget.value }))
          }
        />

        <Group justify="flex-end" mt="xs">
          <Button variant="light" color="gray" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={saveDisabled}>
            Salvar contato
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
