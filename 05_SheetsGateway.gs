/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 05_SheetsGateway.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Gateway de planilha.
 *
 * INTEGRAÇÕES
 * Abstrai SpreadsheetApp, seleção de abas, cabeçalhos e operações de faixa sem espalhar detalhes de infraestrutura.
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

function SheetsGateway_healthcheck() {
  return { component: '05_SheetsGateway.gs', status: 'implemented' };
}

function getSheetRecords(sheetName, limit) {
  var spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];

  // 2. Limita estritamente as linhas lidas a APP_CONSTANTS.maxDashboardRecords (Prompt 67)
  var maxAllowed = (typeof APP_CONSTANTS !== 'undefined' && APP_CONSTANTS.maxDashboardRecords) ? APP_CONSTANTS.maxDashboardRecords : 24;
  var rowLimit = Math.max(1, Math.min(Number(limit) || maxAllowed, maxAllowed));
  var cacheKey = 'sheet_records_' + sheetName + '_' + rowLimit;

  // Cache de sessão via CacheService para evitar chamadas redundantes à planilha
  try {
    if (typeof CacheService !== 'undefined' && CacheService.getUserCache) {
      var cached = CacheService.getUserCache().get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  } catch (cacheReadError) {}

  try {
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];

    var values = sheet.getRange(1, 1, Math.min(sheet.getLastRow(), rowLimit + 1), sheet.getLastColumn()).getValues();
    var headers = values.shift().map(function(header) { return String(header).trim(); });
    var records = values.filter(function(row) {
      return row.some(function(value) { return value !== ''; });
    }).map(function(row) {
      return headers.reduce(function(record, header, index) {
        if (header) record[header] = row[index];
        return record;
      }, {});
    });

    try {
      if (typeof CacheService !== 'undefined' && CacheService.getUserCache) {
        CacheService.getUserCache().put(cacheKey, JSON.stringify(records), 300);
      }
    } catch (cacheWriteError) {}

    return records;
  } catch (error) {
    throw new Error('Falha ao ler a aba ' + normalizeText(sheetName, 80) + '.');
  }
}

function insertRecord(sheetName, record) {
  var sheet = getGatewaySheet_(sheetName);
  var headers = getSheetHeaders_(sheet);
  if (!headers.length) throw new Error('A aba ' + sheetName + ' não possui cabeçalho.');

  var now = new Date();
  var data = Object.assign({}, record || {});
  if (!data.id) data.id = Utilities.getUuid();
  if (!data.created_at) data.created_at = now;
  if (!data.updated_at) data.updated_at = now;
  var additionalHeaders = Object.keys(data).filter(function(header) {
    return headers.indexOf(header) < 0;
  });
  if (additionalHeaders.length) {
    sheet.getRange(1, headers.length + 1, 1, additionalHeaders.length).setValues([additionalHeaders]);
    headers = headers.concat(additionalHeaders);
  }
  var values = headers.map(function(header) {
    return data[header] == null ? '' : data[header];
  });

  sheet.appendRow(values);
  return headers.reduce(function(result, header, index) {
    result[header] = values[index];
    return result;
  }, {});
}

function insertRecordsBatch(sheetName, records) {
  var items = Array.isArray(records) ? records : [];
  if (!items.length) return [];
  var sheet = getGatewaySheet_(sheetName);
  var headers = getSheetHeaders_(sheet);
  if (!headers.length) throw new Error('A aba ' + sheetName + ' não possui cabeçalho.');
  var now = new Date();
  var prepared = items.map(function(record) {
    var data = Object.assign({}, record || {});
    if (!data.id) data.id = generateUuid();
    if (!data.created_at) data.created_at = now;
    if (!data.updated_at) data.updated_at = now;
    return data;
  });
  var additionalHeaders = prepared.reduce(function(result, data) {
    Object.keys(data).forEach(function(header) { if (headers.indexOf(header) < 0 && result.indexOf(header) < 0) result.push(header); });
    return result;
  }, []);
  if (additionalHeaders.length) {
    sheet.getRange(1, headers.length + 1, 1, additionalHeaders.length).setValues([additionalHeaders]);
    headers = headers.concat(additionalHeaders);
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, prepared.length, headers.length).setValues(prepared.map(function(data) {
    return headers.map(function(header) { return data[header] == null ? '' : data[header]; });
  }));
  return prepared;
}

