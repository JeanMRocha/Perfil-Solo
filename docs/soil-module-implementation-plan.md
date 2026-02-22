# Soil Module Implementation Plan (SiBCS)

## Objetivo
Implementar um cadastro tecnico de solos padronizado pelo SiBCS (Embrapa), reutilizavel no cadastro de talhao e em modulos futuros (analise de solo, recomendacao, relatorios e exportacao).

## Escopo inicial
1. Catalogo de classes de solos (ordens SiBCS) com descricao base.
2. Cadastro tecnico completo de solo por perfil/unidade.
3. Vinculo do solo ao talhao com historico de revisoes.
4. Exibicao e uso dos atributos nos modulos de analise e exportacao.

## Requisitos minimos obrigatorios (SiBCS)

### 1) Identificacao taxonomica
- ordem
- subordem
- grande_grupo
- subgrupo

### 2) Genese (formacao)
- material_origem (rochas, sedimentos, organicos)
- processos_dominantes:
  - latolizacao
  - argiluviacao
  - gleizacao
  - vertissolizacao
  - podzolizacao
  - hidromorfismo
- ambiente_pedogenetico (clima, relevo, drenagem)

### 3) Morfologia e estrutura
- horizontes_diagnosticos (A, E, B, C, Bt, Bw, Bn, Bg etc.)
- estrutura_tipo:
  - granular
  - blocos_subangulares
  - prismatica
  - macica
- estrutura_grau_desenvolvimento
- consistencia_seca
- consistencia_umida
- consistencia_molhada

### 4) Profundidade com valores
- profundidade_efetiva_cm (numero obrigatorio)
- classe_profundidade (derivada automatica, nunca texto manual isolado):

| Classe | Profundidade efetiva |
| --- | --- |
| muito_raso | < 25 cm |
| raso | 25 a 50 cm |
| moderado | 50 a 100 cm |
| profundo | 100 a 200 cm |
| muito_profundo | > 200 cm |

### 5) Atributos fisicos
- areia_percentual
- silte_percentual
- argila_percentual
- gradiente_textural
- densidade_solo
- porosidade
- drenagem_interna
- capacidade_retencao_agua

### 6) Atributos quimicos (descritivos)
- ph_h2o
- ph_kcl
- ctc_cmolc_kg
- saturacao_bases_v_percentual
- saturacao_al_m_percentual
- calcio_ca
- magnesio_mg
- potassio_k
- fosforo_disponivel_p
- materia_organica_percentual_ou_g_kg

### 7) Fertilidade tecnicamente descrita
- fertilidade_descricao_tecnica (texto tecnico estruturado)
- Exemplo de referencia:
  - "Fertilidade natural baixa, caracterizada por V% < 50%, CTC < 10 cmolc/kg e baixos teores de Ca e Mg, exigindo calagem e adubacao corretiva."

### 8) Distribuicao geografica no Brasil
- regioes_predominantes
- ambientes_tipicos
- relacao_biomas

### 9) Aptidao e limitacoes agronomicas
- uso_agricola_indicado
- restricoes_principais:
  - erosao
  - drenagem
  - compactacao
  - toxicidade_aluminio
- manejo_recomendado

## Modelo de dados proposto

### soil_profiles
Tabela/colecao principal para o cadastro tecnico de solo.

Campos base:
- id
- nome_perfil
- codigo_interno
- ordem
- subordem
- grande_grupo
- subgrupo
- material_origem
- processos_dominantes (array string)
- ambiente_pedogenetico
- horizontes_diagnosticos (array string)
- estrutura_tipo (array string)
- estrutura_grau_desenvolvimento
- consistencia_seca
- consistencia_umida
- consistencia_molhada
- profundidade_efetiva_cm
- classe_profundidade (derivada)
- areia_percentual
- silte_percentual
- argila_percentual
- gradiente_textural
- densidade_solo
- porosidade
- drenagem_interna
- capacidade_retencao_agua
- ph_h2o
- ph_kcl
- ctc_cmolc_kg
- saturacao_bases_v_percentual
- saturacao_al_m_percentual
- calcio_ca
- magnesio_mg
- potassio_k
- fosforo_disponivel_p
- materia_organica
- fertilidade_descricao_tecnica
- regioes_predominantes
- ambientes_tipicos
- relacao_biomas
- uso_agricola_indicado
- restricoes_principais (array string)
- manejo_recomendado
- source
- source_url
- created_at
- updated_at

