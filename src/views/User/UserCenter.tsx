import { useEffect, useState } from 'react';
import { Container, Tabs, Text } from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import {
  buildUserCenterPath,
  resolveUserCenterTab,
  type UserCenterTab,
} from '../../modules/user';
import BillingSettings from '../Config/BillingSettings';
import CreditsCenter from '../Credits/CreditsCenter';
import CompanyPanel from './CompanyPanel';
import GamificationPanel from './GamificationPanel';
import LoginHistoryCard from './LoginHistoryCard';
import ProfilePage from './Profile';
import TwoFactorSecurityCard from './TwoFactorSecurityCard';
import {
  getProfile,
  PROFILE_UPDATED_EVENT,
  type UserProfile,
} from '../../services/profileService';

export default function UserCenter() {
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const requestedTab = resolveUserCenterTab(location.search);
  const isPessoaJuridica = profile?.producer?.tipo_pessoa === 'pj';
  const activeTab =
    !isPessoaJuridica && requestedTab === 'empresa' ? 'perfil' : requestedTab;

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const data = await getProfile();
      if (!alive) return;
      setProfile(data);
    };

    const onUpdated = (event: Event) => {
      const custom = event as CustomEvent<UserProfile>;
      if (custom.detail) {
        setProfile(custom.detail);
        return;
      }
      void load();
    };

    void load();
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onUpdated);
    return () => {
      alive = false;
      window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onUpdated);
    };
  }, []);

  useEffect(() => {
    if (requestedTab !== 'empresa') return;
    if (isPessoaJuridica) return;
    navigate(buildUserCenterPath('perfil'), { replace: true });
  }, [isPessoaJuridica, navigate, requestedTab]);

  const handleTabChange = (value: string | null) => {
    const nextTab = resolveUserCenterTab(`?tab=${value ?? ''}`);
    if (nextTab === activeTab) return;
    navigate(buildUserCenterPath(nextTab as UserCenterTab), { replace: true });
  };

  return (
    <Container size="xl" mt="md">
      <PageHeader title="Central do Usuário" />
      <Text c="dimmed" size="sm" mb="xs">
        Interface consolidada do usuario logado: usuario, seguranca, jornada, plano, creditos e cupons.
      </Text>

      <Tabs value={activeTab} onChange={handleTabChange} variant="outline" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="perfil">Usuario</Tabs.Tab>
          <Tabs.Tab value="seguranca">Seguranca</Tabs.Tab>
          {isPessoaJuridica ? <Tabs.Tab value="empresa">Empresa</Tabs.Tab> : null}
          <Tabs.Tab value="jornada">Jornada</Tabs.Tab>
          <Tabs.Tab value="plano">Plano e Faturamento</Tabs.Tab>
          <Tabs.Tab value="creditos">Creditos</Tabs.Tab>
          <Tabs.Tab value="cupons">Cupons</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="perfil" pt="xs">
          <ProfilePage embedded />
        </Tabs.Panel>

        <Tabs.Panel value="seguranca" pt="xs">
          <TwoFactorSecurityCard />
          <LoginHistoryCard />
        </Tabs.Panel>

        {isPessoaJuridica ? (
          <Tabs.Panel value="empresa" pt="xs">
            <CompanyPanel />
          </Tabs.Panel>
        ) : null}

        <Tabs.Panel value="jornada" pt="xs">
          <GamificationPanel />
        </Tabs.Panel>

        <Tabs.Panel value="plano" pt="xs">
          <BillingSettings />
        </Tabs.Panel>

        <Tabs.Panel value="creditos" pt="xs">
          <CreditsCenter embedded view="creditos" />
        </Tabs.Panel>

        <Tabs.Panel value="cupons" pt="xs">
          <CreditsCenter embedded view="cupons" />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
