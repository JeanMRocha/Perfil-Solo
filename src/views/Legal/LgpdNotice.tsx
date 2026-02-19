import { useEffect, useState } from 'react';
import { Card, Stack, Text, Title } from '@mantine/core';
import {
  getSystemBrand,
  subscribeSystemConfig,
} from '../../services/systemConfigService';

export default function LgpdNotice() {
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
        <Title order={3}>Aviso LGPD</Title>
        <Text c="dimmed">
          Em conformidade com a LGPD (Lei 13.709/2018), o tratamento de dados no
          {systemName} segue os principios de finalidade, necessidade e seguranca.
        </Text>
        <Text c="dimmed">
          O controlador pode atender solicitacoes de acesso, correcao, portabilidade
          e eliminacao de dados mediante validacao da identidade do solicitante.
        </Text>
      </Stack>
    </Card>
  );
}
