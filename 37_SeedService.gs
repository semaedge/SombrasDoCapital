/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 37_SeedService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Carga inicial.
 *
 * INTEGRAÇÕES
 * Insere conteúdo inicial das cinco fases e dados simulados para investigação didática,
 * sem duplicar registros. O conteúdo não representa fatos ou acusações reais.
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

function SeedService_healthcheck() {
  return { component: '37_SeedService.gs', status: 'implemented' };
}

function seedEpisodeOne(user) {
  if (!user || normalizeIdentifier(user.role) !== APP_CONSTANTS.roles.admin) {
    return jsonError_('FORBIDDEN', 'Apenas administradores podem carregar o conteúdo inicial.');
  }

  try {
    ensureSchema();
    var seeded = seedEpisodeDefinition_({
      id: 'episode-01', phase: 'A Cria', title: 'Episódio 1 - A Cria', position: 1,
      scene: { id: 'scene-01', title: 'O áudio que não deveria existir', narrative: 'A mensagem chegou às 03:17. Um arquivo sem remetente, uma voz conhecida e uma decisão que não pode ser tomada apenas com pressa.', sender: 'Fonte Anônima', source: 'Você vai querer ouvir antes que alguém descubra que recebeu.' },
      choices: [{ id: 'choice-publish', label: 'Publicar imediatamente', action: 'publish', consequence: 'A publicação ganhou velocidade, mas a falta de confirmação deixou uma dúvida registrada.' }, { id: 'choice-verify', label: 'Checar fontes', action: 'verify', consequence: 'Boa decisão: a investigação avançou com uma segunda checagem de fonte.' }]
    });
    var episode = seeded.episode;
    var scene = seeded.scene;
    var choices = seeded.choices;
    return jsonSuccess_({ episode: episode, scene: scene, choices: choices });
  } catch (error) {
    return jsonError_('SEED_FAILED', 'Não foi possível carregar o conteúdo inicial.');
  }
}

