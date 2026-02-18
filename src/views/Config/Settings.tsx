import { Button, Container, Tabs, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { isLocalDataMode } from '../../services/dataProvider';
import { clearLocalDb } from '../../services/localDb';
import BillingSettings from './BillingSettings';
import CulturasSettings from './CulturasSettings';
import LaboratoriosSettings from './LaboratoriosSettings';

export default function Settings() {
  const [isResetting, setIsResetting] = useState(false);

  async function handleResetLocalDb() {
    if (!isLocalDataMode) return;

    const confirmed = window.confirm(
      'Isso vai apagar todos os dados locais (propriedades, talhoes, analises, regras de cultura e laboratorios). Deseja continuar?',
    );

    if (!confirmed) return;

    try {
      setIsResetting(true);
      await clearLocalDb();
      notifications.show({
        title: 'Banco local resetado',
        message: 'Os dados locais, culturas e laboratorios foram removidos com sucesso.',
        color: 'green',
      });
      window.location.reload();
    } catch (error) {
      notifications.show({
        title: 'Falha ao resetar',
        message: 'Nao foi possivel limpar o banco local. Tente novamente.',
        color: 'red',
      });
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <Container size="md" mt="xl">
      <PageHeader title="Configuracoes" />

      <Tabs defaultValue="billing" variant="outline" mt="md">
        <Tabs.List>
          <Tabs.Tab value="billing">Faturamento</Tabs.Tab>
          <Tabs.Tab value="culturas">Culturas</Tabs.Tab>
          <Tabs.Tab value="laboratorios">Laboratorios</Tabs.Tab>
          <Tabs.Tab value="general">Geral</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="billing" pt="md">
          <BillingSettings />
        </Tabs.Panel>

        <Tabs.Panel value="culturas" pt="md">
          <CulturasSettings />
        </Tabs.Panel>

        <Tabs.Panel value="laboratorios" pt="md">
          <LaboratoriosSettings />
        </Tabs.Panel>

        <Tabs.Panel value="general" pt="md">
          <Text c="dimmed" mb="sm">
            Ferramentas gerais em desenvolvimento.
          </Text>

          {isLocalDataMode ? (
            <Button
              color="red"
              loading={isResetting}
              onClick={handleResetLocalDb}
            >
              Resetar banco local
            </Button>
          ) : (
            <Text c="dimmed" size="sm">
              O reset local esta disponivel apenas no modo local.
            </Text>
          )}
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
