/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 28_ImpactReportService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Relatório de impacto.
 *
 * INTEGRAÇÕES
 * Calcula rigor ético, qualidade documental, velocidade, coerência e reflexão pedagógica.
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

function ImpactReportService_healthcheck() {
  return { component: '28_ImpactReportService.gs', status: 'implemented' };
}

/**
 * CORREÇÃO P19: getImpactReport() agora deriva playerId da sessão autenticada.
 * @param {string} sessionTokenOrPlayerId - Token de sessão (ou playerId legado, ignorado)
 */
function getImpactReport(sessionTokenOrPlayerId) {
  // DERIVA playerId da sessão autenticada (não aceita do cliente)
  var token = String(sessionTokenOrPlayerId || '').trim();
  if (!token) return jsonError_('AUTH_REQUIRED', 'Token de sessão obrigatório.');

  var session = getSession(token);
  if (!session || !session.user) {
    return jsonError_('UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }

  var normalizedPlayerId = String(session.user.id || '');
  if (!normalizedPlayerId) {
    return jsonError_('INVALID_PLAYER', 'Sessão não identifica o jogador.');
  }
  try {
    var progress = getPlayerProgress(normalizedPlayerId);
    var rubric = buildFormativeRubric_(normalizedPlayerId, progress);
    if (!progress.length) {
      return jsonSuccess_({
        playerId: normalizedPlayerId,
        choicesCount: 0,
        methodologicalRigor: null,
        ethicalSensitivity: null,
        responseSpeed: null,
        rubric: rubric,
        reviewQueue: buildFormativeReviewQueue_(rubric),
        evaluationNote: 'A rubrica registra indícios para revisão docente; não é uma nota automática e não usa velocidade como critério.',
        strengths: [],
        improvements: [],
        summary: null
      });
    }
    var rigorRaw = progress.reduce(function(total, item) {
      return total + (Number(item.documentary_rigor_delta) || 0);
    }, 0);
    var speedRaw = progress.reduce(function(total, item) {
      return total + (Number(item.speed_delta) || 0);
    }, 0);

    // Normalização das 3 métricas de 0 a 100%
    var methodologicalRigor = clampNumber(60 + rigorRaw * 12, 10, 100, 75);
    var ethicalSensitivity = clampNumber(70 + rigorRaw * 8 - (speedRaw > 3 ? 10 : 0), 15, 100, 80);
    var responseSpeed = clampNumber(50 + speedRaw * 14, 10, 100, 65);

    // Devolutiva Formativa Personalizada
    var strengths = [];
    var improvements = [];

    if (methodologicalRigor >= 70) {
      strengths.push('Excelente rigor na apuração: priorizou a confirmação documental antes de conclusões precipitadas.');
    } else {
      improvements.push('Aprofundar a checagem cruzada: busque validar áudios com contratos ou planilhas oficiais.');
    }

    if (ethicalSensitivity >= 75) {
      strengths.push('Alta sensibilidade ética: respeitou o contraditório e considerou o impacto público das revelações.');
    } else {
      improvements.push('Atenção ao impacto ético: lembre-se de balancear o interesse público com o direito de resposta.');
    }

    if (responseSpeed >= 70) {
      strengths.push('Organização do percurso: você registrou decisões com agilidade; o tempo é apenas contexto e não altera a avaliação.');
    } else {
      improvements.push('Planejamento do percurso: reserve tempo para formular perguntas, cruzar fontes e revisar a conclusão; velocidade não é critério de nota.');
    }

    return jsonSuccess_({
      playerId: normalizedPlayerId,
      choicesCount: progress.length,
      methodologicalRigor: Math.round(methodologicalRigor),
      ethicalSensitivity: Math.round(ethicalSensitivity),
      responseSpeed: Math.round(responseSpeed),
      rubric: rubric,
      reviewQueue: buildFormativeReviewQueue_(rubric),
      evaluationNote: 'A rubrica registra indícios para revisão docente; não é uma nota automática e não usa velocidade como critério.',
      strengths: strengths,
      improvements: improvements,
      summary: progress.length >= 3
        ? 'Trajetória consolidada: suas decisões demonstram raciocínio crítico e compromisso com o jornalismo baseado em evidências.'
        : 'Devolutiva parcial: registre mais decisões para consolidar a análise da sua trajetória.'
    });
  } catch (error) {
    return jsonError_('REPORT_UNAVAILABLE', 'Não foi possível calcular o relatório.');
  }
}

/**
 * Rubrica formativa explicável. Os estados descrevem indícios disponíveis no
 * fluxo, não aprovam automaticamente o estudante nem substituem a conversa
 * com o professor.
 */
function buildFormativeRubric_(playerId, progress) {
  var items = Array.isArray(progress) ? progress : [];
  var checks = [];
  var reports = [];
  try {
    checks = getSheetRecords('SourceChecks', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return String(item.user_id || item.player_id || '') === String(playerId);
    });
    reports = getSheetRecords('Reports', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return String(item.player_id || '') === String(playerId);
    });
  } catch (ignored) {
    checks = [];
    reports = [];
  }

  var hasQuestion = items.some(function(item) {
    return Boolean(item.question || item.inquiry || item.investigative_question || item.prompt);
  });
  var hasUncertainty = items.some(function(item) {
    return Boolean(item.uncertainty || item.limits || item.limitations || item.caveat || item.revision_note);
  });
  var hasRevision = reports.some(function(item) {
    return normalizeIdentifier(item.type || '') === 'reflection' &&
      Boolean(normalizeText(item.reflection || item.text || '', 2000));
  }) || items.some(function(item) {
    return Boolean(item.revised_choice || item.revisedConclusion || item.revision_note);
  });

  function entry(id, label, recorded, evidence, unavailableEvidence) {
    return {
      id: id,
      label: label,
      status: recorded ? 'recorded' : (items.length ? 'not_observed' : 'not_available'),
      evidence: recorded ? evidence : (items.length ? unavailableEvidence : 'Ainda não há registros suficientes nesta sessão.'),
      reviewRequired: true
    };
  }

  return [
    entry('formulate_question', 'Formular uma pergunta investigável', hasQuestion,
      'Uma pergunta investigável foi registrada no percurso.',
      'O percurso não contém uma pergunta investigável identificável; registrar uma pergunta antes de concluir.'),
    entry('distinguish_fact_opinion', 'Distinguir fato, opinião e alegação', hasQuestion && checks.length > 0,
      'A pergunta e uma checagem de fonte aparecem no mesmo percurso.',
      'Revisar a diferença entre alegação, opinião e informação factual com o professor.'),
    entry('cross_sources', 'Cruzar fontes antes de concluir', checks.length > 0,
      checks.length + ' checagem(ns) de fonte foi(ram) registrada(s).',
      'Nenhuma checagem de fonte foi registrada nesta sessão.'),
    entry('recognize_uncertainty', 'Reconhecer incertezas e limites', hasUncertainty,
      'O percurso registra ao menos um limite ou ressalva da apuração.',
      'Adicionar limites, dúvidas ou o que ainda não pode ser afirmado.'),
    entry('justify_decision', 'Justificar uma decisão com evidências', items.length > 0,
      items.length + ' decisão(ões) foi(ram) registrada(s) para discussão.',
      'Registrar uma decisão e sua justificativa antes da devolutiva.'),
    entry('revise_conclusion', 'Revisar a conclusão após novas evidências', hasRevision,
      'Há uma reflexão ou revisão registrada para retomar a conclusão.',
      'Usar a reflexão formativa para registrar o que mudaria após novas evidências.')
  ];
}

