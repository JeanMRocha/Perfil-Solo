import { createBrowserRouter } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ProtectedPath } from '@components/ProtectedPath';
import { LoaderGlobal } from '@components/loaders';

const Logout = lazy(() => import('@views/Auth/Logout'));
const AppLayout = lazy(() => import('@views/Main/AppLayout'));
const Dashboard = lazy(() => import('@views/Main/Dashboard'));
const Landing = lazy(() => import('@views/Landing/Landing'));

const Authentication = lazy(() => import('@views/Auth/Auth'));
const Register = lazy(() => import('@views/Auth/Register'));
const ForgotPassword = lazy(() => import('@views/Auth/ForgotPassword'));

const UserProfile = lazy(() => import('@views/User/Profile'));
const Settings = lazy(() => import('@views/Config/Settings'));
const Propriedades = lazy(() => import('@views/Propriedades/Propriedades'));
const Clientes = lazy(() => import('@views/Clientes/Clientes'));
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
          <Suspense fallback={<LoaderGlobal message="Carregando perfil..." />}>
            <UserProfile />
          </Suspense>
        ),
      },
      {
        path: 'config',
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando configuracoes..." />}>
            <Settings />
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
        element: (
          <Suspense fallback={<LoaderGlobal message="Carregando clientes..." />}>
            <Clientes />
          </Suspense>
        ),
      },
      {
        path: 'analise-solo',
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoaderGlobal message="Carregando analises..." />}>
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
]);
