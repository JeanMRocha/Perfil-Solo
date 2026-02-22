import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@nanostores/react';
import { $currUser } from '../../global-state/user';
import {
  type BillingFeatureDefinition,
  type BillingPlanDefinition,
  type BillingPlanId,
} from '../../modules/billing';
import {
  getBillingFeaturesWithCatalog,
  getBillingFreeFeaturesFromCatalog,
  getBillingPlansWithCatalog,
  subscribeBillingCatalog,
} from '../../services/billingCatalogService';
import {
  BILLING_UPDATED_EVENT,
  calculateBillingQuote,
  createCreditTopupFromMoney,
  formatBillingMoney,
  getBillingSubscriptionForUser,
  getBillingUsageForUser,
  setBillingPlanForUser,
  type BillingQuote,
  type BillingUsageSnapshot,
} from '../../services/billingPlanService';
import {
  CREDITS_UPDATED_EVENT,
  getUserCredits,
  registerAndEnsureUserCredits,
} from '../../services/creditsService';
import { getProfile, updateProfile } from '../../services/profileService';

function blankUsage(): BillingUsageSnapshot {
  return {
    properties: 0,
    talhoes: 0,
    analises: 0,
    captured_at: new Date().toISOString(),
  };
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

export default function BillingSettings() {
  const user = useStore($currUser);
  const userId = String(user?.id ?? '').trim();
  const userEmail = String(user?.email ?? '').trim();
  const hasUser = Boolean(userId && userEmail);

  const [loading, setLoading] = useState(false);
  const [planId, setPlanId] = useState<BillingPlanId>('free');
  const [usage, setUsage] = useState<BillingUsageSnapshot>(blankUsage());
  const [quote, setQuote] = useState<BillingQuote | null>(null);
  const [balance, setBalance] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [topupReais, setTopupReais] = useState<number | ''>(20);
  const [topupLoading, setTopupLoading] = useState(false);
  const [cpf, setCpf] = useState('');
  const [accountCpf, setAccountCpf] = useState('');
  const [useSameAsAccount, setUseSameAsAccount] = useState(true);
  const [cpfSaving, setCpfSaving] = useState(false);
  const [plans, setPlans] = useState<BillingPlanDefinition[]>(() =>
    getBillingPlansWithCatalog(),
  );
  const [features, setFeatures] = useState<BillingFeatureDefinition[]>(() =>
    getBillingFeaturesWithCatalog(),
  );
  const [freeFeatures, setFreeFeatures] = useState<string[]>(() =>
    getBillingFreeFeaturesFromCatalog(),
  );

  const premiumBaseLabel = formatBillingMoney(
    plans.find((row) => row.id === 'premium')?.base_price_cents ?? 0,
  );
  const accountCpfDigits = normalizeCpf(accountCpf);
  const hasEffectiveCpf = Boolean(
    normalizeCpf(useSameAsAccount ? accountCpfDigits : cpf),
  );

  const refresh = async () => {
    setPlans(getBillingPlansWithCatalog());
    setFeatures(getBillingFeaturesWithCatalog());
    setFreeFeatures(getBillingFreeFeaturesFromCatalog());

    if (!hasUser) {
      setPlanId('free');
      setUsage(blankUsage());
      setQuote(null);
      setBalance(0);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      registerAndEnsureUserCredits({
        id: userId,
        email: userEmail,
        name: String(user?.user_metadata?.name ?? userEmail.split('@')[0] ?? 'Usuário'),
      });

      const profile = await getProfile();
      const metadataCpf = String(
        user?.user_metadata?.cpf ??
          user?.user_metadata?.document ??
          '',
      ).trim();
      const profileCpf = String(profile.producer?.cpf ?? '').trim();
      const resolvedAccountCpf = profileCpf || metadataCpf;
      setAccountCpf(resolvedAccountCpf);
      setCpf((prev) => {
        if (normalizeCpf(prev)) return prev;
        return resolvedAccountCpf;
      });

      const subscription = getBillingSubscriptionForUser(
        userId,
        String(user?.user_metadata?.plan_id ?? ''),
      );
      const snapshot = await getBillingUsageForUser(userId);
      const nextQuote = calculateBillingQuote(subscription.plan_id, snapshot);

      setPlanId(subscription.plan_id);
      setUsage(snapshot);
      setQuote(nextQuote);
      setBalance(getUserCredits(userId));
    } catch (error: any) {
      setLoadError(String(error?.message ?? 'Falha ao carregar dados de assinatura.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCpf = async () => {
    if (useSameAsAccount) {
      notifications.show({
        title: 'Usando CPF da conta',
        message: 'Para alterar, atualize o CPF no perfil da conta.',
        color: 'blue',
      });
      return;
    }
    const normalized = normalizeCpf(cpf);
    try {
      setCpfSaving(true);
      const current = await getProfile();
      if (!current.producer) {
        throw new Error('Perfil sem cadastro de produtor para salvar CPF.');
      }
      await updateProfile({
        ...current,
        producer: {
          ...current.producer,
          cpf: normalized,
        },
      });
      setCpf(normalized);
      setAccountCpf(normalized);
      notifications.show({
        title: 'CPF salvo',
        message: 'CPF de verificacao de identidade atualizado com sucesso.',
        color: 'teal',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao salvar CPF',
        message: String(error?.message ?? 'Não foi possível salvar o CPF.'),
        color: 'red',
      });
    } finally {
      setCpfSaving(false);
    }
  };

  useEffect(() => {
    void refresh();
    const onBillingUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const changedUserId = String(custom.detail?.userId ?? '').trim();
      if (changedUserId && changedUserId !== userId) return;
      void refresh();
    };
    const onCreditsUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const changedUserId = String(custom.detail?.userId ?? '').trim();
      if (changedUserId && changedUserId !== userId) return;
      void refresh();
    };
    const onStorage = () => {
      void refresh();
    };
    const unsubscribeCatalog = subscribeBillingCatalog(() => {
      void refresh();
    });
    window.addEventListener(BILLING_UPDATED_EVENT, onBillingUpdated);
    window.addEventListener(CREDITS_UPDATED_EVENT, onCreditsUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      unsubscribeCatalog();
      window.removeEventListener(BILLING_UPDATED_EVENT, onBillingUpdated);
      window.removeEventListener(CREDITS_UPDATED_EVENT, onCreditsUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [userId, userEmail]);

  useEffect(() => {
    if (!useSameAsAccount) return;
    setCpf(accountCpf);
  }, [accountCpf, useSameAsAccount]);

  const applyPlan = (nextPlan: BillingPlanId) => {
    if (!hasUser) return;
    try {
      setBillingPlanForUser({
        user_id: userId,
        plan_id: nextPlan,
        updated_by: userId,
      });
      notifications.show({
        title: 'Plano atualizado',
        message: `Plano ${nextPlan.toUpperCase()} aplicado para sua conta.`,
        color: 'teal',
      });
      void refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao atualizar plano',
        message: String(error?.message ?? 'Não foi possível alterar o plano.'),
        color: 'red',
      });
    }
  };

  const handleTopup = () => {
    if (!hasUser) return;
    const reais = Number(topupReais) || 0;
    const amountCents = Math.max(0, Math.round(reais * 100));
    if (amountCents <= 0) {
      notifications.show({
        title: 'Valor inválido',
        message: 'Informe um valor maior que zero para converter em créditos.',
        color: 'yellow',
      });
      return;
    }

    try {
      setTopupLoading(true);
      const { entry } = createCreditTopupFromMoney({
        user_id: userId,
        amount_cents: amountCents,
        created_by: userId,
      });
      notifications.show({
        title: 'Conversão concluida',
        message: `${formatBillingMoney(entry.amount_cents)} -> ${entry.credits_delta} creditos.`,
        color: 'teal',
      });
      void refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Falha na conversão',
        message: String(error?.message ?? 'Não foi possível converter o valor em créditos.'),
        color: 'red',
      });
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <Stack>
      <Card withBorder radius="md" p="lg">
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Title order={5}>CPF para pagamento</Title>
            <Badge color={hasEffectiveCpf ? 'teal' : 'gray'} variant="light">
              {hasEffectiveCpf ? 'CPF informado' : 'CPF opcional aqui'}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            O CPF de pagamento usa os dados da conta. A validacao ocorre ao salvar na aba Usuario.
          </Text>
          <Checkbox
            label="Usar o mesmo da conta"
            checked={useSameAsAccount}
            onChange={(event) => setUseSameAsAccount(event.currentTarget.checked)}
          />
          {!useSameAsAccount ? (
            <Group align="end" gap="xs" wrap="wrap">
              <TextInput
                label="CPF"
                placeholder="000.000.000-00"
                value={formatCpf(cpf)}
                onChange={(event) => setCpf(normalizeCpf(event.currentTarget.value))}
                w={220}
                inputMode="numeric"
                maxLength={14}
              />
              <Button
                variant="light"
                onClick={() => void handleSaveCpf()}
                loading={cpfSaving}
              >
                Salvar CPF
              </Button>
            </Group>
          ) : null}
          {useSameAsAccount ? (
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                CPF sincronizado automaticamente com os dados da conta.
              </Text>
              <Text size="xs" c="dimmed">
                CPF da conta: {formatCpf(accountCpfDigits) || 'não informado'}
              </Text>
            </Stack>
          ) : null}
        </Stack>
      </Card>

      <Card
        withBorder
        radius="md"
        p="sm"
        style={{
          position: 'sticky',
          top: 8,
          zIndex: 20,
          borderColor: 'var(--mantine-color-violet-4)',
          background: 'var(--mantine-color-violet-0)',
        }}
      >
        <Group justify="space-between" gap="xs">
          <Text size="sm" fw={700}>
            Regra de moedas do sistema
          </Text>
          <Badge color="violet" variant="light">
            1 via
          </Badge>
        </Group>
        <Text size="sm" mt={4}>
          Funcionalidades (planos e adicionais) = dinheiro (BRL).
        </Text>
        <Text size="sm">
          Creditos = itens cosmeticos no app.
        </Text>
        <Text size="xs" c="dimmed">
          Conversao permitida somente de dinheiro para creditos.
        </Text>
      </Card>

      <Card p="xl" radius="md" withBorder>
        <Stack gap="xs">
          <Title order={3}>Assinatura e Planos</Title>
          <Text size="sm" c="dimmed">
            Modelo atual: Free e Premium base de {premiumBaseLabel} com adicionais por uso.
            Funcionalidades sao cobradas em dinheiro; creditos sao carteira de cosmeticos.
          </Text>
          <Group>
            <Text fw={500}>Plano atual:</Text>
            <Badge size="lg" color={planId === 'premium' ? 'blue' : 'gray'}>
              {planId.toUpperCase()}
            </Badge>
            <Badge variant="outline" color="teal">
              Saldo atual: {balance} creditos
            </Badge>
          </Group>
          {loadError ? (
            <Text size="sm" c="red">
              {loadError}
            </Text>
          ) : null}
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {plans.map((plan) => (
          <Card key={plan.id} withBorder p="md" radius="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={700} size="lg">
                  {plan.label}
                </Text>
                <Badge color={plan.id === 'premium' ? 'blue' : 'gray'}>
                  {formatBillingMoney(plan.base_price_cents)}/mes
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {plan.description}
              </Text>
              {features.map((feature) => (
                <Text key={`${plan.id}:${feature.id}`} size="sm">
                  {feature.label}: {feature.included_by_plan[plan.id]} inclusos,
                  extra {formatBillingMoney(feature.extra_unit_price_cents)} por {feature.unit_label}
                </Text>
              ))}
              <Button
                fullWidth
                disabled={!hasUser || loading || planId === plan.id}
                onClick={() => applyPlan(plan.id)}
              >
                {planId === plan.id ? 'Plano Atual' : `Ativar ${plan.label}`}
              </Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <Card withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={5}>Estimativa mensal por uso</Title>
            <Badge color="teal" variant="light">
              Uso em tempo real
            </Badge>
          </Group>

          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Modulo</Table.Th>
                <Table.Th>Uso atual</Table.Th>
                <Table.Th>Franquia</Table.Th>
                <Table.Th>Excedente</Table.Th>
                <Table.Th>Preco unit.</Table.Th>
                <Table.Th>Total extra</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(quote?.lines ?? []).map((line) => (
                <Table.Tr key={line.feature_id}>
                  <Table.Td>{line.label}</Table.Td>
                  <Table.Td>{line.used_units}</Table.Td>
                  <Table.Td>{line.included_units}</Table.Td>
                  <Table.Td>{line.extra_units}</Table.Td>
                  <Table.Td>{formatBillingMoney(line.unit_price_cents)}</Table.Td>
                  <Table.Td>{formatBillingMoney(line.total_extra_cents)}</Table.Td>
                </Table.Tr>
              ))}
              {!quote ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text size="sm" c="dimmed">
                      Carregando estimativa...
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>

          <Group justify="space-between">
            <Text fw={600}>Base do plano</Text>
            <Text fw={600}>{formatBillingMoney(quote?.base_price_cents ?? 0)}</Text>
          </Group>
          <Group justify="space-between">
            <Text fw={600}>Adicionais por uso</Text>
            <Text fw={600}>{formatBillingMoney(quote?.total_extra_cents ?? 0)}</Text>
          </Group>
          <Group justify="space-between">
            <Text fw={700}>Total estimado mensal</Text>
            <Text fw={700}>{formatBillingMoney(quote?.total_monthly_cents ?? 0)}</Text>
          </Group>
          <Text size="xs" c="dimmed">
            Ultima leitura de uso: {new Date(usage.captured_at).toLocaleString('pt-BR')}
          </Text>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <Card withBorder radius="md" p="lg">
          <Stack gap="xs">
            <Title order={5}>Recarga de creditos para cosmeticos</Title>
            <Text size="sm" c="dimmed">
              Conversao fixa: 1 real = 2 creditos. Nao existe conversao de creditos para dinheiro.
            </Text>
            <NumberInput
              label="Valor em reais"
              min={1}
              decimalScale={2}
              fixedDecimalScale
              value={topupReais}
              onChange={(value) => setTopupReais(typeof value === 'number' ? value : '')}
            />
            <Button loading={topupLoading} onClick={handleTopup} disabled={!hasUser}>
              Comprar creditos
            </Button>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Stack gap="xs">
            <Title order={5}>Modulos atualmente gratuitos</Title>
            {freeFeatures.map((item) => (
              <Text key={item} size="sm">
                {item}
              </Text>
            ))}
            <Text size="xs" c="dimmed">
              Futuro: calculo de adubacao e recomendacoes IA poderao receber precificacao
              dedicada.
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
