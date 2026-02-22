import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  NumberInput,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowRight,
  IconChartBar,
  IconCoin,
  IconFlask,
  IconMap2,
  IconRocket,
  IconReceipt2,
  IconShieldCheck,
  IconSparkles,
  IconTarget,
  IconTrophy,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type BillingFeatureDefinition,
  type BillingPlanDefinition,
  CREDIT_MONEY_CONVERSION,
} from '../../modules/billing';
import {
  getBillingFeaturesWithCatalog,
  getBillingFreeFeaturesFromCatalog,
  getBillingPlansWithCatalog,
  subscribeBillingCatalog,
} from '../../services/billingCatalogService';
import { calculateBillingQuote } from '../../services/billingPlanService';
import {
  getSystemBrand,
  subscribeSystemConfig,
} from '../../services/systemConfigService';
import './landing.css';

const features = [
  {
    title: 'Operação por propriedade e talhão',
    text: 'Estruture a fazenda por propriedade e talhão com histórico tecnico pronto para decisao.',
    icon: IconMap2,
  },
  {
    title: 'Análise de solo aplicada',
    text: 'Conecte coleta, laboratorio e interpretacao com fluxo unico de cadastro e acompanhamento.',
    icon: IconFlask,
  },
  {
    title: 'Monetizacao e créditos',
    text: 'Funcionalidades pagas em dinheiro. Créditos ficam na carteira cosmetica do app.',
    icon: IconCoin,
  },
  {
    title: 'Governanca do super usuário',
    text: 'Painel com histórico de compras, estornos, regras e estatisticas detalhadas.',
    icon: IconChartBar,
  },
];

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function pluralize(unit: string, value: number): string {
  return value === 1 ? unit : `${unit}s`;
}

