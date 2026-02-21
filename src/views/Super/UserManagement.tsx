import { useEffect, useMemo, useState } from 'react';
import { Stack, Tabs } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@nanostores/react';
import PageHeader from '../../components/PageHeader';
import { $currUser } from '../../global-state/user';
import {
  CREDITS_UPDATED_EVENT,
  createCreditCoupon,
  formatCreditPrice,
  getCreditAdRewardConfig,
  listCreditEngagementRewardRules,
  listCreditEngagementUsersPerformance,
  getUserCredits,
  grantCreditsToUser,
  listCreditCouponRedemptions,
  listCreditCoupons,
  listCreditPurchaseRequests,
  listCreditTransactionsForUser,
  saveCreditEngagementRewardRules,
  refundCreditTransaction,
  registerAndEnsureUserCredits,
  removeCreditsFromUser,
  reviewCreditPurchaseRequest,
  setCreditCouponActive,
  setCreditsForUser,
  updateCreditAdRewardConfig,
  type CreditAdRewardConfig,
  type CreditCoupon,
  type CreditCouponRedemption,
  type CreditCouponType,
  type CreditEngagementRule,
  type CreditEngagementRuleId,
  type CreditEngagementUserPerformance,
  type CreditPurchaseRequest,
  type CreditTransaction,
} from '../../services/creditsService';
import {
  USERS_REGISTRY_UPDATED_EVENT,
  getInitialCreditsAfterSignup,
  listRegisteredUsers,
  setInitialCreditsAfterSignup,
  type RegisteredUser,
} from '../../services/usersRegistryService';
import {
  IN_APP_PURCHASES_UPDATED_EVENT,
  listAllInAppPurchaseReceipts,
  type InAppPurchaseReceipt,
} from '../../services/inAppPurchasesService';
import {
  CouponsTab,
  CreditsTab,
  PurchasesTab,
  ReceiptsTab,
  RulesTab,
  UsersTab,
  type ReceiptTypeFilter,
  type RequestStatusFilter,
  type TransactionFlowFilter,
  type UserBalanceFilter,
  type UserRow,
} from './UserManagementTabs';

function toTime(dateLike: string): number {
  const time = new Date(dateLike).getTime();
  return Number.isFinite(time) ? time : 0;
}

