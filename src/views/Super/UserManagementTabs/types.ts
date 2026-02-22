import type {
  CreditAdRewardConfig,
  CreditCoupon,
  CreditCouponRedemption,
  CreditCouponType,
  CreditEngagementRule,
  CreditEngagementRuleId,
  CreditEngagementUserPerformance,
  CreditPurchaseRequest,
  CreditTransaction,
} from '../../../services/creditsService';
import type { InAppPurchaseReceipt } from '../../../services/inAppPurchasesService';
import type { RegisteredUser } from '../../../services/usersRegistryService';
import type { BillingPlanId } from '../../../modules/billing';
import type {
  BillingLedgerEntry,
  BillingLedgerEntryType,
  BillingStats,
} from '../../../services/billingPlanService';
import type { BillingCatalogConfig } from '../../../services/billingCatalogService';

export type TransactionFlowFilter = 'all' | 'entry' | 'exit';
export type UserBalanceFilter = 'all' | 'with_balance' | 'zero_balance';
export type RequestStatusFilter = 'all' | CreditPurchaseRequest['status'];
export type ReceiptTypeFilter = 'all' | InAppPurchaseReceipt['purchase_type'];
export type BillingLedgerTypeFilter = 'all' | BillingLedgerEntryType;

export interface UserRow {
  id: string;
  name: string;
  email: string;
  balance: number;
}

export interface UsersTabProps {
  rows: UserRow[];
  selectedUserId: string;
  userSearch: string;
  userBalanceFilter: UserBalanceFilter;
  onUserSearchChange: (value: string) => void;
  onUserBalanceFilterChange: (value: UserBalanceFilter) => void;
  onSelectUser: (row: UserRow) => void;
}

export interface CreditsTabProps {
  selectedUser: RegisteredUser | null;
  selectedBalance: number;
  operationAmount: number | '';
  operationReason: string;
  setBalanceValue: number | '';
  transactionDateFrom: string;
  transactionDateTo: string;
  transactionFlowFilter: TransactionFlowFilter;
  filteredTransactions: CreditTransaction[];
  onOperationAmountChange: (value: number | '') => void;
  onOperationReasonChange: (value: string) => void;
  onSetBalanceValueChange: (value: number | '') => void;
  onTransactionDateFromChange: (value: string) => void;
  onTransactionDateToChange: (value: string) => void;
  onTransactionFlowFilterChange: (value: TransactionFlowFilter) => void;
  onClearTransactionFilters: () => void;
  onGrant: () => void;
  onDebit: () => void;
  onApplySetBalance: () => void;
  onRefund: (tx: CreditTransaction) => void;
}

export interface PurchasesTabProps {
  requestStatusFilter: RequestStatusFilter;
  rows: CreditPurchaseRequest[];
  userById: Map<string, { name: string; email: string }>;
  onRequestStatusFilterChange: (value: RequestStatusFilter) => void;
  onClearRequestFilters: () => void;
  onReviewRequest: (row: CreditPurchaseRequest, approved: boolean) => void;
  formatCreditPrice: (cents: number) => string;
}

export interface CouponsTabProps {
  couponCode: string;
  couponType: CreditCouponType;
  couponValue: number | '';
  couponMaxRedemptions: number | '';
  couponExpiresAt: string;
  couponNotes: string;
  couponRows: CreditCoupon[];
  couponRedemptions: CreditCouponRedemption[];
  userById: Map<string, { name: string; email: string }>;
  onCouponCodeChange: (value: string) => void;
  onCouponTypeChange: (value: CreditCouponType) => void;
  onCouponValueChange: (value: number | '') => void;
  onCouponMaxRedemptionsChange: (value: number | '') => void;
  onCouponExpiresAtChange: (value: string) => void;
  onCouponNotesChange: (value: string) => void;
  onCreateCoupon: () => void;
  onToggleCoupon: (coupon: CreditCoupon) => void;
  formatCreditPrice: (cents: number) => string;
}

export interface RulesTabProps {
  initialCreditsConfig: number | '';
  adConfig: CreditAdRewardConfig;
  engagementRules: CreditEngagementRule[];
  engagementPerformanceRows: CreditEngagementUserPerformance[];
  onInitialCreditsConfigChange: (value: number | '') => void;
  onSaveInitialCredits: () => void;
  onAdConfigChange: (value: CreditAdRewardConfig) => void;
  onSaveAdConfig: () => void;
  onEngagementRuleChange: (
    ruleId: CreditEngagementRuleId,
    patch: Partial<Pick<CreditEngagementRule, 'credits' | 'max_claims_per_user' | 'enabled'>>,
  ) => void;
  onSaveEngagementRules: () => void;
}

export interface ReceiptsTabProps {
  users: RegisteredUser[];
  receiptUserFilter: string;
  receiptTypeFilter: ReceiptTypeFilter;
  receiptDateFrom: string;
  receiptDateTo: string;
  filteredReceipts: InAppPurchaseReceipt[];
  userById: Map<string, { name: string; email: string }>;
  onReceiptUserFilterChange: (value: string) => void;
  onReceiptTypeFilterChange: (value: ReceiptTypeFilter) => void;
  onReceiptDateFromChange: (value: string) => void;
  onReceiptDateToChange: (value: string) => void;
  onClearReceiptFilters: () => void;
}

export interface MonetizationTabProps {
  users: RegisteredUser[];
  selectedUserId: string;
  selectedPlanId: BillingPlanId;
  topupReais: number | '';
  stats: BillingStats;
  rows: BillingLedgerEntry[];
  userById: Map<string, { name: string; email: string }>;
  userFilter: string;
  typeFilter: BillingLedgerTypeFilter;
  dateFrom: string;
  dateTo: string;
  onSelectedUserChange: (value: string) => void;
  onSelectedPlanChange: (value: BillingPlanId) => void;
  onTopupReaisChange: (value: number | '') => void;
  onUserFilterChange: (value: string) => void;
  onTypeFilterChange: (value: BillingLedgerTypeFilter) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClearFilters: () => void;
  onApplyPlan: () => void;
  onGenerateInvoice: () => void;
  onTopupCredits: () => void;
  onRefund: (row: BillingLedgerEntry) => void;
  catalogConfig: BillingCatalogConfig;
  onCatalogPlanBasePriceChange: (planId: BillingPlanId, value: number | '') => void;
  onCatalogFeatureChange: (
    featureId: 'properties' | 'talhoes' | 'analises',
    patch: {
      included_free?: number | '';
      included_premium?: number | '';
      extra_unit_price_cents?: number | '';
    },
  ) => void;
  onSaveCatalogConfig: () => void;
  onResetCatalogConfig: () => void;
  formatMoney: (cents: number) => string;
}