function normalizeWhole(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

export default function Landing() {
  const [systemName, setSystemName] = useState(() => getSystemBrand().name);
  const [plans, setPlans] = useState<BillingPlanDefinition[]>(() =>
    getBillingPlansWithCatalog(),
  );
  const [billingFeatures, setBillingFeatures] = useState<BillingFeatureDefinition[]>(() =>
    getBillingFeaturesWithCatalog(),
  );
  const [freeFeatures, setFreeFeatures] = useState<string[]>(() =>
    getBillingFreeFeaturesFromCatalog(),
  );
  const [simulatedUsage, setSimulatedUsage] = useState({
    properties: 6,
    talhoes: 55,
    analises: 520,
  });

  const premiumQuote = useMemo(
    () =>
      calculateBillingQuote('premium', {
        ...simulatedUsage,
        captured_at: new Date().toISOString(),
      }),
    [billingFeatures, plans, simulatedUsage],
  );
  const premiumPlan = plans.find((plan) => plan.id === 'premium') ?? plans[0];
  const freePlan = plans.find((plan) => plan.id === 'free');
  const exceedsFreeLimits = billingFeatures.some((feature) => {
    const used =
      feature.id === 'properties'
        ? simulatedUsage.properties
        : feature.id === 'talhoes'
          ? simulatedUsage.talhoes
          : simulatedUsage.analises;
    return used > feature.included_by_plan.free;
  });

  useEffect(() => {
    const unsubscribe = subscribeSystemConfig((config) => {
      setSystemName(config.brand.name);
    });
    const unsubscribeCatalog = subscribeBillingCatalog(() => {
      setPlans(getBillingPlansWithCatalog());
      setBillingFeatures(getBillingFeaturesWithCatalog());
      setFreeFeatures(getBillingFreeFeaturesFromCatalog());
    });
    return () => {
      unsubscribe();
      unsubscribeCatalog();
    };
  }, []);

  return (
    <Box className="landing-root">
      <div className="landing-glow landing-glow-top" />
      <div className="landing-glow landing-glow-bottom" />

      <Container size="lg" className="landing-shell">
        <Group justify="space-between" className="landing-nav">
          <Title order={3} className="brand-title">
            {systemName}
          </Title>

          <Group>
            <Button variant="subtle" component={Link} to="/auth">
              Entrar
            </Button>
            <Button component={Link} to="/auth/register" radius="xl">
              Comecar gratis
            </Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" className="hero-grid">
          <Stack className="hero-copy">
            <Badge radius="xl" size="lg" variant="light">
              Plataforma de analise de solo com plano flexivel por uso
            </Badge>
            <Title order={1} className="hero-title">
              Reduza planilha, ganhe velocidade e cresca com previsibilidade.
            </Title>
            <Text className="hero-text">
              O {systemName} conecta operacao de campo, analise de solo e
              faturamento no mesmo fluxo. Voce entra no Free, testa na pratica
              e escala para o Premium quando o volume aumentar.
            </Text>
            <Group gap={8} className="hero-badges">
              <Badge variant="dot" color="green">
                Comece no Free
              </Badge>
              <Badge variant="dot" color="teal">
                Premium base {formatMoney(premiumPlan.base_price_cents)}/mes
              </Badge>
              <Badge variant="dot" color="cyan">
                Sem limite fixo de crescimento
              </Badge>
            </Group>
            <Group className="hero-cta-group">
              <Button
                size="md"
                radius="xl"
                component={Link}
                to="/auth/register"
                rightSection={<IconArrowRight size={16} />}
              >
                Criar conta gratis
              </Button>
              <Button
                size="md"
                radius="xl"
                variant="outline"
                component={Link}
                to="/auth"
              >
                Entrar e testar demo
              </Button>
            </Group>
            <Text size="xs" className="hero-cta-note">
              Sem contrato complexo: voce usa, mede e ajusta o plano com base no seu ritmo.
            </Text>
          </Stack>

          <Card className="hero-demo" radius="lg" padding="xl">
            <Stack gap="md">
              <Group justify="space-between" align="center" className="hero-scene">
                <div className="hero-scene-badge">
                  <img src="/icons/android-chrome-192x192.png" alt="PerfilSolo" />
                </div>
                <div className="hero-scene-badge hero-scene-badge-alt">
                  <img src="/icon.png" alt="Mascote PerfilSolo" />
                </div>
              </Group>
              <Text fw={700}>Fluxo real em 3 passos</Text>
              <Group wrap="nowrap">
                <ThemeIcon variant="light" color="green">
                  <IconTarget size={16} />
                </ThemeIcon>
                <Text size="sm">1. Cadastre propriedade e talhao em poucos cliques</Text>
              </Group>
              <Group wrap="nowrap">
                <ThemeIcon variant="light" color="lime">
                  <IconFlask size={16} />
                </ThemeIcon>
                <Text size="sm">2. Registre analises e acompanhe historico tecnico</Text>
              </Group>
              <Group wrap="nowrap">
                <ThemeIcon variant="light" color="teal">
                  <IconReceipt2 size={16} />
                </ThemeIcon>
                <Text size="sm">3. Controle mensalidade por uso e creditos no mesmo painel</Text>
              </Group>
              <Divider my={4} />
              <Group wrap="nowrap">
                <ThemeIcon variant="light" color="cyan">
                  <IconShieldCheck size={16} />
                </ThemeIcon>
                <Text size="sm">
                  Dono do sistema com governanca completa de compras, estornos e receita
                </Text>
              </Group>
            </Stack>
          </Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md" className="features-grid">
          {features.map(({ title, text, icon: Icon }) => (
            <Card key={title} className="feature-card" radius="lg" p="lg">
              <ThemeIcon size="lg" radius="xl" variant="light" color="green">
                <Icon size={18} />
              </ThemeIcon>
              <Text fw={700} mt="sm">
                {title}
              </Text>
              <Text size="sm" c="dimmed" mt={6}>
                {text}
              </Text>
            </Card>
          ))}
        </SimpleGrid>

        <Card className="game-strip" radius="lg" p="lg">
          <Group justify="space-between" align="end" mb="sm" className="game-strip-header">
            <div>
              <Text fw={800} size="lg">
                Jornada gamificada da operacao
              </Text>
              <Text size="sm" c="dimmed">
                Cada etapa concluida vira historico tecnico, performance e previsibilidade de custo.
              </Text>
            </div>
            <Badge color="yellow" variant="light" leftSection={<IconTrophy size={12} />}>
              Missao ativa
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            <Card className="quest-card" radius="md" p="md">
              <Group justify="space-between">
                <Group gap={8}>
                  <ThemeIcon color="green" variant="light">
                    <IconMap2 size={16} />
                  </ThemeIcon>
                  <Text fw={700} size="sm">
                    Missao 1
                  </Text>
                </Group>
                <Badge color="green" variant="light">
                  +20 XP
                </Badge>
              </Group>
              <Text size="sm" mt={8}>
                Mapear propriedades e talhoes.
              </Text>
              <Progress value={76} size="sm" radius="xl" mt="sm" color="green" />
            </Card>

            <Card className="quest-card" radius="md" p="md">
              <Group justify="space-between">
                <Group gap={8}>
                  <ThemeIcon color="lime" variant="light">
                    <IconFlask size={16} />
                  </ThemeIcon>
                  <Text fw={700} size="sm">
                    Missao 2
                  </Text>
                </Group>
                <Badge color="lime" variant="light">
                  +35 XP
                </Badge>
              </Group>
              <Text size="sm" mt={8}>
                Consolidar analises e diagnosticos.
              </Text>
              <Progress value={58} size="sm" radius="xl" mt="sm" color="lime" />
            </Card>

            <Card className="quest-card" radius="md" p="md">
              <Group justify="space-between">
                <Group gap={8}>
                  <ThemeIcon color="teal" variant="light">
                    <IconRocket size={16} />
                  </ThemeIcon>
                  <Text fw={700} size="sm">
                    Missao 3
                  </Text>
                </Group>
                <Badge color="teal" variant="light">
                  Bonus
                </Badge>
              </Group>
              <Text size="sm" mt={8}>
                Ativar Premium para escalar com extras.
              </Text>
              <Progress value={42} size="sm" radius="xl" mt="sm" color="teal" />
            </Card>
          </SimpleGrid>
          <Group justify="space-between" mt="sm" gap="sm">
            <Text size="sm" c="dimmed">
              Ganhe ritmo operacional: cadastros, analises e gestao financeira no mesmo mapa de execucao.
            </Text>
            <Badge color="cyan" variant="dot" leftSection={<IconSparkles size={12} />}>
              Progressao visual
            </Badge>
          </Group>
        </Card>

        <Card className="cta-strip" radius="lg" p="lg">
          <Group justify="space-between" align="center" className="cta-strip-inner">
            <Stack gap={4}>
              <Text fw={800} size="lg">
                Comece hoje no Free e evolua para o Premium quando fizer sentido.
              </Text>
              <Text c="dimmed" size="sm">
                O plano acompanha o tamanho da sua operacao sem travar seu crescimento.
              </Text>
            </Stack>
            <Group>
              <Button radius="xl" component={Link} to="/auth/register">
                Comecar agora
              </Button>
              <Button radius="xl" variant="light" component={Link} to="/auth">
                Ver painel
              </Button>
            </Group>
          </Group>
        </Card>

        <Box className="plans-block">
          <Group justify="space-between" align="end" mb="md">
            <div>
              <Title order={2}>Planos reais do sistema</Title>
              <Text c="dimmed">
                Modelo atual com Free e Premium base + adicionais por uso.
              </Text>
            </div>
            <Badge color="teal" variant="light">
              1 real = {CREDIT_MONEY_CONVERSION.brl_to_credits_ratio} creditos
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={plan.id === 'premium' ? 'plan-card plan-card-highlight' : 'plan-card'}
                radius="lg"
                p="lg"
              >
                <Text fw={700}>{plan.label}</Text>
                <Title order={3} mt="xs">
                  {formatMoney(plan.base_price_cents)}/mes
                </Title>
                <Text size="sm" c="dimmed" mt={6}>
                  {plan.description}
                </Text>
                <Stack gap={4} mt="md">
                  {billingFeatures.map((feature) => {
                    const included = feature.included_by_plan[plan.id];
                    return (
                      <Text key={`${plan.id}:${feature.id}`} size="sm">
                        {feature.label}: {included}{' '}
                        {pluralize(feature.unit_label, included)} inclusos
                      </Text>
                    );
                  })}
                </Stack>
                <Button
                  mt="lg"
                  fullWidth
                  variant={plan.id === 'premium' ? 'filled' : 'light'}
                  component={Link}
                  to="/auth/register"
                >
                  Escolher plano
                </Button>
              </Card>
            ))}
          </SimpleGrid>

          <Card className="pricing-meta" withBorder mt="md" radius="lg" p="lg">
            <Text fw={700}>Adicionais por uso</Text>
            <SimpleGrid cols={{ base: 1, md: 3 }} mt="sm">
              {billingFeatures.map((feature) => (
                <Text key={`extra:${feature.id}`} size="sm">
                  {feature.label}: {formatMoney(feature.extra_unit_price_cents)} por{' '}
                  {feature.unit_label} extra
                </Text>
              ))}
            </SimpleGrid>
          </Card>

          <Card className="simulator-card" withBorder mt="md" radius="lg" p="lg">
            <Group justify="space-between" align="end" mb="sm">
              <div>
                <Text fw={700}>Calculadora Premium com extras</Text>
                <Text size="sm" c="dimmed">
                  Extras sao contratados apenas no Premium. No Free voce usa apenas a franquia base.
                </Text>
              </div>
              <Badge color="teal" variant="light">
                Extras somente no Premium
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
              <NumberInput
                label="Propriedades"
                min={0}
                step={1}
                value={simulatedUsage.properties}
                onChange={(value) =>
                  setSimulatedUsage((prev) => ({
                    ...prev,
                    properties: normalizeWhole(value),
                  }))
                }
              />
              <NumberInput
                label="Talhões"
                min={0}
                step={1}
                value={simulatedUsage.talhoes}
                onChange={(value) =>
                  setSimulatedUsage((prev) => ({
                    ...prev,
                    talhoes: normalizeWhole(value),
                  }))
                }
              />
              <NumberInput
                label="Análises de Solo"
                min={0}
                step={10}
                value={simulatedUsage.analises}
                onChange={(value) =>
                  setSimulatedUsage((prev) => ({
                    ...prev,
                    analises: normalizeWhole(value),
                  }))
                }
              />
            </SimpleGrid>

            <Card className="simulator-quote simulator-quote-highlight" radius="md" p="md" mt="md">
              <Text size="sm" c="dimmed">
                Estimativa mensal no Premium
              </Text>
              <Title order={3}>{formatMoney(premiumQuote.total_monthly_cents)}/mes</Title>
              <Text size="xs" c="dimmed" mt={6}>
                Base {formatMoney(premiumQuote.base_price_cents)} + extras{' '}
                {formatMoney(premiumQuote.total_extra_cents)}
              </Text>
              <Stack gap={4} mt="sm">
                {premiumQuote.lines.map((line) => (
                  <Text key={`premium-extra:${line.feature_id}`} size="xs" c="dimmed">
                    {line.label}: {line.extra_units} extras x {formatMoney(line.unit_price_cents)} ={' '}
                    {formatMoney(line.total_extra_cents)}
                  </Text>
                ))}
              </Stack>
            </Card>

            <Group justify="space-between" mt="md" gap="sm" className="simulator-footer">
              <Text size="sm">
                {freePlan
                  ? `No ${freePlan.label} voce possui ate ${billingFeatures
                      .map(
                        (feature) =>
                          `${feature.included_by_plan.free} ${pluralize(
                            feature.unit_label,
                            feature.included_by_plan.free,
                          )}`,
                      )
                      .join(', ')} sem extras contrataveis.`
                  : 'No Free voce possui franquia base sem extras contrataveis.'}
                {exceedsFreeLimits
                  ? ' Para esse volume, ative o Premium para contratar adicionais.'
                  : ' Enquanto estiver dentro da franquia, o Free atende sem cobranca mensal.'}
              </Text>
              <Button component={Link} to="/auth/register" radius="xl">
                Criar conta e ativar Premium
              </Button>
            </Group>
          </Card>

          <Card className="free-modules-block" withBorder mt="md" radius="lg" p="lg">
            <Text fw={700}>Modulos gratuitos no momento</Text>
            <SimpleGrid cols={{ base: 1, md: 2 }} mt="sm">
              {freeFeatures.map((item) => (
                <Text key={`free:${item}`} size="sm">
                  {item}
                </Text>
              ))}
            </SimpleGrid>
            <Text size="xs" c="dimmed" mt="sm">
              Futuro: recomendacoes IA e calculos avancados poderao ter precificacao propria.
            </Text>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}
