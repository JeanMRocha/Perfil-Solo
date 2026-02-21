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
import GamificationPanel from './GamificationPanel';
import ProfilePage from './Profile';
import TwoFactorSecurityCard from './TwoFactorSecurityCard';

export default function UserCenter() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = resolveUserCenterTab(location.search);

  const handleTabChange = (value: string | null) => {
    const nextTab = resolveUserCenterTab(`?tab=${value ?? ''}`);
    if (nextTab === activeTab) return;
    navigate(buildUserCenterPath(nextTab as UserCenterTab), { replace: true });
  };

  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Central do Usuario" />
      <Text c="dimmed" size="sm" mb="md">
        Interface consolidada do usuario logado: perfil, jornada, plano, creditos e cupons.
      </Text>

      <Tabs value={activeTab} onChange={handleTabChange} variant="outline">
        <Tabs.List>
          <Tabs.Tab value="perfil">Perfil</Tabs.Tab>
          <Tabs.Tab value="jornada">Jornada</Tabs.Tab>
          <Tabs.Tab value="plano">Plano e Faturamento</Tabs.Tab>
          <Tabs.Tab value="creditos">Creditos</Tabs.Tab>
          <Tabs.Tab value="cupons">Cupons</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="perfil" pt="md">
          <TwoFactorSecurityCard />
          <ProfilePage embedded />
        </Tabs.Panel>

        <Tabs.Panel value="jornada" pt="md">
          <GamificationPanel />
        </Tabs.Panel>

        <Tabs.Panel value="plano" pt="md">
          <BillingSettings />
        </Tabs.Panel>

        <Tabs.Panel value="creditos" pt="md">
          <CreditsCenter embedded view="creditos" />
        </Tabs.Panel>

        <Tabs.Panel value="cupons" pt="md">
          <CreditsCenter embedded view="cupons" />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
