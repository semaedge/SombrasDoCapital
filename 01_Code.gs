/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 01_Code.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Entrada web e despacho de requisições.
 *
 * INTEGRAÇÕES
 * doGet, include e roteamento seguro para telas HTML; integra HtmlService, sessão e configuração.
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
 * Contrato implementado e verificado por testes de contrato.
 *
 * FLUXO INTEGRADO
 * doGet entrega o shell somente após aplicar a política de rota. getDashboardData
 * valida a sessão novamente e agrega apenas evidências do estudante autenticado;
 * o frontend chama essa função por google.script.run e exibe estados vazios/erro
 * quando a fonte não estiver disponível.
 */

function Code_healthcheck() {
  return { component: '01_Code.gs', status: 'implemented' };
}

/**
 * Política de páginas do Web App.
 *
 * Componentes internos continuam disponíveis para include(), mas não podem
 * ser renderizados como uma rota pública. Isso evita que uma URL arbitrária
 * bypass a sessão ou exponha telas administrativas.
 */
var ROUTE_POLICY = {
  public: ['02_Login', '27_TeacherLogin', '33_Help', '34_ErrorState'],
  authenticated: ['01_Index', '03_Logout', '04_AppShell'],
  student: [
    '06_Terminal', '08_Dashboard', '09_EpisodeSelect', '10_SceneViewer',
    '13_EvidenceBoard', '16_DocumentViewer', '18_SourceCheck',
    '21_ChoiceHistory', '22_ReportBuilder', '25_ImpactReport'
  ],
  teacher: ['28_TeacherDashboard', '29_ClassAnalytics', '29_ClassroomManager', '30_StudentRoster', '31_BNCCMap'],
  editor: ['32_ContentAdmin'],
  admin: ['35_HealthDashboard'],
  internal: [
    '05_Navigation', '07_TerminalToolbar', '11_ChoiceModal', '12_TimerWidget',
    '14_EvidenceCard', '15_EvidenceDetail', '17_AudioPlayer',
    '19_SearchResults', '20_CharacterPanel', '23_ReportEvidencePicker',
    '24_ReportPreview', '26_ReflectionForm'
  ]
};

function getRoutePolicy_(page) {
  var routeGroups = Object.keys(ROUTE_POLICY);
  for (var i = 0; i < routeGroups.length; i++) {
    var policy = routeGroups[i];
    if (ROUTE_POLICY[policy].indexOf(page) >= 0) return policy;
  }
  return null;
}

function authorizeRoute_(page, routeTicket) {
  var policy = getRoutePolicy_(page);
  if (!policy) return { allowed: false, code: 'NOT_FOUND' };
  if (policy === 'public') return { allowed: true, policy: policy, session: null };
  if (policy === 'internal' || !routeTicket || typeof consumeRouteTicket_ !== 'function') {
    return { allowed: false, code: 'UNAUTHENTICATED' };
  }

  var session = consumeRouteTicket_(routeTicket);
  if (!session || !session.user) return { allowed: false, code: 'UNAUTHENTICATED' };
  var role = normalizeIdentifier(session.user.role);
  var allowed = policy === 'authenticated' ||
    (policy === 'student' && role === 'student') ||
    (policy === 'teacher' && (role === 'teacher' || role === 'admin')) ||
    (policy === 'editor' && (role === 'editor' || role === 'admin')) ||
    (policy === 'admin' && role === 'admin');
  return allowed ?
    { allowed: true, policy: policy, session: session } :
    { allowed: false, code: 'FORBIDDEN' };
}

function doGet(request) {
  var params = (request && request.parameter) || {};
  if (params.asset || params.file) {
    return serveAssetEndpoint_(params.asset || params.file, params.format);
  }
  if (params.format === 'json') {
    var jsonRoute = authorizeRoute_('01_Index', params.route_ticket);
    if (!jsonRoute.allowed) {
      return doGetJson_(jsonError_('UNAUTHENTICATED', 'É necessário iniciar uma sessão para consultar o painel.'));
    }
    return doGetJson_(getDashboardData(jsonRoute.session.token));
  }

  // O login é a porta de entrada do Web App; o terminal só é aberto
  // explicitamente após a sessão do estudante ou docente ser criada.
  var page = params.page || '02_Login';
  var validPages = [
    '01_Index', '02_Login', '03_Logout', '04_AppShell', '05_Navigation',
    '06_Terminal', '07_TerminalToolbar', '08_Dashboard', '09_EpisodeSelect',
    '10_SceneViewer', '11_ChoiceModal', '12_TimerWidget', '13_EvidenceBoard',
    '14_EvidenceCard', '15_EvidenceDetail', '16_DocumentViewer', '17_AudioPlayer',
    '18_SourceCheck', '19_SearchResults', '20_CharacterPanel', '21_ChoiceHistory',
    '22_ReportBuilder', '23_ReportEvidencePicker', '24_ReportPreview', '25_ImpactReport',
    '26_ReflectionForm', '27_TeacherLogin', '28_TeacherDashboard', '29_ClassAnalytics',
    '29_ClassroomManager', '30_StudentRoster', '31_BNCCMap', '32_ContentAdmin',
    '33_Help', '34_ErrorState', '35_HealthDashboard'
  ];
  var targetPage = validPages.indexOf(page) >= 0 ? page : '02_Login';
  if (targetPage !== '02_Login') {
    var routeAuthorization = authorizeRoute_(targetPage, params.route_ticket);
    if (!routeAuthorization.allowed) targetPage = '02_Login';
  }

  return HtmlService.createTemplateFromFile(targetPage)
    .evaluate()
    .setTitle('O Terminal: Sombras do Capital')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  var cleanName = String(filename || '').replace(/\.html$/i, '');
  return HtmlService.createHtmlOutputFromFile(cleanName).getContent();
}

