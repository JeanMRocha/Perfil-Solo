import { Container } from '@mantine/core';
import PageHeader from '../../components/PageHeader';
import ProdutosManager from './ProdutosManager';

export default function ProdutosCadastro() {
  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Cadastro de Produto" />
      <ProdutosManager startInCreateMode />
    </Container>
  );
}
