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

export type TransactionFlowFilter = 'all' | 'entry' | 'exit';
export type UserBalanceFilter = 'all' | 'with_balance' | 'zero_balance';
export type RequestStatusFilter = 'all' | CreditPurchaseRequest['status'];
export type ReceiptTypeFilter = 'all' | InAppPurchaseReceipt['purchase_type'];

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
