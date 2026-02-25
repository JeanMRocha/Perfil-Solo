import PageHeader from '../../components/PageHeader';
import ServicosManager from './ServicosManager';

export default function ServicosCadastro() {
  return (
    <div className="container mx-auto mt-6 max-w-7xl">
      <PageHeader title="Cadastro de Servico" />
      <ServicosManager startInCreateMode />
    </div>
  );
}
