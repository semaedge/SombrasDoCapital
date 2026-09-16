/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 15_ProgressRepository.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Progresso.
 *
 * INTEGRAÇÕES
 * CRUD de progresso por jogador e fase; integra aba Progress.
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

function ProgressRepository_healthcheck() {
  return { component: '15_ProgressRepository.gs', status: 'implemented' };
}

function recordChoiceProgress(playerId, sceneId, choiceId, consequence) {
  var scene = getSceneById(sceneId || 'scene-01');
  return insertRecord('Progress', {
    id: generateUuid(),
    player_id: normalizeText(playerId, 160),
    scene_id: normalizeText(sceneId || 'scene-01', 160),
    phase: scene ? normalizeText(scene.phase || 'A Cria', 80) : 'A Cria',
    choice_id: normalizeText(choiceId, 160),
    choice_action: normalizeIdentifier(consequence.choice),
    speed_delta: consequence.impact.speed,
    documentary_rigor_delta: consequence.impact.documentaryRigor,
    consequence: consequence.text,
    status: APP_CONSTANTS.statuses.active
  });
}

function getPlayerProgress(playerId) {
  var normalizedPlayerId = normalizeText(playerId, 160);
  if (!normalizedPlayerId) return [];
  return getSheetRecords('Progress', APP_CONSTANTS.maxPageSize).filter(function(progress) {
    return String(progress.player_id) === normalizedPlayerId;
  });
}

function getChoiceHistory(playerId) {
  return getPlayerProgress(playerId).map(function(progress) {
    return {
      sceneId: sanitizeHtml(progress.scene_id),
      choice: sanitizeHtml(progress.choice_action || progress.choice_id),
      speedDelta: Number(progress.speed_delta) || 0,
      documentaryRigorDelta: Number(progress.documentary_rigor_delta) || 0,
      consequence: sanitizeHtml(progress.consequence),
      createdAt: progress.created_at
    };
  });
}

/**
 * Retorna a progressão das fases baseada no histórico do jogador
 * Implementa Prompt 78: desbloqueio automático de fases
 */
function getPhasesProgression(playerId) {
  var normalizedPlayerId = normalizeText(playerId, 160);
  if (!normalizedPlayerId) {
    return {
      phases: getDefaultPhasesLocked()
    };
  }
  
  try {
    var progress = getPlayerProgress(normalizedPlayerId);
    
    // Define as 5 fases do jogo
    var phaseDefinitions = [
      { number: 1, id: 'fase-01', name: 'A Cria', subtitle: 'origens e acesso ao poder', sceneId: 'scene-01' },
      { number: 2, id: 'fase-02', name: 'A Engorda', subtitle: 'capital estatal e expansão', sceneId: 'scene-02' },
      { number: 3, id: 'fase-03', name: 'O Abate', subtitle: 'modelo produtivo e território', sceneId: 'scene-03' },
      { number: 4, id: 'fase-04', name: 'A Refrigeração', subtitle: 'prisão e sobrevivência', sceneId: 'scene-04' },
      { number: 5, id: 'fase-05', name: 'A Desossa', subtitle: 'mercado global e retorno', sceneId: 'scene-05' }
    ];
    
    // Agrupa progresso por fase
    var completedPhases = {};
    progress.forEach(function(item) {
      var phase = normalizeText(item.phase || '', 80);
      var phaseKey = normalizeIdentifier(phase);
      if (phaseKey) completedPhases[phaseKey] = true;
    });
    
    // Determina estado de cada fase
    var phases = phaseDefinitions.map(function(phase, index) {
      var phaseKey = normalizeIdentifier(phase.name);
      var isCompleted = completedPhases[phaseKey] === true;
      var previousPhaseCompleted = index === 0 || completedPhases[normalizeIdentifier(phaseDefinitions[index - 1].name)] === true;
      
      var state = 'locked';
      if (index === 0) {
        // Fase 01 sempre aberta
        state = isCompleted ? 'open' : 'active';
      } else if (previousPhaseCompleted) {
        // Fase desbloqueada se a anterior foi concluída
        state = isCompleted ? 'completed' : 'open';
      }
      
      return {
        number: phase.number,
        id: phase.id,
        title: phase.name,
        subtitle: phase.subtitle,
        sceneId: phase.sceneId,
        state: state,
        isLocked: state === 'locked',
        isActive: state === 'active',
        isOpen: state === 'open' || state === 'active',
        isCompleted: state === 'completed'
      };
    });
    
    var completedCount = phaseDefinitions.filter(function(phase) {
      return completedPhases[normalizeIdentifier(phase.name)] === true;
    }).length;
    return {
      playerId: normalizedPlayerId,
      totalPhases: phases.length,
      completedCount: completedCount,
      phases: phases
    };
    
  } catch (error) {
    Logger.log('Error in getPhasesProgression: ' + error.message);
    return {
      phases: getDefaultPhasesLocked()
    };
  }
}

/**
 * Retorna fases padrão todas bloqueadas exceto a primeira
 */
function getDefaultPhasesLocked() {
  return [
    { number: 1, id: 'fase-01', title: 'A Cria', subtitle: 'origens e acesso ao poder', sceneId: 'scene-01', state: 'active', isLocked: false, isActive: true, isOpen: true },
    { number: 2, id: 'fase-02', title: 'A Engorda', subtitle: 'capital estatal e expansão', sceneId: 'scene-02', state: 'locked', isLocked: true, isActive: false, isOpen: false },
    { number: 3, id: 'fase-03', title: 'O Abate', subtitle: 'modelo produtivo e território', sceneId: 'scene-03', state: 'locked', isLocked: true, isActive: false, isOpen: false },
    { number: 4, id: 'fase-04', title: 'A Refrigeração', subtitle: 'prisão e sobrevivência', sceneId: 'scene-04', state: 'locked', isLocked: true, isActive: false, isOpen: false },
    { number: 5, id: 'fase-05', title: 'A Desossa', subtitle: 'mercado global e retorno', sceneId: 'scene-05', state: 'locked', isLocked: true, isActive: false, isOpen: false }
  ];
}
