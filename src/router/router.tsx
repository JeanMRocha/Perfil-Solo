import { createBrowserRouter } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ProtectedPath } from '@components/ProtectedPath';
const Logout = lazy(() => import('@views/Auth/Logout'));
import { LoaderGlobal } from '@components/loaders';

// 🌿 Lazy loading dos módulos
const AppLayout = lazy(() => import('@views/Main/AppLayout'));
const App = lazy(() => import('@views/Main/App'));
const Dashboard = lazy(() => import('@views/Main/Dashboard'));

// 🔐 Auth
const Authentication = lazy(() => import('@views/Auth/Auth'));
const Register = lazy(() => import('@views/Auth/Register'));
const ForgotPassword = lazy(() => import('@views/Auth/ForgotPassword'));

// 👤 User / ⚙️ Settings
// Se Profile.tsx exporta *default*, use a linha abaixo:
const UserProfile = lazy(() => import('@views/User/Profile'));
// Se ele NÃO exporta default (ex.: `export function UserProfile()`), troque pela debaixo:
// const UserProfile = lazy(() => import('@views/User/Profile').then(m => ({ default: m.UserProfile })));

const Settings = lazy(() => import('@views/Config/Settings'));

// 🌾 Análise de Solo
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
      <Suspense fallback={<LoaderGlobal message="Carregando layout..." />}>
        <ProtectedPath redirectUrl="/auth">
          <AppLayout />
        </ProtectedPath>
      </Suspense>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense
            fallback={<LoaderGlobal message="Carregando aplicação..." />}
          >
            <App />
          </Suspense>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <Suspense
            fallback={<LoaderGlobal message="Carregando dashboard..." />}
          >
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
          <Suspense
            fallback={<LoaderGlobal message="Carregando configurações..." />}
          >
            <Settings />
          </Suspense>
        ),
      },
      {
        path: 'marketplace',
        element: (
          <Suspense
            fallback={<LoaderGlobal message="Carregando ecossistema..." />}
          >
            <Marketplace />
          </Suspense>
        ),
      },
      {
        path: 'analise-solo',
        children: [
          {
            index: true,
            element: (
              <Suspense
                fallback={<LoaderGlobal message="Carregando análises..." />}
              >
                <DashboardAnaliseSolo />
              </Suspense>
            ),
          },
          {
            path: 'cadastro',
            element: (
              <Suspense
                fallback={<LoaderGlobal message="Carregando cadastro..." />}
              >
                <CadastroAnaliseSolo />
              </Suspense>
            ),
          },
          {
            path: 'relatorio',
            element: (
              <Suspense
                fallback={<LoaderGlobal message="Gerando laudo..." />}
              >
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
          <Suspense
            fallback={<LoaderGlobal message="Carregando registro..." />}
          >
            <Register />
          </Suspense>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <Suspense
            fallback={<LoaderGlobal message="Carregando recuperação..." />}
          >
            <ForgotPassword />
          </Suspense>
        ),
      },
    ],
  },
]);
