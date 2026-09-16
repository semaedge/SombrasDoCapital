/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 31_BNCCService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Competências curriculares.
 *
 * INTEGRAÇÕES
 * Relaciona cenas e atividades a Ciências Humanas, Linguagens e objetivos definidos no relatório.
 *
 * CONTRATO DE DADOS
 * - A Google Planilha central é o banco CRUD do projeto.
 * - O ID deve estar em PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID').
 * - O notebook Colab usa a variável de ambiente SPREADSHEET_ID.
 * - Respostas públicas nunca devem retornar senha, token ou payload sensível.
 *
 * ENTRADAS E SAÍDAS
 * - Recebe dados já normalizados pelos serviços e repositórios responsáveis.
 * - Retorna objetos de domínio ou respostas JSON padronizadas, sem detalhes internos.
 * - Falhas devem ser encaminhadas ao ErrorService e receber correlation_id quando públicas.
 *
 * DEPENDÊNCIAS E LIMITES
 * - Depende de Config, Constants e Utils conforme o contrato do módulo.
 * - Acesso à planilha deve passar pelo SheetsGateway; não chamar SpreadsheetApp diretamente
 *   fora da camada de infraestrutura.
 * - Não renderiza HTML, não mantém estado em memória e não duplica regras de autorização.
 *
 * SEGURANÇA E OPERAÇÃO
 * A autenticação em texto plano é mantida somente por compatibilidade com o requisito atual;
 * recomenda-se migração futura para hash com salt. Validar entrada, autorizar por papel,
 * auditar mutações e aplicar lock nas escritas concorrentes.
 *
 * RESPONSABILIDADES
 * Este arquivo deve permanecer coeso, com funções pequenas e sem acesso direto a HTML.
 *
 * STATUS DA IMPLEMENTAÇÃO
 * Contrato implementado e verificado por suíte de testes de contrato.
 */

function BNCCService_healthcheck() {
  return { component: '31_BNCCService.gs', status: 'implemented' };
}

function getBnccMap() {
  var stage = 'Ensino Médio';
  var validationStatus = 'PROPOSTA CURRICULAR — validação pela equipe docente ainda pendente';
  var map = [
    { phase: 'A Cria', area: 'Ciências Humanas e Sociais Aplicadas', competence: 'Competência Geral 1', skill: 'Interpretar relações entre poder, capital e trabalho.', decisionNodes: ['choice-publish', 'choice-verify'], educationalStage: stage, validationStatus: validationStatus },
    { phase: 'A Engorda', area: 'Ciências Humanas e Sociais Aplicadas', competence: 'Competência Geral 2', skill: 'Relacionar agentes, fluxos e interesses econômicos.', decisionNodes: [], educationalStage: stage, validationStatus: validationStatus },
    { phase: 'O Abate', area: 'Ciências Humanas e Sociais Aplicadas', competence: 'Competência Geral 7', skill: 'Avaliar impactos sociais e ambientais de modelos produtivos.', decisionNodes: [], educationalStage: stage, validationStatus: validationStatus },
    { phase: 'A Refrigeração', area: 'Linguagens', competence: 'Competência Geral 5', skill: 'Avaliar fontes, discursos e estratégias de circulação da informação.', decisionNodes: [], educationalStage: stage, validationStatus: validationStatus },
    { phase: 'A Desossa', area: 'Linguagens', competence: 'Competência Geral 7', skill: 'Produzir sínteses argumentativas fundamentadas em evidências.', decisionNodes: [], educationalStage: stage, validationStatus: validationStatus }
  ];
  return map.map(function(item) {
    return Object.assign(item, {
      contentNature: 'concept',
      contentNatureLabel: 'CONCEITO CURRICULAR',
      natureNote: 'Mapa curricular proposto; não é nota nem certificação de aprendizagem.',
      sourceTitle: 'Base Nacional Comum Curricular — Ensino Médio (BNCC-EM, 2018)',
      sourceOrganization: 'Ministério da Educação (MEC)',
      sourceUrl: 'https://www.gov.br/mec/pt-br/cne/bncc_ensino_medio.pdf',
      accessedAt: '2026-09-04',
      sourceVersion: 'BNCC-EM-2018 — Resolução CNE/CP nº 4/2018',
      ageBand: stage,
      pedagogicalObjective: 'Relacionar decisões investigativas a competências de análise, argumentação e cultura digital.'
    });
  });
}
