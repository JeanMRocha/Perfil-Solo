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
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { $currUser, signInLocal, signOut } from '@global/user';
import {
  claimCreditEngagementReward,
  registerAndEnsureUserCredits,
} from '@services/creditsService';
import { isLocalDataMode } from '@services/dataProvider';
import {
  clearTwoFactorVerificationSession,
  isTwoFactorEnabledForEmail,
  isTwoFactorVerifiedForEmail,
  isValidEmail,
  markTwoFactorActivationConfirmed,
  markTwoFactorVerifiedSession,
  requestIdentityChallengeCode,
  verifyIdentityChallengeCode,
} from '@services/identityVerificationService';
import { supabaseClient } from '@sb/supabaseClient';

export default function Authentication() {
  const user = useStore($currUser);
  const navigate = useNavigate();
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (isValidEmail(value) ? null : 'Email invalido'),
    },
  });

  const userEmail = String(user?.email ?? '').trim().toLowerCase();
  const needsTwoFactor =
    !!user &&
    !!userEmail &&
    isTwoFactorEnabledForEmail(userEmail) &&
    !isTwoFactorVerifiedForEmail(userEmail);

  useEffect(() => {
    if (!needsTwoFactor) return;
    if (userEmail) setVerificationEmail(userEmail);
  }, [needsTwoFactor, userEmail]);

  if (user && !needsTwoFactor) {
    return <Navigate to="/dashboard" replace />;
  }

  const requestLoginCode = async (email: string) => {
    const normalized = String(email ?? '').trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      notifications.show({
        title: 'Email invalido',
        message: 'Informe um email valido para verificacao.',
        color: 'red',
      });
      return;
    }

    try {
      setSendingCode(true);
      const challenge = requestIdentityChallengeCode({
        email: normalized,
        reason: 'login',
      });
      setVerificationEmail(challenge.email);
      notifications.show({
        title: 'Verificacao em 2 fatores',
        message: `Codigo enviado para ${challenge.email}. Codigo de teste: ${challenge.debug_code}`,
        color: 'blue',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao enviar codigo',
        message: String(error?.message ?? 'Nao foi possivel enviar o codigo.'),
        color: 'red',
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = form.onSubmit(async (values) => {
    const loginEmail = String(values.email ?? '').trim().toLowerCase();
    if (!isValidEmail(loginEmail)) {
      notifications.show({
        title: 'Email invalido',
        message: 'Informe um email valido para continuar.',
        color: 'red',
      });
      return;
    }

    if (isLocalDataMode) {
      const requiresTwoFactor = isTwoFactorEnabledForEmail(loginEmail);
      clearTwoFactorVerificationSession(loginEmail);
      signInLocal(loginEmail);
      if (requiresTwoFactor) {
        await requestLoginCode(loginEmail);
        return;
      }
      navigate('/dashboard', { replace: true });
      return;
    }

    try {
      const requiresTwoFactor = isTwoFactorEnabledForEmail(loginEmail);
      clearTwoFactorVerificationSession(loginEmail);
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail,
        password: values.password,
      });

      if (error) throw error;
      const signedUser = data.user;
      if (signedUser?.id && signedUser?.email) {
        registerAndEnsureUserCredits({
          id: signedUser.id,
          email: signedUser.email,
          name: String(signedUser.user_metadata?.name ?? ''),
        });
      }
      if (requiresTwoFactor) {
        await requestLoginCode(loginEmail);
        return;
      }
      navigate('/dashboard', { replace: true });
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

  const confirmTwoFactor = async () => {
    const email = verificationEmail || userEmail;
    if (!isValidEmail(email)) {
      notifications.show({
        title: 'Email invalido',
        message: 'Nao foi possivel identificar email para verificar.',
        color: 'red',
      });
      return;
    }

    try {
      setVerifyingCode(true);
      verifyIdentityChallengeCode({
        email,
        reason: 'login',
        code: verificationCode,
      });
      markTwoFactorActivationConfirmed(email);
      markTwoFactorVerifiedSession(email);
      if (user?.id) {
        claimCreditEngagementReward({
          user_id: String(user.id),
          rule_id: 'email_confirmation',
          created_by: String(user.id),
          reference_id: email,
        });
      }
      notifications.show({
        title: 'Identidade confirmada',
        message: 'Autenticacao em 2 fatores concluida com sucesso.',
        color: 'green',
      });
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      notifications.show({
        title: 'Codigo invalido',
        message: String(error?.message ?? 'Nao foi possivel validar o codigo.'),
        color: 'red',
      });
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleResetLogin = async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
    clearTwoFactorVerificationSession();
    setVerificationCode('');
    setVerificationEmail('');
    form.reset();
  };

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
            {needsTwoFactor ? (
              <Box>
                <Title order={4}>Verificacao em 2 fatores</Title>
                <Text size="sm" c="dimmed" mt="xs">
                  Confirme sua identidade no email cadastrado: {verificationEmail || userEmail}
                </Text>

                <TextInput
                  mt="md"
                  label="Codigo de verificacao"
                  placeholder="Digite o codigo de 6 digitos"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.currentTarget.value)}
                />

                <Group mt="lg" justify="space-between">
                  <Button
                    variant="light"
                    loading={sendingCode}
                    onClick={() => void requestLoginCode(verificationEmail || userEmail)}
                  >
                    Reenviar codigo
                  </Button>
                  <Button loading={verifyingCode} onClick={() => void confirmTwoFactor()}>
                    Confirmar identidade
                  </Button>
                </Group>

                <Group justify="center" mt="md">
                  <Anchor size="sm" onClick={() => void handleResetLogin()}>
                    Trocar conta
                  </Anchor>
                </Group>
              </Box>
            ) : (
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
            )}
          </Paper>
        </Container>
      </Center>
    </Box>
  );
}
