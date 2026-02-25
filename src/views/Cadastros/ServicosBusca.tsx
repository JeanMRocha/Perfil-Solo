import PageHeader from '../../components/PageHeader';
import ServicosManager from './ServicosManager';

export default function ServicosBusca() {
  return (
    <div className="container mx-auto mt-6 max-w-7xl">
      <PageHeader title="Busca de Servicos" />
      <ServicosManager />
    </div>
  );
}
