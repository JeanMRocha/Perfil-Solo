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
import { useNavigate } from 'react-router-dom';
import { LoaderInline } from '@components/loaders';
import { setLoading } from '@global/loadingStore';
import { signInLocal } from '@global/user';
import { isLocalDataMode } from '@services/dataProvider';
import { supabaseClient } from '@sb/supabaseClient';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleRegister() {
    try {
      setSubmitting(true);
      setLoading(true);

      if (isLocalDataMode) {
        signInLocal(email);
        notifications.show({
          title: 'Conta local criada',
          message: 'Cadastro local concluido com sucesso.',
          color: 'green',
        });
        navigate('/dashboard');
        return;
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
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
        <Title order={3} c="green.8" ta="center">
          Criar Conta
        </Title>

        <TextInput
          label="Nome"
          placeholder="Seu nome completo"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />

        <TextInput
          label="E-mail"
          placeholder="usuario@email.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
        />

        <PasswordInput
          label="Senha"
          placeholder={isLocalDataMode ? 'Nao utilizada no modo local' : 'Minimo 6 caracteres'}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          required={!isLocalDataMode}
          disabled={isLocalDataMode}
        />

        <Button color="green" radius="md" onClick={handleRegister} disabled={submitting}>
          {isLocalDataMode ? 'Criar conta local' : 'Registrar'}
        </Button>

        {submitting && <LoaderInline message="Criando conta..." />}

        <Text fz="sm" ta="center" mt="sm">
          <a href="/auth">Ja tenho uma conta</a>
        </Text>
      </Stack>
    </Card>
  );
}
