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
  IconShield,
  IconShieldBolt,
  IconShieldCheck,
  IconShieldHalf,
  IconShieldStar,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { getBrandPalette } from '../../mantine/brand';

type Props = {
  planLabel: string;
  creditsNumber: number;
  purchasedCredits: number;
  earnedCredits: number;
  spentCredits: number;
  isDark: boolean;
  onOpenBilling: () => void;
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
  creditsNumber,
  purchasedCredits,
  earnedCredits,
  spentCredits,
  isDark,
  onOpenBilling,
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
            <Text size="xs" style={{ color: brandPalette.credits.textMuted }}>
              Clique para abrir planos, creditos e cupons.
            </Text>
          </Stack>
        }
      >
        <UnstyledButton
          onClick={onOpenBilling}
          aria-label="Abrir plano, creditos e cupons"
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
    </Group>
  );
}
