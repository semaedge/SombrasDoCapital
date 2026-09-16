/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 04_Utils.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Utilitários compartilhados.
 *
 * INTEGRAÇÕES
 * Normalização, validação, datas ISO, serialização e escapes; usado por CRUD e auditoria.
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
 * CONTRATO IMPLEMENTADO
 * As funções abaixo são puras e formam a fronteira de normalização dos dados recebidos.
 */

function Utils_healthcheck() {
  return { component: '04_Utils.gs', status: 'implemented' };
}

function normalizeText(value, maxLength) {
  var limit = maxLength || APP_CONSTANTS.maxTextLength;
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, limit);
}

function normalizeIdentifier(value) {
  return normalizeText(value, 160).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function generateUuid() {
  return Utilities.getUuid();
}

function sanitizeHtml(value) {
  return normalizeText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isNonEmptyText(value, maxLength) {
  return normalizeText(value, maxLength).length > 0;
}

/**
 * Classifica a natureza epistemológica de um conteúdo antes de exibi-lo.
 * O valor desconhecido é deliberadamente conservador: não pode parecer fato.
 */
function getContentNatureCode_(value) {
  var code = normalizeIdentifier(value);
  if (code === 'fiction' || code === 'ficcao' || code === 'didacticfiction') return 'fiction';
  if (code === 'simulateddata' || code === 'simulated' || code === 'dadosimulado') return 'simulated_data';
  if (code === 'fact' || code === 'factual' || code === 'fato') return 'fact';
  if (code === 'concept' || code === 'conceito') return 'concept';
  return 'unclassified';
}

function getContentNatureLabel_(value) {
  var code = getContentNatureCode_(value);
  return {
    fiction: 'FICÇÃO DIDÁTICA',
    simulated_data: 'DADO SIMULADO',
    fact: 'INFORMAÇÃO FACTUAL — FONTE EXTERNA',
    concept: 'CONCEITO CURRICULAR',
    unclassified: 'NATUREZA NÃO CLASSIFICADA — REVISÃO DOCENTE'
  }[code];
}

function clampNumber(value, minimum, maximum, fallback) {
  var number = Number(value);
  if (isNaN(number)) return fallback == null ? minimum : fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function sanitizePublicUser(user) {
  if (!user) return null;
  return { id: sanitizeHtml(user.id || ''), name: sanitizeHtml(normalizeText(user.name || user.display_name, 160)),
    role: normalizeIdentifier(user.role), class_id: user.class_id || '' };
}

/**
 * NEUTRALIZADO: Retorna texto plano (sem hash).
 * A frota opera com senhas em texto plano (decisão de quiosque escolar supervisionado).
 * Esta função foi neutralizada para nunca gerar hash de credencial — sem Utilities.computeDigest.
 * 
 * @param {string} password - Senha em texto plano
 * @returns {string} Senha em texto plano
 */
function hashPassword(password) {
  // Retorna texto plano — sem hash, sem Utilities.computeDigest
  return String(password || '');
}

/**
 * Verifica se uma senha corresponde ao registro armazenado.
 * Suporta comparação direta em texto plano (padrão da frota) e
 * retrocompatibilidade caso exista hash legado (salt$hash).
 * 
 * @param {string} password - Senha informada
 * @param {string} storedPassword - Senha ou hash armazenado
 * @returns {boolean} true se a senha confere
 */
function verifyPassword(password, storedPassword) {
  if (!password || !storedPassword) return false;
  var inputStr = String(password);
  var storedStr = String(storedPassword);
  if (isPasswordHash(storedStr)) {
    var parts = storedStr.split('$');
    if (parts.length !== 2) return false;
    var salt = parts[0];
    var originalHash = parts[1];
    var combined = salt + inputStr;
    var hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, combined, Utilities.Charset.UTF_8);
    var computedHash = hashBytes.map(function(byte) {
      var hex = (byte < 0 ? byte + 256 : byte).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
    if (computedHash.length !== originalHash.length) return false;
    var match = 0;
    for (var i = 0; i < computedHash.length; i++) {
      match |= computedHash.charCodeAt(i) ^ originalHash.charCodeAt(i);
    }
    return match === 0;
  }
  return inputStr === storedStr;
}

/**
 * Detecta se uma string é um hash (contém $) ou senha em texto plano
 * 
 * @param {string} value - Valor a ser verificado
 * @returns {boolean} true se for hash, false se for texto plano
 */
function isPasswordHash(value) {
  return String(value || '').indexOf('$') > 0;
}
