import { useEffect, useState, type ReactNode } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  Container,
  FileInput,
  Grid,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useStore } from '@nanostores/react';
import { IconMapPin, IconUpload, IconUser } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import PageHeader from '../../components/PageHeader';
import { $currUser } from '../../global-state/user';
import {
  buildAddressLine,
  canonicalAddressFromCepLookup,
} from '../../modules/address';
import {
  AVATAR_MARKET_UPDATED_EVENT,
  clearUploadedAvatarForUser,
  getRuralAvatarCatalog,
  getUserAvatarInventory,
  resolveUserAvatarDisplay,
  selectRuralAvatarIcon,
  setUploadedAvatarForUser,
  unlockRuralAvatarIcon,
  type RuralAvatarIcon,
  type UserAvatarInventory,
} from '../../services/avatarMarketplaceService';
import {
  claimCreditEngagementReward,
  CREDITS_UPDATED_EVENT,
  registerAndEnsureUserCredits,
} from '../../services/creditsService';
import {
  getProfile,
  updateProfile,
  type ProducerProfile,
  type UserProfile as UserProfileT,
} from '../../services/profileService';
import { trackGamificationEvent } from '../../services/gamificationService';
import { isLocalDataMode } from '../../services/dataProvider';
import { upsertUserProfilePerson } from '../../services/peopleService';
import { lookupAddressByCep, normalizeCep } from '../../services/cepService';

type ProfileTab =
  | 'identificacao'
  | 'endereco'
  | 'mapa'
  | 'contato'
  | 'observacoes';

const MAX_LOGO_FILE_BYTES = 1_500_000;
const MAX_AVATAR_FILE_BYTES = 1_500_000;
const MAX_CARGO_PROFISSAO_CHARS = 40;
const ACCEPTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
]);

function isAcceptedImageFile(file: File): boolean {
  if (!file.type) return false;
  if (ACCEPTED_IMAGE_TYPES.has(file.type)) return true;
  return file.type.startsWith('image/');
}

function buildAddress(producer: ProducerProfile): string {
  return buildAddressLine([
    producer.endereco,
    producer.numero,
    producer.complemento,
    producer.bairro,
    producer.cidade,
    producer.estado,
    producer.cep,
  ]);
}

function hasCompletedAddress(producer: ProducerProfile): boolean {
  const street = String(producer.endereco ?? '').trim();
  const city = String(producer.cidade ?? '').trim();
  const state = String(producer.estado ?? '').trim();
  const number = String(producer.numero ?? '').trim();
  return Boolean(street && city && state && number);
}

function normalizeCargoProfissaoInput(input: string): string {
  const cleaned = String(input ?? '')
    .replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ\s./,&()\-]/g, '')
    .replace(/\s+/g, ' ')
    .trimStart();
  return cleaned.slice(0, MAX_CARGO_PROFISSAO_CHARS);
}

function normalizeCpf(input: string): string {
  return String(input ?? '').replace(/\D/g, '').slice(0, 11);
}

function formatCpf(input: string): string {
  const digits = normalizeCpf(input);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function isValidCpf(input: string): boolean {
  const cpf = normalizeCpf(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cpf[i]) * (10 - i);
  }
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(cpf[i]) * (11 - i);
  }
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(cpf[10]);
}

function RowField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Grid align="center" gutter="sm">
      <Grid.Col span={{ base: 12, md: 2 }}>
        <Text ta={{ base: 'left', md: 'right' }}>{label}:</Text>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 10 }}>
        <Box maw={820}>{children}</Box>
      </Grid.Col>
    </Grid>
  );
}

interface ProfilePageProps {
  embedded?: boolean;
}

function withAuthEmailFallback(
  input: UserProfileT,
  authEmail: string,
): UserProfileT {
  const fallbackEmail = String(authEmail ?? '').trim().toLowerCase();
  if (!fallbackEmail) return input;

  const nextEmail = String(input.email ?? '').trim() || fallbackEmail;
  const nextContactEmail =
    String(input.contact?.email ?? '').trim() || nextEmail || fallbackEmail;
  const producer = input.producer;
  const nextProducerContactEmail =
    String(producer?.contact_email ?? '').trim() || nextContactEmail;

  return {
    ...input,
    email: nextEmail,
    contact: {
      ...(input.contact ?? {}),
      email: nextContactEmail,
    },
    producer: producer
      ? {
          ...producer,
          contact_email: nextProducerContactEmail,
        }
      : producer,
  };
}

