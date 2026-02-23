/**
 * Script de Teste: Importação Completa do RNC
 *
 * Para usar este script:
 * 1. Abra o navegador em /super/culture-sync
 * 2. Abra o console (F12 > Console)
 * 3. Cole o código abaixo e execute
 *
 * Alternativa: Importe dinamicamente o módulo
 *
 * import('./src/services/cultureImportService.ts').then(m => {
 *   m.fullImportRncDatabase((current, total, msg) => {
 *     console.log(`[${current}/${total}] ${msg}`);
 *   }).then(result => {
 *     console.log('✓ Importação completa!');
 *     console.table(result);
 *   });
 * });
 */

// Este arquivo é apenas para referência. Use o painel administrativo em /super/culture-sync
// para fazer a importação de forma segura e com interface visual.

// EXEMPLO DE USO NO CONSOLE:
/*

// 1. Defina um callback para progresso
const onProgress = (current, total, message) => {
  const percent = Math.round((current / total) * 100);
  console.log(`${percent}% - ${message}`);
};

// 2. Importe a função (se ainda não estiver no escopo)
// Você pode obtê-la do módulo de serviços

// 3. Execute a importação
// await fullImportRncDatabase(onProgress);

// 4. Verifique os resultados na notificação

*/

export const IMPORT_GUIDE = `
GUIA RÁPIDO: Importar Todas as Culturas do RNC
==============================================

OPÇÃO 1 - Painel Administrativo (Recomendado)
----------------------------------------------
1. Vá para: /super/culture-sync
2. Localize: "Importação Completa do RNC"
3. Clique: "Importar Tudo" (botão verde)
4. Aguarde: 2-5 minutos
5. Confira: Resultados na notificação

OPÇÃO 2 - Console JavaScript
-----------------------------
1. Abra: DevTools (F12 → Console)
2. Cole: (veja abaixo)
3. Execute: Enter

CODE:
-----
(async () => {
  const { fullImportRncDatabase } = await import('./src/services/cultureImportService.ts');
  const result = await fullImportRncDatabase((current, total, msg) => {
    console.clear();
    console.log(\`Progresso: \${msg}\`);
    console.log(\`[\${current}/\${total}] \${Math.round((current/total)*100)}%\`);
  });
  console.table(result);
})();

RESULTADO ESPERADO:
-------------------
✓ total_imported: 15,000+
✓ groups_imported: 20+ grupos
✓ duration_seconds: 2-5 minutos
✓ total_errors: <5%

PRÓXIMOS PASSOS:
----------------
1. Teste a busca em /culturas
2. Importe um cultivar manualmente
3. Configure parametrização técnica
4. Ative sincronização automática em /super/culture-sync

DÚVIDAS?
--------
Verifique: /super/culture-sync → Histórico
para ver logs detalhados das importações.
`;
