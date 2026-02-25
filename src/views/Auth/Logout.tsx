import { useEffect } from 'react';
import { notify } from 'lib/notify';
import { signOut } from '@global/user';
import { useNavigate } from 'react-router-dom';

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await signOut();
        notify.show({
          title: 'Sessao encerrada',
          message: 'Acesso finalizado com sucesso.',
          color: 'green',
        });
      } catch (e: any) {
        notify.show({
          title: 'Erro ao sair',
          message: e?.message || 'Tente novamente.',
          color: 'red',
        });
      } finally {
        navigate('/auth', { replace: true });
      }
    })();
  }, [navigate]);

  return null;
}
