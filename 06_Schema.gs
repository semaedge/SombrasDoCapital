/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 06_Schema.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Esquema e inicialização.
 *
 * INTEGRAÇÕES
 * Cria/valida abas e cabeçalhos do banco central; integra setup inicial e migrações.
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
 * CONTRATO IMPLEMENTADO
 * getSchemaDefinition() é a fonte única da estrutura mínima esperada.
 */

function Schema_healthcheck() {
  return { component: '06_Schema.gs', status: 'implemented' };
}

function getSchemaDefinition() {
  return APP_CONSTANTS.sheets.reduce(function(schema, name) {
    schema[name] = ['id', 'created_at', 'updated_at'];
    return schema;
  }, {});
}

function inspectSchema() {
  var spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return { ok: false, missing: APP_CONSTANTS.sheets.slice(), message: 'SPREADSHEET_ID ausente.' };
  try {
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var available = spreadsheet.getSheets().reduce(function(result, sheet) {
      result[sheet.getName()] = sheet;
      return result;
    }, {});
    var missing = APP_CONSTANTS.sheets.filter(function(name) { return !available[name]; });
    var empty = APP_CONSTANTS.sheets.filter(function(name) {
      return available[name] && available[name].getLastRow() < 1;
    });
    var headers = APP_CONSTANTS.sheets.reduce(function(result, name) {
      result[name] = available[name] && available[name].getLastRow() >= 1
        ? getSheetHeaders_(available[name]) : [];
      return result;
    }, {});
    var invalidHeaders = APP_CONSTANTS.sheets.filter(function(name) {
      return !available[name] || ['id', 'created_at', 'updated_at'].some(function(header) {
        return headers[name].indexOf(header) < 0;
      });
    });
    return { ok: missing.length === 0 && empty.length === 0 && invalidHeaders.length === 0, missing: missing, empty: empty,
      invalidHeaders: invalidHeaders, headers: headers, checked: APP_CONSTANTS.sheets.length };
  } catch (error) {
    return { ok: false, missing: APP_CONSTANTS.sheets.slice(), message: 'Planilha inacessível.' };
  }
}

function ensureSchema() {
  var spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Configure SPREADSHEET_ID antes de inicializar o esquema.');
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var created = [];
  var initialized = [];
  var headers = ['id', 'created_at', 'updated_at'];
  APP_CONSTANTS.sheets.forEach(function(name) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
      created.push(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      initialized.push(name);
    }
  });
  return { ok: true, created: created, initialized: initialized, schema: inspectSchema() };
}
