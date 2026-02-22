import { Navigate, createBrowserRouter } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ProtectedPath } from '@components/ProtectedPath';
import SuperModeGuard from '@components/SuperModeGuard';
import { LoaderGlobal } from '@components/loaders';

const Logout = lazy(() => import('@views/Auth/Logout'));
const AppLayout = lazy(() => import('@views/Main/AppLayout'));
const Dashboard = lazy(() => import('@views/Main/Dashboard'));
const Landing = lazy(() => import('@views/Landing/Landing'));

const Authentication = lazy(() => import('@views/Auth/Auth'));
const Register = lazy(() => import('@views/Auth/Register'));
const ForgotPassword = lazy(() => import('@views/Auth/ForgotPassword'));

const UserCenter = lazy(() => import('@views/User/UserCenter'));
const Propriedades = lazy(() => import('@views/Propriedades/Propriedades'));
const CulturasBusca = lazy(() => import('@views/Cadastros/CulturasBusca'));
const CulturasCadastro = lazy(() => import('@views/Cadastros/CulturasCadastro'));
const LaboratoriosBusca = lazy(() => import('@views/Cadastros/LaboratoriosBusca'));
const LaboratoriosCadastro = lazy(
  () => import('@views/Cadastros/LaboratoriosCadastro'),
);
const PessoasBusca = lazy(() => import('@views/Cadastros/PessoasBusca'));
const PessoasCadastro = lazy(() => import('@views/Cadastros/PessoasCadastro'));
const ProdutosBusca = lazy(() => import('@views/Cadastros/ProdutosBusca'));
const ProdutosCadastro = lazy(() => import('@views/Cadastros/ProdutosCadastro'));
const ServicosBusca = lazy(() => import('@views/Cadastros/ServicosBusca'));
const ServicosCadastro = lazy(() => import('@views/Cadastros/ServicosCadastro'));

