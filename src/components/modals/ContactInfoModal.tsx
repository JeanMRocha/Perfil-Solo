import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Button } from '@components/ui/button';
import {
  mapCanonicalPointsToContactInfo,
  mapContactInfoToCanonicalPoints,
} from '../../modules/contact';
import type { ContactInfo } from '../../types/contact';

type ContactInfoModalProps = {
  opened: boolean;
  onClose: () => void;
  onSave: (contact: ContactInfo) => Promise<void> | void;
  title?: string;
  subtitle?: string;
  value?: ContactInfo | null;
  saving?: boolean;
};

type ContactDraft = {
  email: string;
  phone: string;
  website: string;
  address: string;
  socialNetwork: string;
  socialUrl: string;
};

function normalizeContact(contact: ContactInfo): ContactInfo {
  const canonicalPoints = mapContactInfoToCanonicalPoints(contact);
  const normalizedByModule = mapCanonicalPointsToContactInfo(
    canonicalPoints,
    contact,
  );
  return {
    ...normalizedByModule,
    email: normalizedByModule.email?.trim() ?? '',
    phone: normalizedByModule.phone?.trim() ?? '',
    website: normalizedByModule.website?.trim() ?? '',
    address: contact.address?.trim() ?? '',
    social_links: normalizedByModule.social_links,
  };
}

function toDraft(value: ContactInfo | null | undefined): ContactDraft {
  const contact = normalizeContact(value ?? {});
  const social = contact.social_links?.[0];
  return {
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    website: contact.website ?? '',
    address: contact.address ?? '',
    socialNetwork: social?.network ?? 'Instagram',
    socialUrl: social?.url ?? '',
  };
}

export default function ContactInfoModal({
  opened,
  onClose,
  onSave,
  title = 'Contato',
  subtitle = 'Informe dados para compartilhamento de resultados.',
  value,
  saving = false,
}: ContactInfoModalProps) {
  const [draft, setDraft] = useState<ContactDraft>({
    email: '',
    phone: '',
    website: '',
    address: '',
    socialNetwork: 'Instagram',
    socialUrl: '',
  });

  useEffect(() => {
    if (!opened) return;
    setDraft(toDraft(value));
  }, [opened, value]);

  const emailError = useMemo(() => {
    const email = draft.email?.trim();
    if (!email) return null;
    return /^\S+@\S+\.\S+$/.test(email) ? null : 'Email inválido.';
  }, [draft.email]);

  const saveDisabled = Boolean(emailError) || saving;

  const handleSave = async () => {
    if (saveDisabled) return;
    const contact: ContactInfo = {
      email: draft.email,
      phone: draft.phone,
      website: draft.website,
      address: draft.address,
      social_links: draft.socialUrl.trim()
        ? [{ network: draft.socialNetwork.trim(), url: draft.socialUrl.trim() }]
        : [],
    };
    await onSave(normalizeContact(contact));
  };

  return (
    <Dialog open={opened} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              placeholder="contato@empresa.com"
              value={draft.email ?? ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-phone">Telefone</Label>
            <Input
              id="contact-phone"
              placeholder="(00) 00000-0000"
              value={draft.phone}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-website">Website</Label>
            <Input
              id="contact-website"
              placeholder="https://empresa.com.br"
              value={draft.website}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, website: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-social-network">Rede social</Label>
            <Input
              id="contact-social-network"
              placeholder="Instagram, LinkedIn, Facebook..."
              value={draft.socialNetwork}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  socialNetwork: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-social-url">URL/usuário da rede</Label>
            <Input
              id="contact-social-url"
              placeholder="https://instagram.com/empresa ou @empresa"
              value={draft.socialUrl}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, socialUrl: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-address">Endereço</Label>
            <Input
              id="contact-address"
              placeholder="Rua, número, bairro, cidade"
              value={draft.address}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, address: e.target.value }))
              }
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saveDisabled}>
            {saving ? 'Salvando...' : 'Salvar contato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
