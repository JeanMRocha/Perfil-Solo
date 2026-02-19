import { useState } from 'react';
import { Card, Stack, TextInput, Button, Title, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { LoaderInline } from '@components/loaders';
import { setLoading } from '@global/loadingStore';
import { isLocalDataMode } from '@services/dataProvider';
import {
  isValidEmail,
  requestIdentityChallengeCode,
  verifyIdentityChallengeCode,
} from '@services/identityVerificationService';
import { supabaseClient } from '../../supabase/supabaseClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'request' | 'verify' | 'done'>('request');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSendCode() {
    try {
      setSubmitting(true);
      setLoading(true);
      const normalizedEmail = String(email ?? '').trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        notifications.show({
          title: 'Email invalido',
          message: 'Informe um email valido para recuperar a conta.',
          color: 'red',
        });
        return;
      }

      const challenge = requestIdentityChallengeCode({
        email: normalizedEmail,
        reason: 'recovery',
      });

      notifications.show({
        title: 'Codigo enviado',
        message: `Verificacao enviada para ${normalizedEmail}. Codigo de teste: ${challenge.debug_code}`,
        color: 'blue',
      });
      setStep('verify');
    } catch (error: any) {
      notifications.show({
        title: 'Falha no envio',
        message: String(error?.message ?? 'Nao foi possivel enviar o codigo.'),
        color: 'red',
      });
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  }

  async function handleVerifyAndRecover() {
    try {
      setSubmitting(true);
      setLoading(true);
      const normalizedEmail = String(email ?? '').trim().toLowerCase();
      verifyIdentityChallengeCode({
        email: normalizedEmail,
        reason: 'recovery',
        code,
      });

      if (!isLocalDataMode) {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(normalizedEmail);
        if (error) throw error;
      }

      notifications.show({
        title: 'Identidade confirmada',
        message: isLocalDataMode
          ? 'Verificacao concluida no modo local. Contate o super usuario para redefinir senha.'
          : 'Link de recuperacao enviado para o email cadastrado.',
        color: 'green',
      });
      setStep('done');
    } catch (error: any) {
      notifications.show({
        title: 'Falha na verificacao',
        message: String(error?.message ?? 'Nao foi possivel validar o codigo.'),
        color: 'red',
      });
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  }

  return (
    <Card shadow="sm" radius="md" p="xl" maw={420} mx="auto" mt="10%">
      <Stack>
        <Title order={3} c="green.8" ta="center">
          Recuperar Conta
        </Title>

        <TextInput
          label="E-mail cadastrado"
          placeholder="usuario@email.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          disabled={step === 'done'}
        />

        {step === 'verify' ? (
          <TextInput
            label="Codigo de verificacao"
            placeholder="Digite o codigo enviado"
            value={code}
            onChange={(e) => setCode(e.currentTarget.value)}
          />
        ) : null}

        {step === 'request' ? (
          <Button color="green" radius="md" onClick={() => void handleSendCode()} disabled={submitting}>
            Enviar codigo de identidade
          </Button>
        ) : null}

        {step === 'verify' ? (
          <Button
            color="green"
            radius="md"
            onClick={() => void handleVerifyAndRecover()}
            disabled={submitting}
          >
            Validar identidade e recuperar
          </Button>
        ) : null}

        {step === 'done' ? (
          <Button color="blue" radius="md" onClick={() => navigate('/auth')}>
            Voltar ao login
          </Button>
        ) : null}

        {submitting && <LoaderInline message="Processando..." />}

        <Text fz="sm" ta="center" mt="sm">
          <a href="/auth">Voltar ao login</a>
        </Text>
      </Stack>
    </Card>
  );
}
