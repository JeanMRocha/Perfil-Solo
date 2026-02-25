import { useEffect, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import {
  getSystemBrand,
  subscribeSystemConfig,
} from '../../services/systemConfigService';

export default function LgpdNotice() {
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
        <h3 className="text-lg font-semibold">Aviso LGPD</h3>
        <p className="text-muted-foreground">
          Em conformidade com a LGPD (Lei 13.709/2018), o tratamento de dados no
          {systemName} segue os principios de finalidade, necessidade e seguranca.
        </p>
        <p className="text-muted-foreground">
          O controlador pode atender solicitacoes de acesso, correcao, portabilidade
          e eliminacao de dados mediante validacao da identidade do solicitante.
        </p>
      </CardContent>
    </Card>
  );
}
