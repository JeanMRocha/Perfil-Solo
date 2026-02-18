import { Container } from '@mantine/core';
import PageHeader from '../../components/PageHeader';
import ServicosManager from './ServicosManager';

export default function ServicosCadastro() {
  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Cadastro de Servico" />
      <ServicosManager startInCreateMode />
    </Container>
  );
}
