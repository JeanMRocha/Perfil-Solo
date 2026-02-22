import { useEffect, useMemo, useState } from 'react';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import {
  mapCanonicalPointsToContactInfo,
  mapContactInfoToCanonicalPoints,
} from '../../modules/contact';
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

type ContactDraft = {
  email: string;
  phone: string;
  website: string;
  address: string;
  socialNetwork: string;
  socialUrl: string;
};

function normalizeContact(contact: ContactInfo): ContactInfo {
  const canonicalPoints = mapContactInfoToCanonicalPoints(contact);
  const normalizedByModule = mapCanonicalPointsToContactInfo(
    canonicalPoints,
    contact,
  );
  return {
    ...normalizedByModule,
    email: normalizedByModule.email?.trim() ?? '',
    phone: normalizedByModule.phone?.trim() ?? '',
    website: normalizedByModule.website?.trim() ?? '',
    address: contact.address?.trim() ?? '',
    social_links: normalizedByModule.social_links,
  };
}

function toDraft(value: ContactInfo | null | undefined): ContactDraft {
  const contact = normalizeContact(value ?? {});
  const social = contact.social_links?.[0];
  return {
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    website: contact.website ?? '',
    address: contact.address ?? '',
    socialNetwork: social?.network ?? 'Instagram',
    socialUrl: social?.url ?? '',
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
  const [draft, setDraft] = useState<ContactDraft>({
    email: '',
    phone: '',
    website: '',
    address: '',
    socialNetwork: 'Instagram',
    socialUrl: '',
  });

  useEffect(() => {
    if (!opened) return;
    setDraft(toDraft(value));
  }, [opened, value]);

  const emailError = useMemo(() => {
    const email = draft.email?.trim();
    if (!email) return null;
    return /^\S+@\S+\.\S+$/.test(email) ? null : 'Email inválido.';
  }, [draft.email]);

  const saveDisabled = Boolean(emailError) || saving;

  const handleSave = async () => {
    if (saveDisabled) return;
    const contact: ContactInfo = {
      email: draft.email,
      phone: draft.phone,
      website: draft.website,
      address: draft.address,
      social_links: draft.socialUrl.trim()
        ? [{ network: draft.socialNetwork.trim(), url: draft.socialUrl.trim() }]
        : [],
    };
    await onSave(normalizeContact(contact));
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
          value={draft.phone}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, phone: event.currentTarget.value }))
          }
        />

        <TextInput
          label="Website"
          placeholder="https://empresa.com.br"
          value={draft.website}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, website: event.currentTarget.value }))
          }
        />

        <TextInput
          label="Rede social"
          placeholder="Instagram, LinkedIn, Facebook..."
          value={draft.socialNetwork}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              socialNetwork: event.currentTarget.value,
            }))
          }
        />

        <TextInput
          label="URL/usuário da rede"
          placeholder="https://instagram.com/empresa ou @empresa"
          value={draft.socialUrl}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, socialUrl: event.currentTarget.value }))
          }
        />

        <TextInput
          label="Endereço"
          placeholder="Rua, número, bairro, cidade"
          value={draft.address}
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
