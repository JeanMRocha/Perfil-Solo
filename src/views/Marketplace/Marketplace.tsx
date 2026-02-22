import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@nanostores/react';
import {
  IconCopy,
  IconShoppingCart,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react';
import { $currUser } from '../../global-state/user';
import {
  APP_STORE_UPDATED_EVENT,
  attachUserToReferralCode,
  ensureStoreReferralProfile,
  getAppStoreCatalog,
  getStoreRecurringOverviewForUser,
  getStoreReferralSummary,
  getUserStoreQuotaOverview,
  listStorePurchaseReceiptsForUser,
  purchaseAppStoreItem,
  validateAppStoreCoupon,
  type StoreCatalogItem,
  type StorePurchaseReceipt,
  type StoreQuotaOverview,
} from '../../services/appStoreService';
import {
  CREDITS_UPDATED_EVENT,
  getUserCredits,
  registerAndEnsureUserCredits,
} from '../../services/creditsService';
import {
  calculateBillingQuote,
  formatBillingMoney,
  getBillingSubscriptionForUser,
  getBillingUsageForUser,
  type BillingQuote,
} from '../../services/billingPlanService';

function normalizeCode(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatResourceLabel(resource: string): string {
  if (resource === 'properties') return 'Propriedades';
  if (resource === 'talhoes') return 'Talhões';
  return 'Análises';
}

function formatPricing(item: StoreCatalogItem): string {
  if (item.pricing_mode === 'recurring_brl') {
    return `${formatBillingMoney(item.unit_price_cents)}/mes`;
  }
  return `${item.unit_cost_credits} creditos`;
}

export default function Marketplace() {
  const user = useStore($currUser);
  const userId = String(user?.id ?? '').trim();
  const userEmail = String(user?.email ?? '').trim().toLowerCase();
  const planId = String(user?.user_metadata?.plan_id ?? '').trim();

  const [catalog, setCatalog] = useState<StoreCatalogItem[]>([]);
  const [quotaOverview, setQuotaOverview] = useState<StoreQuotaOverview | null>(null);
  const [quote, setQuote] = useState<BillingQuote | null>(null);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [recurringActiveCents, setRecurringActiveCents] = useState(0);
  const [receipts, setReceipts] = useState<StorePurchaseReceipt[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const refresh = useCallback(async () => {
    if (!userId || !userEmail) return;
    registerAndEnsureUserCredits({
      id: userId,
      email: userEmail,
      name: String(user?.user_metadata?.name ?? 'Usuário'),
    });

    setCatalog(getAppStoreCatalog());
    setCreditsBalance(getUserCredits(userId));
    setQuotaOverview(await getUserStoreQuotaOverview(userId, planId));
    setReceipts(listStorePurchaseReceiptsForUser(userId).slice(0, 30));
    setRecurringActiveCents(getStoreRecurringOverviewForUser(userId).total_monthly_cents);
    ensureStoreReferralProfile(userId);
    setReferralCode(getStoreReferralSummary(userId).profile.referral_code);

    const usage = await getBillingUsageForUser(userId);
    const sub = getBillingSubscriptionForUser(userId, planId);
    setQuote(calculateBillingQuote(sub.plan_id, usage));
  }, [planId, user?.user_metadata?.name, userEmail, userId]);

  useEffect(() => {
    void refresh();
    const onUpdate = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const changedUserId = String(custom.detail?.userId ?? '').trim();
      if (changedUserId && changedUserId !== userId) return;
      void refresh();
    };
    window.addEventListener(CREDITS_UPDATED_EVENT, onUpdate);
    window.addEventListener(APP_STORE_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener(CREDITS_UPDATED_EVENT, onUpdate);
      window.removeEventListener(APP_STORE_UPDATED_EVENT, onUpdate);
    };
  }, [refresh, userId]);

  const itemById = useMemo(() => new Map(catalog.map((row) => [row.id, row])), [catalog]);
  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([itemId, qtyRaw]) => {
          const item = itemById.get(itemId);
          if (!item) return null;
          const qty = Math.max(1, Math.round(Number(qtyRaw) || 1));
          return { item, qty };
        })
        .filter((row): row is { item: StoreCatalogItem; qty: number } => Boolean(row)),
    [cart, itemById],
  );
  const recurringCartCents = useMemo(
    () =>
      cartLines.reduce(
        (sum, row) => sum + (row.item.pricing_mode === 'recurring_brl' ? row.item.unit_price_cents * row.qty : 0),
        0,
      ),
    [cartLines],
  );
  const creditsCart = useMemo(
    () =>
      cartLines.reduce(
        (sum, row) => sum + (row.item.pricing_mode === 'credits' ? row.item.unit_cost_credits * row.qty : 0),
        0,
      ),
    [cartLines],
  );
  const coupon = useMemo(
    () =>
      couponCode
        ? validateAppStoreCoupon({
            code: couponCode,
            credits_subtotal: creditsCart,
            recurring_subtotal_cents: recurringCartCents,
          })
        : null,
    [couponCode, creditsCart, recurringCartCents],
  );
  const discountCredits = coupon?.valid ? coupon.discount_credits : 0;
  const creditsFinal = Math.max(0, creditsCart - discountCredits);
  const projectedNextInvoice = (quote?.total_monthly_cents ?? 0) + recurringActiveCents + recurringCartCents;

  const handleCheckout = async () => {
    if (!userId || cartLines.length === 0) return;
    try {
      setCheckoutLoading(true);
      let remainingDiscount = discountCredits;
      for (const line of cartLines) {
        const lineTotal = line.item.pricing_mode === 'credits' ? line.item.unit_cost_credits * line.qty : 0;
        const lineDiscount = Math.min(remainingDiscount, lineTotal);
        remainingDiscount -= lineDiscount;
        await purchaseAppStoreItem({
          user_id: userId,
          item_id: line.item.id,
          quantity: line.qty,
          created_by: userId,
          coupon_code: coupon?.valid ? coupon.code : undefined,
          discount_credits: lineDiscount,
        });
      }
      setCart({});
      setCouponCode('');
      setCouponInput('');
      notifications.show({ title: 'Carrinho finalizado', message: 'Pedido processado.', color: 'teal' });
      await refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Falha no checkout',
        message: String(error?.message ?? 'Não foi possível finalizar.'),
        color: 'red',
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <Stack p="md">
      <Group justify="space-between">
        <Title order={2}>Marketplace Interno</Title>
        <Group>
          <Badge variant="light" color="violet">Saldo: {creditsBalance} creditos</Badge>
          <Badge variant="light" color="blue">Recorrente ativo: {formatBillingMoney(recurringActiveCents)}/mes</Badge>
        </Group>
      </Group>

      <Tabs defaultValue="loja" variant="outline">
        <Tabs.List>
          <Tabs.Tab value="loja" leftSection={<IconShoppingCart size={16} />}>Loja</Tabs.Tab>
          <Tabs.Tab value="indicacao" leftSection={<IconUsers size={16} />}>Indicacao</Tabs.Tab>
          <Tabs.Tab value="roadmap" leftSection={<IconSparkles size={16} />}>Roadmap</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="loja" pt="md">
          <Stack>
            <Card withBorder p="md">
              <Text size="sm">Fatura atual estimada: <b>{formatBillingMoney(quote?.total_monthly_cents ?? 0)}</b></Text>
              <Text size="sm">Projecao com carrinho: <b>{formatBillingMoney(projectedNextInvoice)}</b></Text>
              <Text size="xs" c="dimmed">Propriedade/talhoes/analises entram em recorrencia. IA/cosmeticos ficam em creditos.</Text>
            </Card>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {catalog.filter((row) => row.status === 'active').map((item) => (
                <Card key={item.id} withBorder p="md">
                  <Text fw={700}>{item.label}</Text>
                  <Text size="sm" c="dimmed">{item.description}</Text>
                  <Text size="sm" mt="xs">Valor: <b>{formatPricing(item)}</b></Text>
                  <Group mt="xs" grow>
                    <NumberInput
                      min={item.min_quantity}
                      max={item.max_quantity}
                      value={quantities[item.id] ?? item.min_quantity}
                      onChange={(value) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [item.id]: typeof value === 'number' ? value : item.min_quantity,
                        }))
                      }
                    />
                    <Button
                      variant="light"
                      onClick={() => {
                        const qty = Math.max(1, Math.round(Number(quantities[item.id] ?? 1)));
                        setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + qty }));
                      }}
                    >
                      Carrinho
                    </Button>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>

            <Card withBorder p="md">
              <Text fw={700} mb="xs">Carrinho</Text>
              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Item</Table.Th>
                    <Table.Th>Modelo</Table.Th>
                    <Table.Th>Qtd</Table.Th>
                    <Table.Th>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {cartLines.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={4}><Text size="sm" c="dimmed">Carrinho vazio.</Text></Table.Td></Table.Tr>
                  ) : cartLines.map((row) => (
                    <Table.Tr key={row.item.id}>
                      <Table.Td>{row.item.label}</Table.Td>
                      <Table.Td>{row.item.pricing_mode === 'recurring_brl' ? 'Recorrente' : 'Avulso'}</Table.Td>
                      <Table.Td>{row.qty}</Table.Td>
                      <Table.Td>{row.item.pricing_mode === 'recurring_brl' ? `${formatBillingMoney(row.item.unit_price_cents * row.qty)}/mes` : `${row.item.unit_cost_credits * row.qty} creditos`}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Group mt="sm" align="end">
                <TextInput
                  label="Cupom"
                  value={couponInput}
                  onChange={(event) => {
                    setCouponInput(event.currentTarget.value);
                    if (couponCode && normalizeCode(event.currentTarget.value) !== couponCode) {
                      setCouponCode('');
                    }
                  }}
                />
                <Button
                  variant="light"
                  onClick={() => {
                    const result = validateAppStoreCoupon({
                      code: couponInput,
                      credits_subtotal: creditsCart,
                      recurring_subtotal_cents: recurringCartCents,
                    });
                    if (!result.valid) {
                      notifications.show({ title: 'Cupom inválido', message: result.message, color: 'red' });
                      setCouponCode('');
                      return;
                    }
                    setCouponCode(result.code);
                  }}
                >
                  Aplicar
                </Button>
                <Button onClick={() => void handleCheckout()} loading={checkoutLoading}>Finalizar</Button>
              </Group>
              <Text size="sm" mt="sm">Total avulso: {creditsFinal} creditos (desconto: -{discountCredits})</Text>
              <Text size="sm">Total recorrente no carrinho: {formatBillingMoney(recurringCartCents)}/mes</Text>
            </Card>

            <Card withBorder p="md">
              <Text fw={700} mb="xs">Limites da conta</Text>
              <Table withTableBorder>
                <Table.Thead><Table.Tr><Table.Th>Recurso</Table.Th><Table.Th>Total</Table.Th><Table.Th>Usado</Table.Th><Table.Th>Restante</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {quotaOverview ? (['properties', 'talhoes', 'analises'] as const).map((resource) => (
                    <Table.Tr key={resource}>
                      <Table.Td>{formatResourceLabel(resource)}</Table.Td>
                      <Table.Td>{quotaOverview.rows[resource].total_limit}</Table.Td>
                      <Table.Td>{quotaOverview.rows[resource].used}</Table.Td>
                      <Table.Td>{quotaOverview.rows[resource].remaining}</Table.Td>
                    </Table.Tr>
                  )) : <Table.Tr><Table.Td colSpan={4}>Carregando...</Table.Td></Table.Tr>}
                </Table.Tbody>
              </Table>
            </Card>

            <Card withBorder p="md">
              <Text fw={700} mb="xs">Historico</Text>
              <Table withTableBorder>
                <Table.Thead><Table.Tr><Table.Th>Data</Table.Th><Table.Th>Item</Table.Th><Table.Th>Modelo</Table.Th><Table.Th>Valor</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {receipts.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={4}><Text size="sm" c="dimmed">Sem compras.</Text></Table.Td></Table.Tr>
                  ) : receipts.map((row) => (
                    <Table.Tr key={row.id}>
                      <Table.Td>{new Date(row.created_at).toLocaleString('pt-BR')}</Table.Td>
                      <Table.Td>{row.item_label}</Table.Td>
                      <Table.Td>{row.pricing_mode === 'recurring_brl' ? 'Recorrente' : 'Avulso'}</Table.Td>
                      <Table.Td>{row.pricing_mode === 'recurring_brl' ? `${formatBillingMoney(row.total_price_cents)}/mes` : `${row.total_cost_credits} creditos`}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="indicacao" pt="md">
          <Card withBorder p="md">
            <TextInput label="Meu código de indicacao" value={referralCode} readOnly />
            <Group mt="xs">
              <Button leftSection={<IconCopy size={14} />} variant="light" onClick={() => void navigator.clipboard.writeText(referralCode)}>Copiar</Button>
            </Group>
            <Group mt="md" align="end">
              <TextInput label="Vincular código" value={referralCodeInput} onChange={(event) => setReferralCodeInput(event.currentTarget.value)} />
              <Button onClick={() => {
                if (!userId) return;
                try {
                  attachUserToReferralCode({ user_id: userId, referral_code: referralCodeInput });
                  notifications.show({ title: 'Código vinculado', message: 'Indicacao aplicada.', color: 'teal' });
                  setReferralCodeInput('');
                } catch (error: any) {
                  notifications.show({ title: 'Falha', message: String(error?.message ?? 'Erro ao vincular.'), color: 'red' });
                }
              }}>Vincular</Button>
            </Group>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="roadmap" pt="md">
          <Card withBorder p="md">
            <Text>1. Checkout com auditoria de cupom.</Text>
            <Text>2. Catalogo com imagens reais dos itens.</Text>
            <Text>3. Promocoes por temporada.</Text>
            <Text>4. IA premium por ticket.</Text>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
