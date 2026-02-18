import { useState } from 'react';
import {
  Button,
  Card,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderInline } from '@components/loaders';
import { setLoading } from '@global/loadingStore';
import { signInLocal } from '@global/user';
import { isLocalDataMode } from '@services/dataProvider';
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
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      notifications.show({
        title: 'Email invalido',
        message: 'Informe um email valido para continuar.',
        color: 'red',
      });
      return;
    }

    if (!isLocalDataMode && password.length < 6) {
      notifications.show({
        title: 'Senha curta',
        message: 'A senha deve ter pelo menos 6 caracteres.',
        color: 'red',
      });
      return;
    }

    try {
      setSubmitting(true);
      setLoading(true);

      if (isLocalDataMode) {
        signInLocal(normalizedEmail);
        await updateProfile({
          name: name || 'Usuario Local',
          email: normalizedEmail,
          contact,
        });
        notifications.show({
          title: 'Conta local criada',
          message: 'Cadastro local concluido com sucesso.',
          color: 'green',
        });
        navigate('/dashboard');
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
        notifications.show({
          title: 'Conta criada',
          message: 'Cadastro concluido e login efetuado.',
          color: 'green',
        });
        navigate('/dashboard');
      } else {
        notifications.show({
          title: 'Confirme seu email',
          message: 'Cadastro criado. Verifique sua caixa de entrada.',
          color: 'blue',
        });
        navigate('/auth');
      }
    } catch (err: any) {
      const message = String(err?.message ?? 'Nao foi possivel cadastrar.');
      const isNetwork = message.toLowerCase().includes('failed to fetch');

      notifications.show({
        title: isNetwork ? 'Falha de rede com Supabase' : 'Falha no cadastro',
        message: isNetwork
          ? 'Nao foi possivel conectar ao Supabase. Verifique URL do projeto e DNS.'
          : message,
        color: 'red',
      });
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  }

  return (
    <Card shadow="sm" radius="md" p="xl" maw={400} mx="auto" mt="10%">
      <Stack>
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

        <Title order={3} c="green.8" ta="center">
          Criar Conta
        </Title>

        <TextInput
          label="Nome"
          placeholder="Seu nome completo"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          disabled={submitting}
        />

        <TextInput
          label="E-mail"
          placeholder="usuario@email.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          autoComplete="email"
          disabled={submitting}
          required
        />

        <PasswordInput
          label="Senha"
          placeholder={isLocalDataMode ? 'Nao utilizada no modo local' : 'Minimo 6 caracteres'}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          autoComplete="new-password"
          required={!isLocalDataMode}
          disabled={isLocalDataMode || submitting}
        />

        <Button
          variant="light"
          color="blue"
          onClick={() => setContactModalOpened(true)}
          disabled={submitting}
        >
          Definir contato e compartilhamento
        </Button>

        {(contact.email || contact.phone || contact.address) && (
          <Text size="sm" c="dimmed">
            Contato: {contact.email || '-'} | {contact.phone || '-'}
          </Text>
        )}

        <Button color="green" radius="md" onClick={handleRegister} disabled={submitting}>
          {isLocalDataMode ? 'Criar conta local' : 'Registrar'}
        </Button>

        {submitting && <LoaderInline message="Criando conta..." />}

        <Text fz="sm" ta="center" mt="sm">
          <Link to="/auth">Ja tenho uma conta</Link>
        </Text>
      </Stack>
    </Card>
  );
}
