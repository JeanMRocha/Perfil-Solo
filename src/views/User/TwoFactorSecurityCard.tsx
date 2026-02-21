import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Group, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@nanostores/react';
import { $currUser } from '../../global-state/user';
import { claimCreditEngagementReward } from '../../services/creditsService';
import {
  TWO_FACTOR_SETTINGS_UPDATED_EVENT,
  getTwoFactorStatusForEmail,
  markTwoFactorActivationConfirmed,
  markTwoFactorVerifiedSession,
  requestIdentityChallengeCode,
  setTwoFactorEnabledForEmail,
  verifyIdentityChallengeCode,
} from '../../services/identityVerificationService';

export default function TwoFactorSecurityCard() {
  const user = useStore($currUser);
  const userId = String(user?.id ?? '').trim();
  const email = String(user?.email ?? '').trim().toLowerCase();
  const [code, setCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const confirmedLabel = useMemo(() => {
    if (!confirmedAt) return '';
    const dt = new Date(confirmedAt);
    if (Number.isNaN(dt.getTime())) return confirmedAt;
    return dt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [confirmedAt]);

  useEffect(() => {
    const refresh = () => {
      if (!email) {
        setEnabled(false);
        setConfirmedAt(null);
        return;
      }
      const status = getTwoFactorStatusForEmail(email);
      setEnabled(status.enabled);
      setConfirmedAt(status.confirmed_at);
    };

    refresh();

    const onUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ email?: string }>;
      const changedEmail = String(custom.detail?.email ?? '').trim().toLowerCase();
      if (changedEmail && changedEmail !== email) return;
      refresh();
    };

    const onStorage = () => refresh();

    window.addEventListener(TWO_FACTOR_SETTINGS_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(TWO_FACTOR_SETTINGS_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [email]);

  if (!email) return null;

  const handleToggle = (nextEnabled: boolean) => {
    try {
      const status = setTwoFactorEnabledForEmail(email, nextEnabled);
      if (status.enabled) {
        markTwoFactorVerifiedSession(email);
      }
      setEnabled(status.enabled);
      setConfirmedAt(status.confirmed_at);
      notifications.show({
        title: 'Seguranca atualizada',
        message: status.enabled
          ? 'Fator de 2 etapas ativado.'
          : 'Fator de 2 etapas desativado.',
        color: status.enabled ? 'teal' : 'blue',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Nao foi possivel alterar',
        message: String(error?.message ?? 'Falha ao atualizar 2 etapas.'),
        color: 'red',
      });
    }
  };

  const handleSendCode = async () => {
    try {
      setSendingCode(true);
      const challenge = requestIdentityChallengeCode({
        email,
        reason: 'login',
      });
      notifications.show({
        title: 'Codigo enviado',
        message: `Use o codigo de teste: ${challenge.debug_code}`,
        color: 'blue',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao enviar codigo',
        message: String(error?.message ?? 'Nao foi possivel enviar codigo.'),
        color: 'red',
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleConfirmIdentity = async () => {
    try {
      setVerifyingCode(true);
      verifyIdentityChallengeCode({
        email,
        reason: 'login',
        code,
      });
      const status = markTwoFactorActivationConfirmed(email);
      markTwoFactorVerifiedSession(email);
      setConfirmedAt(status.confirmed_at);
      if (userId) {
        claimCreditEngagementReward({
          user_id: userId,
          rule_id: 'email_confirmation',
          created_by: userId,
          reference_id: email,
        });
      }
      notifications.show({
        title: 'Identidade confirmada',
        message: 'Agora voce pode ativar o fator de 2 etapas.',
        color: 'teal',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Codigo invalido',
        message: String(error?.message ?? 'Nao foi possivel confirmar identidade.'),
        color: 'red',
      });
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <Card withBorder radius="md" p="md" mb="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <div>
            <Title order={5}>Seguranca: fator de 2 etapas</Title>
            <Text size="sm" c="dimmed">
              Por padrao fica desativado e so pode ser ativado apos confirmacao de identidade.
            </Text>
          </div>
          <Switch
            checked={enabled}
            onChange={(event) => handleToggle(event.currentTarget.checked)}
            disabled={!confirmedAt && !enabled}
            label={enabled ? 'Ativado' : 'Desativado'}
          />
        </Group>

        {confirmedAt ? (
          <Text size="sm" c="dimmed">
            Identidade confirmada em: {confirmedLabel}
          </Text>
        ) : (
          <Stack gap="xs">
            <Text size="sm" c="yellow.7">
              Confirme identidade para habilitar o 2 etapas.
            </Text>
            <Group align="end" wrap="wrap">
              <Button size="xs" variant="light" loading={sendingCode} onClick={() => void handleSendCode()}>
                Enviar codigo
              </Button>
              <TextInput
                label="Codigo"
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.currentTarget.value)}
                w={160}
              />
              <Button size="xs" loading={verifyingCode} onClick={() => void handleConfirmIdentity()}>
                Confirmar
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
