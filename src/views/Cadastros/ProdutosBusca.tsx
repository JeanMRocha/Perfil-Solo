import { Container } from '@mantine/core';
import PageHeader from '../../components/PageHeader';
import ProdutosManager from './ProdutosManager';

export default function ProdutosBusca() {
  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Busca de Produtos" />
      <ProdutosManager />
    </Container>
  );
}