function updateRecordById(sheetName, id, updates) {
  var sheet = getGatewaySheet_(sheetName);
  var headers = getSheetHeaders_(sheet);
  var idColumn = headers.indexOf('id');
  if (idColumn < 0) throw new Error('A aba ' + sheetName + ' não possui a coluna id.');
  if (sheet.getLastRow() < 2) return null;

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var rowIndex = rows.findIndex(function(row) {
    return String(row[idColumn]) === String(id);
  });
  if (rowIndex < 0) return null;

  var row = rows[rowIndex];
  Object.keys(updates || {}).forEach(function(header) {
    var column = headers.indexOf(header);
    if (column >= 0 && header !== 'id' && header !== 'created_at') {
      row[column] = updates[header];
    }
  });
  var updatedAtColumn = headers.indexOf('updated_at');
  if (updatedAtColumn >= 0) row[updatedAtColumn] = new Date();
  sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([row]);

  return headers.reduce(function(result, header, index) {
    result[header] = row[index];
    return result;
  }, {});
}

function deleteRecordById(sheetName, id) {
  var sheet = getGatewaySheet_(sheetName);
  var headers = getSheetHeaders_(sheet);
  var idColumn = headers.indexOf('id');
  if (idColumn < 0 || sheet.getLastRow() < 2) return false;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var rowIndex = rows.findIndex(function(row) { return String(row[idColumn]) === String(id); });
  if (rowIndex < 0) return false;
  sheet.deleteRow(rowIndex + 2);
  return true;
}

function getGatewaySheet_(sheetName) {
  var spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Configure SPREADSHEET_ID antes de acessar a planilha.');
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  if (!sheet) throw new Error('Aba não encontrada: ' + sheetName);
  return sheet;
}

function getSheetHeaders_(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(header) {
    return String(header).trim();
  });
}

/**
 * Executa operação de escrita com Lock para prevenir condições de corrida
 * Usa LockService.getScriptLock() para garantir atomicidade em escritas concorrentes
 * 
 * @param {function} operation - Função a ser executada com lock
 * @param {number} timeoutSeconds - Tempo máximo de espera pelo lock (padrão: 30s)
 * @returns {*} Resultado da operação
 * @throws {Error} Se não conseguir obter o lock no tempo especificado
 */
function withWriteLock(operation, timeoutSeconds) {
  var timeout = timeoutSeconds || 30;
  var lock = LockService.getScriptLock();
  
  try {
    // Tenta adquirir lock por até N segundos
    var acquired = lock.tryLock(timeout * 1000);
    
    if (!acquired) {
      throw new Error('Não foi possível obter lock de escrita após ' + timeout + ' segundos. Tente novamente.');
    }
    
    // Executa operação com lock garantido
    var result = operation();
    return result;
    
  } finally {
    // Sempre libera o lock, mesmo em caso de erro
    try {
      lock.releaseLock();
    } catch (releaseError) {
      // Ignora erro de release (lock já foi liberado automaticamente)
    }
  }
}

/**
 * Versão com lock do insertRecord - garante atomicidade na inserção
 */
function insertRecordSafe(sheetName, record) {
  return withWriteLock(function() {
    return insertRecord(sheetName, record);
  });
}

/**
 * Versão com lock do insertRecordsBatch - garante atomicidade em lote
 */
function insertRecordsBatchSafe(sheetName, records) {
  return withWriteLock(function() {
    return insertRecordsBatch(sheetName, records);
  });
}

/**
 * Versão com lock do updateRecordById - garante atomicidade na atualização
 */
function updateRecordByIdSafe(sheetName, id, updates) {
  return withWriteLock(function() {
    return updateRecordById(sheetName, id, updates);
  });
}

/**
 * Versão com lock do deleteRecordById - garante atomicidade na exclusão
 */
function deleteRecordByIdSafe(sheetName, id) {
  return withWriteLock(function() {
    return deleteRecordById(sheetName, id);
  });
}
