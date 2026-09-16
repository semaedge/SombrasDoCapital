/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 27_ReportService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Reportagem final.
 *
 * INTEGRAÇÕES
 * Monta, valida e salva a reportagem final do aluno a partir das evidências selecionadas.
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

function ReportService_healthcheck() {
  return { component: '27_ReportService.gs', status: 'implemented' };
}

/**
 * CORREÇÃO P19: saveFinalReport() agora deriva playerId da sessão autenticada.
 * @param {string} sessionTokenOrPlayerId - Token de sessão (ou playerId legado, ignorado)
 * @param {Object} reportPayload - Dados do relatório
 */
function saveFinalReport(sessionTokenOrPlayerId, reportPayload) {
  // DERIVA playerId da sessão autenticada (não aceita do cliente)
  var token = String(sessionTokenOrPlayerId || '').trim();
  if (!token) return jsonError_('AUTH_REQUIRED', 'Token de sessão obrigatório.');
  
  var session = getSession(token);
  if (!session || !session.user) {
    return jsonError_('UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }
  
  var player = String(session.user.id || '');
  if (!player) {
    return jsonError_('INVALID_PLAYER', 'Sessão não identifica o jogador.');
  }

  var payload = reportPayload || {};
  var title = normalizeText(payload.title, 180);
  var thesis = normalizeText(payload.thesis || payload.centralThesis, APP_CONSTANTS.maxTextLength);
  var evidenceIds = Array.isArray(payload.evidenceIds) ? payload.evidenceIds.map(function(id) {
    return normalizeText(id, 160);
  }) : [];
  if (!title || !thesis || evidenceIds.length !== 3 || new Set(evidenceIds).size !== 3) {
    return jsonError_('INVALID_REPORT', 'Informe título, tese e exatamente 3 evidências diferentes.');
  }
  try {
    var available = getUnlockedEvidenceByUser(player);
    var selected = evidenceIds.map(function(id) {
      return available.filter(function(item) { return String(item.id) === id; })[0];
    });
    if (selected.some(function(item) { return !item; })) {
      return jsonError_('EVIDENCE_NOT_AVAILABLE', 'Uma ou mais evidências não estão disponíveis.');
    }
    var thesisTerms = normalizeIdentifier(thesis).match(/[a-z0-9]{4,}/g) || [];
    var evidenceText = selected.map(function(item) {
      return normalizeIdentifier([item.title, item.source, item.phase, item.description].join(' '));
    }).join(' ');
    var matches = thesisTerms.filter(function(term) { return evidenceText.indexOf(term) >= 0; });
    var coherence = Math.round(clampNumber(matches.length / Math.max(thesisTerms.length, 1) * 100, 0, 100, 0));
    var report = insertRecord('Reports', {
      id: generateUuid(), player_id: player, type: 'final', title: title, thesis: thesis,
      evidence_ids: evidenceIds.join(','), coherence: coherence, status: APP_CONSTANTS.statuses.active
    });
    return jsonSuccess_({ reportId: report.id, coherence: coherence, message: 'Reportagem salva para revisão.' });
  } catch (error) {
    return logAndCreateError('REPORT_NOT_SAVED', 'Não foi possível salvar a reportagem.', error.message, player);
  }
}

function getStudentFinalReport(sessionTokenOrPlayerId) {
  // DERIVA playerId da sessão autenticada (não aceita do cliente)
  var token = String(sessionTokenOrPlayerId || '').trim();
  if (!token) return jsonError_('AUTH_REQUIRED', 'Token de sessão obrigatório.');
  
  var session = getSession(token);
  if (!session || !session.user) {
    return jsonError_('UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }
  
  var player = String(session.user.id || '');
  if (!player) {
    return jsonError_('INVALID_PLAYER', 'Sessão não identifica o jogador.');
  }

  try {
    var reports = getSheetRecords('Reports', APP_CONSTANTS.maxPageSize).filter(function(report) {
      return String(report.player_id) === player && normalizeIdentifier(report.type) === 'final';
    });
    if (!reports.length) return jsonError_('REPORT_NOT_FOUND', 'Relatório final não encontrado.');
    var report = reports[reports.length - 1];
    return jsonSuccess_({ id: sanitizeHtml(report.id), playerId: sanitizeHtml(report.player_id),
      title: sanitizeHtml(report.title), thesis: sanitizeHtml(report.thesis),
      evidenceIds: String(report.evidence_ids || '').split(',').filter(Boolean).map(sanitizeHtml),
      coherence: Number(report.coherence) || 0, grade: report.grade == null ? null : Number(report.grade),
      feedback: sanitizeHtml(report.feedback || ''), status: normalizeIdentifier(report.status || 'active') });
  } catch (error) {
    return jsonError_('REPORT_UNAVAILABLE', 'Não foi possível carregar o relatório final.');
  }
}

function gradeStudentReport(teacherUser, reportId, grade, feedback) {
  try {
    requireTeacher(teacherUser);
    var normalizedId = normalizeText(reportId, 160);
    var numericGrade = Number(grade);
    if (!normalizedId || isNaN(numericGrade) || numericGrade < 0 || numericGrade > 100) {
      return jsonError_('INVALID_GRADE', 'Informe uma nota entre 0 e 100.');
    }
    var report = getSheetRecords('Reports', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return String(item.id) === normalizedId && normalizeIdentifier(item.type) === 'final';
    })[0];
    if (!report) return jsonError_('REPORT_NOT_FOUND', 'Relatório final não encontrado.');
    var saved = updateRecordById('Reports', normalizedId, { grade: numericGrade,
      feedback: normalizeText(feedback, APP_CONSTANTS.maxTextLength), graded_by: teacherUser.id,
      graded_at: new Date().toISOString() });
    if (!saved) return jsonError_('REPORT_NOT_GRADED', 'Não foi possível atribuir a nota.');
    writeAuditLog(teacherUser.id, 'report_graded', 'report', normalizedId,
      'Nota atribuída ao relatório final.');
    return jsonSuccess_({ reportId: normalizedId, grade: numericGrade, feedback: sanitizeHtml(saved.feedback || '') });
  } catch (error) {
    if (error.message === 'Acesso restrito a professores.') return jsonError_('FORBIDDEN', error.message);
    return jsonError_('REPORT_NOT_GRADED', 'Não foi possível atribuir a nota.');
  }
}
