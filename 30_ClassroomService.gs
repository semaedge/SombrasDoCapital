/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 30_ClassroomService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Turmas.
 *
 * INTEGRAÇÕES
 * CRUD de turmas, códigos de acesso e vínculo entre professor e alunos.
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

function ClassroomService_healthcheck() {
  return { component: '30_ClassroomService.gs', status: 'implemented' };
}

function createClass(teacher, name) {
  try {
    requireTeacher(teacher);
    var className = normalizeText(name, 160);
    if (!className) return jsonError_('INVALID_CLASS', 'Informe o nome da turma.');
    var existing = getSheetRecords('Classes', APP_CONSTANTS.maxPageSize);
    var code;
    do { code = generateClassCode_(); } while (existing.some(function(item) { return item.code === code; }));
    var record = insertRecord('Classes', { id: generateUuid(), name: className, code: code,
      teacher_id: normalizeText(teacher.id, 160), status: APP_CONSTANTS.statuses.active });
    return jsonSuccess_({ id: record.id, name: record.name, code: record.code });
  } catch (error) {
    if (error.message === 'Acesso restrito a professores.') return jsonError_('FORBIDDEN', error.message);
    return jsonError_('CLASS_NOT_CREATED', 'Não foi possível criar a turma.');
  }
}

function archiveClass(teacher, classId) {
  try {
    requireTeacher(teacher);
    var item = getSheetRecords('Classes', APP_CONSTANTS.maxPageSize).filter(function(record) {
      return String(record.id) === String(classId) && String(record.teacher_id) === String(teacher.id);
    })[0];
    if (!item) return jsonError_('CLASS_NOT_FOUND', 'Turma não encontrada.');
    updateRecordById('Classes', classId, { status: APP_CONSTANTS.statuses.inactive });
    return jsonSuccess_({ id: classId, status: APP_CONSTANTS.statuses.inactive });
  } catch (error) {
    if (error.message === 'Acesso restrito a professores.') return jsonError_('FORBIDDEN', error.message);
    return jsonError_('CLASS_NOT_ARCHIVED', 'Não foi possível arquivar a turma.');
  }
}

function getTeacherClasses(teacher) {
  try {
    requireTeacher(teacher);
    var students = getSheetRecords('Users', APP_CONSTANTS.maxPageSize);
    return jsonSuccess_(getSheetRecords('Classes', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return String(item.teacher_id) === String(teacher.id) && item.status !== APP_CONSTANTS.statuses.inactive;
    }).map(function(item) { return { id: sanitizeHtml(item.id), name: sanitizeHtml(item.name), code: sanitizeHtml(item.code), updatedAt: item.updated_at,
      studentCount: students.filter(function(student) { return normalizeIdentifier(student.role) === APP_CONSTANTS.roles.student && String(student.class_id) === String(item.id); }).length }; }));
  } catch (error) {
    if (error.message === 'Acesso restrito a professores.') return jsonError_('FORBIDDEN', error.message);
    return jsonError_('CLASSES_UNAVAILABLE', 'Não foi possível carregar as turmas.');
  }
}

function getClassRoster(teacher, classId) {
  try {
    requireTeacher(teacher);
    var targetClassId = classId ? normalizeText(classId, 160) : '';
    var classes = getSheetRecords('Classes', APP_CONSTANTS.maxPageSize);
    var targetClass = classes.filter(function(item) {
      return (String(item.id) === targetClassId || (!targetClassId && String(item.teacher_id) === String(teacher.id))) &&
        (String(item.teacher_id) === String(teacher.id) || String(teacher.role) === APP_CONSTANTS.roles.admin);
    })[0];

    var classFilterId = targetClass ? String(targetClass.id) : targetClassId;

    var students = getSheetRecords('Users', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return normalizeIdentifier(item.role) === APP_CONSTANTS.roles.student &&
        (!classFilterId || String(item.class_id) === classFilterId);
    });

    var progress = getSheetRecords('Progress', APP_CONSTANTS.maxPageSize);
    var reports = getSheetRecords('Reports', APP_CONSTANTS.maxPageSize);
    var nowMs = new Date().getTime();

    return jsonSuccess_(students.map(function(student) {
      var records = progress.filter(function(item) { return String(item.player_id || item.user_id) === String(student.id); });
      var rigor = records.reduce(function(total, item) { return total + (Number(item.documentary_rigor_delta) || 0); }, 0);
      var progressPct = Math.round(clampNumber(records.length / 4 * 100, 0, 100, 0));
      var ethicalScore = Math.round(clampNumber(50 + rigor * 10, 0, 100, 50));

      var lastSync = records.length ? (records[records.length - 1].updated_at || records[records.length - 1].created_at) : null;
      var lastSyncMs = lastSync ? new Date(lastSync).getTime() : 0;
      var hoursInactive = lastSyncMs ? Math.round((nowMs - lastSyncMs) / (1000 * 60 * 60)) : 99;

      var isCompleted = progressPct >= 100 || records.length >= 4;
      var isStalled = !isCompleted && (hoursInactive >= 48);

      var studentReports = reports.filter(function(r) {
        return String(r.player_id) === String(student.id) && normalizeIdentifier(r.type) === 'final';
      });
      var finalReport = studentReports.length ? studentReports[studentReports.length - 1] : null;

      return {
        id: sanitizeHtml(student.id),
        name: sanitizeHtml(student.name || student.display_name || 'Estudante'),
        progress: progressPct,
        ethicalRigor: ethicalScore,
        lastSync: lastSync,
        hoursInactive: hoursInactive,
        isCompleted: isCompleted,
        isStalled: isStalled,
        reportId: finalReport ? sanitizeHtml(finalReport.id) : null,
        reportGrade: finalReport && finalReport.grade != null ? Number(finalReport.grade) : null,
        reportFeedback: finalReport && finalReport.feedback ? sanitizeHtml(finalReport.feedback) : ''
      };
    }));
  } catch (error) {
    if (error.message === 'Acesso restrito a professores.') return jsonError_('FORBIDDEN', error.message);
    return jsonError_('ROSTER_UNAVAILABLE', 'Não foi possível carregar os estudantes.');
  }
}

function generateClassCode_() {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var index = 0; index < 6; index++) code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  return code;
}
