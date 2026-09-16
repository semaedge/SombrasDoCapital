/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 09_UserRepository.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Repositório de usuários.
 *
 * INTEGRAÇÕES
 * CRUD de usuários, perfis, turmas e status; integra aba Users.
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

function UserRepository_healthcheck() {
  return { component: '09_UserRepository.gs', status: 'implemented' };
}

function findUserByIdentifier(identifier) {
  var normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) return null;
  return getSheetRecords('Users', APP_CONSTANTS.maxPageSize).filter(function(user) {
    return [user.email, user.username, user.login, user.identifier].some(function(candidate) {
      return normalizeIdentifier(candidate) === normalizedIdentifier;
    });
  })[0] || null;
}

function findUserById(userId) {
  var normalizedId = normalizeText(userId, 160);
  if (!normalizedId) return null;
  return getSheetRecords('Users', APP_CONSTANTS.maxPageSize).filter(function(user) {
    return String(user.id) === normalizedId;
  })[0] || null;
}

function createUser(userData) {
  var data = userData || {};
  var login = data.login || data.email || data.username;
  var name = data.name || data.display_name;
  var role = normalizeIdentifier(data.role);
  var validRoles = Object.keys(APP_CONSTANTS.roles).map(function(key) { return APP_CONSTANTS.roles[key]; });
  if (!isNonEmptyText(login, 160) || !isNonEmptyText(name, 160) || !isNonEmptyText(role, 40)) {
    return jsonError_('INVALID_USER', 'Login, nome e papel são obrigatórios.');
  }
  if (validRoles.indexOf(role) < 0) return jsonError_('INVALID_ROLE', 'Papel de usuário inválido.');
  try {
    var duplicate = findUserByIdentifier(login);
    if (duplicate) return jsonError_('USER_EXISTS', 'Já existe um usuário com esse login.');
    var record = insertRecord('Users', {
      id: generateUuid(), login: normalizeText(login, 160), name: normalizeText(name, 160),
      role: role, password: String(data.password == null ? '' : data.password),
      status: APP_CONSTANTS.statuses.active
    });
    return jsonSuccess_({ user: sanitizePublicUser(record) });
  } catch (error) {
    return jsonError_('USER_NOT_CREATED', 'Não foi possível criar o usuário.');
  }
}

function updateUser(userId, updates) {
  var user = findUserById(userId);
  if (!user) return jsonError_('USER_NOT_FOUND', 'Usuário não encontrado.');
  var input = updates || {};
  var changes = {};
  if (input.login != null || input.email != null || input.username != null) {
    var login = input.login || input.email || input.username;
    if (!isNonEmptyText(login, 160)) return jsonError_('INVALID_USER', 'Login inválido.');
    changes.login = normalizeText(login, 160);
  }
  if (input.name != null || input.display_name != null) {
    var name = input.name || input.display_name;
    if (!isNonEmptyText(name, 160)) return jsonError_('INVALID_USER', 'Nome inválido.');
    changes.name = normalizeText(name, 160);
  }
  if (input.role != null) {
    var role = normalizeIdentifier(input.role);
    var validRoles = Object.keys(APP_CONSTANTS.roles).map(function(key) { return APP_CONSTANTS.roles[key]; });
    if (validRoles.indexOf(role) < 0) return jsonError_('INVALID_ROLE', 'Papel de usuário inválido.');
    changes.role = role;
  }
  if (input.password != null) changes.password = String(input.password);
  if (!Object.keys(changes).length) return jsonError_('NO_CHANGES', 'Nenhuma alteração informada.');
  try {
    var saved = updateRecordById('Users', user.id, changes);
    return saved ? jsonSuccess_({ user: sanitizePublicUser(saved) }) : jsonError_('USER_NOT_UPDATED', 'Usuário não atualizado.');
  } catch (error) {
    return jsonError_('USER_NOT_UPDATED', 'Não foi possível atualizar o usuário.');
  }
}

function deactivateUser(userId) {
  var user = findUserById(userId);
  if (!user) return jsonError_('USER_NOT_FOUND', 'Usuário não encontrado.');
  try {
    var saved = updateRecordById('Users', user.id, { status: APP_CONSTANTS.statuses.inactive });
    return saved ? jsonSuccess_({ user: sanitizePublicUser(saved) }) : jsonError_('USER_NOT_DEACTIVATED', 'Usuário não desativado.');
  } catch (error) {
    return jsonError_('USER_NOT_DEACTIVATED', 'Não foi possível desativar o usuário.');
  }
}