export default function UserManagement() {
  const currentUser = useStore($currUser);
  const currentAdminId = currentUser?.id ?? 'super-admin';

  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedBalance, setSelectedBalance] = useState(0);
  const [initialCreditsConfig, setInitialCreditsConfig] = useState<number | ''>(50);
  const [operationAmount, setOperationAmount] = useState<number | ''>(10);
  const [operationReason, setOperationReason] = useState('Ajuste administrativo');
  const [setBalanceValue, setSetBalanceValue] = useState<number | ''>(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [requests, setRequests] = useState<CreditPurchaseRequest[]>([]);
  const [purchaseReceipts, setPurchaseReceipts] = useState<InAppPurchaseReceipt[]>([]);
  const [adConfig, setAdConfig] = useState<CreditAdRewardConfig>(getCreditAdRewardConfig());
  const [engagementRules, setEngagementRules] = useState<CreditEngagementRule[]>(
    listCreditEngagementRewardRules(),
  );
  const [engagementPerformanceRows, setEngagementPerformanceRows] = useState<
    CreditEngagementUserPerformance[]
  >([]);
  const [couponRows, setCouponRows] = useState<CreditCoupon[]>([]);
  const [couponRedemptions, setCouponRedemptions] = useState<CreditCouponRedemption[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [couponType, setCouponType] = useState<CreditCouponType>('percent');
  const [couponValue, setCouponValue] = useState<number | ''>(10);
  const [couponMaxRedemptions, setCouponMaxRedemptions] = useState<number | ''>('');
  const [couponExpiresAt, setCouponExpiresAt] = useState('');
  const [couponNotes, setCouponNotes] = useState('');
  const [transactionDateFrom, setTransactionDateFrom] = useState('');
  const [transactionDateTo, setTransactionDateTo] = useState('');
  const [transactionFlowFilter, setTransactionFlowFilter] =
    useState<TransactionFlowFilter>('all');
  const [userSearch, setUserSearch] = useState('');
  const [userBalanceFilter, setUserBalanceFilter] = useState<UserBalanceFilter>('all');
  const [requestStatusFilter, setRequestStatusFilter] =
    useState<RequestStatusFilter>('all');
  const [receiptUserFilter, setReceiptUserFilter] = useState('all');
  const [receiptTypeFilter, setReceiptTypeFilter] =
    useState<ReceiptTypeFilter>('all');
  const [receiptDateFrom, setReceiptDateFrom] = useState('');
  const [receiptDateTo, setReceiptDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('usuarios');

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const refresh = () => {
    const rows = listRegisteredUsers();
    setUsers(rows);
    if (selectedUserId && !rows.some((row) => row.id === selectedUserId)) {
      setSelectedUserId('');
      setSetBalanceValue(0);
    }
    setInitialCreditsConfig(getInitialCreditsAfterSignup());
    setRequests(listCreditPurchaseRequests().slice(0, 30));
    setPurchaseReceipts(listAllInAppPurchaseReceipts().slice(0, 300));
    setAdConfig(getCreditAdRewardConfig());
    setEngagementRules(listCreditEngagementRewardRules());
    setEngagementPerformanceRows(listCreditEngagementUsersPerformance().slice(0, 200));
    setCouponRows(listCreditCoupons());
    setCouponRedemptions(listCreditCouponRedemptions(50));
  };

  useEffect(() => {
    if (currentUser?.id && currentUser?.email) {
      registerAndEnsureUserCredits({
        id: currentUser.id,
        email: currentUser.email,
        name: String(currentUser.user_metadata?.name ?? ''),
      });
    }
    refresh();
    const onRegistryChanged = () => refresh();
    const onCreditsChanged = () => refresh();
    const onInAppPurchasesChanged = () => refresh();
    const onStorage = () => refresh();
    window.addEventListener(USERS_REGISTRY_UPDATED_EVENT, onRegistryChanged);
    window.addEventListener(CREDITS_UPDATED_EVENT, onCreditsChanged);
    window.addEventListener(IN_APP_PURCHASES_UPDATED_EVENT, onInAppPurchasesChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(USERS_REGISTRY_UPDATED_EVENT, onRegistryChanged);
      window.removeEventListener(CREDITS_UPDATED_EVENT, onCreditsChanged);
      window.removeEventListener(IN_APP_PURCHASES_UPDATED_EVENT, onInAppPurchasesChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedBalance(0);
      setTransactions([]);
      return;
    }
    setSelectedBalance(getUserCredits(selectedUserId));
    setTransactions(listCreditTransactionsForUser(selectedUserId).slice(0, 60));
  }, [selectedUserId, users, requests, couponRows]);

  const userRows = useMemo<UserRow[]>(
    () =>
      users.map((row) => ({
        ...row,
        balance: getUserCredits(row.id),
      })),
    [users, requests],
  );

  const filteredTransactions = useMemo(() => {
    const fromMs = transactionDateFrom ? new Date(`${transactionDateFrom}T00:00:00`).getTime() : 0;
    const toMs = transactionDateTo ? new Date(`${transactionDateTo}T23:59:59.999`).getTime() : 0;

    return transactions.filter((tx) => {
      const txTime = toTime(tx.created_at);
      if (fromMs && txTime < fromMs) return false;
      if (toMs && txTime > toMs) return false;

      if (transactionFlowFilter === 'entry') return tx.amount > 0;
      if (transactionFlowFilter === 'exit') return tx.amount < 0;
      return true;
    });
  }, [transactions, transactionDateFrom, transactionDateTo, transactionFlowFilter]);

  const userById = useMemo(
    () =>
      new Map(
        users.map((row) => [
          row.id,
          {
            name: row.name,
            email: row.email,
          },
        ]),
      ),
    [users],
  );

  const filteredUserRows = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();
    return userRows.filter((row) => {
      if (needle) {
        const haystack = `${row.name} ${row.email}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      if (userBalanceFilter === 'with_balance') return row.balance > 0;
      if (userBalanceFilter === 'zero_balance') return row.balance <= 0;
      return true;
    });
  }, [userRows, userSearch, userBalanceFilter]);

  const filteredRequests = useMemo(() => {
    if (requestStatusFilter === 'all') return requests;
    return requests.filter((row) => row.status === requestStatusFilter);
  }, [requests, requestStatusFilter]);

  const filteredReceipts = useMemo(() => {
    const fromMs = receiptDateFrom ? new Date(`${receiptDateFrom}T00:00:00`).getTime() : 0;
    const toMs = receiptDateTo ? new Date(`${receiptDateTo}T23:59:59.999`).getTime() : 0;

    return purchaseReceipts.filter((row) => {
      if (receiptUserFilter !== 'all' && row.user_id !== receiptUserFilter) return false;
      if (receiptTypeFilter !== 'all' && row.purchase_type !== receiptTypeFilter) return false;

      const rowTime = toTime(row.created_at);
      if (fromMs && rowTime < fromMs) return false;
      if (toMs && rowTime > toMs) return false;
      return true;
    });
  }, [purchaseReceipts, receiptUserFilter, receiptTypeFilter, receiptDateFrom, receiptDateTo]);

  const applyGrant = () => {
    if (!selectedUserId) return;
    const amount = Math.abs(Math.round(Number(operationAmount) || 0));
    if (amount <= 0) return;
    try {
      grantCreditsToUser(
        selectedUserId,
        amount,
        operationReason || 'Credito concedido pelo super usuario',
        currentAdminId,
      );
      notifications.show({
        title: 'Credito concedido',
        message: `${amount} creditos adicionados para o usuario.`,
        color: 'teal',
      });
      refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao conceder credito',
        message: String(error?.message ?? 'Nao foi possivel concluir a operacao.'),
        color: 'red',
      });
    }
  };

  const applyDebit = () => {
    if (!selectedUserId) return;
    const amount = Math.abs(Math.round(Number(operationAmount) || 0));
    if (amount <= 0) return;
    try {
      removeCreditsFromUser(
        selectedUserId,
        amount,
        operationReason || 'Debito aplicado pelo super usuario',
        currentAdminId,
      );
      notifications.show({
        title: 'Debito aplicado',
        message: `${amount} creditos removidos do usuario.`,
        color: 'yellow',
      });
      refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao remover credito',
        message: String(error?.message ?? 'Nao foi possivel concluir a operacao.'),
        color: 'red',
      });
    }
  };

  const applySetBalance = () => {
    if (!selectedUserId) return;
    try {
      setCreditsForUser(selectedUserId, Number(setBalanceValue) || 0, currentAdminId);
      notifications.show({
        title: 'Saldo ajustado',
        message: 'O saldo do usuario foi atualizado.',
        color: 'blue',
      });
      refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao ajustar saldo',
        message: String(error?.message ?? 'Nao foi possivel ajustar saldo.'),
        color: 'red',
      });
    }
  };

  const saveInitialCredits = () => {
    const next = Math.max(0, Math.round(Number(initialCreditsConfig) || 0));
    setInitialCreditsAfterSignup(next);
    notifications.show({
      title: 'Configuracao atualizada',
      message: `Novos usuarios receberao ${next} creditos iniciais.`,
      color: 'teal',
    });
    refresh();
  };

  const saveAdConfig = () => {
    const next = updateCreditAdRewardConfig({
      enabled: adConfig.enabled,
      credits_per_view: adConfig.credits_per_view,
      daily_limit_per_user: adConfig.daily_limit_per_user,
      cooldown_minutes: adConfig.cooldown_minutes,
    });
    setAdConfig(next);
    notifications.show({
      title: 'Recompensa por propaganda atualizada',
      message: 'As regras foram salvas para todos os usuarios.',
      color: 'teal',
    });
  };

  const handleEngagementRuleChange = (
    ruleId: CreditEngagementRuleId,
    patch: Partial<Pick<CreditEngagementRule, 'credits' | 'max_claims_per_user' | 'enabled'>>,
  ) => {
    setEngagementRules((prev) =>
      prev.map((row) =>
        row.id === ruleId
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );
  };

  const saveEngagementRules = () => {
    const saved = saveCreditEngagementRewardRules(engagementRules);
    setEngagementRules(saved);
    setEngagementPerformanceRows(listCreditEngagementUsersPerformance().slice(0, 200));
    notifications.show({
      title: 'Regras de conquista atualizadas',
      message: 'Limites e valores de recompensa foram salvos.',
      color: 'teal',
    });
  };

  const handleCreateCoupon = () => {
    try {
      const expiresAtIso = couponExpiresAt ? new Date(couponExpiresAt).toISOString() : null;
      if (couponExpiresAt && Number.isNaN(new Date(couponExpiresAt).getTime())) {
        throw new Error('Data de expiracao invalida.');
      }

      createCreditCoupon({
        code: couponCode,
        type: couponType,
        value: Number(couponValue) || 0,
        max_redemptions:
          couponMaxRedemptions === ''
            ? null
            : Math.max(1, Math.round(Number(couponMaxRedemptions) || 0)),
        expires_at: expiresAtIso,
        notes: couponNotes,
        created_by: currentAdminId,
      });

      setCouponCode('');
      setCouponValue(couponType === 'percent' ? 10 : 5);
      setCouponMaxRedemptions('');
      setCouponExpiresAt('');
      setCouponNotes('');
      notifications.show({
        title: 'Cupom criado',
        message: 'Cupom salvo e pronto para uso.',
        color: 'teal',
      });
      refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao criar cupom',
        message: String(error?.message ?? 'Nao foi possivel salvar o cupom.'),
        color: 'red',
      });
    }
  };

  const handleToggleCoupon = (coupon: CreditCoupon) => {
    try {
      setCreditCouponActive(coupon.id, !coupon.active);
      notifications.show({
        title: 'Cupom atualizado',
        message: `Cupom ${coupon.code} ${coupon.active ? 'desativado' : 'ativado'}.`,
        color: 'blue',
      });
      refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao atualizar cupom',
        message: String(error?.message ?? 'Nao foi possivel atualizar o cupom.'),
        color: 'red',
      });
    }
  };

  const handleRefund = (tx: CreditTransaction) => {
    if (!selectedUserId) return;
    try {
      refundCreditTransaction(selectedUserId, tx.id, currentAdminId);
      notifications.show({
        title: 'Ressarcimento concluido',
        message: 'O credito foi devolvido ao usuario.',
        color: 'teal',
      });
      refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Falha no ressarcimento',
        message: String(error?.message ?? 'Nao foi possivel ressarcir a transacao.'),
        color: 'red',
      });
    }
  };

  const handleReviewRequest = (request: CreditPurchaseRequest, approved: boolean) => {
    try {
      reviewCreditPurchaseRequest(
        request.id,
        approved,
        currentAdminId,
        approved ? 'Aprovado pelo super usuario' : 'Negado pelo super usuario',
      );
      notifications.show({
        title: approved ? 'Solicitacao aprovada' : 'Solicitacao negada',
        message: approved
          ? 'Creditos liberados para o usuario.'
          : 'Solicitacao marcada como negada.',
        color: approved ? 'teal' : 'yellow',
      });
      refresh();
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao revisar solicitacao',
        message: String(error?.message ?? 'Nao foi possivel revisar a solicitacao.'),
        color: 'red',
      });
    }
  };

  return (
    <Stack>
      <PageHeader title="Gestao de Usuarios e Creditos" color="yellow" />

      <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
        <Tabs.List grow>
          <Tabs.Tab value="usuarios">Usuarios</Tabs.Tab>
          <Tabs.Tab value="creditos">Creditos</Tabs.Tab>
          <Tabs.Tab value="compras">Compras</Tabs.Tab>
          <Tabs.Tab value="cupons">Cupons</Tabs.Tab>
          <Tabs.Tab value="regras">Regras</Tabs.Tab>
          <Tabs.Tab value="comprovantes">Comprovantes</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="usuarios" pt="md">
          <UsersTab
            rows={filteredUserRows}
            selectedUserId={selectedUserId}
            userSearch={userSearch}
            userBalanceFilter={userBalanceFilter}
            onUserSearchChange={setUserSearch}
            onUserBalanceFilterChange={setUserBalanceFilter}
            onSelectUser={(row) => {
              setSelectedUserId(row.id);
              setSetBalanceValue(row.balance);
              setActiveTab('creditos');
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="creditos" pt="md">
          <CreditsTab
            selectedUser={selectedUser}
            selectedBalance={selectedBalance}
            operationAmount={operationAmount}
            operationReason={operationReason}
            setBalanceValue={setBalanceValue}
            transactionDateFrom={transactionDateFrom}
            transactionDateTo={transactionDateTo}
            transactionFlowFilter={transactionFlowFilter}
            filteredTransactions={filteredTransactions}
            onOperationAmountChange={setOperationAmount}
            onOperationReasonChange={setOperationReason}
            onSetBalanceValueChange={setSetBalanceValue}
            onTransactionDateFromChange={setTransactionDateFrom}
            onTransactionDateToChange={setTransactionDateTo}
            onTransactionFlowFilterChange={setTransactionFlowFilter}
            onClearTransactionFilters={() => {
              setTransactionDateFrom('');
              setTransactionDateTo('');
              setTransactionFlowFilter('all');
            }}
            onGrant={applyGrant}
            onDebit={applyDebit}
            onApplySetBalance={applySetBalance}
            onRefund={handleRefund}
          />
        </Tabs.Panel>

        <Tabs.Panel value="compras" pt="md">
          <PurchasesTab
            requestStatusFilter={requestStatusFilter}
            rows={filteredRequests}
            userById={userById}
            onRequestStatusFilterChange={setRequestStatusFilter}
            onClearRequestFilters={() => setRequestStatusFilter('all')}
            onReviewRequest={handleReviewRequest}
            formatCreditPrice={formatCreditPrice}
          />
        </Tabs.Panel>

        <Tabs.Panel value="cupons" pt="md">
          <CouponsTab
            couponCode={couponCode}
            couponType={couponType}
            couponValue={couponValue}
            couponMaxRedemptions={couponMaxRedemptions}
            couponExpiresAt={couponExpiresAt}
            couponNotes={couponNotes}
            couponRows={couponRows}
            couponRedemptions={couponRedemptions}
            userById={userById}
            onCouponCodeChange={setCouponCode}
            onCouponTypeChange={setCouponType}
            onCouponValueChange={setCouponValue}
            onCouponMaxRedemptionsChange={setCouponMaxRedemptions}
            onCouponExpiresAtChange={setCouponExpiresAt}
            onCouponNotesChange={setCouponNotes}
            onCreateCoupon={handleCreateCoupon}
            onToggleCoupon={handleToggleCoupon}
            formatCreditPrice={formatCreditPrice}
          />
        </Tabs.Panel>

        <Tabs.Panel value="regras" pt="md">
          <RulesTab
            initialCreditsConfig={initialCreditsConfig}
            adConfig={adConfig}
            engagementRules={engagementRules}
            engagementPerformanceRows={engagementPerformanceRows}
            onInitialCreditsConfigChange={setInitialCreditsConfig}
            onSaveInitialCredits={saveInitialCredits}
            onAdConfigChange={setAdConfig}
            onSaveAdConfig={saveAdConfig}
            onEngagementRuleChange={handleEngagementRuleChange}
            onSaveEngagementRules={saveEngagementRules}
          />
        </Tabs.Panel>

        <Tabs.Panel value="comprovantes" pt="md">
          <ReceiptsTab
            users={users}
            receiptUserFilter={receiptUserFilter}
            receiptTypeFilter={receiptTypeFilter}
            receiptDateFrom={receiptDateFrom}
            receiptDateTo={receiptDateTo}
            filteredReceipts={filteredReceipts}
            userById={userById}
            onReceiptUserFilterChange={setReceiptUserFilter}
            onReceiptTypeFilterChange={setReceiptTypeFilter}
            onReceiptDateFromChange={setReceiptDateFrom}
            onReceiptDateToChange={setReceiptDateTo}
            onClearReceiptFilters={() => {
              setReceiptUserFilter('all');
              setReceiptTypeFilter('all');
              setReceiptDateFrom('');
              setReceiptDateTo('');
            }}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
