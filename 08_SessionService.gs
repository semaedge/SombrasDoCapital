/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 08_SessionService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Sessões.
 *
 * INTEGRAÇÕES
 * Cria, consulta, expira e revoga tokens de sessão armazenados na planilha.
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
 * As sessões usam CacheService com expiração e nunca retornam o token ao painel público.
 */

function SessionService_healthcheck() {
  return { component: '08_SessionService.gs', status: 'implemented' };
}

function createSession(user) {
  if (!user || !user.id) throw new Error('Usuário inválido para criação de sessão.');
  var ttlSeconds = Number(APP_CONSTANTS.sessionTtlSeconds);
  if (!isFinite(ttlSeconds) || ttlSeconds <= 0) throw new Error('TTL de sessão inválido.');
  var token = generateUuid();
  var createdAt = new Date();
  var session = { token: token, user: sanitizePublicUser(user), createdAt: createdAt.toISOString() };
  CacheService.getScriptCache().put('session:' + token, JSON.stringify(session), ttlSeconds);
  insertRecord('Sessions', {
    id: token,
    created_at: createdAt,
    updated_at: createdAt,
    user_id: user.id,
    status: APP_CONSTANTS.statuses.active,
    expires_at: new Date(createdAt.getTime() + ttlSeconds * 1000)
  });
  return { token: token, expiresIn: ttlSeconds, user: session.user };
}

function getSession(token) {
  if (typeof token !== 'string') return null;
  var normalizedToken = normalizeText(token, 80);
  if (!normalizedToken || !/^[a-z0-9-]{20,80}$/i.test(normalizedToken)) return null;
  var cache = CacheService.getScriptCache();
  var cacheKey = 'session:' + normalizedToken;
  var value = cache.get(cacheKey);
  if (!value) return null;
  try {
    var session = JSON.parse(value);
    var createdAt = session && new Date(session.createdAt);
    var ttlSeconds = Number(APP_CONSTANTS.sessionTtlSeconds);
    var user = session && session.user;
    var validUser = user && typeof user === 'object' && !Array.isArray(user) &&
      (typeof user.id === 'string' || typeof user.id === 'number') && normalizeText(user.id, 160);
    var validCreatedAt = createdAt && !isNaN(createdAt.getTime());
    var validTtl = isFinite(ttlSeconds) && ttlSeconds > 0;
    var stillValid = validCreatedAt && validTtl && createdAt.getTime() + ttlSeconds * 1000 > new Date().getTime();
    if (!session || typeof session !== 'object' || Array.isArray(session) || session.token !== normalizedToken ||
        !validUser || !stillValid) {
      cache.remove(cacheKey);
      return null;
    }
    return { token: session.token, user: sanitizePublicUser(user), createdAt: session.createdAt };
  } catch (error) {
    cache.remove(cacheKey);
    return null;
  }
}

/**
 * Emite uma credencial curta para o roteador do Web App.
 *
 * O token de sessão permanece somente no localStorage/RPC. O ticket é opaco,
 * não contém o usuário e expira rapidamente; ele existe apenas para que o
 * doGet consiga autorizar a navegação inicial no servidor sem depender de
 * cookies de terceiros; a janela curta também cobre uma recarga imediata.
 */
var ROUTE_TICKET_TTL_SECONDS = 300;

function createRouteTicket(sessionToken) {
  var session = getSession(sessionToken);
  if (!session || !session.user || !session.user.id) {
    return jsonError_('UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }
  var ticket = generateUuid();
  CacheService.getScriptCache().put('route-ticket:' + ticket, JSON.stringify({
    sessionToken: session.token,
    issuedAt: new Date().toISOString()
  }), ROUTE_TICKET_TTL_SECONDS);
  return jsonSuccess_({ ticket: ticket, expiresIn: ROUTE_TICKET_TTL_SECONDS });
}

/** Resolve um ticket sem expor ou aceitar o token de sessão na URL. */
function consumeRouteTicket_(ticket) {
  if (typeof ticket !== 'string') return null;
  var normalizedTicket = normalizeText(ticket, 80);
  if (!normalizedTicket || !/^[a-z0-9-]{20,80}$/i.test(normalizedTicket)) return null;
  var cache = CacheService.getScriptCache();
  var cacheKey = 'route-ticket:' + normalizedTicket;
  var value = cache.get(cacheKey);
  if (!value) return null;
  try {
    var payload = JSON.parse(value);
    var session = payload && typeof payload === 'object' && !Array.isArray(payload) && payload.sessionToken
      ? getSession(payload.sessionToken) : null;
    if (!session) cache.remove(cacheKey);
    return session;
  } catch (error) {
    cache.remove(cacheKey);
    return null;
  }
}

function revokeSession(token) {
  var normalizedToken = normalizeText(token, 80);
  if (!normalizedToken) return false;
  var session = getSession(normalizedToken);
  CacheService.getScriptCache().remove('session:' + normalizedToken);
  if (session) updateRecordById('Sessions', normalizedToken, { status: APP_CONSTANTS.statuses.inactive });
  return true;
}
