import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
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

  const handleTabChange = (value: string) => {
    const nextTab = resolveUserCenterTab(`?tab=${value ?? ''}`);
    if (nextTab === activeTab) return;
    navigate(buildUserCenterPath(nextTab as UserCenterTab), { replace: true });
  };

  return (
    <div className="container mx-auto mt-4 max-w-7xl">
      <PageHeader title="Central do Usuário" />
      <p className="mb-2 text-sm text-muted-foreground">
        Interface consolidada do usuario logado: usuario, seguranca, jornada, plano, creditos e cupons.
      </p>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="perfil">Usuario</TabsTrigger>
          <TabsTrigger value="seguranca">Seguranca</TabsTrigger>
          {isPessoaJuridica ? <TabsTrigger value="empresa">Empresa</TabsTrigger> : null}
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="plano">Plano e Faturamento</TabsTrigger>
          <TabsTrigger value="creditos">Creditos</TabsTrigger>
          <TabsTrigger value="cupons">Cupons</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="pt-2">
          <ProfilePage embedded />
        </TabsContent>

        <TabsContent value="seguranca" className="pt-2">
          <TwoFactorSecurityCard />
          <LoginHistoryCard />
        </TabsContent>

        {isPessoaJuridica ? (
          <TabsContent value="empresa" className="pt-2">
            <CompanyPanel />
          </TabsContent>
        ) : null}

        <TabsContent value="jornada" className="pt-2">
          <GamificationPanel />
        </TabsContent>

        <TabsContent value="plano" className="pt-2">
          <BillingSettings />
        </TabsContent>

        <TabsContent value="creditos" className="pt-2">
          <CreditsCenter embedded view="creditos" />
        </TabsContent>

        <TabsContent value="cupons" className="pt-2">
          <CreditsCenter embedded view="cupons" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