export default function ProfilePage({ embedded = false }: ProfilePageProps) {
  const user = useStore($currUser);
  const [profile, setProfile] = useState<UserProfileT | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('identificacao');
  const [avatarModalOpened, setAvatarModalOpened] = useState(false);
  const [avatarInventory, setAvatarInventory] = useState<UserAvatarInventory | null>(
    null,
  );
  const [avatarDisplay, setAvatarDisplay] = useState<{ src?: string; emoji?: string }>(
    {},
  );
  const userId = String(user?.id ?? '').trim();
  const userEmail = String(user?.email ?? '').trim().toLowerCase();
  const ruralIcons = getRuralAvatarCatalog();
  const selectedRuralIcon =
    ruralIcons.find((icon) => icon.id === avatarInventory?.selected_icon_id) ?? null;

  useEffect(() => {
    (async () => {
      try {
        const data = await getProfile();
        setProfile(withAuthEmailFallback(data, userEmail));
      } finally {
        setLoading(false);
      }
    })();
  }, [userEmail]);

  useEffect(() => {
    if (!profile || !userEmail) return;
    const producerEmail = String(profile.producer?.contact_email ?? '').trim();
    const contactEmail = String(profile.contact?.email ?? '').trim();
    const rootEmail = String(profile.email ?? '').trim();
    if (producerEmail && contactEmail && rootEmail) return;
    setProfile((prev) => {
      if (!prev) return prev;
      return withAuthEmailFallback(prev, userEmail);
    });
  }, [profile, userEmail]);

  useEffect(() => {
    if (!userId || !userEmail) {
      setAvatarInventory(null);
      setAvatarDisplay({});
      return;
    }

    registerAndEnsureUserCredits({
      id: userId,
      email: userEmail,
      name: String(user?.user_metadata?.name ?? ''),
    });

    const refreshAvatarAndCredits = () => {
      setAvatarInventory(getUserAvatarInventory(userId));
      setAvatarDisplay(resolveUserAvatarDisplay(userId));
    };

    const onCreditsUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      if (custom.detail?.userId && custom.detail.userId !== userId) return;
      refreshAvatarAndCredits();
    };

    const onAvatarUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      if (custom.detail?.userId && custom.detail.userId !== userId) return;
      refreshAvatarAndCredits();
    };

    const onStorage = () => {
      refreshAvatarAndCredits();
    };

    refreshAvatarAndCredits();
    window.addEventListener(CREDITS_UPDATED_EVENT, onCreditsUpdated);
    window.addEventListener(AVATAR_MARKET_UPDATED_EVENT, onAvatarUpdated);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(CREDITS_UPDATED_EVENT, onCreditsUpdated);
      window.removeEventListener(AVATAR_MARKET_UPDATED_EVENT, onAvatarUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [userId, userEmail, user?.user_metadata?.name]);

  if (loading) {
    if (embedded) {
      return <Text c="dimmed">Carregando...</Text>;
    }
    return (
      <Container size="xl" mt="xl">
        <PageHeader title="Dados do Usuário" />
        <Text c="dimmed">Carregando...</Text>
      </Container>
    );
  }

  if (!profile || !profile.producer) {
    if (embedded) {
      return (
        <Stack>
          <Text c="red.6">Nao foi possivel carregar o cadastro.</Text>
          <Button mt="md" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </Stack>
      );
    }
    return (
      <Container size="xl" mt="xl">
        <PageHeader title="Dados do Usuário" />
        <Text c="red.6">Nao foi possivel carregar o cadastro.</Text>
        <Button mt="md" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </Container>
    );
  }

  const producer = profile.producer;
  const producerPersonType = producer.tipo_pessoa === 'pf' ? 'pf' : 'pj';
  const resolvedAccountEmail = String(
    userEmail || profile.email || profile.contact?.email || producer.contact_email || '',
  )
    .trim()
    .toLowerCase();
  const resolvedContactEmail = String(
    producer.contact_email || profile.contact?.email || profile.email || userEmail || '',
  )
    .trim()
    .toLowerCase();

  const setProducerField = <K extends keyof ProducerProfile>(
    key: K,
    value: ProducerProfile[K],
  ) => {
    setProfile((prev) => {
      if (!prev || !prev.producer) return prev;
      return {
        ...prev,
        producer: {
          ...prev.producer,
          [key]: value,
        },
      };
    });
  };

  const handleLogoFile = (file: File | null) => {
    if (!file) {
      setProfile((prev) => (prev ? { ...prev, logo_url: '' } : prev));
      return;
    }

    if (file.size > MAX_LOGO_FILE_BYTES) {
      notifications.show({
        title: 'Arquivo muito grande',
        message: 'Use uma imagem de ate 1.5 MB para o logotipo.',
        color: 'yellow',
      });
      return;
    }

    if (!isAcceptedImageFile(file)) {
      notifications.show({
        title: 'Formato não suportado',
        message: 'Use PNG, JPG, WEBP, SVG ou GIF para o logotipo.',
        color: 'yellow',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      setProfile((prev) => (prev ? { ...prev, logo_url: result } : prev));
    };
    reader.onerror = () => {
      notifications.show({
        title: 'Falha no upload',
        message: 'Não foi possível ler o arquivo do logotipo.',
        color: 'red',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleUserAvatarFile = (file: File | null) => {
    if (!userId) return;
    if (!file) {
      clearUploadedAvatarForUser(userId);
      notifications.show({
        title: 'Avatar removido',
        message: 'Avatar personalizado removido. O ícone rural sera usado.',
        color: 'blue',
      });
      return;
    }

    if (file.size > MAX_AVATAR_FILE_BYTES) {
      notifications.show({
        title: 'Arquivo muito grande',
        message: 'Use uma imagem de ate 1.5 MB para o avatar.',
        color: 'yellow',
      });
      return;
    }

    if (!isAcceptedImageFile(file)) {
      notifications.show({
        title: 'Formato não suportado',
        message: 'Use PNG, JPG, WEBP, SVG ou GIF para o avatar.',
        color: 'yellow',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      setUploadedAvatarForUser(userId, result);
      notifications.show({
        title: 'Avatar atualizado',
        message: 'Novo avatar enviado com sucesso.',
        color: 'teal',
      });
    };
    reader.onerror = () => {
      notifications.show({
        title: 'Falha no upload',
        message: 'Não foi possível ler o arquivo do avatar.',
        color: 'red',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSelectRuralIcon = (icon: RuralAvatarIcon) => {
    if (!userId) return;
    try {
      const unlocked = avatarInventory?.unlocked_icon_ids.includes(icon.id) ?? false;
      if (!unlocked) {
        unlockRuralAvatarIcon(userId, icon.id, userId);
        notifications.show({
          title: 'Ícone desbloqueado',
          message: `${icon.label} liberado com custo de ${icon.price_credits} credito.`,
          color: 'teal',
        });
        return;
      }
      selectRuralAvatarIcon(userId, icon.id);
      notifications.show({
        title: 'Ícone selecionado',
        message: `${icon.label} agora e seu avatar ativo.`,
        color: 'blue',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao atualizar avatar',
        message: String(error?.message ?? 'Não foi possível atualizar avatar.'),
        color: 'red',
      });
    }
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      notifications.show({
        title: 'Geolocalizacao indisponivel',
        message: 'Seu navegador não suporta geolocalizacao.',
        color: 'yellow',
      });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setProducerField('latitude', position.coords.latitude.toFixed(6));
        setProducerField('longitude', position.coords.longitude.toFixed(6));
        notifications.show({
          title: 'Localização capturada',
          message: 'Latitude e longitude preenchidas com sucesso.',
          color: 'green',
        });
        setLocating(false);
      },
      () => {
        notifications.show({
          title: 'Falha ao capturar localização',
          message: 'Permita acesso ao GPS e tente novamente.',
          color: 'red',
        });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleCepBlur = async () => {
    const cep = normalizeCep(producer.cep);
    if (cep.length !== 8) return;

    try {
      setLoadingCep(true);
      const lookup = await lookupAddressByCep(cep);
      if (!lookup) {
        notifications.show({
          title: 'CEP não encontrado',
          message: 'Revise o CEP informado.',
          color: 'yellow',
        });
        return;
      }
      const parsed = canonicalAddressFromCepLookup(lookup);

      setProfile((prev) => {
        if (!prev || !prev.producer) return prev;
        return {
          ...prev,
          producer: {
            ...prev.producer,
            cep: parsed.cep ?? prev.producer.cep,
            endereco: parsed.street ?? prev.producer.endereco,
            bairro: parsed.neighborhood ?? prev.producer.bairro,
            cidade: parsed.city ?? prev.producer.cidade,
            estado: parsed.state ?? prev.producer.estado,
            complemento: parsed.complement ?? prev.producer.complemento,
          },
        };
      });
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao buscar CEP',
        message:
          error?.message ?? 'Não foi possível preencher endereço automaticamente.',
        color: 'red',
      });
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSave = async () => {
    if (!profile || !profile.producer) return;
    const normalizedCpf = normalizeCpf(profile.producer.cpf);
    if (!isValidCpf(normalizedCpf)) {
      notifications.show({
        title: 'CPF inválido',
        message: 'Informe um CPF valido na aba Perfil antes de salvar.',
        color: 'red',
      });
      return;
    }

    try {
      setSaving(true);
      const nextContactEmail = String(
        profile.producer.contact_email ||
          profile.contact?.email ||
          profile.email ||
          userEmail ||
          '',
      )
        .trim()
        .toLowerCase();
      const next: UserProfileT = {
        ...profile,
        producer: {
          ...profile.producer,
          cpf: normalizedCpf,
          contact_email: nextContactEmail,
          cargo_profissao: normalizeCargoProfissaoInput(
            profile.producer.cargo_profissao,
          ),
        },
        name: profile.producer.nome_exibicao || profile.name,
        email: profile.email || userEmail || nextContactEmail || '',
        company_name: profile.company_name,
        contact: {
          email: nextContactEmail,
          phone: profile.producer.contact_phone || profile.contact?.phone || '',
          address: buildAddress(profile.producer) || profile.contact?.address || '',
        },
      };

      await updateProfile(next);
      const personUserId = userId || (isLocalDataMode ? 'local-user' : '');
      if (personUserId) {
        try {
          await upsertUserProfilePerson({
            userId: personUserId,
            name:
              next.producer?.contact_name ||
              next.producer?.nome_exibicao ||
              next.name ||
              'Usuário',
            email:
              next.producer?.contact_email ||
              next.contact?.email ||
              next.email ||
              '',
            phone: next.producer?.contact_phone || next.contact?.phone || '',
            website: next.producer?.website || next.contact?.website || '',
            address:
              buildAddress(next.producer ?? producer) ||
              next.contact?.address ||
              '',
          });
        } catch (err: any) {
          notifications.show({
            title: 'Perfil salvo com alerta',
            message:
              err?.message ??
              'Não foi possível sincronizar a pessoa de perfil no modulo Pessoas.',
            color: 'yellow',
          });
        }
      }
      setProfile(next);
      if (userId && next.producer && hasCompletedAddress(next.producer)) {
        claimCreditEngagementReward({
          user_id: userId,
          rule_id: 'profile_address',
          created_by: userId,
        });
      }
      if (userId) {
        void trackGamificationEvent(userId, 'profile_saved').catch(() => null);
      }
      notifications.show({
        title: 'Cadastro salvo',
        message: 'Dados do produtor atualizados com sucesso.',
        color: 'green',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearCurrentTab = () => {
    setProfile((prev) => {
      if (!prev || !prev.producer) return prev;

      const nextProducer = { ...prev.producer };
      let nextProfile: UserProfileT = { ...prev, producer: nextProducer };

      if (activeTab === 'identificacao') {
        nextProducer.nome_exibicao = '';
        nextProducer.cargo_profissao = '';
        nextProducer.cpf = '';
        nextProducer.website = '';
        nextProfile = {
          ...nextProfile,
          name: '',
          logo_url: '',
        };
      }

      if (activeTab === 'endereco') {
        nextProducer.cep = '';
        nextProducer.endereco = '';
        nextProducer.numero = '';
        nextProducer.complemento = '';
        nextProducer.estado = '';
        nextProducer.cidade = '';
        nextProducer.bairro = '';
      }

      if (activeTab === 'mapa') {
        nextProducer.latitude = '';
        nextProducer.longitude = '';
      }

      if (activeTab === 'contato') {
        nextProducer.contact_name = '';
        nextProducer.contact_email = '';
        nextProducer.contact_phone = '';
        nextProducer.contact_extension = '';
      }

      if (activeTab === 'observacoes') {
        nextProducer.notes = '';
      }

      return nextProfile;
    });
  };

  const profileContent = (
    <>
      <Card withBorder radius="md" p="sm">
        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab((value as ProfileTab) ?? 'identificacao')}
          variant="outline"
        >
          <Tabs.List>
            <Tabs.Tab value="identificacao">Perfil</Tabs.Tab>
            <Tabs.Tab value="endereco">Endereco</Tabs.Tab>
            <Tabs.Tab value="mapa">Localizacao no Mapa</Tabs.Tab>
            <Tabs.Tab value="contato">Dados de contato</Tabs.Tab>
            <Tabs.Tab value="observacoes">Observacoes</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="identificacao" pt="xs">
            <Card withBorder p="sm">
              <Stack gap="xs">
                <RowField label="Nome">
                  <TextInput
                    value={producer.nome_exibicao}
                    onChange={(event) =>
                      setProducerField('nome_exibicao', event.currentTarget.value)
                    }
                  />
                </RowField>
                <RowField label="Cargo/Profissao">
                  <TextInput
                    value={producer.cargo_profissao}
                    onChange={(event) =>
                      setProducerField(
                        'cargo_profissao',
                        normalizeCargoProfissaoInput(event.currentTarget.value),
                      )
                    }
                    placeholder="Ex.: Engenheiro Agronomo"
                    maxLength={MAX_CARGO_PROFISSAO_CHARS}
                    description={`${producer.cargo_profissao.length}/${MAX_CARGO_PROFISSAO_CHARS}`}
                  />
                </RowField>
                <RowField label="Tipo de cadastro">
                  <Select
                    data={[
                      { value: 'pf', label: 'Pessoa fisica' },
                      { value: 'pj', label: 'Pessoa juridica' },
                    ]}
                    value={producerPersonType}
                    onChange={(value) =>
                      setProducerField('tipo_pessoa', value === 'pf' ? 'pf' : 'pj')
                    }
                  />
                </RowField>
                <RowField label="CPF">
                  <TextInput
                    value={formatCpf(producer.cpf)}
                    onChange={(event) =>
                      setProducerField('cpf', normalizeCpf(event.currentTarget.value))
                    }
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                  />
                </RowField>
                <RowField label="Email da conta">
                  <TextInput
                    value={resolvedAccountEmail}
                    readOnly
                  />
                </RowField>
                <RowField label="Website">
                  <TextInput
                    value={producer.website}
                    onChange={(event) =>
                      setProducerField('website', event.currentTarget.value)
                    }
                    placeholder="https://"
                  />
                </RowField>
                <RowField label="Logotipo">
                  <Group align="center" gap="sm" wrap="wrap">
                    <FileInput
                      placeholder="Escolher arquivo"
                      leftSection={<IconUpload size={14} />}
                      onChange={handleLogoFile}
                      accept="image/*"
                    />
                    <Button
                      size="xs"
                      color="red"
                      variant="light"
                      onClick={() =>
                        setProfile((prev) => (prev ? { ...prev, logo_url: '' } : prev))
                      }
                      disabled={!profile.logo_url}
                    >
                      Remover logotipo
                    </Button>
                    <Text size="xs" c="dimmed">
                      {profile.logo_url ? 'Logotipo carregado.' : 'Nenhum logotipo carregado.'}
                    </Text>
                  </Group>
                </RowField>
                <RowField label="Avatar do usuário">
                  <Group align="center" gap="sm" wrap="wrap">
                    <Avatar radius="xl" size={42} src={avatarDisplay.src || undefined}>
                      {avatarDisplay.emoji || <IconUser size={20} />}
                    </Avatar>
                    <Text size="sm" c="dimmed">
                      {selectedRuralIcon
                        ? `Avatar atual: ${selectedRuralIcon.label}`
                        : 'Avatar atual'}
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => setAvatarModalOpened(true)}
                    >
                      Gerenciar avatar
                    </Button>
                  </Group>
                </RowField>
              </Stack>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="endereco" pt="xs">
            <Card withBorder p="sm">
              <Stack gap="xs">
                <Text c="red" fs="italic">
                  Digite o CEP e saia do campo para preenchimento automatico.
                </Text>
                <RowField label="CEP">
                  <TextInput
                    value={producer.cep}
                    onChange={(event) =>
                      setProducerField('cep', event.currentTarget.value)
                    }
                    onBlur={() => void handleCepBlur()}
                    rightSection={loadingCep ? <Text size="xs">...</Text> : null}
                  />
                </RowField>
                <RowField label="Endereço">
                  <TextInput
                    value={producer.endereco}
                    onChange={(event) =>
                      setProducerField('endereco', event.currentTarget.value)
                    }
                  />
                </RowField>
                <RowField label="Número">
                  <TextInput
                    value={producer.numero}
                    onChange={(event) =>
                      setProducerField('numero', event.currentTarget.value)
                    }
                  />
                </RowField>
                <RowField label="Complemento">
                  <TextInput
                    value={producer.complemento}
                    onChange={(event) =>
                      setProducerField('complemento', event.currentTarget.value)
                    }
                  />
                </RowField>
                <RowField label="Estado">
                  <TextInput
                    value={producer.estado}
                    onChange={(event) =>
                      setProducerField('estado', event.currentTarget.value)
                    }
                  />
                </RowField>
                <RowField label="Cidade">
                  <TextInput
                    value={producer.cidade}
                    onChange={(event) =>
                      setProducerField('cidade', event.currentTarget.value)
                    }
                  />
                </RowField>
                <RowField label="Bairro">
                  <TextInput
                    value={producer.bairro}
                    onChange={(event) =>
                      setProducerField('bairro', event.currentTarget.value)
                    }
                  />
                </RowField>
              </Stack>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="mapa" pt="xs">
            <Card withBorder p="sm">
              <Stack gap="xs">
                <RowField label="Latitude">
                  <TextInput
                    value={producer.latitude}
                    onChange={(event) =>
                      setProducerField('latitude', event.currentTarget.value)
                    }
                  />
                </RowField>
                <RowField label="Longitude">
                  <TextInput
                    value={producer.longitude}
                    onChange={(event) =>
                      setProducerField('longitude', event.currentTarget.value)
                    }
                  />
                </RowField>

                <Grid gutter="md" mt="xs">
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Button
                      leftSection={<IconMapPin size={16} />}
                      onClick={handleLocate}
                      loading={locating}
                    >
                      Localizar no mapa
                    </Button>
                    <Card withBorder mt="sm" h={260} bg="dark.9">
                      <Text c="gray.4" size="sm">
                        Placeholder do mapa (integracao pode ser feita depois com provider escolhido).
                      </Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Text fw={700}>ATENCAO</Text>
                    <Text size="sm">1) Capture a localizacao estando fisicamente na propriedade.</Text>
                    <Text size="sm">2) Permita acesso ao GPS do dispositivo.</Text>
                    <Text size="sm">3) Revise os valores antes de salvar.</Text>
                    <Text size="sm" mt="md">
                      Coordenadas atuais: {producer.latitude || '--'}, {producer.longitude || '--'}
                    </Text>
                  </Grid.Col>
                </Grid>
              </Stack>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="contato" pt="xs">
            <Card withBorder p="sm">
              <Stack gap="xs">
                <RowField label="Contato">
                  <TextInput
                    value={producer.contact_name}
                    onChange={(event) =>
                      setProducerField('contact_name', event.currentTarget.value)
                    }
                  />
                </RowField>
                <RowField label="Email">
                  <TextInput
                    value={resolvedContactEmail}
                    onChange={(event) => {
                      const nextEmail = String(event.currentTarget.value ?? '')
                        .trim()
                        .toLowerCase();
                      setProfile((prev) => {
                        if (!prev || !prev.producer) return prev;
                        return {
                          ...prev,
                          email: prev.email || nextEmail,
                          contact: {
                            ...(prev.contact ?? {}),
                            email: nextEmail,
                          },
                          producer: {
                            ...prev.producer,
                            contact_email: nextEmail,
                          },
                        };
                      });
                    }}
                  />
                </RowField>
                <RowField label="Telefone">
                  <TextInput
                    value={producer.contact_phone}
                    onChange={(event) =>
                      setProducerField('contact_phone', event.currentTarget.value)
                    }
                  />
                </RowField>
                <RowField label="Ramal">
                  <TextInput
                    value={producer.contact_extension}
                    onChange={(event) =>
                      setProducerField('contact_extension', event.currentTarget.value)
                    }
                  />
                </RowField>
              </Stack>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="observacoes" pt="xs">
            <Card withBorder p="sm">
              <RowField label="Observações">
                <Textarea
                  minRows={8}
                  value={producer.notes}
                  onChange={(event) =>
                    setProducerField('notes', event.currentTarget.value)
                  }
                />
              </RowField>
            </Card>
          </Tabs.Panel>
        </Tabs>

        <Modal
          opened={avatarModalOpened}
          onClose={() => setAvatarModalOpened(false)}
          title="Gerenciar avatar"
          size="lg"
          centered
        >
          <Stack gap="sm">
            <Group justify="space-between" wrap="wrap">
              <Group gap="sm" wrap="nowrap">
                <Avatar radius="xl" size={48} src={avatarDisplay.src || undefined}>
                  {avatarDisplay.emoji || <IconUser size={24} />}
                </Avatar>
                <Text size="sm" c="dimmed">
                  {selectedRuralIcon
                    ? `Selecionado: ${selectedRuralIcon.label}`
                    : 'Nenhum avatar selecionado'}
                </Text>
              </Group>
            </Group>

            <FileInput
              placeholder="Upload de avatar personalizado"
              leftSection={<IconUpload size={14} />}
              onChange={handleUserAvatarFile}
              accept="image/*"
            />

            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
              {ruralIcons.map((icon) => {
                const isUnlocked =
                  avatarInventory?.unlocked_icon_ids.includes(icon.id) ?? false;
                const isSelected = avatarInventory?.selected_icon_id === icon.id;
                return (
                  <Card key={icon.id} withBorder p="xs" radius="md">
                    <Stack gap={4} align="center">
                      <Text size="lg">{icon.emoji}</Text>
                      <Text size="xs" fw={700}>
                        {icon.label}
                      </Text>
                      <Button
                        size="xs"
                        variant={isSelected ? 'filled' : 'light'}
                        color={isSelected ? 'teal' : 'gray'}
                        onClick={() => handleSelectRuralIcon(icon)}
                      >
                        {isSelected
                          ? 'Selecionado'
                          : isUnlocked
                            ? 'Usar'
                            : `Desbloquear (${icon.price_credits})`}
                      </Button>
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>
        </Modal>

        <Group mt="xs">
          <Button onClick={handleSave} loading={saving}>
            Salvar
          </Button>
          <Button variant="light" color="red" onClick={handleClearCurrentTab}>
            Limpar formulario
          </Button>
        </Group>
      </Card>
    </>
  );

  if (embedded) return profileContent;

  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Dados do Usuário" />
      {profileContent}
    </Container>
  );
}
