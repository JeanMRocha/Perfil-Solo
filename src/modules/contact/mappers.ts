import type {
  ContactChannel,
  ContactInfo,
  ContactSocialLink,
} from '../../types/contact';
import {
  buildContactPointsFromContactInfo,
  getPrimaryContactPoint,
} from './normalization';
import type { CanonicalContactPoint } from './types';

function toChannels(points: CanonicalContactPoint[]): ContactChannel[] {
  return points.map((row) => ({
    id: row.id,
    label: row.label,
    value: row.value,
  }));
}

function toSocial(points: CanonicalContactPoint[]): ContactSocialLink[] {
  return points.map((row) => ({
    id: row.id,
    network: row.network,
    url: row.value,
  }));
}

export function mapContactInfoToCanonicalPoints(
  contact: ContactInfo | null | undefined,
): CanonicalContactPoint[] {
  return buildContactPointsFromContactInfo(contact);
}

export function mapCanonicalPointsToContactInfo(
  points: CanonicalContactPoint[],
  base?: ContactInfo | null,
): ContactInfo {
  const emails = points.filter((row) => row.kind === 'email');
  const phones = points.filter((row) => row.kind === 'phone');
  const websites = points.filter((row) => row.kind === 'website');
  const socials = points.filter((row) => row.kind === 'social');

  const primaryEmail = getPrimaryContactPoint(emails, 'email')?.value ?? '';
  const primaryPhone = getPrimaryContactPoint(phones, 'phone')?.value ?? '';
  const primaryWebsite =
    getPrimaryContactPoint(websites, 'website')?.value ?? '';

  return {
    ...(base ?? {}),
    email: primaryEmail || undefined,
    phone: primaryPhone || undefined,
    website: primaryWebsite || undefined,
    emails: emails.length > 0 ? toChannels(emails) : undefined,
    phones: phones.length > 0 ? toChannels(phones) : undefined,
    websites: websites.length > 0 ? toChannels(websites) : undefined,
    social_links: socials.length > 0 ? toSocial(socials) : undefined,
  };
}
