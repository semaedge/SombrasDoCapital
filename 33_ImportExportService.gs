/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 33_ImportExportService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Importação e exportação.
 *
 * INTEGRAÇÕES
 * Exporta dados didáticos para JSON/CSV e importa lotes validados para a planilha.
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

function ImportExportService_healthcheck() {
  return { component: '33_ImportExportService.gs', status: 'implemented' };
}

function exportReports(format) {
  var outputFormat = normalizeIdentifier(format || 'json');
  if (outputFormat !== 'json' && outputFormat !== 'csv') return jsonError_('INVALID_EXPORT_FORMAT', 'Formato de exportação inválido.');
  try {
    var payload = { Reports: getSheetRecords('Reports', APP_CONSTANTS.maxPageSize), ImpactReports: getSheetRecords('ImpactReports', APP_CONSTANTS.maxPageSize) };
    if (outputFormat === 'json') return jsonSuccess_(payload);
    return jsonSuccess_({ contentType: 'text/csv', content: toCsv_(payload.Reports, 'Reports') + toCsv_(payload.ImpactReports, 'ImpactReports') });
  } catch (error) {
    return jsonError_('EXPORT_FAILED', 'Não foi possível exportar os relatórios.');
  }
}

function toCsv_(records, sheetName) {
  if (!records.length) return '';
  var headers = Object.keys(records[0]);
  var lines = [headers.map(csvValue_).join(',')];
  records.forEach(function(record) { lines.push(headers.map(function(header) { return csvValue_(record[header]); }).join(',')); });
  return csvValue_(sheetName) + '\n' + lines.join('\n') + '\n';
}

function csvValue_(value) {
  return '"' + String(value == null ? '' : value).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
}

function exportClassData(teacher, classId) {
  try {
    requireTeacher(teacher);
    var requestedClassId = normalizeText(classId || '', 160);
    var teacherClasses = getSheetRecords('Classes', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return String(item.teacher_id || item.owner_id || '') === String(teacher.id);
    });
    var selectedClasses = requestedClassId && requestedClassId !== 'all'
      ? teacherClasses.filter(function(item) { return String(item.id) === requestedClassId; })
      : teacherClasses;
    if (!selectedClasses.length) return jsonError_('CLASS_NOT_FOUND', 'Turma não encontrada.');
    var selectedClassIds = selectedClasses.map(function(item) { return String(item.id); });
    var students = getSheetRecords('Users', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return normalizeIdentifier(item.role) === APP_CONSTANTS.roles.student && selectedClassIds.indexOf(String(item.class_id)) >= 0;
    });
    var progress = getSheetRecords('Progress', APP_CONSTANTS.maxPageSize);
    var reports = getSheetRecords('Reports', APP_CONSTANTS.maxPageSize);
    var rows = students.map(function(student) {
      var studentProgress = progress.filter(function(item) { return String(item.player_id) === String(student.id); });
      var finalReport = reports.filter(function(item) { return String(item.player_id) === String(student.id) && normalizeIdentifier(item.type) === 'final'; }).pop() || {};
      return { student_id: student.id, student_name: student.name || student.display_name || '', decisions: studentProgress.length,
        rigor_delta: studentProgress.reduce(function(total, item) { return total + (Number(item.documentary_rigor_delta) || 0); }, 0),
        speed_delta: studentProgress.reduce(function(total, item) { return total + (Number(item.speed_delta) || 0); }, 0),
        report_title: finalReport.title || '', report_grade: finalReport.grade == null ? '' : finalReport.grade,
        report_coherence: finalReport.coherence == null ? '' : finalReport.coherence };
    });
    return jsonSuccess_({ classId: sanitizeHtml(requestedClassId || 'all'), contentType: 'text/csv', records: rows, content: toCsv_(rows, 'class_' + (requestedClassId || 'all')) });
  } catch (error) {
    if (error.message === 'Acesso restrito a professores.') return jsonError_('FORBIDDEN', error.message);
    return jsonError_('CLASS_EXPORT_FAILED', 'Não foi possível exportar os dados da turma.');
  }
}

