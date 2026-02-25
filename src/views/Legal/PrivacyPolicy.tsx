import { useEffect, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
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
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <h3 className="text-lg font-semibold">Politica de Privacidade</h3>
        <p className="text-muted-foreground">
          O {systemName} utiliza dados para operacao da plataforma, suporte e melhoria
          continua do produto. Dados tecnicos e cadastrais sao tratados com controle
          de acesso por usuario.
        </p>
        <p className="text-muted-foreground">
          O usuario pode solicitar revisao, atualizacao ou remocao de dados pessoais
          conforme as diretrizes legais aplicaveis.
        </p>
      </CardContent>
    </Card>
  );
}
