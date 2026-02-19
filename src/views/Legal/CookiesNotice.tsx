import { useEffect, useState } from 'react';
import { Card, Stack, Text, Title } from '@mantine/core';
import {
  getSystemBrand,
  subscribeSystemConfig,
} from '../../services/systemConfigService';

export default function CookiesNotice() {
  const [systemName, setSystemName] = useState(() => getSystemBrand().name);

  useEffect(() => {
    const unsubscribe = subscribeSystemConfig((config) => {
      setSystemName(config.brand.name);
    });
    return unsubscribe;
  }, []);

  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Title order={3}>Aviso de Cookies</Title>
        <Text c="dimmed">
          O {systemName} utiliza cookies e armazenamento local para manter sessao,
          preferencias de interface e recursos de produtividade, como filtros e
          historico de notificacoes.
        </Text>
        <Text c="dimmed">
          Ao continuar utilizando a plataforma, o usuario concorda com esse uso para
          fins estritamente operacionais e de experiencia.
        </Text>
      </Stack>
    </Card>
  );
}
