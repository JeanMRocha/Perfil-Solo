import { useState } from 'react';
import { notify } from 'lib/notify';
import { useNavigate } from 'react-router-dom';
import { LoaderInline } from '@components/loaders';
import { setLoading } from '@global/loadingStore';
import { isLocalDataMode } from '@services/dataProvider';
import { Card, CardContent } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Button } from '@components/ui/button';
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
        notify.show({
          title: 'Email inválido',
          message: 'Informe um email valido para recuperar a conta.',
          color: 'red',
        });
        return;
      }

      const challenge = requestIdentityChallengeCode({
        email: normalizedEmail,
        reason: 'recovery',
      });

      notify.show({
        title: 'Código enviado',
        message: `Verificacao enviada para ${normalizedEmail}. Codigo de teste: ${challenge.debug_code}`,
        color: 'blue',
      });
      setStep('verify');
    } catch (error: any) {
      notify.show({
        title: 'Falha no envio',
        message: String(error?.message ?? 'Não foi possível enviar o código.'),
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

      notify.show({
        title: 'Identidade confirmada',
        message: isLocalDataMode
          ? 'Verificacao concluida no modo local. Contate o super usuário para redefinir senha.'
          : 'Link de recuperacao enviado para o email cadastrado.',
        color: 'green',
      });
      setStep('done');
    } catch (error: any) {
      notify.show({
        title: 'Falha na verificacao',
        message: String(error?.message ?? 'Não foi possível validar o código.'),
        color: 'red',
      });
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  }

  return (
    <div className="mt-[10%] mx-auto max-w-[420px]">
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6">
          <h3 className="text-center text-lg font-semibold text-brand">
            Recuperar Conta
          </h3>

          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">E-mail cadastrado</Label>
            <Input
              id="forgot-email"
              placeholder="usuário@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={step === 'done'}
            />
          </div>

          {step === 'verify' ? (
            <div className="space-y-1.5">
              <Label htmlFor="forgot-code">Código de verificacao</Label>
              <Input
                id="forgot-code"
                placeholder="Digite o código enviado"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          ) : null}

          {step === 'request' ? (
            <Button onClick={() => void handleSendCode()} disabled={submitting}>
              Enviar codigo de identidade
            </Button>
          ) : null}

          {step === 'verify' ? (
            <Button onClick={() => void handleVerifyAndRecover()} disabled={submitting}>
              Validar identidade e recuperar
            </Button>
          ) : null}

          {step === 'done' ? (
            <Button variant="secondary" onClick={() => navigate('/auth')}>
              Ir para login
            </Button>
          ) : null}

          {submitting && <LoaderInline message="Processando..." />}

          <p className="mt-1 text-center text-sm text-muted-foreground">
            <a href="/auth" className="underline hover:text-foreground">Ir para login</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
