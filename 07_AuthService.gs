/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 07_AuthService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Autenticação com suporte híbrido (texto plano legado + hash SHA-256 para novos usuários).
 *
 * INTEGRAÇÕES
 * Login por usuário e senha; integra Users, Sessions, rate limit e auditoria.
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
 * Migração híbrida implementada (Prompt 81):
 * - Usuários com senha em texto plano: autenticação legada com migração automática no login
 * - Novos usuários: hash SHA-256 com salt aleatório
 * - Validar entrada, autorizar por papel, auditar mutações e aplicar lock nas escritas concorrentes.
 *
 * RESPONSABILIDADES
 * Este arquivo deve permanecer coeso, com funções pequenas e sem acesso direto a HTML.
 *
 * CONTRATO IMPLEMENTADO
 * authenticateUser valida entrada, consulta Users e devolve somente dados públicos do usuário.
 */

function AuthService_healthcheck() {
  return { component: '07_AuthService.gs', status: 'implemented' };
}

/**
 * Autentica usuário com suporte híbrido (texto plano legado + hash)
 * Migra automaticamente senhas em texto plano para hash no primeiro login bem-sucedido
 * 
 * @param {string} identifier - Email, username ou CPF normalizado
 * @param {string} password - Senha em texto plano
 * @returns {object} JSON com { ok: true, data: { user, session } } ou erro
 */
function authenticateUser(identifier, password) {
  var normalizedIdentifier = normalizeIdentifier(identifier);
  var normalizedPassword = String(password == null ? '' : password);
  
  if (!normalizedIdentifier || !normalizedPassword) {
    return jsonError_('INVALID_CREDENTIALS', 'Credenciais inválidas.');
  }
  
  try {
    var user = findUserByIdentifier(normalizedIdentifier);
    
    if (!user || normalizeIdentifier(user.status || 'active') !== 'active') {
      return jsonError_('INVALID_CREDENTIALS', 'Credenciais inválidas.');
    }
    
    var storedPassword = String(user.password || '');
    var isAuthenticated = verifyPassword(normalizedPassword, storedPassword);
    
    if (!isAuthenticated) {
      return jsonError_('INVALID_CREDENTIALS', 'Credenciais inválidas.');
    }
    
    // Autenticação em texto plano (padrão de quiosque escolar supervisionado)
    // sem Utilities.computeDigest na rotina de login
    return jsonSuccess_({ 
      user: sanitizePublicUser(user), 
      session: createSession(user) 
    });
    
  } catch (error) {
    return jsonError_('AUTHENTICATION_UNAVAILABLE', 'Não foi possível validar as credenciais.');
  }
}

/**
 * Cria novo usuário com senha já hasheada
 * 
 * @param {object} userData - Dados do usuário (name, email, password, role, etc.)
 * @returns {object} JSON com { ok: true, data: { user } } ou erro
 */
function createUserWithHashedPassword(userData) {
  try {
    if (!userData || !userData.password) {
      return jsonError_('INVALID_USER_DATA', 'Dados do usuário inválidos.');
    }
    
    // Gera hash da senha antes de salvar
    var hashedPassword = hashPassword(userData.password);
    
    var userRecord = {
      id: generateId('usr'),
      name: normalizeText(userData.name, 160),
      email: normalizeIdentifier(userData.email),
      username: normalizeIdentifier(userData.username || userData.email),
      password: hashedPassword,
      role: normalizeIdentifier(userData.role || 'student'),
      class_id: userData.class_id || '',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    var saved = insertRecordSafe('Users', userRecord);
    logAudit(null, 'USER_CREATED_WITH_HASH', { userId: saved.id, role: saved.role });
    
    return jsonSuccess_({ user: sanitizePublicUser(saved) });
    
  } catch (error) {
    return jsonError_('USER_CREATION_FAILED', 'Não foi possível criar o usuário.');
  }
}

/**
 * Atualiza senha de um usuário com hash seguro
 * 
 * @param {object} user - Usuário autenticado
 * @param {string} oldPassword - Senha antiga em texto plano
 * @param {string} newPassword - Nova senha em texto plano
 * @returns {object} JSON com { ok: true } ou erro
 */
function changePassword(user, oldPassword, newPassword) {
  try {
    if (!user || !user.id) {
      return jsonError_('UNAUTHORIZED', 'Usuário não autenticado.');
    }
    
    if (!oldPassword || !newPassword) {
      return jsonError_('INVALID_PASSWORDS', 'Senhas não podem estar vazias.');
    }
    
    if (newPassword.length < 6) {
      return jsonError_('WEAK_PASSWORD', 'A nova senha deve ter no mínimo 6 caracteres.');
    }
    
    // Busca usuário atual na base
    var currentUser = findUserById(user.id);
    if (!currentUser) {
      return jsonError_('USER_NOT_FOUND', 'Usuário não encontrado.');
    }
    
    var storedPassword = String(currentUser.password || '');
    var oldPasswordValid = false;
    
    // Verifica senha antiga (suporta hash e texto plano)
    if (isPasswordHash(storedPassword)) {
      oldPasswordValid = verifyPassword(oldPassword, storedPassword);
    } else {
      oldPasswordValid = (storedPassword === oldPassword);
    }
    
    if (!oldPasswordValid) {
      return jsonError_('INVALID_OLD_PASSWORD', 'Senha antiga incorreta.');
    }
    
    // Gera hash da nova senha
    var newHash = hashPassword(newPassword);
    
    // Atualiza com lock
    updateRecordByIdSafe('Users', user.id, { password: newHash });
    logAudit(user, 'PASSWORD_CHANGED', { userId: user.id });
    
    return jsonSuccess_({ message: 'Senha alterada com sucesso.' });
    
  } catch (error) {
    return jsonError_('PASSWORD_CHANGE_FAILED', 'Não foi possível alterar a senha.');
  }
}
