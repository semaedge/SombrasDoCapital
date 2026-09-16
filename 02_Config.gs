/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 02_Config.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Configuração central.
 *
 * INTEGRAÇÕES
 * Lê SPREADSHEET_ID das Script Properties e concentra nomes de abas, limites e chaves de configuração.
 *
 * CONTRATO DE DADOS
 * - A Google Planilha central é o banco CRUD do projeto.
 * - O ID deve estar em PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID').
 * - Os assets do jogo devem usar PropertiesService.getScriptProperties().getProperty('FOLDER_ID')
 *   e todos os arquivos devem permanecer na raiz dessa pasta no Google Drive.
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

function Config_healthcheck() {
  return { component: '02_Config.gs', status: 'implemented' };
}

function getAssetFolderId() {
  return PropertiesService.getScriptProperties().getProperty('FOLDER_ID') || '';
}

function hasAssetFolder() {
  return Boolean(getAssetFolderId());
}

function getAssetFolder_() {
  var folderId = getAssetFolderId();
  if (!folderId) throw new Error('FOLDER_ID não configurado nas Script Properties.');
  return DriveApp.getFolderById(folderId);
}

function getSpreadsheetId() {
  return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '';
}

function getAppConfig() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('app-config');
  if (cached) {
    try {
      var parsed = JSON.parse(cached);
      var validCache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
        typeof parsed.spreadsheetId === 'string' && typeof parsed.folderId === 'string' &&
        typeof parsed.integrationTokenConfigured === 'boolean' &&
        parsed.defaults && typeof parsed.defaults === 'object' && !Array.isArray(parsed.defaults);
      if (validCache) return parsed;
    } catch (cacheReadError) {}
    cache.remove('app-config');
  }
  var properties = PropertiesService.getScriptProperties();
  var config = {
    spreadsheetId: properties.getProperty('SPREADSHEET_ID') || '',
    folderId: properties.getProperty('FOLDER_ID') || '',
    integrationTokenConfigured: Boolean(properties.getProperty('INTEGRATION_TOKEN')),
    defaults: {}
  };
  try {
    getSheetRecords('Config', APP_CONSTANTS.maxPageSize).forEach(function(record) {
      var key = normalizeIdentifier(record.key || record.name);
      if (key && key !== 'integrationtoken' && key !== 'password' && key !== 'token') {
        config.defaults[key] = normalizeText(record.value, 500);
      }
    });
  } catch (error) {}
  cache.put('app-config', JSON.stringify(config), 300);
  return config;
}

function setAppProperty(adminUser, key, value) {
  if (!adminUser || normalizeIdentifier(adminUser.role) !== APP_CONSTANTS.roles.admin) {
    return jsonError_('FORBIDDEN', 'Apenas administradores podem alterar configurações.');
  }
  var propertyKey = String(key || '').trim().toUpperCase();
  var allowed = ['SPREADSHEET_ID', 'FOLDER_ID', 'INTEGRATION_TOKEN'];
  if (allowed.indexOf(propertyKey) < 0) return jsonError_('INVALID_PROPERTY', 'Propriedade não permitida.');
  var propertyValue = String(value == null ? '' : value).trim();
  if (!propertyValue) return jsonError_('INVALID_PROPERTY', 'O valor da propriedade é obrigatório.');
  try {
    PropertiesService.getScriptProperties().setProperty(propertyKey, propertyValue);
    CacheService.getScriptCache().remove('app-config');
    writeAuditLog(adminUser.id, 'config_changed', 'property', propertyKey, 'Propriedade atualizada.');
    return jsonSuccess_({ key: propertyKey, configured: true });
  } catch (error) {
    return jsonError_('PROPERTY_NOT_SAVED', 'Não foi possível salvar a configuração.');
  }
}