function seedAllEpisodes(user) {
  if (!user || normalizeIdentifier(user.role) !== APP_CONSTANTS.roles.admin) {
    return jsonError_('FORBIDDEN', 'Apenas administradores podem carregar o conteúdo inicial.');
  }
  try {
    ensureSchema();
    var definitions = [
      { id: 'episode-01', phase: 'A Cria', title: 'Episódio 1 - A Cria', position: 1, scene: { id: 'scene-01', title: 'O áudio que não deveria existir', narrative: 'Uma gravação sem remetente coloca a urgência da publicação contra a necessidade de confirmação.', sender: 'Fonte Anônima', source: 'Você vai querer ouvir antes que alguém descubra que recebeu.' }, choices: [{ id: 'choice-publish', label: 'Publicar imediatamente', action: 'publish' }, { id: 'choice-verify', label: 'Checar fontes', action: 'verify' }] },
      { id: 'episode-02', phase: 'A Engorda', title: 'Episódio 2 - A Engorda', position: 2, scene: { id: 'scene-02', title: 'O dinheiro público', narrative: 'Planilhas revelam como subsídios estatais mudaram o equilíbrio entre empresas e comunidades.', sender: 'Analista Financeira', source: 'Há uma rubrica que não aparece no discurso oficial.' }, choices: [{ id: 'choice-subsidy', label: 'Seguir o subsídio estatal', action: 'verify' }, { id: 'choice-release', label: 'Publicar a denúncia', action: 'publish' }] },
      { id: 'episode-03', phase: 'O Abate', title: 'Episódio 3 - O Abate', position: 3, scene: { id: 'scene-03', title: 'Duas formas de produzir', narrative: 'O confronto entre o modelo sintrópico e o latifúndio expõe custos ambientais e escolhas de território.', sender: 'Pesquisadora do Território', source: 'O solo registra aquilo que os relatórios omitem.' }, choices: [{ id: 'choice-syntropic', label: 'Investigar o modelo sintrópico', action: 'verify' }, { id: 'choice-latifundio', label: 'Priorizar o latifúndio', action: 'publish' }] },
      { id: 'episode-04', phase: 'A Refrigeração', title: 'Episódio 4 - A Refrigeração', position: 4, scene: { id: 'scene-04', title: 'O mapa das offshores', narrative: 'Contas offshore conectam intermediários, empresas e decisões tomadas longe dos olhos do público.', sender: 'Repórter Internacional', source: 'O endereço fiscal não conta toda a história.' }, choices: [{ id: 'choice-offshore', label: 'Rastrear as offshores', action: 'verify' }, { id: 'choice-ignore', label: 'Ignorar a conexão', action: 'publish' }] },
      { id: 'episode-05', phase: 'A Desossa', title: 'Episódio 5 - A Desossa', position: 5, scene: { id: 'scene-05', title: 'O lobby sem fronteiras', narrative: 'O lobby internacional transforma interesses privados em linguagem de política pública.', sender: 'Editora de Política', source: 'A influência aparece nas agendas antes de aparecer nas manchetes.' }, choices: [{ id: 'choice-lobby', label: 'Confrontar o lobby internacional', action: 'verify' }, { id: 'choice-publish-final', label: 'Publicar a síntese', action: 'publish' }] }
    ];
    var created = { Episodes: 0, Scenes: 0, Choices: 0, Evidence: 0 };
    definitions.forEach(function(definition) {
      var result = seedEpisodeDefinition_(definition);
      if (result.episodeCreated) created.Episodes++;
      if (result.sceneCreated) created.Scenes++;
      created.Choices += result.choiceCreated;
    });
    created.Evidence = seedEvidenceItems_();
    return jsonSuccess_({ created: created, total: { episodes: definitions.length, scenes: definitions.length, choices: definitions.length * 2, evidence: 8 } });
  } catch (error) {
    return jsonError_('SEED_FAILED', 'Não foi possível carregar os cinco episódios.');
  }
}

function seedEvidenceItems_() {
  var evidenceList = [
    { id: 'ev-01', phase: 'A Cria', title: 'Depoimento da Liderança Comunitária', type: 'audio', format: 'audio', source: 'Gravação anônima', reliability: 'alta', file_name: 'src-001-depoimento.mp3', status: 'unlocked', unlocked: 'true' },
    { id: 'ev-02', phase: 'A Cria', title: 'Minuta de Arrendamento Compulsório', type: 'document', format: 'document', source: 'Cartório distrital', reliability: 'alta', file_name: 'doc-contrato-arrendamento.webp', status: 'unlocked', unlocked: 'true' },
    { id: 'ev-03', phase: 'A Engorda', title: 'Planilha Contábil de Repasses', type: 'spreadsheet', format: 'spreadsheet', source: 'Vazamento financeiro', reliability: 'média', file_name: 'donations-ledger.webp', status: 'unlocked', unlocked: 'true' },
    { id: 'ev-04', phase: 'A Engorda', title: 'Memorando Interno da AgroVale', type: 'document', format: 'document', source: 'Comunicação interna interceptada', reliability: 'alta', file_name: 'corporate-memo-agro.webp', status: 'unlocked', unlocked: 'true' },
    { id: 'ev-05', phase: 'O Abate', title: 'Mosaico de Satélite do Cerrado', type: 'document', format: 'document', source: 'Monitoramento multitemporal', reliability: 'alta', file_name: 'cerrado-satellite-map.webp', status: 'unlocked', unlocked: 'true' },
    { id: 'ev-06', phase: 'O Abate', title: 'Laudo de Auditoria Ambiental', type: 'document', format: 'document', source: 'Fiscalização ambiental', reliability: 'alta', file_name: 'environmental-audit.webp', status: 'unlocked', unlocked: 'true' },
    { id: 'ev-07', phase: 'A Refrigeração', title: 'Acordo de Confidencialidade e Sigilo', type: 'document', format: 'document', source: 'Arquivo corporativo', reliability: 'alta', file_name: 'doc-acordo-sigilo.webp', status: 'unlocked', unlocked: 'true' },
    { id: 'ev-08', phase: 'A Refrigeração', title: 'Depoimento de Auditoria Jurídica', type: 'audio', format: 'audio', source: 'Ex-consultor jurídico', reliability: 'alta', file_name: 'src-002-auditoria-juridica.mp3', status: 'unlocked', unlocked: 'true' }
  ];

  evidenceList.forEach(function(item) {
    item.content_nature = 'simulated_data';
    item.nature_note = 'Documento ou áudio criado para o caso didático; não comprova fato real nem acusa pessoa ou entidade real.';
    item.source_title = 'Material autoral do projeto — não é fonte factual externa';
    item.source_organization = 'Equipe Sombras do Capital';
    item.source_url = '';
    item.accessed_at = '';
    item.source_version = 'ficcao-didatica-v1';
    item.age_band = 'Ensino Médio — uso com mediação docente';
    item.pedagogical_objective = 'Distinguir alegação, fonte, evidência e incerteza antes de tomar uma decisão.';
  });

  var count = 0;
  evidenceList.forEach(function(item) {
    var res = seedRecordWithStatus_('Evidence', item);
    if (res.created) count++;
  });
  return count;
}