### talhao_soil_history
Historico de vinculacao de solo ao talhao.

Campos base:
- id
- talhao_id
- soil_profile_id
- data_inicio
- data_fim (null para ativo)
- observacoes
- created_at
- updated_at

## Regras de negocio
1. Nao permitir profundidade sem valor numerico.
2. Calcular classe_profundidade automaticamente com base em profundidade_efetiva_cm.
3. Exigir descricao tecnica de fertilidade sem adjetivo solto ("bom", "ruim") sem parametro.
4. Validar textura:
   - areia + silte + argila = 100 (+/- tolerancia configuravel, ex. 1%).
5. Permitir vinculo de um solo ativo por talhao e manter historico de trocas.
6. Permitir heranca de perfil de solo entre talhoes com edicao local opcional.

## Integracao com telas
1. `TalhaoDetailModal`:
   - manter seletor de classe SiBCS.
   - adicionar atalho "Abrir cadastro tecnico" para detalhar o solo selecionado.
2. `CadastroAnaliseSolo`:
   - consumir atributos quimicos/fisicos para contexto.
3. `PropertyExportModal`:
   - exportar dados tecnicos de solo por propriedade/talhao.

## Fases de implementacao
1. Fase 1 - Estrutura e validacoes
   - criar tipos TS e servico `soilProfilesService`.
   - criar regras de validacao.
   - incluir calculo automatico de classe_profundidade.
2. Fase 2 - UI de cadastro tecnico
   - formulario completo em secoes (taxonomia, genese, fisico, quimico, aptidao).
   - estado local + persistencia.
3. Fase 3 - Vinculo no talhao
   - selecionar perfil tecnico no talhao.
   - historico de trocas e auditoria.
4. Fase 4 - Exportacao e relatorios
   - filtros e templates de exportacao por propriedade/talhao.
5. Fase 5 - Regras avancadas
   - sugestoes de manejo.
   - cruzamento com analises laboratoriais.

## Criterios de aceite
1. Usuario consegue cadastrar perfil de solo com todos os campos minimos obrigatorios do SiBCS.
2. Talhao consegue selecionar perfil de solo e manter historico.
3. Exportacao inclui campos tecnicos de solo.
4. Validacoes impedem cadastro incompleto ou inconsistente.

## Seed inicial aplicado
Referencia tecnica incorporada no codigo:
- arquivo: `src/services/soilProfilesService.ts`
- id: `latossolos-referencia-embrapa-v1`
- base:

```json
{
  "ordem": "Latossolos",
  "horizonte_diagnostico": "Bw",
  "processo_formacao": "Latolizacao",
  "profundidade_cm": ">200",
  "estrutura": "Granular forte",
  "textura_argila_percentual": "35-80",
  "ctc_cmolc_kg": "<10",
  "v_percentual": "<50",
  "ph": "4.5-5.8",
  "fertilidade_natural": "Baixa",
  "uso_agricola": "Alta aptidao com correcao",
  "distribuicao": ["Cerrado", "Sudeste", "Norte"]
}
```

Observacao:
- no servico, campos de faixa sao parseados para estrutura numerica (`min`, `max`, `comparator`) para facilitar validacao e calculos.
- seed enriquecido com continuacao tecnica de Latossolos:
  - criterios do horizonte Bw
  - material de origem
  - contexto pedogenetico (latolizacao)
  - densidade e textura
  - nutrientes e limitacoes
  - distribuicao por regioes e biomas
  - manejo recomendado