const DashboardAnaliseSolo = lazy(
  () => import('@views/AnaliseSolo/DashboardAnaliseSolo'),
);
const CadastroAnaliseSolo = lazy(
  () => import('@views/AnaliseSolo/CadastroAnaliseSolo'),
);
const RelatorioAnalise = lazy(
  () => import('@views/Relatorios/RelatorioAnalise'),
);
const Marketplace = lazy(() => import('@views/Marketplace/Marketplace'));
const NotificationsCenter = lazy(
  () => import('@views/Notifications/NotificationsCenter'),
);
const PrivacyPolicy = lazy(() => import('@views/Legal/PrivacyPolicy'));
const CookiesNotice = lazy(() => import('@views/Legal/CookiesNotice'));
const LgpdNotice = lazy(() => import('@views/Legal/LgpdNotice'));
const SystemIdentity = lazy(() => import('@views/Super/SystemIdentity'));
const UserManagement = lazy(() => import('@views/Super/UserManagement'));
const ApiMode = lazy(() => import('@views/Integracoes/ApiMode'));
const AulasHub = lazy(() => import('@views/Aulas/AulasHub'));
const KnowledgeHub = lazy(() => import('@views/Knowledge/KnowledgeHub'));
const SolosHub = lazy(() => import('@views/Solos/SolosHub'));
const ThemePersonalization = lazy(
  () => import('@views/Config/ThemePersonalization'),
);
const RncCultivarSelector = lazy(
  () => import('@views/Rnc/RncCultivarSelector'),
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<LoaderGlobal message="Carregando home..." />}>
        <Landing />
      </Suspense>
    ),
  },
  {
    element: (
      <Suspense fallback={<LoaderGlobal message="Carregando layout..." />}>
        <ProtectedPath redirectUrl="/auth">
          <AppLayout />
        </ProtectedPath>
      </Suspense>
    ),
    children: [
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando dashboard..." />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: 'user',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando central do usuário..." />}>
            <UserCenter />
          </Suspense>
        ),
      },
      {
        path: 'config',
        element: <Navigate to="/user?tab=plano" replace />,
      },
      {
        path: 'config/aparencia',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando personalizacao..." />}>
            <ThemePersonalization />
          </Suspense>
        ),
      },
      {
        path: 'marketplace',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando ecossistema..." />}>
            <Marketplace />
          </Suspense>
        ),
      },
      {
        path: 'notificacoes',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando notificacoes..." />}>
            <NotificationsCenter />
          </Suspense>
        ),
      },
      {
        path: 'propriedades',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando propriedades..." />}>
            <Propriedades />
          </Suspense>
        ),
      },
      {
        path: 'cadastros',
        children: [
          {
            path: 'culturas/busca',
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando culturas..." />}>
                <CulturasBusca />
              </Suspense>
            ),
          },
          {
            path: 'culturas/cadastro',
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando cultura..." />}>
                <CulturasCadastro />
              </Suspense>
            ),
          },
          {
            path: 'laboratorios/busca',
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando laboratorios..." />}>
                <LaboratoriosBusca />
              </Suspense>
            ),
          },
          {
            path: 'laboratorios/cadastro',
            element: (
              <Suspense
                fallback={<LoaderGlobal message="Carregando cadastro de laboratorio..." />}
              >
                <LaboratoriosCadastro />
              </Suspense>
            ),
          },
          {
            path: 'pessoas/busca',
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando pessoas..." />}>
                <PessoasBusca />
              </Suspense>
            ),
          },
          {
            path: 'pessoas/cadastro',
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando cadastro de pessoa..." />}>
                <PessoasCadastro />
              </Suspense>
            ),
          },
          {
            path: 'produtos/busca',
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando produtos..." />}>
                <ProdutosBusca />
              </Suspense>
            ),
          },
          {
            path: 'produtos/cadastro',
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando cadastro de produto..." />}>
                <ProdutosCadastro />
              </Suspense>
            ),
          },
          {
            path: 'servicos/busca',
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando servicos..." />}>
                <ServicosBusca />
              </Suspense>
            ),
          },
          {
            path: 'servicos/cadastro',
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando cadastro de servico..." />}>
                <ServicosCadastro />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'relatorios',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando relatorios..." />}>
            <RelatorioAnalise />
          </Suspense>
        ),
      },
      {
        path: 'clientes',
        element: <Navigate to="/cadastros/pessoas/busca" replace />,
      },
      {
        path: 'legal/privacidade',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando politica..." />}>
            <PrivacyPolicy />
          </Suspense>
        ),
      },
      {
        path: 'legal/cookies',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando aviso..." />}>
            <CookiesNotice />
          </Suspense>
        ),
      },
      {
        path: 'legal/lgpd',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando LGPD..." />}>
            <LgpdNotice />
          </Suspense>
        ),
      },
      {
        path: 'super/sistema',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando modulo super..." />}>
            <SuperModeGuard>
              <SystemIdentity />
            </SuperModeGuard>
          </Suspense>
        ),
      },
      {
        path: 'super/logo',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando modulo super..." />}>
            <SuperModeGuard>
              <SystemIdentity />
            </SuperModeGuard>
          </Suspense>
        ),
      },
      {
        path: 'super/usuarios',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando gestao de usuários..." />}>
            <SuperModeGuard>
              <UserManagement />
            </SuperModeGuard>
          </Suspense>
        ),
      },
      {
        path: 'integracoes/api',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando modo API..." />}>
            <ApiMode />
          </Suspense>
        ),
      },
      {
        path: 'creditos',
        element: <Navigate to="/user?tab=creditos" replace />,
      },
      {
        path: 'cupons',
        element: <Navigate to="/user?tab=cupons" replace />,
      },
      {
        path: 'aulas',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando aulas..." />}>
            <AulasHub />
          </Suspense>
        ),
      },
      {
        path: 'conhecimento',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando conhecimento..." />}>
            <KnowledgeHub />
          </Suspense>
        ),
      },
      {
        path: 'solos',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando solos..." />}>
            <SolosHub />
          </Suspense>
        ),
      },
      {
        path: 'analise-solo',
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando análises..." />}>
                <DashboardAnaliseSolo />
              </Suspense>
            ),
          },
          {
            path: 'cadastro',
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando cadastro..." />}>
                <CadastroAnaliseSolo />
              </Suspense>
            ),
          },
          {
            path: 'relatorio',
            element: (
              <Suspense fallback={<LoaderGlobal message="Gerando laudo..." />}>
                <RelatorioAnalise />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '/auth',
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando login..." />}>
            <Authentication />
          </Suspense>
        ),
      },
      {
        path: 'logout',
        element: (
          <Suspense fallback={<LoaderGlobal message="Saindo..." />}>
            <Logout />
          </Suspense>
        ),
      },
      {
        path: 'register',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando registro..." />}>
            <Register />
          </Suspense>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando recuperacao..." />}>
            <ForgotPassword />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '/rnc/cultivares/selector',
    element: (
      <Suspense fallback={<LoaderGlobal message="Carregando seletor RNC..." />}>
        <ProtectedPath redirectUrl="/auth">
          <RncCultivarSelector />
        </ProtectedPath>
      </Suspense>
    ),
  },
]);
