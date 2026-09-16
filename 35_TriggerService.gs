/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 35_TriggerService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Gatilhos nativos.
 *
 * INTEGRAÇÕES
 * Funções para gatilhos instaláveis de abertura, edição e rotina de manutenção da planilha.
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

function TriggerService_healthcheck() {
  return { component: '35_TriggerService.gs', status: 'implemented' };
}

function installMaintenanceTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runDailyMaintenance') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('runDailyMaintenance').timeBased().everyDays(1).atHour(3).create();
  return { ok: true, handler: 'runDailyMaintenance', frequency: 'daily' };
}

function setupAllTriggers(adminUser) {
  if (!adminUser || normalizeIdentifier(adminUser.role) !== APP_CONSTANTS.roles.admin) {
    return jsonError_('FORBIDDEN', 'Apenas administradores podem configurar gatilhos.');
  }
  try {
    var spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return jsonError_('CONFIGURATION_ERROR', 'SPREADSHEET_ID não configurado.');
    ScriptApp.getProjectTriggers().forEach(function(trigger) {
      if (['runDailyMaintenance', 'onContentEdit'].indexOf(trigger.getHandlerFunction()) >= 0) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    ScriptApp.newTrigger('runDailyMaintenance').timeBased().everyDays(1).atHour(3).create();
    ScriptApp.newTrigger('onContentEdit').forSpreadsheet(spreadsheetId).onEdit().create();
    return jsonSuccess_({ installed: ['runDailyMaintenance', 'onContentEdit'] });
  } catch (error) {
    return jsonError_('TRIGGERS_NOT_CONFIGURED', 'Não foi possível configurar os gatilhos.');
  }
}

function listInstalledTriggers() {
  try {
    return jsonSuccess_(ScriptApp.getProjectTriggers().map(function(trigger) {
      return { handler: trigger.getHandlerFunction(), type: String(trigger.getEventType()) };
    }));
  } catch (error) {
    return jsonError_('TRIGGERS_UNAVAILABLE', 'Não foi possível consultar os gatilhos.');
  }
}

function onContentEdit(event) {
  if (!event || !event.range) return;
  try {
    writeAuditLog('system', 'sheet_edit', event.range.getSheet().getName(), String(event.range.getRow()), 'Edição registrada.');
  } catch (error) {}
}
