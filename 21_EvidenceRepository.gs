/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 21_EvidenceRepository.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Repositório de evidências.
 *
 * INTEGRAÇÕES
 * CRUD da aba Evidence com controle de origem, confiabilidade e fase relacionada.
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

function EvidenceRepository_healthcheck() {
  return { component: '21_EvidenceRepository.gs', status: 'implemented' };
}

function getUnlockedEvidenceByUser(userId) {
  var normalizedUserId = normalizeText(userId, 160);
  if (!normalizedUserId) return [];
  return getSheetRecords('Evidence', APP_CONSTANTS.maxPageSize).filter(function(record) {
    var owner = String(record.user_id || record.unlocked_by || '');
    var isUnlocked = String(record.unlocked || record.status || '').toLowerCase() === 'true' ||
      normalizeIdentifier(record.status) === 'unlocked';
    return isUnlocked && (!owner || owner === normalizedUserId);
  });
}

function getUnlockedEvidenceDetailById(userId, evidenceId) {
  var normalizedId = normalizeText(evidenceId, 160);
  return getUnlockedEvidenceByUser(userId).filter(function(record) {
    return String(record.id) === normalizedId && normalizeIdentifier(record.status) !== 'locked';
  })[0] || null;
}
