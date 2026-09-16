/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 29_TeacherDashboardService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Painel do professor.
 *
 * INTEGRAÇÕES
 * Agrega progresso por turma, fase, competência e padrão de escolhas.
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

function TeacherDashboardService_healthcheck() {
  return { component: '29_TeacherDashboardService.gs', status: 'implemented' };
}

function getTeacherDashboard(teacher, classIdFilter) {
  try {
    requireTeacher(teacher);
    var teacherId = normalizeText(teacher.id, 160);
    var targetClassId = classIdFilter ? normalizeText(classIdFilter, 160) : '';

    var allClasses = getSheetRecords('Classes', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return String(item.teacher_id || item.owner_id || '') === teacherId ||
        String(item.id) === String(teacher.class_id || '');
    });

    // Se houver filtro específico de turma, filtra a lista ativa
    var activeClasses = targetClassId && targetClassId !== 'all'
      ? allClasses.filter(function(c) { return String(c.id) === targetClassId; })
      : allClasses;

    var classIds = activeClasses.map(function(item) { return String(item.id); });
    if (!classIds.length && targetClassId && targetClassId !== 'all') {
      classIds = [targetClassId];
    } else if (!classIds.length && teacher.class_id) {
      classIds = [String(teacher.class_id)];
    }

    var students = getSheetRecords('Users', APP_CONSTANTS.maxPageSize).filter(function(user) {
      return normalizeIdentifier(user.role) === APP_CONSTANTS.roles.student &&
        (!classIds.length || classIds.indexOf(String(user.class_id)) >= 0);
    });

    var studentIds = students.map(function(student) { return String(student.id); });
    var progress = getSheetRecords('Progress', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return studentIds.indexOf(String(item.player_id || item.user_id)) >= 0;
    });
    var sourceChecks = getSheetRecords('SourceChecks', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return studentIds.indexOf(String(item.player_id || item.user_id)) >= 0;
    });
    var reports = getSheetRecords('Reports', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return studentIds.indexOf(String(item.player_id || item.user_id)) >= 0;
    });
    var formativeSummary = buildClassFormativeSummary_(studentIds, progress, sourceChecks, reports);

    var counts = progress.reduce(function(result, item) {
      var action = normalizeIdentifier(item.choice_action || item.choice_id || 'unknown');
      if (action.indexOf('verify') >= 0) action = 'verify';
      else if (action.indexOf('publish') >= 0) action = 'publish';
      result[action] = (result[action] || 0) + 1;
      return result;
    }, {});

    var totalDecisions = progress.length;
    var publishCount = counts['publish'] || 0;
    var verifyCount = counts['verify'] || 0;
    var criticalTotal = publishCount + verifyCount;

    // Métricas para os Cards de Resumo
    var completedStudents = students.filter(function(s) {
      return progress.filter(function(p) { return String(p.player_id || p.user_id) === String(s.id); }).length >= 3;
    }).length;

    var completionRate = students.length ? Math.round((completedStudents / students.length) * 100) : null;

    var rigorValues = progress.map(function(p) {
      var raw = Number(p.documentary_rigor_delta);
      return isNaN(raw) ? null : (50 + raw * 15);
    }).filter(function(value) { return value != null; });
    var avgDocumentaryRigor = rigorValues.length ? Math.round(clampNumber(
      rigorValues.reduce(function(sum, value) { return sum + value; }, 0) / rigorValues.length,
      20, 100, null
    )) : null;
    var avgEpisodeTime = null;

    // Distribuição de Escolhas Críticas (Episódio 1)
    var criticalChoices = {
      publish: {
        count: publishCount,
        percentage: criticalTotal ? Math.round((publishCount / criticalTotal) * 100) : 0,
        label: 'Publicar Imediatamente (Velocidade)'
      },
      verify: {
        count: verifyCount,
        percentage: criticalTotal ? Math.round((verifyCount / criticalTotal) * 100) : 0,
        label: 'Segurar e Checar Fontes (Rigor Documental)'
      }
    };

    // Dados de Alunos para Exportação CSV
    var exportRows = students.map(function(s, idx) {
      var sProg = progress.filter(function(p) { return String(p.player_id || p.user_id) === String(s.id); });
      var lastChoice = sProg.length ? String(sProg[0].choice_action || sProg[0].choice_id || '') : '';
      var classRecord = allClasses.find(function(c) { return String(c.id) === String(s.class_id); });
      var studentRigor = sProg.length ? sProg.reduce(function(sum, item) {
        return sum + (Number(item.documentary_rigor_delta) || 0);
      }, 0) : null;
      return {
        id: s.id,
        name: s.name || s.display_name || '',
        className: classRecord ? (classRecord.name || classRecord.title || '') : '',
        episode: sProg.length ? 'Episódio ' + Math.min(5, sProg.length + 1) : '',
        scene1Choice: lastChoice ? (lastChoice.indexOf('publish') >= 0 ? 'Publicar Imediatamente' : 'Segurar e Checar') : '',
        documentaryRigor: studentRigor == null ? '' : String(studentRigor),
        timeSpentMin: null,
        status: sProg.length >= 3 ? 'Concluído' : 'Em Andamento'
      };
    });

    return jsonSuccess_({
      classes: allClasses.map(function(item) {
        return {
          id: sanitizeHtml(item.id),
          name: sanitizeHtml(item.name || item.title || item.id),
          year: item.year || '2026'
        };
      }),
      activeClassId: targetClassId || 'all',
      studentsCount: students.length,
      decisionsCount: totalDecisions,
      completionRate: completionRate,
      avgDocumentaryRigor: avgDocumentaryRigor,
      avgEpisodeTime: avgEpisodeTime,
      formativeIndicators: formativeSummary.indicators,
      reviewQueueCount: formativeSummary.reviewQueueCount,
      criticalChoices: criticalChoices,
      exportRows: exportRows
    });
  } catch (error) {
    if (error.message === 'Acesso restrito a professores.') return jsonError_('FORBIDDEN', error.message);
    return jsonError_('TEACHER_DASHBOARD_UNAVAILABLE', 'Não foi possível carregar o painel da turma.');
  }
}