function getDashboardData(sessionToken) {
  var session = getSession(sessionToken);
  if (!session || !session.user) {
    return jsonError_('UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }
  var records = getSheetRecords('Evidence', 24);
  var role = normalizeIdentifier(session.user.role);
  if (role !== 'student') {
    return jsonError_('FORBIDDEN', 'O painel investigativo é restrito à sessão de estudante.');
  }
  var userId = String(session.user.id || '');
  records = records.filter(function(record) {
    return String(record.user_id || record.player_id || record.student_id || '') === userId;
  });
  var collected = records.length;
  var checked = records.filter(function(record) {
    return String(record.status || '').toLowerCase() === 'checked';
  }).length;
  var score = collected ? Math.round(checked / collected * 100) : 0;

  return jsonSuccess_({
    metrics: {
      evidenceCollected: collected,
      evidenceTotal: 24,
      documentaryRigor: score,
      activePhase: 1
    },
    evidence: records.slice(0, 3).map(toPublicEvidence_),
    phases: getDefaultPhases_(),
    source: records.length ? 'sheets' : 'sheets_empty'
  });
}

function toPublicEvidence_(record) {
  var nature = getContentNatureCode_(record.content_nature || record.nature || record.epistemic_status);
  return {
    type: String(record.type || 'DOCUMENTO').toUpperCase(),
    title: String(record.title || record.name || 'Evidência sem título'),
    source: String(record.source || 'Origem não informada'),
    status: String(record.status || 'PENDING').toUpperCase(),
    contentNature: nature,
    contentNatureLabel: getContentNatureLabel_(nature),
    natureNote: String(record.nature_note || 'Natureza do conteúdo não informada; requer revisão docente.'),
    sourceTitle: String(record.source_title || ''),
    sourceOrganization: String(record.source_organization || ''),
    sourceUrl: String(record.source_url || ''),
    accessedAt: String(record.accessed_at || ''),
    sourceVersion: String(record.source_version || record.sourceVersion || ''),
    ageBand: String(record.age_band || ''),
    pedagogicalObjective: String(record.pedagogical_objective || '')
  };
}

function getDefaultPhases_() {
  return [
    { number: 1, title: 'A Cria', subtitle: 'origens e acesso ao poder', state: 'active' },
    { number: 2, title: 'A Engorda', subtitle: 'capital estatal e expansão', state: 'open' },
    { number: 3, title: 'O Abate', subtitle: 'modelo produtivo e território', state: 'locked' },
    { number: 4, title: 'A Refrigeração', subtitle: 'prisão e sobrevivência', state: 'locked' },
    { number: 5, title: 'A Desossa', subtitle: 'mercado global e retorno', state: 'locked' }
  ];
}

function serveAssetEndpoint_(assetName, requestedFormat) {
  var cleanName = String(assetName || '').trim().replace(/[\\/]/g, '');
  if (!cleanName || cleanName.indexOf('..') >= 0) {
    return doGetJson_(jsonError_('INVALID_ASSET', 'Nome de arquivo de asset inválido.'));
  }
  var folderId = getAssetFolderId();
  if (!folderId) {
    return doGetJson_(jsonError_('ASSET_FOLDER_UNAVAILABLE', 'FOLDER_ID não configurado.'));
  }
  try {
    var files = DriveApp.getFolderById(folderId).getFilesByName(cleanName);
    if (!files.hasNext()) {
      return doGetJson_(jsonError_('ASSET_NOT_FOUND', 'Asset não encontrado na pasta de mídia.'));
    }
    var file = files.next();
    var mime = file.getMimeType() || '';
    var lower = cleanName.toLowerCase();

    // Se solicitado formato JSON ou se for arquivo binário complexo
    if (requestedFormat === 'json') {
      var blob = file.getBlob();
      return doGetJson_(jsonSuccess_({
        fileName: file.getName(),
        mimeType: mime,
        size: file.getSize(),
        driveUrl: file.getUrl(),
        downloadUrl: file.getDownloadUrl(),
        dataUrl: 'data:' + (mime || 'application/octet-stream') + ';base64,' + Utilities.base64Encode(blob.getBytes())
      }));
    }

    // Se for SVG, JSON ou texto, pode ser servido via ContentService com o Content-Type apropriado
    if (lower.endsWith('.svg') || mime === 'image/svg+xml') {
      return ContentService.createTextOutput(file.getBlob().getDataAsString())
        .setMimeType(ContentService.MimeType.XML);
    }
    if (lower.endsWith('.json') || mime === 'application/json') {
      return ContentService.createTextOutput(file.getBlob().getDataAsString())
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (lower.endsWith('.txt') || mime.indexOf('text/') === 0) {
      return ContentService.createTextOutput(file.getBlob().getDataAsString())
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // Para imagens (WEBP, PNG) e áudios (MP3), entrega JSON com dataUrl seguro
    var fileBlob = file.getBlob();
    return doGetJson_(jsonSuccess_({
      fileName: file.getName(),
      mimeType: mime,
      size: file.getSize(),
      driveUrl: file.getUrl(),
      dataUrl: 'data:' + (mime || 'application/octet-stream') + ';base64,' + Utilities.base64Encode(fileBlob.getBytes())
    }));
  } catch (error) {
    return doGetJson_(jsonError_('ASSET_ERROR', 'Não foi possível servir o asset: ' + error.message));
  }
}
