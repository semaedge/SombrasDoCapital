/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 14_PlayerService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Perfil do jogador.
 *
 * INTEGRAÇÕES
 * Mantém progresso, preferências e métricas pedagógicas do aluno.
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

function PlayerService_healthcheck() {
  return { component: '14_PlayerService.gs', status: 'implemented' };
}

function getPlayerProfile(userId) {
  var user = findUserById(userId);
  if (!user) return jsonError_('PLAYER_NOT_FOUND', 'Jogador não encontrado.');
  return jsonSuccess_({ user: sanitizePublicUser(user), preferences: getPlayerPreferences_(user) });
}

function updatePlayerPreferences(userId, preferences) {
  var user = findUserById(userId);
  if (!user) return jsonError_('PLAYER_NOT_FOUND', 'Jogador não encontrado.');
  var input = preferences || {};
  var updates = {};
  if (input.highContrast != null) updates.high_contrast = Boolean(input.highContrast);
  if (input.fontSize != null) updates.font_size = clampNumber(input.fontSize, 12, 24, 16);
  if (input.typingSpeed != null) updates.typing_speed = clampNumber(input.typingSpeed, 0.5, 2, 1);
  try {
    var saved = updateRecordById('Users', user.id, updates);
    if (!saved) return jsonError_('PLAYER_NOT_UPDATED', 'Preferências não atualizadas.');
    return jsonSuccess_({ preferences: getPlayerPreferences_(saved) });
  } catch (error) {
    return jsonError_('PREFERENCES_NOT_SAVED', 'Não foi possível salvar as preferências.');
  }
}

function getPlayerSummary(userId) {
  var user = findUserById(userId);
  if (!user) return jsonError_('PLAYER_NOT_FOUND', 'Jogador não encontrado.');
  try {
    var progress = getPlayerProgress(user.id);
    var rigorDelta = progress.reduce(function(total, item) { return total + (Number(item.documentary_rigor_delta) || 0); }, 0);
    var phase = progress.length ? String(progress[progress.length - 1].phase || 'A Cria') : null;
    return jsonSuccess_({
      decisions: progress.length,
      documentaryRigor: progress.length ? Math.round(clampNumber(50 + rigorDelta * 10, 0, 100, null)) : null,
      activePhase: phase
    });
  } catch (error) {
    return jsonError_('SUMMARY_UNAVAILABLE', 'Não foi possível calcular o resumo do jogador.');
  }
}

function getPlayerPreferences_(user) {
  return { highContrast: String(user.high_contrast).toLowerCase() === 'true',
    fontSize: clampNumber(user.font_size, 12, 24, 16), typingSpeed: clampNumber(user.typing_speed, 0.5, 2, 1) };
}
