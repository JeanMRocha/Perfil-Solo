import { useState } from 'react';
import { notify } from 'lib/notify';
import { useNavigate } from 'react-router-dom';
import { LoaderInline } from '@components/loaders';
import { Card, CardContent } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Button } from '@components/ui/button';
import { setLoading } from '@global/loadingStore';
import { signInLocal } from '@global/user';
import { registerAndEnsureUserCredits } from '@services/creditsService';
import { isLocalDataMode } from '@services/dataProvider';
import {
  clearTwoFactorVerificationSession,
  isValidEmail,
} from '@services/identityVerificationService';
import { supabaseClient } from '@sb/supabaseClient';
import ContactInfoModal from '../../components/modals/ContactInfoModal';
import { updateProfile } from '../../services/profileService';
import type { ContactInfo } from '../../types/contact';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [contactModalOpened, setContactModalOpened] = useState(false);
  const [contact, setContact] = useState<ContactInfo>({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleRegister() {
    try {
      setSubmitting(true);
      setLoading(true);
      const normalizedEmail = String(email ?? '').trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        notify.show({
          title: 'Email inválido',
          message: 'Informe um email valido para cadastrar.',
          color: 'red',
        });
        return;
      }

      if (isLocalDataMode) {
        clearTwoFactorVerificationSession(normalizedEmail);
        const localUser = signInLocal(normalizedEmail);
        registerAndEnsureUserCredits({
          id: localUser.id,
          email: normalizedEmail || localUser.email || '',
          name: name || String(localUser.user_metadata?.name ?? 'Usuário Local'),
        });
        await updateProfile({
          name: name || 'Usuário Local',
          email: normalizedEmail,
          contact,
        });
        notify.show({
          title: 'Conta local criada',
          message: 'Cadastro concluido com sucesso.',
          color: 'green',
        });
        navigate('/auth');
        return;
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            name,
            contact_email: contact.email ?? '',
            contact_phone: contact.phone ?? '',
            contact_address: contact.address ?? '',
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        const signedUser = data.session.user;
        if (signedUser?.id && signedUser?.email) {
          registerAndEnsureUserCredits({
            id: signedUser.id,
            email: signedUser.email,
            name: name || String(signedUser.user_metadata?.name ?? ''),
          });
        }
        clearTwoFactorVerificationSession(normalizedEmail);
        notify.show({
          title: 'Conta criada',
          message: 'Cadastro concluido com sucesso.',
          color: 'green',
        });
        navigate('/auth');
      } else {
        notify.show({
          title: 'Confirme seu email',
          message: 'Cadastro criado. Verifique sua caixa de entrada.',
          color: 'blue',
        });
        navigate('/auth');
      }
    } catch (err: any) {
      const message = String(err?.message ?? 'Não foi possível cadastrar.');
      const isNetwork = message.toLowerCase().includes('failed to fetch');

      notify.show({
        title: isNetwork ? 'Falha de rede com Supabase' : 'Falha no cadastro',
        message: isNetwork
          ? 'Não foi possível conectar ao Supabase. Verifique URL do projeto e DNS.'
          : message,
        color: 'red',
      });
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  }

  return (
    <div className="mt-[10%] mx-auto max-w-[400px]">
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6">
          <ContactInfoModal
            opened={contactModalOpened}
            onClose={() => setContactModalOpened(false)}
            onSave={async (draft) => {
              setContact(draft);
              setContactModalOpened(false);
            }}
            value={contact}
            title="Contato para compartilhamento"
            subtitle="Esses dados serao usados nos relatorios e modulos."
          />

          <h3 className="text-center text-lg font-semibold text-brand">
            Criar Conta
          </h3>

          <div className="space-y-1.5">
            <Label htmlFor="reg-name">Nome</Label>
            <Input
              id="reg-name"
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-email">E-mail</Label>
            <Input
              id="reg-email"
              placeholder="usuário@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Senha</Label>
            <Input
              id="reg-password"
              type="password"
              placeholder={isLocalDataMode ? 'Não utilizada no modo local' : 'Minimo 6 caracteres'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isLocalDataMode}
              disabled={isLocalDataMode}
            />
          </div>

          <Button variant="secondary" onClick={() => setContactModalOpened(true)}>
            Definir contato e compartilhamento
          </Button>

          {(contact.email || contact.phone || contact.address) && (
            <p className="text-sm text-muted-foreground">
              Contato: {contact.email || '-'} | {contact.phone || '-'}
            </p>
          )}

          <Button onClick={handleRegister} disabled={submitting}>
            {isLocalDataMode ? 'Criar conta local' : 'Registrar'}
          </Button>

          {submitting && <LoaderInline message="Criando conta..." />}

          <p className="mt-1 text-center text-sm text-muted-foreground">
            <a href="/auth" className="underline hover:text-foreground">Ja tenho uma conta</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
