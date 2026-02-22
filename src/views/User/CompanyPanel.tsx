import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@nanostores/react';
import { $currUser } from '../../global-state/user';
import { canonicalAddressFromCepLookup } from '../../modules/address';
import { isLocalDataMode } from '../../services/dataProvider';
import {
  COMPANY_MEMBERSHIP_UPDATED_EVENT,
  ensureCompanyBootstrapFromLegacyProfile,
  getActiveCompanyIdByUser,
  listCompaniesByUser,
  saveCompanyForUser,
  setActiveCompanyByUser,
  type CompanyMembership,
} from '../../services/companyMembershipService';
import { lookupAddressByCep, normalizeCep } from '../../services/cepService';
import { getProfile } from '../../services/profileService';

interface CompanyDraft {
  id: string | null;
  razao_social: string;
  cnpj: string;
  ie: string;
  im: string;
  cnae: string;
  notes: string;
  email: string;
  phone: string;
  website: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

function emptyDraft(): CompanyDraft {
  return {
    id: null,
    razao_social: '',
    cnpj: '',
    ie: '',
    im: '',
    cnae: '',
    notes: '',
    email: '',
    phone: '',
    website: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
  };
}

function draftFromCompany(row: CompanyMembership | null): CompanyDraft {
  if (!row) return emptyDraft();
  return {
    id: row.id,
    razao_social: row.razao_social,
    cnpj: row.cnpj,
    ie: row.ie,
    im: row.im,
    cnae: row.cnae,
    notes: row.notes,
    email: String(row.contact?.email ?? ''),
    phone: String(row.contact?.phone ?? ''),
    website: String(row.contact?.website ?? ''),
    cep: String(row.address?.cep ?? ''),
    endereco: String(row.address?.street ?? ''),
    numero: String(row.address?.number ?? ''),
    complemento: String(row.address?.complement ?? ''),
    bairro: String(row.address?.neighborhood ?? ''),
    cidade: String(row.address?.city ?? ''),
    estado: String(row.address?.state ?? ''),
  };
}

export default function CompanyPanel() {
  const user = useStore($currUser);
  const userId = String(user?.id ?? (isLocalDataMode ? 'local-user' : '')).trim();

  const [rows, setRows] = useState<CompanyMembership[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const loadRows = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setSelectedId(null);
      setDraft(emptyDraft());
      return;
    }

    const profile = await getProfile();
    const hydrated = ensureCompanyBootstrapFromLegacyProfile(userId, profile);
    const sourceRows = hydrated.length > 0 ? hydrated : listCompaniesByUser(userId);
    const active = getActiveCompanyIdByUser(userId);
    const fallback = sourceRows[0]?.id ?? null;
    const nextSelected = active && sourceRows.some((row) => row.id === active) ? active : fallback;

    setRows(sourceRows);
    setSelectedId(nextSelected);
    setDraft(draftFromCompany(sourceRows.find((row) => row.id === nextSelected) ?? null));
  }, [userId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!userId) return;
    const onUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const changedUserId = String(custom.detail?.userId ?? '').trim();
      if (changedUserId && changedUserId !== userId) return;
      void loadRows();
    };
    const onStorage = () => {
      void loadRows();
    };

    window.addEventListener(COMPANY_MEMBERSHIP_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(COMPANY_MEMBERSHIP_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [loadRows, userId]);

  const selectOptions = rows.map((row) => ({
    value: row.id,
    label: row.razao_social || row.cnpj || row.id,
  }));

  const handleSelectCompany = (value: string | null) => {
    const next = String(value ?? '').trim();
    if (!next) return;
    setSelectedId(next);
    setActiveCompanyByUser(userId, next);
    const row = rows.find((item) => item.id === next) ?? null;
    setDraft(draftFromCompany(row));
  };

  const handleCreateCompany = () => {
    setSelectedId(null);
    setDraft(emptyDraft());
  };

  const handleSave = async () => {
    if (!userId) return;
    const razaoSocial = draft.razao_social.trim();
    if (!razaoSocial) {
      notifications.show({
        title: 'Razão social obrigatoria',
        message: 'Informe a razão social da empresa para salvar.',
        color: 'yellow',
      });
      return;
    }

    try {
      setSaving(true);
      const saved = saveCompanyForUser(userId, {
        id: draft.id ?? undefined,
        razao_social: razaoSocial,
        cnpj: draft.cnpj.trim(),
        ie: draft.ie.trim(),
        im: draft.im.trim(),
        cnae: draft.cnae.trim(),
        notes: draft.notes.trim(),
        address: {
          cep: draft.cep.trim(),
          street: draft.endereco.trim(),
          number: draft.numero.trim(),
          complement: draft.complemento.trim(),
          neighborhood: draft.bairro.trim(),
          city: draft.cidade.trim(),
          state: draft.estado.trim(),
        },
        contact: {
          email: draft.email.trim(),
          phone: draft.phone.trim(),
          website: draft.website.trim(),
        },
      });
      setSelectedId(saved.id);
      setActiveCompanyByUser(userId, saved.id);
      notifications.show({
        title: 'Empresa salva',
        message: 'Dados da empresa atualizados com sucesso.',
        color: 'teal',
      });
      await loadRows();
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao salvar empresa',
        message: String(error?.message ?? 'Não foi possível salvar a empresa.'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCepBlur = async () => {
    const cep = normalizeCep(draft.cep);
    if (cep.length !== 8) return;
    try {
      setLoadingCep(true);
      const lookup = await lookupAddressByCep(cep);
      if (!lookup) return;
      const parsed = canonicalAddressFromCepLookup(lookup);
      setDraft((prev) => ({
        ...prev,
        cep: parsed.cep ?? prev.cep,
        endereco: parsed.street ?? prev.endereco,
        bairro: parsed.neighborhood ?? prev.bairro,
        cidade: parsed.city ?? prev.cidade,
        estado: parsed.state ?? prev.estado,
        complemento: parsed.complement ?? prev.complemento,
      }));
    } finally {
      setLoadingCep(false);
    }
  };

  return (
    <Stack gap="xs">
      <Card withBorder radius="md" p="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="xs">
            <Text fw={700}>Empresas vinculadas</Text>
            <Badge variant="light" color="blue">
              {rows.length}
            </Badge>
          </Group>
          <Group gap="xs" wrap="wrap">
            <Select
              placeholder="Selecionar empresa"
              data={selectOptions}
              value={selectedId}
              onChange={handleSelectCompany}
              w={280}
            />
            <Button size="xs" variant="light" onClick={handleCreateCompany}>
              Nova empresa
            </Button>
          </Group>
        </Group>
      </Card>

      <Card withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Text fw={700}>Dados da empresa</Text>
          <Group grow>
            <TextInput
              label="Razão social"
              value={draft.razao_social}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, razao_social: event.currentTarget.value }))
              }
            />
            <TextInput
              label="CNPJ"
              value={draft.cnpj}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, cnpj: event.currentTarget.value }))
              }
            />
          </Group>
          <Group grow>
            <TextInput
              label="IE"
              value={draft.ie}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, ie: event.currentTarget.value }))
              }
            />
            <TextInput
              label="IM"
              value={draft.im}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, im: event.currentTarget.value }))
              }
            />
            <TextInput
              label="CNAE"
              value={draft.cnae}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, cnae: event.currentTarget.value }))
              }
            />
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Text fw={700}>Endereco da empresa</Text>
          <Group grow>
            <TextInput
              label="CEP"
              value={draft.cep}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, cep: event.currentTarget.value }))
              }
              onBlur={() => void handleCepBlur()}
              rightSection={loadingCep ? <Text size="xs">...</Text> : null}
            />
            <TextInput
              label="Endereço"
              value={draft.endereco}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, endereco: event.currentTarget.value }))
              }
            />
            <TextInput
              label="Número"
              value={draft.numero}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, numero: event.currentTarget.value }))
              }
            />
          </Group>
          <Group grow>
            <TextInput
              label="Complemento"
              value={draft.complemento}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, complemento: event.currentTarget.value }))
              }
            />
            <TextInput
              label="Bairro"
              value={draft.bairro}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, bairro: event.currentTarget.value }))
              }
            />
            <TextInput
              label="Cidade"
              value={draft.cidade}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, cidade: event.currentTarget.value }))
              }
            />
            <TextInput
              label="Estado"
              value={draft.estado}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, estado: event.currentTarget.value }))
              }
            />
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Text fw={700}>Contato da empresa</Text>
          <Group grow>
            <TextInput
              label="Email"
              value={draft.email}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, email: event.currentTarget.value }))
              }
            />
            <TextInput
              label="Telefone"
              value={draft.phone}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, phone: event.currentTarget.value }))
              }
            />
            <TextInput
              label="Website"
              value={draft.website}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, website: event.currentTarget.value }))
              }
            />
          </Group>
          <Textarea
            label="Observações"
            minRows={3}
            value={draft.notes}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, notes: event.currentTarget.value }))
            }
          />
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button onClick={() => void handleSave()} loading={saving}>
          Salvar empresa
        </Button>
      </Group>
    </Stack>
  );
}
