/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 17_SceneRepository.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Cenas.
 *
 * INTEGRAÇÕES
 * CRUD de cenas, textos, temporizadores e transições; integra aba Scenes.
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

function SceneRepository_healthcheck() {
  return { component: '17_SceneRepository.gs', status: 'implemented' };
}

function getSceneById(sceneId) {
  var normalizedId = normalizeText(sceneId, 160);
  if (!normalizedId) return null;
  return getSheetRecords('Scenes', APP_CONSTANTS.maxPageSize).filter(function(scene) {
    return String(scene.id) === normalizedId;
  })[0] || null;
}

function getEpisodeById(episodeId) {
  var normalizedId = normalizeText(episodeId, 160);
  if (!normalizedId) return null;
  return getSheetRecords('Episodes', APP_CONSTANTS.maxPageSize).filter(function(episode) {
    return String(episode.id) === normalizedId;
  })[0] || null;
}

function getChoicesBySceneId(sceneId) {
  return getSheetRecords('Choices', APP_CONSTANTS.maxPageSize).filter(function(choice) {
    return String(choice.scene_id) === String(sceneId);
  }).map(function(choice) {
    var nature = getContentNatureCode_(choice.content_nature || choice.nature || choice.epistemic_status);
    return {
      id: sanitizeHtml(choice.id),
      label: sanitizeHtml(choice.label || choice.text),
      action: normalizeIdentifier(choice.action),
      contentNature: nature,
      contentNatureLabel: getContentNatureLabel_(nature),
      natureNote: sanitizeHtml(choice.nature_note || 'Decisão narrativa de um caso simulado; requer mediação docente.'),
      ageBand: sanitizeHtml(choice.age_band || ''),
      pedagogicalObjective: sanitizeHtml(choice.pedagogical_objective || '')
    };
  });
}

function createScene(sceneData) {
  var data = sanitizeSceneData_(sceneData || {});
  if (!data.title || !data.narrative || !data.phase) {
    return jsonError_('INVALID_SCENE', 'Título, narrativa e fase são obrigatórios.');
  }
  try {
    var record = insertRecord('Scenes', data);
    return jsonSuccess_({ scene: toPublicScene_(record) });
  } catch (error) {
    return jsonError_('SCENE_NOT_CREATED', 'Não foi possível criar a cena.');
  }
}

function updateScene(sceneId, updates) {
  var existing = getSceneById(sceneId);
  if (!existing) return jsonError_('SCENE_NOT_FOUND', 'Cena não encontrada.');
  var data = sanitizeSceneData_(updates || {});
  var merged = Object.assign({}, existing, data);
  if (!merged.title || !merged.narrative || !merged.phase) {
    return jsonError_('INVALID_SCENE', 'Título, narrativa e fase são obrigatórios.');
  }
  try {
    var saved = updateRecordById('Scenes', sceneId, data);
    return saved ? jsonSuccess_({ scene: toPublicScene_(saved) }) : jsonError_('SCENE_NOT_UPDATED', 'Cena não atualizada.');
  } catch (error) {
    return jsonError_('SCENE_NOT_UPDATED', 'Não foi possível atualizar a cena.');
  }
}

function getScenesByEpisode(episodeId) {
  var normalizedEpisodeId = normalizeText(episodeId, 160);
  if (!normalizedEpisodeId) return [];
  return getSheetRecords('Scenes', APP_CONSTANTS.maxPageSize).filter(function(scene) {
    return String(scene.episode_id) === normalizedEpisodeId;
  }).sort(function(first, second) {
    return (Number(first.position) || 0) - (Number(second.position) || 0);
  }).map(toPublicScene_);
}

function sanitizeSceneData_(data) {
  var clean = {};
  Object.keys(data).forEach(function(key) {
    if (key === 'id' || key === 'created_at' || key === 'updated_at') return;
    clean[key] = typeof data[key] === 'string'
      ? normalizeText(data[key], APP_CONSTANTS.maxTextLength) : data[key];
  });
  return clean;
}

function toPublicScene_(scene) {
  var nature = getContentNatureCode_(scene.content_nature || scene.nature || scene.epistemic_status);
  return {
    id: sanitizeHtml(scene.id), episode_id: sanitizeHtml(scene.episode_id),
    title: sanitizeHtml(scene.title), narrative: sanitizeHtml(scene.narrative),
    phase: sanitizeHtml(scene.phase), position: Number(scene.position) || 0,
    contentNature: nature,
    contentNatureLabel: getContentNatureLabel_(nature),
    natureNote: sanitizeHtml(scene.nature_note || 'Natureza da cena não informada; requer revisão docente.'),
    sourceTitle: sanitizeHtml(scene.source_title || ''),
    sourceOrganization: sanitizeHtml(scene.source_organization || ''),
    sourceUrl: sanitizeHtml(scene.source_url || ''),
    accessedAt: sanitizeHtml(scene.accessed_at || ''),
    sourceVersion: sanitizeHtml(scene.source_version || scene.sourceVersion || ''),
    ageBand: sanitizeHtml(scene.age_band || ''),
    pedagogicalObjective: sanitizeHtml(scene.pedagogical_objective || '')
  };
}
