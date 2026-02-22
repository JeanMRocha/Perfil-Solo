import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@nanostores/react';
import { useLocation } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { $currUser } from '../../global-state/user';
import {
  CREDITS_UPDATED_EVENT,
  CREDIT_PACKAGES,
  claimAdRewardCredits,
  createCreditPurchaseRequest,
  formatCreditPrice,
  getAdRewardAvailabilityForUser,
  getUserCredits,
  listCreditPurchaseRequests,
  listCreditTransactionsForUser,
  registerAndEnsureUserCredits,
  validateCouponForPackage,
  type CreditAdRewardAvailability,
  type CreditCouponValidation,
  type CreditPackage,
  type CreditPurchaseRequest,
  type CreditTransaction,
} from '../../services/creditsService';
import { isLocalDataMode } from '../../services/dataProvider';
import {
  IN_APP_PURCHASES_UPDATED_EVENT,
  listInAppPurchaseReceiptsForUser,
  type InAppPurchaseReceipt,
} from '../../services/inAppPurchasesService';
import { supabaseClient } from '../../supabase/supabaseClient';

function formatSignedAmount(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

function formatTransactionTypeLabel(type: CreditTransaction['type']): string {
  if (type === 'icon_purchase') return 'compra_interna';
  if (type === 'store_purchase') return 'loja_app';
  if (type === 'referral_reward') return 'indicacao_bonus';
  if (type === 'admin_grant') return 'credito_admin';
  if (type === 'admin_remove') return 'debito_admin';
  if (type === 'engagement_reward') return 'conquista';
  return type;
}

interface CreditsCenterProps {
  embedded?: boolean;
  view?: 'creditos' | 'cupons';
}

export default function CreditsCenter({
  embedded = false,
  view,
}: CreditsCenterProps) {
  const location = useLocation();
  const user = useStore($currUser);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [requests, setRequests] = useState<CreditPurchaseRequest[]>([]);
  const [purchaseReceipts, setPurchaseReceipts] = useState<InAppPurchaseReceipt[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    CREDIT_PACKAGES[0]?.id ?? null,
  );
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [rewarding, setRewarding] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponValidation, setCouponValidation] = useState<CreditCouponValidation | null>(
    null,
  );
  const [adAvailability, setAdAvailability] = useState<CreditAdRewardAvailability | null>(
    null,
  );

  const userId = user?.id ?? '';
  const userEmail = String(user?.email ?? '');
  const isCouponsView = view
    ? view === 'cupons'
    : location.pathname === '/cupons' || location.pathname.startsWith('/cupons/');

  const selectedPackage = useMemo<CreditPackage | null>(() => {
    return CREDIT_PACKAGES.find((row) => row.id === selectedPackageId) ?? null;
  }, [selectedPackageId]);

  const selectedPackagePriceCents = selectedPackage?.price_cents ?? 0;
  const selectedPackageFinalPriceCents =
    couponValidation?.valid && couponValidation.final_price_cents >= 0
      ? couponValidation.final_price_cents
      : selectedPackagePriceCents;
  const couponRequests = useMemo(
    () => requests.filter((row) => Boolean(String(row.coupon_code ?? '').trim())),
    [requests],
  );

  const refresh = () => {
    if (!userId || !userEmail) {
      setBalance(0);
      setTransactions([]);
      setRequests([]);
      setPurchaseReceipts([]);
      setAdAvailability(null);
      return;
    }
    registerAndEnsureUserCredits({
      id: userId,
      email: userEmail,
      name: String(user?.user_metadata?.name ?? userEmail.split('@')[0] ?? 'Usuário'),
    });
    setBalance(getUserCredits(userId));
    setTransactions(listCreditTransactionsForUser(userId).slice(0, 30));
    setRequests(
      listCreditPurchaseRequests()
        .filter((row) => row.user_id === userId)
        .slice(0, 20),
    );
    setPurchaseReceipts(listInAppPurchaseReceiptsForUser(userId).slice(0, 20));
    setAdAvailability(getAdRewardAvailabilityForUser(userId));
  };

  useEffect(() => {
    refresh();
    const onCreditsUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const updatedFor = custom.detail?.userId;
      if (updatedFor && updatedFor !== userId) return;
      refresh();
    };
    const onInAppPurchasesUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const updatedFor = custom.detail?.userId;
      if (updatedFor && updatedFor !== userId) return;
      refresh();
    };
    const onStorage = () => {
      refresh();
    };
    window.addEventListener(CREDITS_UPDATED_EVENT, onCreditsUpdated);
    window.addEventListener(IN_APP_PURCHASES_UPDATED_EVENT, onInAppPurchasesUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CREDITS_UPDATED_EVENT, onCreditsUpdated);
      window.removeEventListener(
        IN_APP_PURCHASES_UPDATED_EVENT,
        onInAppPurchasesUpdated,
      );
      window.removeEventListener('storage', onStorage);
    };
  }, [userId, userEmail]);

  const applyCoupon = () => {
    if (!selectedPackage) {
      notifications.show({
        title: 'Pacote não selecionado',
        message: 'Escolha um pacote antes de aplicar cupom.',
        color: 'yellow',
      });
      return;
    }

    const validation = validateCouponForPackage({
      package_id: selectedPackage.id,
      coupon_code: couponCode,
    });

    if (!validation.valid) {
      setCouponValidation(null);
      notifications.show({
        title: 'Cupom inválido',
        message: validation.message,
        color: 'red',
      });
      return;
    }

    setCouponValidation(validation);
    notifications.show({
      title: 'Cupom aplicado',
      message: `${validation.coupon?.code} aplicado com sucesso.`,
      color: 'teal',
    });
  };

  const clearCoupon = () => {
    setCouponCode('');
    setCouponValidation(null);
  };

  const requestPurchase = async () => {
    if (!userId || !userEmail) return;
    if (!selectedPackage) {
      notifications.show({
        title: 'Pacote não selecionado',
        message: 'Selecione um pacote de créditos para continuar.',
        color: 'yellow',
      });
      return;
    }

    if (authEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      notifications.show({
        title: 'Autenticacao inválida',
        message: 'Confirme o email da conta logada para solicitar a compra.',
        color: 'red',
      });
      return;
    }

    try {
      setRequesting(true);
      if (!isLocalDataMode) {
        if (!authPassword) {
          notifications.show({
            title: 'Senha obrigatoria',
            message: 'Informe a senha para confirmar a solicitação.',
            color: 'yellow',
          });
          return;
        }
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: userEmail,
          password: authPassword,
        });
        if (error) throw error;
      }

      createCreditPurchaseRequest({
        user_id: userId,
        package_id: selectedPackage.id,
        credits_requested: selectedPackage.credits,
        auth_email: authEmail,
        coupon_code: couponValidation?.coupon?.code,
      });

      setAuthPassword('');
      notifications.show({
        title: 'Solicitação enviada',
        message:
          'Pedido autenticado e pendente para aprovacao do super usuário.',
        color: 'blue',
      });
      refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Falha na solicitação',
        message: String(error?.message ?? 'Não foi possível autenticar a compra.'),
        color: 'red',
      });
    } finally {
      setRequesting(false);
    }
  };

  const claimReward = async () => {
    if (!userId) return;
    try {
      setRewarding(true);
      claimAdRewardCredits(userId, userId);
      notifications.show({
        title: 'Crédito liberado',
        message: 'Voce recebeu 1 crédito por assistir propaganda.',
        color: 'teal',
      });
      refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Recompensa indisponivel',
        message: String(error?.message ?? 'Não foi possível liberar a recompensa.'),
        color: 'yellow',
      });
    } finally {
      setRewarding(false);
    }
  };

  return (
    <Stack>
      {!embedded ? (
        <PageHeader
          title={isCouponsView ? 'Cupons e Compra de Créditos' : 'Créditos e Histórico'}
          color="violet"
        />
      ) : null}

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

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="center">
          <div>
            <Text size="sm" c="dimmed">
              Saldo atual
            </Text>
            <Title order={3}>{balance} creditos</Title>
          </div>
          <Badge color="violet" variant="light" size="lg">
            {isCouponsView ? 'Menu de cupons' : 'Controle de uso ativo'}
          </Badge>
        </Group>
      </Card>

      {isCouponsView ? (
        <>
          <Card withBorder radius="md" p="lg">
            <Stack gap="sm">
              <Text fw={700}>Carteira de creditos para itens cosmeticos</Text>
              <Text size="sm" c="dimmed">
                Selecione pacote, aplique cupom e envie a solicitacao autenticada.
                Creditos servem para compras cosmeticas no app.
              </Text>
              <Select
                label="Pacote"
                data={CREDIT_PACKAGES.map((item) => ({
                  value: item.id,
                  label: `${item.label} - ${item.credits} creditos (${item.price_label})`,
                }))}
                value={selectedPackageId}
                onChange={(value) => {
                  setSelectedPackageId(value);
                  setCouponValidation(null);
                }}
              />
              <Group align="end" grow>
                <TextInput
                  label="Cupom de desconto"
                  value={couponCode}
                  onChange={(event) => {
                    setCouponCode(event.currentTarget.value);
                    setCouponValidation(null);
                  }}
                  placeholder="EX: SOLO10"
                />
                <Button variant="light" onClick={applyCoupon}>
                  Aplicar cupom
                </Button>
                <Button variant="subtle" color="gray" onClick={clearCoupon}>
                  Limpar
                </Button>
              </Group>
              <Group gap="xs">
                <Badge color="gray" variant="light">
                  Original: {formatCreditPrice(selectedPackagePriceCents)}
                </Badge>
                <Badge color="orange" variant="light">
                  Desconto: {formatCreditPrice(couponValidation?.discount_cents ?? 0)}
                </Badge>
                <Badge color="teal" variant="light">
                  Final: {formatCreditPrice(selectedPackageFinalPriceCents)}
                </Badge>
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="md" p="lg">
            <Stack gap="sm">
              <Text fw={700}>Autenticacao para compra de creditos cosmeticos</Text>
              <Text size="sm" c="dimmed">
                Funcionalidades (planos e adicionais) sao cobradas em dinheiro.
                Creditos sao apenas para cosmeticos e nao podem ser convertidos de volta em dinheiro.
              </Text>
              <Group grow align="end">
                <TextInput
                  label="Confirme seu email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.currentTarget.value)}
                  placeholder={userEmail || 'email@conta.com'}
                />
                {!isLocalDataMode ? (
                  <PasswordInput
                    label="Senha"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.currentTarget.value)}
                    placeholder="Sua senha para autenticar"
                  />
                ) : null}
              </Group>
              <Group justify="flex-end">
                <Button
                  color="violet"
                  loading={requesting}
                  onClick={() => void requestPurchase()}
                >
                  Solicitar compra
                </Button>
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="md" p="lg">
            <Text fw={700} mb="sm">
              Historico de uso de cupons
            </Text>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Pacote</Table.Th>
                  <Table.Th>Cupom</Table.Th>
                  <Table.Th>Desconto</Table.Th>
                  <Table.Th>Valor final</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {couponRequests.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text c="dimmed" size="sm">
                        Nenhuma solicitacao com cupom encontrada.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  couponRequests.map((request) => (
                    <Table.Tr key={request.id}>
                      <Table.Td>{new Date(request.created_at).toLocaleString('pt-BR')}</Table.Td>
                      <Table.Td>{request.package_label ?? request.package_id}</Table.Td>
                      <Table.Td>{request.coupon_code || '-'}</Table.Td>
                      <Table.Td>{formatCreditPrice(request.discount_cents ?? 0)}</Table.Td>
                      <Table.Td>
                        {formatCreditPrice(
                          request.final_price_cents ?? request.price_cents ?? 0,
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            request.status === 'approved'
                              ? 'teal'
                              : request.status === 'denied'
                                ? 'red'
                                : 'yellow'
                          }
                        >
                          {request.status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </>
      ) : (
        <>
          <Card withBorder radius="md" p="lg">
            <Stack gap="sm">
              <Text fw={700}>Ganhar credito assistindo propaganda</Text>
              <Text size="sm" c="dimmed">
                Recompensa para carteira cosmetica. A administracao e feita pelo super usuario.
              </Text>
              <Text size="xs" c="dimmed">
                Cupons agora ficam em menu separado no menu do usuario.
              </Text>
              <Group gap="xs">
                <Badge color={adAvailability?.allowed ? 'teal' : 'yellow'} variant="light">
                  {adAvailability?.allowed ? 'Disponivel' : 'Indisponivel'}
                </Badge>
                <Badge color="grape" variant="light">
                  Restante hoje: {adAvailability?.remaining_today ?? 0}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {adAvailability?.reason ?? 'Sem status de recompensa.'}
              </Text>
              {adAvailability?.next_available_at ? (
                <Text size="xs" c="dimmed">
                  Proxima liberacao:{' '}
                  {new Date(adAvailability.next_available_at).toLocaleString('pt-BR')}
                </Text>
              ) : null}
              <Button
                color="teal"
                onClick={() => void claimReward()}
                loading={rewarding}
                disabled={!adAvailability?.allowed}
              >
                Assistir propaganda e ganhar credito
              </Button>
            </Stack>
          </Card>

          <Card withBorder radius="md" p="lg">
            <Text fw={700} mb="sm">
              Historico de uso de creditos
            </Text>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Movimento</Table.Th>
                  <Table.Th>Saldo apos</Table.Th>
                  <Table.Th>Descricao</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {transactions.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Text c="dimmed" size="sm">
                        Sem movimentacoes de credito para este usuario.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  transactions.map((row) => (
                    <Table.Tr key={row.id}>
                      <Table.Td>{new Date(row.created_at).toLocaleString('pt-BR')}</Table.Td>
                      <Table.Td>{formatTransactionTypeLabel(row.type)}</Table.Td>
                      <Table.Td>
                        <Text c={row.amount < 0 ? 'red.6' : 'teal.6'} fw={700}>
                          {formatSignedAmount(row.amount)}
                        </Text>
                      </Table.Td>
                      <Table.Td>{row.balance_after}</Table.Td>
                      <Table.Td>{row.description}</Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Card>

          <Card withBorder radius="md" p="lg">
            <Text fw={700} mb="sm">
              Minhas solicitacoes de compra
            </Text>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Pacote</Table.Th>
                  <Table.Th>Creditos</Table.Th>
                  <Table.Th>Cupom</Table.Th>
                  <Table.Th>Valor final</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {requests.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text c="dimmed" size="sm">
                        Nenhuma solicitacao encontrada.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  requests.map((request) => (
                    <Table.Tr key={request.id}>
                      <Table.Td>{new Date(request.created_at).toLocaleString('pt-BR')}</Table.Td>
                      <Table.Td>{request.package_label ?? request.package_id}</Table.Td>
                      <Table.Td>{request.credits_requested}</Table.Td>
                      <Table.Td>{request.coupon_code || '-'}</Table.Td>
                      <Table.Td>
                        {formatCreditPrice(
                          request.final_price_cents ?? request.price_cents ?? 0,
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            request.status === 'approved'
                              ? 'teal'
                              : request.status === 'denied'
                                ? 'red'
                                : 'yellow'
                          }
                        >
                          {request.status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </>
      )}

      <Card withBorder radius="md" p="lg">
        <Text fw={700} mb="sm">
          Comprovantes de compras cosmeticas com creditos
        </Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Comprovante</Table.Th>
              <Table.Th>Item</Table.Th>
              <Table.Th>Qtd</Table.Th>
              <Table.Th>Custo</Table.Th>
              <Table.Th>Tx credito</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {purchaseReceipts.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" size="sm">
                    Nenhum comprovante de compra interna encontrado.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              purchaseReceipts.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{new Date(row.created_at).toLocaleString('pt-BR')}</Table.Td>
                  <Table.Td>{row.receipt_number}</Table.Td>
                  <Table.Td>{row.item_label}</Table.Td>
                  <Table.Td>{row.quantity}</Table.Td>
                  <Table.Td>
                    -{row.total_cost_credits} {row.total_cost_credits === 1 ? 'credito' : 'creditos'}
                  </Table.Td>
                  <Table.Td>{row.credit_transaction_id ?? '-'}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
