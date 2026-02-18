import { Container, Text } from '@mantine/core';
import PageHeader from '../../components/PageHeader';
import GameMap from '../../components/GameWorld/GameMap';

export default function Propriedades() {
  return (
    <Container size="xl" mt="md">
      <PageHeader title="Propriedades e Talhoes" />
      <Text c="dimmed" mb="md">
        Desenhe talhoes no mapa e evolua para integracao com analises reais.
      </Text>
      <GameMap />
    </Container>
  );
}
