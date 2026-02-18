import { Container } from '@mantine/core';
import PageHeader from '../../components/PageHeader';
import ServicosManager from './ServicosManager';

export default function ServicosBusca() {
  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Busca de Servicos" />
      <ServicosManager />
    </Container>
  );
}
