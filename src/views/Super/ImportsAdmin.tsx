import { useState } from 'react';
import { Container, Tabs } from '@mantine/core';
import { IconPlant2 } from '@tabler/icons-react';
import PageHeader from '../../components/PageHeader';
import CultureSyncAdmin from './CultureSyncAdmin';

export default function ImportsAdmin() {
  const [activeTab, setActiveTab] = useState<string | null>('culturas');

  return (
    <Container size="lg" py="xl">
      <PageHeader title="Gestão de Importações" color="blue" />

      <Tabs value={activeTab} onChange={setActiveTab} defaultValue="culturas">
        <Tabs.List>
          <Tabs.Tab value="culturas" leftSection={<IconPlant2 size={16} />}>
            Culturas
          </Tabs.Tab>
          {/* Adicionar abas de outras importações futuramente */}
        </Tabs.List>

        <Tabs.Panel value="culturas" pt="md">
          <CultureSyncAdmin isEmbedded={true} />
        </Tabs.Panel>

        {/* Adicionar panels de outras importações aqui */}
      </Tabs>
    </Container>
  );
}
