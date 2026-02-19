import { useEffect, useState } from 'react';
import { Card, Stack, Text, Title } from '@mantine/core';
import {
  getSystemBrand,
  subscribeSystemConfig,
} from '../../services/systemConfigService';

export default function PrivacyPolicy() {
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
        <Title order={3}>Politica de Privacidade</Title>
        <Text c="dimmed">
          O {systemName} utiliza dados para operacao da plataforma, suporte e melhoria
          continua do produto. Dados tecnicos e cadastrais sao tratados com controle
          de acesso por usuario.
        </Text>
        <Text c="dimmed">
          O usuario pode solicitar revisao, atualizacao ou remocao de dados pessoais
          conforme as diretrizes legais aplicaveis.
        </Text>
      </Stack>
    </Card>
  );
}