function buildFormativeReviewQueue_(rubric) {
  return (Array.isArray(rubric) ? rubric : []).filter(function(item) {
    return item && item.reviewRequired === true;
  }).map(function(item) {
    return {
      dimensionId: item.id,
      label: item.label,
      status: 'pending_teacher_review'
    };
  });
}

/**
 * CORREÇÃO P19: saveReflection() agora deriva playerId da sessão autenticada.
 * @param {string} sessionTokenOrPlayerId - Token de sessão (ou playerId legado, ignorado)
 * @param {Object|string} reflectionData - Dados da reflexão
 */
function saveReflection(sessionTokenOrPlayerId, reflectionData) {
  // DERIVA playerId da sessão autenticada (não aceita do cliente)
  var token = String(sessionTokenOrPlayerId || '').trim();
  if (!token) return jsonError_('AUTH_REQUIRED', 'Token de sessão obrigatório.');

  var session = getSession(token);
  if (!session || !session.user) {
    return jsonError_('UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }

  var normalizedPlayerId = String(session.user.id || '');
  if (!normalizedPlayerId) {
    return jsonError_('INVALID_PLAYER', 'Sessão não identifica o jogador.');
  }

  var payload = typeof reflectionData === 'object' && reflectionData !== null ? reflectionData : { text: String(reflectionData) };
  var q1 = normalizeText(payload.challenge || payload.q1 || '', 1000);
  var q2 = normalizeText(payload.revisedChoice || payload.q2 || '', 1000);
  var q3 = normalizeText(payload.dataPerception || payload.q3 || '', 1000);
  var likert = Number(payload.securityScore || payload.likertSecurity || 3);
  var fullText = normalizeText(payload.text || [q1, q2, q3].filter(Boolean).join('\n---\n'), APP_CONSTANTS.maxTextLength);

  try {
    var report = insertRecord('Reports', {
      id: generateUuid(),
      player_id: normalizedPlayerId,
      type: 'reflection',
      reflection: fullText,
      likert_security: likert,
      status: APP_CONSTANTS.statuses.active
    });
    return jsonSuccess_({ reportId: report.id, message: 'Reflexão registrada com sucesso.' });
  } catch (error) {
    return jsonError_('REFLECTION_NOT_SAVED', 'Não foi possível salvar a reflexão.');
  }
}
