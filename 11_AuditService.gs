/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 11_AuditService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Auditoria.
 *
 * INTEGRAÇÕES
 * Registra ator, ação, entidade, payload resumido, data e correlação; integra aba AuditLog.
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

function AuditService_healthcheck() {
  return { component: '11_AuditService.gs', status: 'implemented' };
}

function writeAuditLog(actorId, action, entity, entityId, details) {
  return insertRecord('AuditLog', {
    id: generateUuid(), actor_id: normalizeText(actorId, 160), action: normalizeText(action, 80).toLowerCase(),
    entity: normalizeIdentifier(entity), entity_id: normalizeText(entityId, 160),
    details: scrubAuditDetails_(details), status: APP_CONSTANTS.statuses.active
  });
}

function getAuditLogs(adminUser, limit) {
  if (!adminUser || normalizeIdentifier(adminUser.role) !== APP_CONSTANTS.roles.admin) {
    return jsonError_('FORBIDDEN', 'Apenas administradores podem consultar a auditoria.');
  }
  try {
    var pageSize = Math.min(Math.max(Number(limit) || 50, 1), APP_CONSTANTS.maxPageSize);
    return jsonSuccess_(getSheetRecords('AuditLog', APP_CONSTANTS.maxPageSize).slice(-pageSize).reverse().map(function(log) {
      return { id: sanitizeHtml(log.id), actorId: sanitizeHtml(log.actor_id), action: sanitizeHtml(log.action),
        entity: sanitizeHtml(log.entity), entityId: sanitizeHtml(log.entity_id), details: sanitizeHtml(log.details), createdAt: log.created_at };
    }));
  } catch (error) {
    return jsonError_('AUDIT_UNAVAILABLE', 'Não foi possível consultar os registros de auditoria.');
  }
}

function logAuthEvent(userId, outcome, ipDetails) {
  return writeAuditLog(userId || 'anonymous', 'auth_event', 'user', userId || 'unknown',
    'Resultado: ' + normalizeText(outcome, 80) + '. Origem: ' + normalizeText(ipDetails, 120));
}

function logDecisionEvent(userId, sceneId, choiceId) {
  return writeAuditLog(userId, 'decision_event', 'scene', sceneId,
    'Escolha registrada: ' + normalizeText(choiceId, 160));
}

function scrubAuditDetails_(details) {
  return normalizeText(details, 500).replace(/(password|senha|token|integration_token)\s*[:=]\s*[^,;\s]+/gi, '$1: [redacted]');
}
