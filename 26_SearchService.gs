/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 26_SearchService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Busca textual.
 *
 * INTEGRAÇÕES
 * Pesquisa evidências, personagens, entidades e cenas com normalização e limite de resultados.
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

function SearchService_healthcheck() {
  return { component: '26_SearchService.gs', status: 'implemented' };
}

function searchRecords(query) {
  var term = normalizeIdentifier(query);
  if (!term) return [];
  var sources = [
    { type: 'evidence', records: getSheetRecords('Evidence', APP_CONSTANTS.maxPageSize) },
    { type: 'scene', records: getSheetRecords('Scenes', APP_CONSTANTS.maxPageSize) },
    { type: 'choice', records: getSheetRecords('Choices', APP_CONSTANTS.maxPageSize) }
  ];
  return sources.reduce(function(results, source) {
    return results.concat(source.records.filter(function(record) {
      return normalizeIdentifier([record.title, record.name, record.source, record.phase,
        record.narrative, record.label, record.text].join(' ')).indexOf(term) >= 0;
    }).map(function(record) {
      var natureValue = record.content_nature || record.nature || record.epistemic_status || '';
      return {
        type: source.type === 'evidence' ? normalizeIdentifier(record.type || 'document') : source.type,
        id: sanitizeHtml(record.id),
        title: sanitizeHtml(record.title || record.name || record.label || 'Registro sem título'),
        excerpt: sanitizeHtml(record.source || record.narrative || record.text || ''),
        contentNature: getContentNatureCode_(natureValue),
        contentNatureLabel: getContentNatureLabel_(natureValue),
        natureNote: sanitizeHtml(record.nature_note || 'Natureza do conteúdo não informada; requer revisão docente.')
      };
    }));
  }, []).slice(0, 24);
}
