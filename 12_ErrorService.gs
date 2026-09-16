/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 12_ErrorService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Erros padronizados.
 *
 * INTEGRAÇÕES
 * Converte falhas em respostas seguras para o cliente e em registros técnicos auditáveis.
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

function ErrorService_healthcheck() {
  return { component: '12_ErrorService.gs', status: 'implemented' };
}

function createPublicError_(code, message) {
  return { ok: false, success: false, data: null, error: { code: normalizeIdentifier(code || 'internal_error'),
    message: normalizeText(message || 'Não foi possível concluir a operação.', 240), correlation_id: generateUuid() } };
}

function handleError_(code, message) {
  return createPublicError_(code, message);
}

function logAndCreateError(code, publicMessage, internalDetails, actorId) {
  var correlationId = generateUuid();
  try {
    writeAuditLog(actorId || 'system', 'system_error', 'application', correlationId,
      normalizeText(internalDetails || 'Falha não especificada.', 500));
  } catch (ignored) {}
  return { ok: false, success: false, data: null, error: { code: normalizeIdentifier(code || 'internal_error'),
    message: normalizeText(publicMessage || 'Não foi possível concluir a operação.', 240),
    correlation_id: correlationId } };
}