ORDEM 2 adicionada:
- id: `argissolos-referencia-embrapa-v1`
- inclui:
  - subordens de Argissolos como opcoes de cadastro
  - diagnostico por horizonte `Bt`
  - regra numerica de `mudanca_textural_abrupta` (SiBCS)
  - campos recomendados para avaliacao tecnica (argila A/E, argila Bt, V%, CTC, Al, pH, estrutura Bt e profundidade)
  - limitacoes e manejo conservacionista padrao

ORDEM 3 adicionada:
- id: `cambissolos-referencia-embrapa-v1`
- inclui:
  - diagnostico por horizonte `Bi (B incipiente)`
  - subordens principais (Haplicos, Humicos, Fluvicos)
  - profundidade efetiva tipica (25-150 cm) com classificacao dependente da medicao local
  - variabilidade fisica e quimica marcada no perfil
  - limitacoes tipicas (erosao, baixa profundidade, pedregosidade)
  - diretrizes de manejo conservacionista

ORDEM 4 adicionada:
- id: `neossolos-referencia-embrapa-v1`
- inclui:
  - criterio diagnostico por ausencia de horizonte B diagnostico
  - subordens obrigatorias (Litolicos, Regoliticos, Quartzarenicos, Fluvicos)
  - exigencia de `tipo_impedimento` no cadastro tecnico
  - diferenciacao de limitacoes e aptidao por subordem
  - resumo de manejo: "Neossolos nao se corrigem, se respeitam" (manejo especifico por ambiente)

ORDEM 5 adicionada:
- id: `luvissolos-referencia-embrapa-v1`
- inclui:
  - diagnostico por horizonte `Bt`
  - criterio distintivo: `V% >= 50` na secao de controle (carater eutrico)
  - subordens principais (Cromicos, Hipocromicos, Palicos)
  - enfoque em diferenca tecnica para Argissolos (`V% < 50` vs `V% >= 50`)
  - limitacoes fisicas do Bt (compactacao/infiltracao) e manejo conservacionista

ORDEM 6 adicionada:
- id: `nitossolos-referencia-embrapa-v1`
- inclui:
  - diagnostico por horizonte `Bn (B nitico)`
  - criterio distintivo por qualidade estrutural do subsolo
  - subordens principais (Vermelhos, Haplicos)
  - referencia de argila alta no B nítico (`>350 g/kg`)
  - alta aptidao fisica com foco de manejo em erosao/fosforo

ORDEM 7 adicionada:
- id: `chernossolos-referencia-embrapa-v1`
- inclui:
  - diagnostico por horizonte `A chernozemico`
  - criterio distintivo por alta MO + alta saturacao por bases (`V% >= 50`)
  - subordens principais (Argiluvicos, Rendzicos, Ebanicos, Haplicos)
  - foco em alta fertilidade natural e conservacao estrutural
  - registro de distribuicao pontual (solos raros no Brasil)

ORDEM 8 adicionada:
- id: `espodossolos-referencia-embrapa-v1`
- inclui:
  - diagnostico por horizonte espodico (`Bh`, `Bs`, `Bhs`)
  - processo pedogenetico de `podzolizacao`
  - subordens principais (Humiluvicos, Ferriluvicos, Haplicos)
  - campos de controle para `ortstein` e `lencol freatico`
  - classificacao de aptidao agronomica muito baixa e foco em conservacao

ORDEM 9 adicionada:
- id: `planossolos-referencia-embrapa-v1`
- inclui:
  - diagnostico por horizonte `Bpl (B planico)`
  - foco em limitacao fisico-hidrica (baixa permeabilidade e drenagem restrita)
  - subordens principais (Haplicos, Natricos)
  - campos de sodicidade (`na_trocavel`, `esp_percentual`) para perfis natricos
  - manejo orientado a drenagem, trafego controlado e mitigacao de compactacao

