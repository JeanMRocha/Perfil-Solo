import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconChartBar,
  IconFlask,
  IconMap2,
  IconShieldCheck,
  IconTarget,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import './landing.css';

const features = [
  {
    title: 'Mapeamento por talhao',
    text: 'Organize propriedades e talhoes com visao historica pronta para decisao tecnica.',
    icon: IconMap2,
  },
  {
    title: 'Interpretacao automatica',
    text: 'Transforme laudos em alertas objetivos para calagem, gessagem e nutricao.',
    icon: IconFlask,
  },
  {
    title: 'Painel comercial',
    text: 'Mostre ganhos de produtividade com dados claros para clientes e parceiros.',
    icon: IconChartBar,
  },
];

const plans = [
  {
    name: 'Start',
    price: 'R$ 79',
    description: 'Para operacao individual em fase inicial.',
  },
  {
    name: 'Pro',
    price: 'R$ 199',
    description: 'Para consultorias com varios clientes e rotina intensa.',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Sob consulta',
    description: 'Para equipes com governanca, escala e suporte dedicado.',
  },
];

export default function Landing() {
  return (
    <Box className="landing-root">
      <div className="landing-glow landing-glow-top" />
      <div className="landing-glow landing-glow-bottom" />

      <Container size="lg" className="landing-shell">
        <Group justify="space-between" className="landing-nav">
          <Title order={3} className="brand-title">
            PerfilSolo
          </Title>

          <Group>
            <Button variant="subtle" component={Link} to="/auth">
              Entrar
            </Button>
            <Button component={Link} to="/auth/register" radius="xl">
              Testar agora
            </Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" className="hero-grid">
          <Stack className="hero-copy">
            <Badge radius="xl" size="lg" variant="light">
              Plataforma de analise de solo
            </Badge>
            <Title order={1} className="hero-title">
              Venda mais consultoria com um app que prova resultado.
            </Title>
            <Text className="hero-text">
              Do cadastro da amostra ao relatorio final, o PerfilSolo conecta
              campo, laboratorio e decisao tecnica em um fluxo unico.
            </Text>
            <Group>
              <Button size="md" radius="xl" component={Link} to="/auth/register">
                Criar conta
              </Button>
              <Button
                size="md"
                radius="xl"
                variant="outline"
                component={Link}
                to="/auth"
              >
                Ver demonstracao
              </Button>
            </Group>
          </Stack>

          <Card className="hero-demo" radius="lg" padding="xl">
            <Stack gap="md">
              <Text fw={700}>Demo rapida do fluxo</Text>
              <Group wrap="nowrap">
                <ThemeIcon variant="light" color="green">
                  <IconTarget size={16} />
                </ThemeIcon>
                <Text size="sm">1. Cadastrar propriedade e talhao</Text>
              </Group>
              <Group wrap="nowrap">
                <ThemeIcon variant="light" color="lime">
                  <IconFlask size={16} />
                </ThemeIcon>
                <Text size="sm">2. Importar laudo e gerar interpretacao</Text>
              </Group>
              <Group wrap="nowrap">
                <ThemeIcon variant="light" color="teal">
                  <IconShieldCheck size={16} />
                </ThemeIcon>
                <Text size="sm">3. Entregar relatorio tecnico ao cliente</Text>
              </Group>
            </Stack>
          </Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" className="features-grid">
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

        <Box className="plans-block">
          <Group justify="space-between" align="end" mb="md">
            <div>
              <Title order={2}>Planos para escalar sua operacao</Title>
              <Text c="dimmed">
                Estrutura de entrada simples com upgrade conforme sua carteira cresce.
              </Text>
            </div>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={plan.highlight ? 'plan-card plan-card-highlight' : 'plan-card'}
                radius="lg"
                p="lg"
              >
                <Text fw={700}>{plan.name}</Text>
                <Title order={3} mt="xs">
                  {plan.price}
                </Title>
                <Text size="sm" c="dimmed" mt={6}>
                  {plan.description}
                </Text>
                <Button
                  mt="lg"
                  fullWidth
                  variant={plan.highlight ? 'filled' : 'light'}
                  component={Link}
                  to="/auth/register"
                >
                  Escolher plano
                </Button>
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      </Container>
    </Box>
  );
}
