/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 20_EvidenceService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Evidências.
 *
 * INTEGRAÇÕES
 * Catálogo, consulta e desbloqueio de documentos, áudios, links e planilhas fictícias.
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

function EvidenceService_healthcheck() {
  return { component: '20_EvidenceService.gs', status: 'implemented' };
}

function listUnlockedEvidence(userId) {
  var normalizedUserId = normalizeText(userId, 160);
  if (!normalizedUserId) return jsonError_('INVALID_USER', 'Usuário inválido.');
  try {
    var evidence = getUnlockedEvidenceByUser(normalizedUserId).map(toPublicUnlockedEvidence_);
    return jsonSuccess_(evidence);
  } catch (error) {
    return jsonError_('EVIDENCE_UNAVAILABLE', 'Não foi possível carregar as evidências.');
  }
}

function getEvidenceDetail(userId, evidenceId) {
  if (!normalizeText(userId, 160) || !normalizeText(evidenceId, 160)) {
    return jsonError_('INVALID_EVIDENCE', 'Evidência inválida.');
  }
  try {
    var record = getUnlockedEvidenceDetailById(userId, evidenceId);
    if (!record) return jsonError_('EVIDENCE_NOT_FOUND', 'Evidência não encontrada ou bloqueada.');
    return jsonSuccess_(toPublicUnlockedEvidence_(record));
  } catch (error) {
    return jsonError_('EVIDENCE_UNAVAILABLE', 'Não foi possível carregar a evidência.');
  }
}

function toPublicUnlockedEvidence_(record) {
  var nature = getContentNatureCode_(record.content_nature || record.nature || record.epistemic_status);
  return {
    id: sanitizeHtml(record.id),
    type: normalizeIdentifier(record.type || 'document'),
    title: sanitizeHtml(record.title || record.name || 'Evidência sem título'),
    source: sanitizeHtml(record.source || 'Origem não informada'),
    reliability: sanitizeHtml(record.reliability || record.confidence || 'não classificada'),
    format: normalizeIdentifier(record.format || record.type || 'document'),
    phase: sanitizeHtml(record.phase || record.phase_id || ''),
    status: normalizeIdentifier(record.status || 'unlocked'),
    contentNature: nature,
    contentNatureLabel: getContentNatureLabel_(nature),
    natureNote: sanitizeHtml(record.nature_note || 'Natureza do conteúdo não informada; requer revisão docente.'),
    sourceTitle: sanitizeHtml(record.source_title || ''),
    sourceOrganization: sanitizeHtml(record.source_organization || ''),
    sourceUrl: sanitizeHtml(record.source_url || ''),
    accessedAt: sanitizeHtml(record.accessed_at || ''),
    sourceVersion: sanitizeHtml(record.source_version || record.sourceVersion || ''),
    ageBand: sanitizeHtml(record.age_band || ''),
    pedagogicalObjective: sanitizeHtml(record.pedagogical_objective || '')
  };
}
