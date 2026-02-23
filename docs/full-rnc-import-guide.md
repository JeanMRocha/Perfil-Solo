# Guia de Importação Completa das Culturas do RNC

## Visão Geral

Este documento descreve como importar TODAS as culturas registradas no Registro Nacional de Cultivares (RNC) para seu banco de dados local, permitindo que usuários comuns tenham acesso a um catálogo completo de culturas e cultivares.

## Status Atual

- ✅ Apenas 3 culturas no banco de dados
- ✅ Sistema de importação implementado
- ✅ Interface administrativa criada
- ✅ Função de bulk import com progresso em tempo real

## Métodos de Importação

### Método 1: Painel Administrativo (Recomendado)

**Melhor para**: Usuários normais com acesso ao painel de admin

1. Acesse `/super/culture-sync` (painel de super-usuário)
2. Na aba **Status**, procure por "Importação Completa do RNC"
3. Clique no botão verde **"Importar Tudo"**
4. Aguarde o progresso completar (pode levar 2-5 minutos)
5. Verifique os resultados na notificação

**Características**:

- ✅ Barra de progresso em tempo real
- ✅ Feedback detalhado
- ✅ Tratamento automático de erros
- ✅ Sem necessidade de terminal

### Método 2: Console do Navegador (Para Testes)

**Melhor para**: Testes e debugging

```javascript
// 1. Abra o console do navegador (F12)

// 2. Execute o script de importação
import('./src/services/cultureImportService.js').then((module) => {
  const { fullImportRncDatabase } = module;

  fullImportRncDatabase((current, total, message) => {
    console.log(`[${current}/${total}] ${message}`);
  }).then((result) => {
    console.log('Importação completa!', result);
    console.log(`Importados: ${result.total_imported}`);
    console.log(`Grupos: ${result.groups_imported.join(', ')}`);
  });
});
```

### Método 3: Programático (Node.js / Edge Function)

**Melhor para**: Automação e integração

```typescript
import { fullImportRncDatabase } from './services/cultureImportService';

const result = await fullImportRncDatabase((current, total, message) => {
  console.log(
    `Progresso: ${Math.round((current / total) * 100)}% - ${message}`,
  );
});

console.log(`Total importado: ${result.total_imported}`);
console.log(`Tempo decorrido: ${result.duration_seconds}s`);
```

## O que Acontece Durante a Importação

1. **Busca Paginada**: Sistema busca dados do RNC em páginas de até 500 registros
2. **Validação**: Cada registro é validado com:
   - Nome científico ou comum
   - Grupo de espécie
   - Situação no RNC
3. **Armazenamento Local**: Criação/atualização de:
   - `crop_species_profiles` (espécies únicas)
   - `crop_cultivar_profiles` (cultivares vinculados à espécie)
4. **Tracking**: Cada operação é rastreada com:
   - Total processado
   - Sucessos/falhas
   - Grupo de espécies importadas
   - Tempo total

## Estrutura de Dados Importados

### Espécies (crop_species_profiles)

