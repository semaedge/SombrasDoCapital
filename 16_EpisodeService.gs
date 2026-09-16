/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 16_EpisodeService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Episódios e fases.
 *
 * INTEGRAÇÕES
 * Consulta as cinco fases narrativas: A Cria, A Engorda, O Abate, A Refrigeração e A Desossa.
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

function EpisodeService_healthcheck() {
  return { component: '16_EpisodeService.gs', status: 'implemented' };
}

function getInitialScene() {
  return getCurrentScene('', 'scene-01');
}

function getCurrentScene(userId, sceneId) {
  try {
    var scene = getSceneById(sceneId || 'scene-01');
    if (!scene) return jsonError_('SCENE_NOT_FOUND', 'Cena não encontrada.');
    var episode = getEpisodeById(scene.episode_id);
    var publicScene = toPublicScene_(scene);
    return jsonSuccess_({
      id: publicScene.id,
      episode: sanitizeHtml((episode && (episode.title || episode.name)) || scene.phase || ''),
      phase: publicScene.phase,
      title: publicScene.title,
      narrative: publicScene.narrative,
      sender: sanitizeHtml(scene.sender || 'Fonte Anônima'),
      source: sanitizeHtml(scene.source),
      contentNature: publicScene.contentNature,
      contentNatureLabel: publicScene.contentNatureLabel,
      natureNote: publicScene.natureNote,
      sourceTitle: publicScene.sourceTitle,
      sourceOrganization: publicScene.sourceOrganization,
      sourceUrl: publicScene.sourceUrl,
      accessedAt: publicScene.accessedAt,
      sourceVersion: publicScene.sourceVersion,
      ageBand: publicScene.ageBand,
      pedagogicalObjective: publicScene.pedagogicalObjective,
      media: {
        audioUrl: sanitizeHtml(scene.audio_url),
        documentUrl: sanitizeHtml(scene.document_url)
      },
      choices: getChoicesBySceneId(scene.id)
    });
  } catch (error) {
    return logAndCreateError('SCENE_UNAVAILABLE', 'Não foi possível carregar a cena.', error.message, userId);
  }
}

/**
 * Retorna progressão de fases com desbloqueio automático
 * Implementa Prompt 78: motor de desbloqueio
 */
function getPhases(playerId) {
  var normalizedPlayerId = normalizeText(playerId, 160);
  if (!normalizedPlayerId) {
    return jsonError_('INVALID_PLAYER', 'Jogador não autenticado.');
  }
  
  try {
    var progression = getPhasesProgression(normalizedPlayerId);
    return jsonSuccess_(progression);
  } catch (error) {
    return logAndCreateError('PHASES_UNAVAILABLE', 'Não foi possível carregar as fases.', error.message, playerId);
  }
}
