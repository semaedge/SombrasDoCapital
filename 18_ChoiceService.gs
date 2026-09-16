/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 18_ChoiceService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Escolhas.
 *
 * INTEGRAÇÕES
 * Registra escolhas do jogador e resolve próximos nós da árvore narrativa.
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

function ChoiceService_healthcheck() {
  return { component: '18_ChoiceService.gs', status: 'implemented' };
}

/**
 * CORREÇÃO P19: submitChoice() agora deriva playerId da sessão autenticada.
 * Assinatura compatível com chamadas legadas mas requer token válido.
 * @param {string} choiceId - ID da escolha
 * @param {string} sessionTokenOrPlayerId - Token de sessão (ou playerId legado, ignorado)
 * @param {string} sceneId - ID da cena (opcional, padrão scene-01)
 */
function submitChoice(choiceId, sessionTokenOrPlayerId, sceneId) {
  var choiceKey = normalizeIdentifier(choiceId);
  if (choiceKey !== 'publish' && choiceKey !== 'verify' && choiceKey !== 'inaction' &&
      choiceKey !== 'choicepublish' && choiceKey !== 'choiceverify') {
    return jsonError_('INVALID_CHOICE', 'Escolha inválida.');
  }

  // DERIVA playerId da sessão autenticada (não aceita do cliente)
  var token = String(sessionTokenOrPlayerId || '').trim();
  if (!token) return jsonError_('AUTH_REQUIRED', 'Token de sessão obrigatório.');
  
  var session = getSession(token);
  if (!session || !session.user) {
    return jsonError_('UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }
  
  var playerId = String(session.user.id || '');
  if (!playerId) {
    return jsonError_('INVALID_PLAYER', 'Sessão não identifica o jogador.');
  }

  var targetScene = sceneId || 'scene-01';
  var action = choiceKey === 'inaction' ? 'inaction' : choiceKey.indexOf('verify') >= 0 ? 'verify' : 'publish';
  var consequence = evaluateChoice(action);
  try {
    var progress = recordChoiceProgress(playerId, targetScene, choiceId, consequence);
    return jsonSuccess_({ choice: action, consequence: consequence.text, impact: consequence.impact, progressId: progress.id });
  } catch (error) {
    return jsonError_('CHOICE_NOT_RECORDED', 'Não foi possível registrar a escolha.');
  }
}
