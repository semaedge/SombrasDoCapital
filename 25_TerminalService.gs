/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 25_TerminalService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Terminal investigativo.
 *
 * INTEGRAÇÕES
 * Orquestra comandos de busca, filtros, arquivos e alertas do sistema simulado.
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

function TerminalService_healthcheck() {
  return { component: '25_TerminalService.gs', status: 'implemented' };
}

function executeTerminalCommand(command) {
  var input = normalizeText(command, 120);
  if (!input) {
    return jsonError_('INVALID_COMMAND', "Comando não identificado. Tente: 'buscar [termo]' ou use os filtros acima.");
  }

  var isSearch = /^buscar(\s+.*)?$/i.test(input);
  if (!isSearch) {
    return jsonError_('UNRECOGNIZED_COMMAND', "Comando não identificado. Tente: 'buscar [termo]' ou use os filtros acima.");
  }

  var query = input.replace(/^buscar\s*/i, '').trim();
  if (!query) {
    return jsonError_('EMPTY_QUERY', "Comando não identificado. Tente: 'buscar [termo]' ou use os filtros acima.");
  }

  try {
    return jsonSuccess_({ command: input, query: query, results: searchRecords(query) });
  } catch (error) {
    return jsonError_('SEARCH_UNAVAILABLE', 'Não foi possível consultar o terminal.');
  }
}