ORDEM 10 adicionada:
- id: `plintossolos-referencia-embrapa-v1`
- inclui:
  - diagnostico por `plintita/petroplintita` com foco em hidromorfismo periodico
  - subordens principais (Haplicos, Argiluvicos, Petricos)
  - campos para tipo e continuidade de plintita (`tipo_plintita`, `continuidade_plintita`)
  - limitacoes por encharcamento, endurecimento irreversivel e fixacao de fosforo
  - manejo com cautela em drenagem e foco em uso de longo prazo

ORDEM 11 adicionada:
- id: `gleissolos-referencia-embrapa-v1`
- inclui:
  - diagnostico por horizonte glei (`Bg/Cg`) e processo de `gleizacao`
  - subordens principais (Haplicos, Melanicos, Salicos, Tiomorficos)
  - campo tecnico para `duracao_saturacao` no conjunto recomendado
  - foco em limitacoes por anoxia, toxidez Fe/Mn e drenagem muito pobre
  - manejo orientado a drenagem controlada e sistemas adaptados a inundacao

ORDEM 12 adicionada:
- id: `organossolos-referencia-embrapa-v1`
- inclui:
  - diagnostico por horizonte histico (`O`) com predominancia organica
  - subordens principais (Fibricos, Hemicos, Sapricos)
  - campo tecnico `grau_decomposicao_mo` e espessura do horizonte histico
  - foco em risco de subsidencia, acidificacao e instabilidade fisica
  - manejo com drenagem minima/controlada e uso conservacionista

ORDEM 13 adicionada:
- id: `vertissolos-referencia-embrapa-v1`
- inclui:
  - diagnostico por `carater vertico` com fendas estacionais e slickensides
  - subordens principais (Haplicos, Ebanicos, Hidromorficos)
  - campos tecnicos para fendas (`largura_fenda_cm`, `profundidade_fenda_cm`) e presenca de slickensides
  - foco em alta fertilidade quimica com limitacao fisica por expansao/contracao
  - manejo orientado a janela de umidade ideal e trafego controlado

## Motor de classificacao hibrido (base inicial)
- arquivo: `src/services/soilClassificationEngine.ts`
- implementado:
  - entrada hibrida laboratorio + campo (`SoilClassificationInput`)
  - calculos automaticos por camada: `SB`, `T`, `V%`, `m%`
  - deteccao automatica de `mudanca_textural_abrupta` com regra operacional
  - arvore de decisao por prioridade para ordens:
    - Organossolos
    - Gleissolos
    - Plintossolos
    - Vertissolos
    - Planossolos
    - Espodossolos
    - Neossolos
    - Cambissolos
    - Argissolos/Luvissolos (via V% no Bt)
    - Nitossolos
    - Latossolos
    - Chernossolos
  - saida padrao:
    - `ordem_provavel`
    - `subordem_provavel`
    - `alternativas`
    - `confianca`
    - `criterios_usados`
    - `dados_faltantes_para_confirmar`
    - `observacoes_agronomicas`
    - `diagnosticos` calculados
- testes iniciais:
  - arquivo: `src/tests/soil-classification-engine.test.ts`
  - cobre regra de Organossolos, Planossolos, separacao Argissolos/Luvissolos, pendencias por dados faltantes e formulas quimicas

## Contrato JSON do motor (Artefato 1)
- arquivo: `src/services/soilClassificationContractService.ts`
- implementado:
  - schema tipado de entrada (`SoilClassificationRequest`) com `meta`, `lab_layers` e `field`
  - normalizacao de unidades:
    - cations: `mmolc_dm3` -> `cmolc_dm3`
    - textura: `g_kg` -> `%`
    - MO: `g_kg` -> `%`
  - validacao de entrada:
    - sobreposicao de camadas
    - `top_cm < bottom_cm`
    - soma textural entre 95 e 105
    - proibicao de valores negativos
    - faixa de pH (3-9)
  - saida contratual (`SoilResultResponse`) com:
    - `primary` (ordem, confianca, modo)
    - `alternatives`
    - `audit` (evidencias, faltantes, metricas derivadas)
    - `agronomic_alerts`
    - `next_steps`
  - funcao de orquestracao: `classifySoilByContract`
