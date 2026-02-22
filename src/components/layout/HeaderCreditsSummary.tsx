import {
  Group,
  RingProgress,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  type BillingQuoteLine,
} from '../../services/billingPlanService';
import type { BillingPlanId } from '../../modules/billing';
import {
  IconShield,
  IconShieldBolt,
  IconShieldCheck,
  IconShieldHalf,
  IconShieldStar,
  IconTrophy,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { getBrandPalette } from '../../mantine/brand';

type Props = {
  planLabel: string;
  billingPlanId: BillingPlanId;
  creditsNumber: number;
  purchasedCredits: number;
  earnedCredits: number;
  spentCredits: number;
  usageLines: BillingQuoteLine[];
  usageLoading: boolean;
  xpTotal: number;
  xpLevel: number;
  isDark: boolean;
  onOpenBilling: () => void;
  onOpenJourney: () => void;
};

type PlanVisual = {
  icon: ComponentType<{ size?: number }>;
  color: string;
  label: string;
};

function normalizePlan(planLabel: string): string {
  return String(planLabel ?? '').trim().toUpperCase();
}

function resolvePlanVisual(planLabel: string): PlanVisual {
  const normalized = normalizePlan(planLabel);

  if (normalized.includes('SUPER') || normalized.includes('ENTERPRISE')) {
    return { icon: IconShieldBolt, color: 'yellow', label: 'SUPER' };
  }
  if (normalized.includes('PREMIUM') || normalized.includes('PLUS')) {
    return { icon: IconShieldStar, color: 'violet', label: normalized || 'PLUS' };
  }
  if (normalized.includes('PRO')) {
    return { icon: IconShieldCheck, color: 'cyan', label: 'PRO' };
  }
  if (normalized.includes('FREE')) {
    return { icon: IconShield, color: 'gray', label: 'FREE' };
  }

  return {
    icon: IconShieldHalf,
    color: 'teal',
    label: normalized || 'PLANO',
  };
}

function normalizeAmount(value: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function formatCompact(value: number): string {
  const normalized = normalizeAmount(value);
  return new Intl.NumberFormat('pt-BR', {
    notation: normalized >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(normalized);
}

export default function HeaderCreditsSummary({
  planLabel,
  billingPlanId,
  creditsNumber,
  purchasedCredits,
  earnedCredits,
  spentCredits,
  usageLines,
  usageLoading,
  xpTotal,
  xpLevel,
  isDark,
  onOpenBilling,
  onOpenJourney,
}: Props) {
  const brandPalette = getBrandPalette(isDark ? 'dark' : 'light');
  const purchased = normalizeAmount(purchasedCredits);
  const earned = normalizeAmount(earnedCredits);
  const spent = normalizeAmount(spentCredits);
  const currentBalance = normalizeAmount(creditsNumber);
  const totalIn = purchased + earned;
  const totalFlow = totalIn + spent;
  const plan = resolvePlanVisual(planLabel);
  const PlanIcon = plan.icon;
  const normalizedXp = normalizeAmount(xpTotal);
  const normalizedLevel = Math.max(1, normalizeAmount(xpLevel));
  const supportsPaidExtras = billingPlanId === 'premium';
  const totalInPercent =
    totalFlow > 0 ? Math.round((totalIn / totalFlow) * 100) : 0;
  const ringSections =
    totalFlow > 0
      ? [
          {
            value: (purchased / totalFlow) * 100,
            color: brandPalette.credits.ringPurchased,
          },
          {
            value: (earned / totalFlow) * 100,
            color: brandPalette.credits.ringPromotional,
          },
          {
            value: (spent / totalFlow) * 100,
            color: brandPalette.credits.ringConsumed,
          },
        ].filter((section) => section.value > 0)
      : [{ value: 100, color: brandPalette.credits.ringIdle }];

  return (
    <Group gap={6} wrap="nowrap" align="center">
      <Tooltip
        withArrow
        position="bottom-end"
        openDelay={120}
        multiline
        label={
          <Stack gap={2}>
            <Text size="xs" fw={700}>
              Plano {plan.label}
            </Text>
            <Text size="xs">Saldo: {formatCompact(currentBalance)}</Text>
            <Text size="xs" style={{ color: brandPalette.credits.textPurchased }}>
              + Comprado {formatCompact(purchased)}
            </Text>
            <Text size="xs" style={{ color: brandPalette.credits.textPromotional }}>
              + Promocional {formatCompact(earned)}
            </Text>
            <Text size="xs" style={{ color: brandPalette.credits.textConsumed }}>
              - Consumido {formatCompact(spent)}
            </Text>
            <Text size="xs" style={{ color: brandPalette.credits.textMuted }}>
              Entrada {totalInPercent}% do fluxo
            </Text>
            {usageLoading ? (
              <Text size="xs" style={{ color: brandPalette.credits.textMuted }}>
                Atualizando consumo de recursos...
              </Text>
            ) : usageLines.length > 0 ? (
              usageLines.map((line) => {
                const baseLimit = Math.max(0, normalizeAmount(line.included_units));
                const used = Math.max(0, normalizeAmount(line.used_units));
                const extras = Math.max(0, normalizeAmount(line.extra_units));
                const displayLimit = supportsPaidExtras ? baseLimit + extras : baseLimit;
                const baseText = `${line.label}: ${used}/${displayLimit}`;
                const note = supportsPaidExtras
                  ? extras > 0
                    ? ` (+${extras} extras)`
                    : ''
                  : extras > 0
                    ? ` (+${extras} acima do limite Free)`
                    : '';
                return (
                  <Text key={`usage:${line.feature_id}`} size="xs">
                    {baseText}
                    {note}
                  </Text>
                );
              })
            ) : (
              <Text size="xs" style={{ color: brandPalette.credits.textMuted }}>
                Sem leitura de consumo no momento.
              </Text>
            )}
            <Text size="xs" style={{ color: brandPalette.credits.textMuted }}>
              Clique para abrir planos, creditos e cupons.
            </Text>
          </Stack>
        }
      >
        <UnstyledButton
          onClick={onOpenBilling}
          aria-label="Abrir plano, créditos e cupons"
          style={{
            borderRadius: 999,
            lineHeight: 0,
            transition: 'transform 0.15s ease',
          }}
        >
          <RingProgress
            size={42}
            thickness={6}
            roundCaps
            sections={ringSections}
            label={
              <Group justify="center">
                <ThemeIcon
                  size={24}
                  radius="xl"
                  color={plan.color}
                  variant={isDark ? 'light' : 'filled'}
                  styles={{
                    root: {
                      boxShadow: isDark
                        ? '0 6px 14px rgba(0, 0, 0, 0.38)'
                        : '0 6px 14px rgba(2, 132, 199, 0.22)',
                    },
                  }}
                >
                  <PlanIcon size={14} />
                </ThemeIcon>
              </Group>
            }
          />
        </UnstyledButton>
      </Tooltip>

      <Tooltip
        withArrow
        position="bottom-end"
        openDelay={120}
        multiline
        label={
          <Stack gap={2}>
            <Text size="xs" fw={700}>
              Jornada XP
            </Text>
            <Text size="xs">Nivel: {normalizedLevel}</Text>
            <Text size="xs">XP total: {formatCompact(normalizedXp)}</Text>
            <Text size="xs" style={{ color: brandPalette.credits.textMuted }}>
              Clique para abrir a trilha de niveis e badges.
            </Text>
          </Stack>
        }
      >
        <UnstyledButton
          onClick={onOpenJourney}
          aria-label="Abrir jornada de XP"
          style={{
            borderRadius: 999,
            transition: 'transform 0.15s ease',
          }}
        >
          <Group
            gap={6}
            wrap="nowrap"
            style={{
              border: `1px solid ${brandPalette.header.border}`,
              background: isDark ? 'rgba(13, 17, 23, 0.7)' : 'rgba(255, 255, 255, 0.75)',
              borderRadius: 999,
              padding: '3px 8px 3px 4px',
            }}
          >
            <ThemeIcon
              size={24}
              radius="xl"
              color="yellow"
              variant={isDark ? 'light' : 'filled'}
            >
              <IconTrophy size={14} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text size="10px" fw={700} lh={1.1}>
                NIVEL {normalizedLevel}
              </Text>
              <Text size="10px" c={brandPalette.credits.textMuted} lh={1.1}>
                XP {formatCompact(normalizedXp)}
              </Text>
            </Stack>
          </Group>
        </UnstyledButton>
      </Tooltip>
    </Group>
  );
}
