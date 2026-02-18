import { useEffect, useState } from 'react';
import {
  Card,
  Text,
  Group,
  Button,
  Badge,
  SimpleGrid,
  Title,
  Stack,
} from '@mantine/core';
import { useStore } from '@nanostores/react';
import { notifications } from '@mantine/notifications';
import { $currUser } from '../../global-state/user';
import { supabaseClient } from '../../supabase/supabaseClient';
import { dataProviderLabel, isLocalDataMode } from '../../services/dataProvider';

type ProfileBilling = {
  plan_id?: 'free' | 'pro' | 'enterprise';
  subscription_status?: string;
};

const LOCAL_BILLING_KEY = 'perfilsolo_local_billing';

const PUBLIC_PRICE_PRO =
  import.meta.env.VITE_STRIPE_PRICE_PRO ?? 'price_pro_id';
const PUBLIC_PRICE_ENTERPRISE =
  import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE ?? 'price_enterprise_id';

export default function BillingSettings() {
  const user = useStore($currUser);
  const [profile, setProfile] = useState<ProfileBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (isLocalDataMode) {
        const saved = localStorage.getItem(LOCAL_BILLING_KEY);
        const parsed = saved ? (JSON.parse(saved) as ProfileBilling) : null;
        setProfile(parsed ?? {
          plan_id: 'free',
          subscription_status: 'active',
        });
        setLoading(false);
        return;
      }

      if (!user?.id) {
        setLoading(false);
        return;
      }

      const { data } = await (supabaseClient as any)
        .from('profiles')
        .select('plan_id,subscription_status')
        .eq('id', user.id)
        .maybeSingle();

      setProfile(data ?? null);
      setLoading(false);
    };

    void loadProfile();
  }, [user?.id]);

  const plan = profile?.plan_id ?? user?.user_metadata?.plan_id ?? 'free';
  const status =
    profile?.subscription_status ??
    user?.user_metadata?.subscription_status ??
    'inactive';

  const handleSubscribe = async (priceId: string) => {
    if (isLocalDataMode) {
      const nextPlan: ProfileBilling['plan_id'] =
        priceId === PUBLIC_PRICE_ENTERPRISE ? 'enterprise' : 'pro';
      const localProfile: ProfileBilling = {
        plan_id: nextPlan,
        subscription_status: 'active',
      };
      localStorage.setItem(LOCAL_BILLING_KEY, JSON.stringify(localProfile));
      setProfile(localProfile);
      notifications.show({
        title: 'Modo local',
        message: `Plano ${String(nextPlan).toUpperCase()} aplicado localmente.`,
        color: 'teal',
      });
      return;
    }

    setCheckoutLoading(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        'create-checkout-session',
        {
          body: { priceId },
        },
      );

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      notifications.show({
        title: 'Checkout indisponivel',
        message: 'Nao foi possivel gerar a sessao de checkout.',
        color: 'red',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao iniciar checkout',
        message: err?.message ?? 'Erro inesperado ao abrir o Stripe.',
        color: 'red',
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <Card p="xl" radius="md" withBorder>
      <Stack gap="xs" mb="lg">
        <Title order={3}>Assinatura e Planos</Title>
        <Text size="xs" c="dimmed">
          Fonte de dados: {dataProviderLabel}
        </Text>
        {loading ? (
          <Text c="dimmed" size="sm">
            Carregando status da assinatura...
          </Text>
        ) : null}
      </Stack>

      <Group mb="xl">
        <Text fw={500}>Plano Atual:</Text>
        <Badge size="lg" color={plan === 'pro' ? 'blue' : 'gray'}>
          {String(plan).toUpperCase()}
        </Badge>
        <Badge variant="outline" color={status === 'active' ? 'green' : 'red'}>
          {String(status).toUpperCase()}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <Card withBorder p="md" radius="md">
          <Text fw={700} size="lg">
            Gratuito
          </Text>
          <Text c="dimmed" size="sm" mb="md">
            Para pequenos produtores
          </Text>
          <Text fw={700} size="xl" mb="md">
            R$ 0/mes
          </Text>
          <Button fullWidth variant="default" disabled={plan === 'free'}>
            {plan === 'free' ? 'Plano Atual' : 'Downgrade'}
          </Button>
        </Card>

        <Card
          withBorder
          p="md"
          radius="md"
          style={{ borderColor: '#228be6', borderWidth: 2 }}
        >
          <Text fw={700} size="lg" c="blue">
            Profissional
          </Text>
          <Text c="dimmed" size="sm" mb="md">
            Para consultores e agronomos
          </Text>
          <Text fw={700} size="xl" mb="md">
            R$ 49/mes
          </Text>
          <Button
            fullWidth
            loading={checkoutLoading}
            onClick={() => handleSubscribe(PUBLIC_PRICE_PRO)}
            disabled={plan === 'pro'}
          >
            {plan === 'pro' ? 'Plano Atual' : 'Assinar Pro'}
          </Button>
        </Card>

        <Card withBorder p="md" radius="md">
          <Text fw={700} size="lg" c="grape">
            Enterprise
          </Text>
          <Text c="dimmed" size="sm" mb="md">
            Para operacoes multi-fazenda
          </Text>
          <Text fw={700} size="xl" mb="md">
            Sob Consulta
          </Text>
          <Button
            fullWidth
            variant="light"
            color="grape"
            loading={checkoutLoading}
            onClick={() => handleSubscribe(PUBLIC_PRICE_ENTERPRISE)}
          >
            Falar com Vendas
          </Button>
        </Card>
      </SimpleGrid>
    </Card>
  );
}
