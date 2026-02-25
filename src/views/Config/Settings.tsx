import { useState } from 'react';
import { notify } from 'lib/notify';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Button } from '@components/ui/button';
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
      'Isso vai apagar todos os dados locais (propriedades, talhões, análises, regras de cultura e laboratorios). Deseja continuar?',
    );

    if (!confirmed) return;

    try {
      setIsResetting(true);
      await clearLocalDb();
      notify.show({
        title: 'Banco local resetado',
        message: 'Os dados locais, culturas e laboratorios foram removidos com sucesso.',
        color: 'green',
      });
      window.location.reload();
    } catch (error) {
      notify.show({
        title: 'Falha ao resetar',
        message: 'Não foi possível limpar o banco local. Tente novamente.',
        color: 'red',
      });
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="container mx-auto mt-6 max-w-3xl">
      <PageHeader title="Configurações" />

      <Tabs defaultValue="billing" className="mt-4">
        <TabsList>
          <TabsTrigger value="billing">Faturamento</TabsTrigger>
          <TabsTrigger value="culturas">Culturas</TabsTrigger>
          <TabsTrigger value="laboratorios">Laboratorios</TabsTrigger>
          <TabsTrigger value="general">Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="pt-4">
          <BillingSettings />
        </TabsContent>

        <TabsContent value="culturas" className="pt-4">
          <CulturasSettings />
        </TabsContent>

        <TabsContent value="laboratorios" className="pt-4">
          <LaboratoriosSettings />
        </TabsContent>

        <TabsContent value="general" className="pt-4">
          <p className="mb-3 text-muted-foreground">
            Ferramentas gerais em desenvolvimento.
          </p>

          {isLocalDataMode ? (
            <Button
              variant="destructive"
              disabled={isResetting}
              onClick={handleResetLocalDb}
            >
              {isResetting ? 'Resetando...' : 'Resetar banco local'}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              O reset local esta disponivel apenas no modo local.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
