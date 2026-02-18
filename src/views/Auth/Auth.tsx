import {
  Anchor,
  Box,
  Button,
  Center,
  Container,
  Group,
  Paper,
  PasswordInput,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useStore } from '@nanostores/react';
import { IconCircleKey } from '@tabler/icons-react';
import { Link, Navigate } from 'react-router-dom';
import { $currUser, signInLocal } from '@global/user';
import { isLocalDataMode } from '@services/dataProvider';
import { supabaseClient } from '@sb/supabaseClient';

export default function Authentication() {
  const user = useStore($currUser);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Email invalido'),
    },
  });

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = form.onSubmit(async (values) => {
    if (isLocalDataMode) {
      signInLocal(values.email);
      notifications.show({
        title: 'Modo local',
        message: 'Acesso local liberado com sucesso.',
        color: 'green',
      });
      return;
    }

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) throw error;
    } catch (err: any) {
      const message = String(err?.message ?? 'Falha ao autenticar.');
      const isNetwork = message.toLowerCase().includes('failed to fetch');

      notifications.show({
        title: isNetwork ? 'Falha de rede com Supabase' : 'Falha no login',
        message: isNetwork
          ? 'Nao foi possivel conectar ao Supabase. Verifique URL do projeto e DNS.'
          : message,
        color: 'red',
      });
    }
  });

  return (
    <Box h="100vh" w="100vw">
      <Center h="100vh" w="100%">
        <Container size={620} miw={440}>
          <Group align="baseline">
            <Text c="dimmed">
              <IconCircleKey />
            </Text>
            <Title>{isLocalDataMode ? 'Entrar (Local)' : 'Login'}</Title>
          </Group>

          <Paper withBorder shadow="md" p={30} mt={30} radius="md">
            <form onSubmit={handleSubmit}>
              <TextInput
                label="Email"
                placeholder="voce@empresa.com"
                required
                {...form.getInputProps('email')}
              />

              <PasswordInput
                label="Senha"
                placeholder={
                  isLocalDataMode ? 'Nao utilizada no modo local' : 'Sua senha'
                }
                required={!isLocalDataMode}
                mt="md"
                disabled={isLocalDataMode}
                {...form.getInputProps('password')}
              />

              <Button fullWidth mt="xl" type="submit">
                {isLocalDataMode ? 'Entrar no modo local' : 'Sign in'}
              </Button>

              <Group justify="space-between" mt="md">
                <Anchor component={Link} to="/auth/register" size="sm">
                  Criar conta
                </Anchor>
                <Anchor component={Link} to="/auth/forgot-password" size="sm">
                  Esqueci a senha
                </Anchor>
              </Group>
            </form>
          </Paper>
        </Container>
      </Center>
    </Box>
  );
}
