import { useState } from 'react';
import { Card, Stack, TextInput, Button, Title, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderInline } from '@components/loaders';
import { setLoading } from '@global/loadingStore';
import { isLocalDataMode } from '@services/dataProvider';
import { supabaseClient } from '@sb/supabaseClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleReset() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      notifications.show({
        title: 'Email invalido',
        message: 'Informe um email valido para recuperar a senha.',
        color: 'red',
      });
      return;
    }

    try {
      setSubmitting(true);
      setLoading(true);

      if (isLocalDataMode) {
        notifications.show({
          title: 'Modo local',
          message: 'No modo local nao ha recuperacao de senha por email.',
          color: 'blue',
        });
        navigate('/auth');
        return;
      }

      const { error } = await supabaseClient.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/auth`,
        },
      );

      if (error) throw error;

      notifications.show({
        title: 'Email enviado',
        message: 'Verifique sua caixa de entrada para redefinir a senha.',
        color: 'green',
      });
      navigate('/auth');
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao enviar recuperacao',
        message: err?.message ?? 'Nao foi possivel processar sua solicitacao.',
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
          Recuperar Senha
        </Title>

        <TextInput
          label="E-mail"
          placeholder="usuario@email.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          autoComplete="email"
          disabled={submitting}
        />

        <Button
          color="green"
          radius="md"
          onClick={handleReset}
          disabled={submitting}
        >
          Enviar link de recuperação
        </Button>

        {submitting && <LoaderInline message="Enviando instruções..." />}

        <Text fz="sm" ta="center" mt="sm">
          <Link to="/auth">Voltar ao login</Link>
        </Text>
      </Stack>
    </Card>
  );
}
