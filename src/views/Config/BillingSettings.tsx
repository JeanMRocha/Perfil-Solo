// src/views/Config/BillingSettings.tsx
import { Card, Text, Group, Button, Badge, SimpleGrid, Title } from '@mantine/core';
import { useStore } from '@nanostores/react';
import { $currUser } from '../../global-state/user';
import { supabaseClient } from '../../supabase/supabaseClient';

export default function BillingSettings() {
    const user = useStore($currUser);
    // @ts-ignore - Em um cenário real, esses dados viriam de um hook useProfile()
    const plan = user?.user_metadata?.plan_id || 'free';
    const status = user?.user_metadata?.subscription_status || 'inactive';

    const handleSubscribe = async (priceId: string) => {
        // Chama Edge Function para criar sessão de checkout
        const { data, error } = await supabaseClient.functions.invoke('create-checkout-session', {
            body: { priceId }
        });

        if (data?.url) {
            window.location.href = data.url;
        }
    };

    return (
        <Card p="xl" radius="md" withBorder>
            <Title order={3} mb="lg">Assinatura e Planos</Title>

            <Group mb="xl">
                <Text fw={500}>Plano Atual:</Text>
                <Badge size="lg" color={plan === 'pro' ? 'blue' : 'gray'}>
                    {plan.toUpperCase()}
                </Badge>
                <Badge variant="outline" color={status === 'active' ? 'green' : 'red'}>
                    {status.toUpperCase()}
                </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                {/* FREE PLAN */}
                <Card withBorder p="md" radius="md">
                    <Text fw={700} size="lg">Gratuito</Text>
                    <Text c="dimmed" size="sm" mb="md">Para pequenos produtores</Text>
                    <Text fw={700} size="xl" mb="md">R$ 0/mês</Text>
                    <Button fullWidth variant="default" disabled={plan === 'free'}>
                        {plan === 'free' ? 'Plano Atual' : 'Downgrade'}
                    </Button>
                </Card>

                {/* PRO PLAN */}
                <Card withBorder p="md" radius="md" style={{ borderColor: '#228be6', borderWidth: 2 }}>
                    <Text fw={700} size="lg" c="blue">Profissional</Text>
                    <Text c="dimmed" size="sm" mb="md">Para consultores e agrônomos</Text>
                    <Text fw={700} size="xl" mb="md">R$ 49/mês</Text>
                    <Button fullWidth onClick={() => handleSubscribe('price_pro_id')} disabled={plan === 'pro'}>
                        {plan === 'pro' ? 'Plano Atual' : 'Assinar Pro'}
                    </Button>
                </Card>

                {/* ENTERPRISE PLAN */}
                <Card withBorder p="md" radius="md">
                    <Text fw={700} size="lg" c="purple">Enterprise</Text>
                    <Text c="dimmed" size="sm" mb="md">Para grandes fazendas</Text>
                    <Text fw={700} size="xl" mb="md">Sob Consulta</Text>
                    <Button fullWidth variant="light" color="purple">
                        Falar com Vendas
                    </Button>
                </Card>
            </SimpleGrid>
        </Card>
    );
}