function importBatchContent(user, sheetName, csvString) {
  if (!hasRole(user, APP_CONSTANTS.roles.admin)) return jsonError_('FORBIDDEN', 'Apenas administradores podem importar conteúdo.');
  var allowedSheets = ['Episodes', 'Scenes', 'Choices', 'Consequences'];
  if (allowedSheets.indexOf(sheetName) < 0) return jsonError_('INVALID_CONTENT_SHEET', 'Aba de conteúdo inválida.');
  try {
    var rows = parseCsv_(String(csvString || ''));
    if (rows.length < 2 || rows.length > 101) return jsonError_('INVALID_BATCH', 'O CSV deve conter entre 1 e 100 registros.');
    var headers = rows.shift().map(function(header) { return normalizeIdentifier(header); });
    var required = { Episodes: ['title', 'phase'], Scenes: ['title', 'narrative', 'phase'], Choices: ['label', 'action'], Consequences: ['text'] }[sheetName];
    if (required.some(function(header) { return headers.indexOf(header) < 0; })) return jsonError_('INVALID_COLUMNS', 'Cabeçalhos incompatíveis com a aba de destino.');
    var records = rows.map(function(row) { var record = {}; headers.forEach(function(header, index) { record[header] = normalizeText(row[index], APP_CONSTANTS.maxTextLength); }); return record; });
    var saved = insertRecordsBatch(sheetName, records);
    return jsonSuccess_({ sheet: sheetName, inserted: saved.length });
  } catch (error) {
    return jsonError_('IMPORT_FAILED', 'Não foi possível importar o conteúdo.');
  }
}

function parseCsv_(text) {
  var rows = [], row = [], value = '', quoted = false;
  for (var index = 0; index < text.length; index++) {
    var character = text.charAt(index);
    if (character === '"') {
      if (quoted && text.charAt(index + 1) === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(value); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text.charAt(index + 1) === '\n') index++;
      row.push(value); value = ''; if (row.some(function(cell) { return cell !== ''; })) rows.push(row); row = [];
    } else value += character;
  }
  if (value !== '' || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function sendBatchFeedback(teacher, classId, feedbackText) {
  try {
    requireTeacher(teacher);
    var sanitizedText = normalizeText(feedbackText, 2000);
    if (!sanitizedText) return jsonError_('INVALID_FEEDBACK', 'O comentário não pode estar vazio.');
    var targetClassId = normalizeText(classId, 160);
    if (!targetClassId || targetClassId === 'all') {
      return jsonError_('CLASS_SCOPE_REQUIRED', 'Selecione uma turma específica para registrar a orientação.');
    }
    
    var classRecord = getSheetRecords('Classes', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return String(item.id) === String(targetClassId) && String(item.teacher_id) === String(teacher.id);
    })[0];
    
    if (!classRecord) return jsonError_('CLASS_NOT_FOUND', 'Turma não encontrada.');
    
    var students = getSheetRecords('Users', APP_CONSTANTS.maxPageSize).filter(function(item) {
      return normalizeIdentifier(item.role) === APP_CONSTANTS.roles.student && 
             String(item.class_id) === String(targetClassId);
    });
    
    if (!students.length) return jsonError_('NO_STUDENTS', 'Nenhum aluno encontrado nesta turma.');
    
    var timestamp = new Date().toISOString();
    var feedbackRecords = students.map(function(student) {
      return {
        id: generateId('feedback'),
        player_id: student.id,
        teacher_id: teacher.id,
        class_id: targetClassId,
        feedback_text: sanitizedText,
        created_at: timestamp,
        type: 'batch_feedback',
        visibility: 'class_scope',
        purpose: 'formative_class_guidance',
        supersedes_report_id: ''
      };
    });
    
    var saved = insertRecordsBatch('Reports', feedbackRecords);
    logAudit(teacher, 'BATCH_FEEDBACK_SENT', { classId: targetClassId, studentsCount: students.length, recordsCreated: saved.length });
    
    return jsonSuccess_({ studentsCount: students.length, feedbacksSent: saved.length });
  } catch (error) {
    if (error.message === 'Acesso restrito a professores.') return jsonError_('FORBIDDEN', error.message);
    return jsonError_('FEEDBACK_SEND_FAILED', 'Não foi possível enviar a devolutiva em lote.');
  }
}
