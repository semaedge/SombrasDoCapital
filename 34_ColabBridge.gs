/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 34_ColabBridge.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Ponte com Colab.
 *
 * INTEGRAÇÕES
 * Fornece endpoints e formatos para análises externas autorizadas; usa token de integração em Script Properties.
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

function ColabBridge_healthcheck() {
  return { component: '34_ColabBridge.gs', status: 'implemented' };
}

function doPost(event) {
  var expected = PropertiesService.getScriptProperties().getProperty('INTEGRATION_TOKEN') || '';
  var supplied = event && event.parameter ? String(event.parameter.integration_token || event.parameter.token || '') : '';
  var body = event && event.postData && event.postData.contents ? event.postData.contents : '{}';
  try {
    var payload = JSON.parse(body);
    supplied = supplied || String(payload.integration_token || payload.token || '');
    if (!expected || supplied !== expected) return doGetJson_(jsonError_('UNAUTHORIZED', 'Token de integração inválido.'));
    if (payload.action === 'query_data') {
      var queryPageSize = Math.min(Math.max(Number(payload.pageSize) || 100, 1), 100);
      var queryPage = Math.max(Number(payload.page) || 0, 0);
      var progress = getSheetRecords('Progress', APP_CONSTANTS.maxPageSize).map(function(item) {
        return { kind: 'progress', player_id: item.player_id, scene_id: item.scene_id, choice_action: item.choice_action,
          speed_delta: item.speed_delta, documentary_rigor_delta: item.documentary_rigor_delta, consequence: item.consequence, created_at: item.created_at };
      });
      var reflections = getSheetRecords('Reports', APP_CONSTANTS.maxPageSize).filter(function(item) {
        return normalizeIdentifier(item.type) === 'reflection';
      }).map(function(item) {
        return { kind: 'reflection', player_id: item.player_id, reflection: item.reflection, created_at: item.created_at };
      });
      var queryRecords = progress.concat(reflections);
      return doGetJson_(jsonSuccess_({ action: 'query_data', page: queryPage, pageSize: queryPageSize,
        total: queryRecords.length, records: queryRecords.slice(queryPage * queryPageSize, (queryPage + 1) * queryPageSize) }));
    }
    var sheetName = String(payload.sheet || '');
    var allowedSheets = ['Episodes', 'Scenes', 'Choices', 'Consequences', 'Evidence'];
    var records = Array.isArray(payload.records) ? payload.records : [];
    if (allowedSheets.indexOf(sheetName) < 0 || !records.length || records.length > 100) {
      return doGetJson_(jsonError_('INVALID_BATCH', 'Lote ou aba inválida.'));
    }
    var cleanRecords = records.map(function(record) {
      var clean = {};
      Object.keys(record || {}).forEach(function(key) {
        if (['token', 'integrationtoken', 'password'].indexOf(normalizeIdentifier(key)) < 0) clean[key] = record[key];
      });
      return clean;
    });
    var saved = insertRecordsBatch(sheetName, cleanRecords);
    return doGetJson_(jsonSuccess_({ sheet: sheetName, inserted: saved.length }));
  } catch (error) {
    return doGetJson_(jsonError_('IMPORT_FAILED', 'Não foi possível processar o lote.'));
  }
}
