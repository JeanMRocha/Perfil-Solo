import { useEffect, useMemo, useState } from 'react';
import { notify } from 'lib/notify';
import { useStore } from '@nanostores/react';
import { Card, CardContent } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Button } from '@components/ui/button';
import { Switch } from '@components/ui/switch';
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
      notify.show({
        title: 'Segurança atualizada',
        message: status.enabled
          ? 'Fator de 2 etapas ativado.'
          : 'Fator de 2 etapas desativado.',
        color: status.enabled ? 'teal' : 'blue',
      });
    } catch (error: any) {
      notify.show({
        title: 'Não foi possível alterar',
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
      notify.show({
        title: 'Código enviado',
        message: `Use o codigo de teste: ${challenge.debug_code}`,
        color: 'blue',
      });
    } catch (error: any) {
      notify.show({
        title: 'Falha ao enviar código',
        message: String(error?.message ?? 'Não foi possível enviar código.'),
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
      notify.show({
        title: 'Identidade confirmada',
        message: 'Agora voce pode ativar o fator de 2 etapas.',
        color: 'teal',
      });
    } catch (error: any) {
      notify.show({
        title: 'Código inválido',
        message: String(error?.message ?? 'Não foi possível confirmar identidade.'),
        color: 'red',
      });
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <Card className="mb-2">
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h6 className="text-sm font-semibold">Seguranca: fator de 2 etapas</h6>
            <p className="text-xs text-muted-foreground">
              Por padrao fica desativado e so pode ser ativado apos confirmacao de identidade.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="two-factor-switch"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={!confirmedAt && !enabled}
            />
            <Label htmlFor="two-factor-switch" className="text-sm">
              {enabled ? 'Ativado' : 'Desativado'}
            </Label>
          </div>
        </div>

        {confirmedAt ? (
          <p className="text-xs text-muted-foreground">
            Identidade confirmada em: {confirmedLabel}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Confirme identidade para habilitar o 2 etapas.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={sendingCode}
                onClick={() => void handleSendCode()}
              >
                {sendingCode ? 'Enviando...' : 'Enviar codigo'}
              </Button>
              <div className="space-y-1">
                <Label htmlFor="2fa-code" className="text-xs">Codigo</Label>
                <Input
                  id="2fa-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-[140px]"
                />
              </div>
              <Button
                size="sm"
                disabled={verifyingCode}
                onClick={() => void handleConfirmIdentity()}
              >
                {verifyingCode ? 'Verificando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