```typescript
{
  id: string; // UUID
  user_id: string; // Proprietário
  species_key: string; // Nome científico normalizado
  especie_nome_comum: string; // Ex: "Milho", "Soja"
  especie_nome_cientifico: string; // Ex: "Zea mays L."
  grupo_especie: string; // Ex: "CEREAIS", "LEGUMINOSAS"
  technical_data: {
  } // Dados técnicos (vazio na importação)
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Cultivares (crop_cultivar_profiles)

```typescript
{
  id: string; // UUID
  user_id: string; // Proprietário
  species_profile_id: string; // FK para espécie
  cultivar_key: string; // Chave única normalizada
  cultivar_nome: string; // Nome do cultivar registrado
  base_cultivar_key: string | null; // Para cultivares derivados
  rnc_detail_url: string | null; // Link para RNC
  technical_data: {
  } // Dados técnicos (vazio na importação)
  created_at: timestamp;
  updated_at: timestamp;
}
```

## Resultado Esperado

### Para Usuários Comuns

Após a importação completa, usuários comuns terão acesso a:

1. **Tab "Busca de Culturas"**: Consultar todo catálogo importado
2. **Filtros Avançados**:

   - Por nome comum (Milho, Soja, etc.)
   - Por grupo (Cereais, Leguminosas, etc.)
   - Por cultivar específico

3. **Importação Manual**: Botão "Importar" para cada cultivar desejado

### Para Administradores

Após a importação completa, você terá:

1. **Dashboard de Status**: Ver estatísticas de importação
2. **Log de Histórico**: Rastrear todas as sincronizações
3. **Limpeza de Dados**: Gerenciar retenção de logs

## Estatísticas Típicas

Uma importação completa do RNC normalmente resulta em:

- **Total de Registros**: ~15,000+ registros
- **Espécies Únicas**: ~1,500+ espécies
- **Grupos**: ~20+ grupos (Cereais, Frutíferas, Olerícolas, etc.)
- **Tempo Estimado**: 2-5 minutos
- **Taxa de Sucesso**: ~95%+ (a maioria dos registros inválidos é ignorada)

## Tratamento de Erros

Se ocorrerem erros durante a importação:

1. **Erros Parciais**: Sistema continua importando registros válidos
2. **Erros Críticos**: Importação para e exibe mensagem
3. **Retry Automático**: Não implementado (favor fazer manualmente)

### Erros Comuns

| Erro                      | Causa                   | Solução                              |
| ------------------------- | ----------------------- | ------------------------------------ |
| "Usuário não autenticado" | Sessão expirada         | Faça login novamente                 |
| "Falha ao consultar RNC"  | Conexão de rede         | Verifique internet e tente novamente |
| "Registros duplicados"    | Importação já executada | Dados já estão no banco              |

## Próximos Passos Após Importação

1. **Teste de Busca**: Vá para "/culturas" e busque por "milho"
2. **Edição de Parâmetros**: Importe um cultivar e adicione dados técnicos
3. **Sincronização Automática**: Ative cron semanal em `/super/culture-sync`

## Perguntas Frequentes

### P: Quanto tempo leva a importação?

R: Normalmente 2-5 minutos, dependendo da conexão de internet.

### P: Posso fazer nova importação sem apagar os dados antigos?

R: Sim, o sistema detecta duplicatas e evita re-importar registros idênticos.

### P: Os dados importados são públicos?

R: Não, cada usuário tem seus próprios registros vinculados a `user_id`.

### P: Preciso ser super-usuário?

R: Para usar o painel administrativo, sim. Mas qualquer usuário autenticado pode importar cultivares individuais.

## Arquitetura Técnica

### Fluxo de Importação

```
User Clica "Importar Tudo"
    ↓
fullImportRncDatabase() inicia
    ↓
Loop: Busca páginas do RNC (searchRncCultivars)
    ↓
Para cada página: bulkImportRncRecords()
    ↓
Para cada registro:
  - importOrEnsureSpecies() → cria/encontra espécie
  - importCultivar() → cria/encontra cultivar
  - Calcula hash MD5 para dedup
    ↓
Retorna: FullRncImportResult com estatísticas
    ↓
Modal exibe: total_imported, duration, groups_imported
```

### Tecnologias Utilizadas

- **Frontend**: React + TypeScript + Mantine UI
- **Backend**: Supabase (PostgreSQL)
- **Sincronização**: hash-based deduplication (MD5)
- **Paginação**: 500 registros por página
- **Timeout**: Nenhum (aguarda conclusão)

## Próximas Melhorias

- [ ] Exporte de dados importados (CSV, JSON)
- [ ] Sincronização incremental (apenas novos registros)
- [ ] Agendamento de importações recorrentes
- [ ] Comparação de versões RNC
- [ ] Tratamento de cultivares descontinuados

## Suporte

Se encontrar problemas:

1. Verifique a autenticação
2. Verifique a conexão de internet
3. Tente novamente em horário de menor uso
4. Consulte os logs em `/super/culture-sync` → Histórico

---

**Última atualização**: Fevereiro 22, 2026
**Versão**: 1.0
