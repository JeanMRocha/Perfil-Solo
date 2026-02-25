import { useEffect, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import {
  getSystemBrand,
  subscribeSystemConfig,
} from '../../services/systemConfigService';

export default function CookiesNotice() {
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
        <h3 className="text-lg font-semibold">Aviso de Cookies</h3>
        <p className="text-muted-foreground">
          O {systemName} utiliza cookies e armazenamento local para manter sessao,
          preferencias de interface e recursos de produtividade, como filtros e
          historico de notificacoes.
        </p>
        <p className="text-muted-foreground">
          Ao continuar utilizando a plataforma, o usuario concorda com esse uso para
          fins estritamente operacionais e de experiencia.
        </p>
      </CardContent>
    </Card>
  );
}
