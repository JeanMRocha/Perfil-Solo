/// <reference types="vitest" />
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';

// Carrega .env no lado Node (apenas para logs no start)
dotenv.config();

console.log('[dotenv] inject:');
console.log('  VITE_SUPABASE_URL =', process.env.VITE_SUPABASE_URL);
console.log(
  '  VITE_SUPABASE_ANON_KEY =',
  process.env.VITE_SUPABASE_ANON_KEY ? 'OK' : 'FALTA',
);

// ⚠️ Observação: o Vite já injeta automaticamente *no client* todas as variáveis que
// começam com VITE_. O bloco "define" abaixo é opcional. Se mantiver, ele força
// a definição mesmo quando o .env não é lido por algum motivo.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@global': path.resolve(__dirname, 'src/global-state'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@views': path.resolve(__dirname, 'src/views'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@sb': path.resolve(__dirname, 'src/supabase'),
    },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL,
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY,
    ),
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
