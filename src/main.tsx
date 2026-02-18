import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { RouterProvider } from 'react-router-dom';

import { useStore } from '@nanostores/react';
import { $tema } from '@global/themeStore';
import { initGlobalErrorCatcher } from '@global/errorCatcher';
import { mantineModals } from './mantine/modals/modals';
import { mantineTheme } from './mantine/theme';
import { CustomSpotlight } from './mantine/spotlight';
import { router } from './router/router';
import ErrorBoundary from '@components/errors/ErrorBoundary';
import { LoaderGlobal } from '@components/loaders';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';

initGlobalErrorCatcher();

/**
 * 🔰 AppRoot centraliza Providers, Tema dinâmico e ErrorBoundary no topo.
 * Mantine v8: controle de tema via `forceColorScheme` no MantineProvider.
 */
function AppRoot() {
  const tema = useStore($tema); // 'light' | 'dark'

  return (
    <ErrorBoundary>
      <MantineProvider
        theme={mantineTheme}
        forceColorScheme={tema}
      >
        <Notifications position="top-right" />
        <CustomSpotlight />
        <ModalsProvider modals={mantineModals}>
          <Suspense
            fallback={<LoaderGlobal message="Carregando aplicação..." />}
          >
            <RouterProvider router={router} />
          </Suspense>
        </ModalsProvider>
      </MantineProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