/**
 * Agrega evidências formativas sem ordenar estudantes, calcular ranking ou
 * expor identificadores individuais. Percentuais significam cobertura da
 * turma para uma dimensão, não desempenho ou nota.
 */
function buildClassFormativeSummary_(studentIds, progress, sourceChecks, reports) {
  var ids = Array.isArray(studentIds) ? studentIds.map(String) : [];
  var progressRows = Array.isArray(progress) ? progress : [];
  var checks = Array.isArray(sourceChecks) ? sourceChecks : [];
  var reportRows = Array.isArray(reports) ? reports : [];

  function recordsForStudent(rows, studentId, key) {
    return rows.filter(function(row) {
      return String(row[key] || row.player_id || row.user_id || '') === String(studentId);
    });
  }

  var dimensions = [
    {
      id: 'formulate_question',
      label: 'Formular pergunta investigável',
      description: 'Perguntas identificáveis antes de uma conclusão.',
      hasEvidence: function(studentId) {
        return recordsForStudent(progressRows, studentId, 'player_id').some(function(item) {
          return Boolean(item.question || item.inquiry || item.investigative_question || item.prompt);
        });
      }
    },
    {
      id: 'distinguish_fact_opinion',
      label: 'Distinguir fato, opinião e alegação',
      description: 'Checagem registrada para discutir a natureza da afirmação.',
      hasEvidence: function(studentId) {
        return recordsForStudent(checks, studentId, 'user_id').length > 0;
      }
    },
    {
      id: 'cross_sources',
      label: 'Cruzar fontes antes de concluir',
      description: 'Confrontos de fontes registrados no caso.',
      hasEvidence: function(studentId) {
        return recordsForStudent(checks, studentId, 'user_id').length > 0;
      }
    },
    {
      id: 'recognize_uncertainty',
      label: 'Reconhecer incertezas e limites',
      description: 'Ressalvas ou limites explicitados no percurso.',
      hasEvidence: function(studentId) {
        return recordsForStudent(progressRows, studentId, 'player_id').some(function(item) {
          return Boolean(item.uncertainty || item.limits || item.limitations || item.caveat || item.revision_note);
        });
      }
    },
    {
      id: 'justify_decision',
      label: 'Justificar decisão com evidências',
      description: 'Decisões e consequências disponíveis para conversa pedagógica.',
      hasEvidence: function(studentId) {
        return recordsForStudent(progressRows, studentId, 'player_id').some(function(item) {
          return Boolean(item.choice_id || item.choice_action || item.consequence);
        });
      }
    },
    {
      id: 'revise_conclusion',
      label: 'Revisar conclusão após novas evidências',
      description: 'Reflexão ou revisão registrada para retomar a conclusão.',
      hasEvidence: function(studentId) {
        return recordsForStudent(reportRows, studentId, 'player_id').some(function(item) {
          return normalizeIdentifier(item.type || '') === 'reflection' &&
            Boolean(normalizeText(item.reflection || item.text || '', 2000));
        }) || recordsForStudent(progressRows, studentId, 'player_id').some(function(item) {
          return Boolean(item.revised_choice || item.revisedConclusion || item.revision_note);
        });
      }
    }
  ];

  var indicators = dimensions.map(function(dimension) {
    var count = ids.filter(dimension.hasEvidence).length;
    return {
      id: dimension.id,
      label: dimension.label,
      description: dimension.description,
      studentsWithEvidence: count,
      studentsCount: ids.length,
      coveragePercentage: ids.length ? Math.round(count / ids.length * 100) : null,
      reviewRequired: true
    };
  });
  var recorded = indicators.reduce(function(total, item) { return total + item.studentsWithEvidence; }, 0);
  var possible = ids.length * dimensions.length;
  return {
    indicators: indicators,
    reviewQueueCount: Math.max(0, possible - recorded)
  };
}
