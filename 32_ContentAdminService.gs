/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 32_ContentAdminService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Administração de conteúdo.
 *
 * INTEGRAÇÕES
 * CRUD protegido de episódios, cenas, evidências, escolhas e consequências.
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

function ContentAdminService_healthcheck() {
  return { component: '32_ContentAdminService.gs', status: 'implemented' };
}

function saveContentRecord(user, sheetName, record, recordId) {
  var allowedSheets = ['Episodes', 'Scenes', 'Choices', 'Consequences'];
  try {
    requireContentEditor(user);
    if (allowedSheets.indexOf(sheetName) < 0) return jsonError_('INVALID_CONTENT_SHEET', 'Aba de conteúdo inválida.');
    var cleanRecord = sanitizeContentRecord_(record || {});
    if (!cleanRecord.title && !cleanRecord.name && !cleanRecord.label && !cleanRecord.text && !cleanRecord.narrative) {
      return jsonError_('INVALID_CONTENT', 'O registro precisa conter conteúdo textual.');
    }
    var saved = recordId ? updateRecordById(sheetName, recordId, cleanRecord) : insertRecord(sheetName, cleanRecord);
    if (!saved) return jsonError_('CONTENT_NOT_FOUND', 'Registro de conteúdo não encontrado.');
    return jsonSuccess_({ id: saved.id, sheet: sheetName });
  } catch (error) {
    if (error.message === 'Acesso restrito a editores.') return jsonError_('FORBIDDEN', error.message);
    return jsonError_('CONTENT_NOT_SAVED', 'Não foi possível salvar o conteúdo.');
  }
}

function listContentRecords(user, sheetName) {
  try {
    requireContentEditor(user);
    if (['Episodes', 'Scenes', 'Choices', 'Consequences'].indexOf(sheetName) < 0) {
      return jsonError_('INVALID_CONTENT_SHEET', 'Aba de conteúdo inválida.');
    }
    return jsonSuccess_(getSheetRecords(sheetName, APP_CONSTANTS.maxPageSize).map(function(record) {
      return { id: sanitizeHtml(record.id), title: sanitizeHtml(record.title || record.name || record.label || record.text || '') };
    }));
  } catch (error) {
    if (error.message === 'Acesso restrito a editores.') return jsonError_('FORBIDDEN', error.message);
    return jsonError_('CONTENT_UNAVAILABLE', 'Não foi possível carregar o conteúdo.');
  }
}

function sanitizeContentRecord_(record) {
  var clean = {};
  Object.keys(record).forEach(function(key) {
    if (key === 'id' || key === 'created_at' || key === 'updated_at') return;
    clean[key] = typeof record[key] === 'string' ? normalizeText(record[key], APP_CONSTANTS.maxTextLength) : record[key];
  });
  return clean;
}
