// src/types/auth.ts

export type UserRole = 'admin' | 'consultant' | 'farmer';

export type PlanType = 'free' | 'pro' | 'enterprise';

export interface UserSubscription {
    plan_id: PlanType;
    status: 'active' | 'past_due' | 'canceled' | 'incomplete';
    current_period_end: string;
    cancel_at_period_end: boolean;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
}

export interface UserProfile {
    id: string;
    email: string;
    full_name?: string;
    role: UserRole;
    plan_id?: PlanType;
    subscription_status?: string;
    subscription?: UserSubscription;
    plan_usage?: {
        pdf_imports_count: number;
        analysis_count: number;
        credits_remaining: number;
    };
    created_at: string;
}