- testes do contrato:
  - arquivo: `src/tests/soil-classification-contract-service.test.ts`
  - cobre normalizacao de unidades, deterministico/probabilistico e validacao textural

## Tabela de regras e pontuacao (Artefato 2)
- arquivo: `src/services/soilClassificationRuleTableService.ts`
- implementado:
  - pontuacao por ordem com base + evidencias + conflitos
  - teto por ordem e teto efetivo com penalizacao por `missing_critical`
  - desempate por:
    - maior score
    - menor quantidade de lacunas criticas
    - prioridade de especificidade (Organossolos > Gleissolos > Plintossolos > Vertissolos > Planossolos > ...)
  - metricas derivadas reutilizaveis:
    - `abrupt_textural_change`
    - `v_percent_bt`, `m_percent_bt`, `sb_bt`, `t_bt`
    - `median_clay_pct`, `texture_homogeneous`, `clay_all_le_15`
  - modo por candidato (`deterministic|probabilistic`) conforme assinatura forte
  - integracao no contrato:
    - `classifySoilByContract` passou a usar `scoreSoilOrderCandidates`
    - auditoria agora traz `positive_evidence` e `conflicts` com `score_delta`
- testes da tabela:
  - arquivo: `src/tests/soil-classification-rule-table-service.test.ts`
  - cobre assinatura forte (Organossolos), decisao Luvissolos vs Argissolos e desempate por especificidade

## Checklist SiBCS de campo (Artefato 3)
- arquivo: `src/services/soilFieldChecklistService.ts`
- implementado:
  - checklist estruturado com 17 perguntas objetivas (SIM/NAO/medida/opcao)
  - metadados por pergunta:
    - `how_to_observe`
    - `answer_type`
    - `field_key`
    - ordens favorecidas/penalizadas
  - bloco de confirmacao por ordem provavel:
    - Espodossolos -> confirmar `Bh/Bs/Bhs`
    - Argissolos/Luvissolos -> confirmar `V%` no `Bt`
    - Latossolos -> confirmar `Bw`
    - Nitossolos -> confirmar `Bn`
  - integracao no contrato:
    - `SoilResultResponse.checklist.question_count`
    - `SoilResultResponse.checklist.order_confirmation_focus`
    - `next_steps` agora faz merge de pendencias + foco de confirmacao da ordem
- testes do checklist:
  - arquivo: `src/tests/soil-field-checklist-service.test.ts`
  - cobre quantidade de perguntas e passos de confirmacao por ordem

## Modulos de UI documentados (implementados)
- pasta: `src/modules/soilClassification/`
- componentes criados:
  - `SoilLabForm`
  - `FieldChecklist`
  - `ConfidenceMeter`
  - `RuleEngineReport`
  - `NextStepsPanel`
  - `SoilClassificationWorkspace` (container)
- arquivos de suporte:
  - `defaults.ts` (request padrao)
  - `types.ts` (tipos do workspace)
  - `index.ts` e `components/index.ts` (exports)
- objetivo:
  - disponibilizar os modulos documentados para plug direto no dashboard/talhao sem retrabalho estrutural

## Integracao operacional (implementada)
- arquivo: `src/components/Propriedades/TalhaoDetailModal.tsx`
- comportamento:
  - adicionada acao `Classificar SiBCS` no bloco de dados do talhao
  - abre modal dedicado com `SoilClassificationWorkspace`
  - permite aplicar a `ordem` classificada diretamente no campo `Classe de solo (SiBCS)` do talhao
  - snapshot tecnico (`request + response + confianca`) persistido em `coordenadas_svg` para manter historico sem migracao imediata de schema
  - mantem a tela de detalhamento aberta para continuar edicao e salvar quando desejar

## Fontes de referencia
1. Embrapa - Solos do Brasil: https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil
2. Embrapa - SiBCS bases e criterios: https://www.embrapa.br/solos/sibcs/bases-e-criterios-para-classificacao
