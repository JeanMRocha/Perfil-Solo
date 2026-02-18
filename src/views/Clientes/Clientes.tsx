import { Container, Text } from '@mantine/core';
import PageHeader from '../../components/PageHeader';

export default function Clientes() {
  return (
    <Container size="md" mt="xl">
      <PageHeader title="Clientes" />
      <Text c="dimmed">
        Cadastro e carteira de clientes serao ativados nesta fase.
      </Text>
    </Container>
  );
}
