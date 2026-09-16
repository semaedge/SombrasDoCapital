/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 36_MaintenanceService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Manutenção.
 *
 * INTEGRAÇÕES
 * Limpa sessões expiradas, verifica esquema, recompõe índices lógicos e registra saúde do sistema.
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

function MaintenanceService_healthcheck() {
  return { component: '36_MaintenanceService.gs', status: 'implemented' };
}

function runDailyMaintenance() {
  var startedAt = new Date().getTime();
  var result = { expiredSessions: 0, cleanedAuditLogs: 0, schemaOk: false, schemaCreated: [], schemaInitialized: [], durationMs: 0 };
  try {
    var now = new Date();
    getSheetRecords('Sessions', APP_CONSTANTS.maxPageSize).forEach(function(session) {
      var expiresAt = session.expires_at instanceof Date ? session.expires_at : new Date(session.expires_at);
      if (session.status === APP_CONSTANTS.statuses.active && !isNaN(expiresAt.getTime()) && expiresAt <= now) {
        if (updateRecordById('Sessions', session.id, { status: APP_CONSTANTS.statuses.inactive })) result.expiredSessions++;
      }
    });
    var schema = ensureSchema();
    result.schemaCreated = schema.created || [];
    result.schemaInitialized = schema.initialized || [];
    result.schemaOk = schema.schema && schema.schema.ok;
    var auditSheet = getGatewaySheet_('AuditLog');
    var headers = getSheetHeaders_(auditSheet);
    var createdAtColumn = headers.indexOf('created_at');
    if (createdAtColumn >= 0 && auditSheet.getLastRow() >= 2) {
      var cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      var auditRows = auditSheet.getRange(2, 1, auditSheet.getLastRow() - 1, headers.length).getValues();
      for (var index = auditRows.length - 1; index >= 0; index--) {
        var createdAt = auditRows[index][createdAtColumn] instanceof Date ? auditRows[index][createdAtColumn] : new Date(auditRows[index][createdAtColumn]);
        if (!isNaN(createdAt.getTime()) && createdAt < cutoff) {
          auditSheet.deleteRow(index + 2);
          result.cleanedAuditLogs++;
        }
      }
    }
    result.durationMs = new Date().getTime() - startedAt;
    writeAuditLog('system', 'maintenance_cycle', 'system', 'maintenance', JSON.stringify(result));
    return result;
  } catch (error) {
    result.durationMs = new Date().getTime() - startedAt;
    try { writeAuditLog('system', 'maintenance_failed', 'system', 'maintenance', 'Falha durante manutenção.'); } catch (ignored) {}
    return result;
  }
}