function seedEpisodeDefinition_(definition) {
  var episodeResult = seedRecordWithStatus_('Episodes', { id: definition.id, phase: definition.phase, title: definition.title, status: 'active', position: definition.position });
    var sceneData = Object.assign({
      episode_id: definition.id,
      phase: definition.phase,
      audio_url: '',
      document_url: '',
      position: 1,
      content_nature: 'fiction',
      nature_note: 'Cena ficcional criada para investigação didática; não descreve um fato real.',
      age_band: 'Ensino Médio — uso com mediação docente',
      pedagogical_objective: 'Formular uma pergunta investigável antes de decidir se uma alegação pode ser publicada.',
      source_title: 'Material autoral do projeto — não é fonte factual externa',
      source_organization: 'Equipe Sombras do Capital',
      source_url: '',
      accessed_at: '',
      source_version: 'ficcao-didatica-v1'
    }, definition.scene);
  var sceneResult = seedRecordWithStatus_('Scenes', sceneData);
  var choiceCreated = 0;
  definition.choices.forEach(function(choice) {
    var choiceResult = seedRecordWithStatus_('Choices', Object.assign({
      scene_id: definition.scene.id,
      next_scene_id: '',
      consequence: choice.action === 'verify' ? 'A investigação avançou com uma checagem documental.' : 'A publicação ganhou velocidade, mas exige revisão posterior.',
      content_nature: 'fiction',
      nature_note: 'Decisão narrativa dentro de um caso simulado; não é recomendação sobre um fato real.',
      age_band: 'Ensino Médio — uso com mediação docente',
      pedagogical_objective: 'Justificar uma decisão e reconhecer o que ainda precisa ser verificado.'
    }, choice));
    if (choiceResult.created) choiceCreated++;
  });
  return { episode: episodeResult.record, scene: sceneResult.record, choices: getSheetRecords('Choices', APP_CONSTANTS.maxPageSize).filter(function(choice) { return String(choice.scene_id) === definition.scene.id; }), episodeCreated: episodeResult.created, sceneCreated: sceneResult.created, choiceCreated: choiceCreated };
}

function seedRecordWithStatus_(sheetName, record) {
  var existing = getSheetRecords(sheetName, APP_CONSTANTS.maxPageSize).filter(function(candidate) {
    return String(candidate.id) === String(record.id);
  })[0];
  return { record: existing || insertRecord(sheetName, record), created: !existing };
}

function seedRecord_(sheetName, record) {
  return seedRecordWithStatus_(sheetName, record).record;
}
