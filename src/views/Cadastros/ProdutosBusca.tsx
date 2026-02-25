import PageHeader from '../../components/PageHeader';
import ProdutosManager from './ProdutosManager';

export default function ProdutosBusca() {
  return (
    <div className="container mx-auto mt-6 max-w-7xl">
      <PageHeader title="Busca de Produtos" />
      <ProdutosManager />
    </div>
  );
}
