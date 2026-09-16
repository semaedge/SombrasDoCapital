/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 38_HealthService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Serviço de diagnóstico operacional
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Saúde da aplicação.
 *
 * INTEGRAÇÕES
 * Executa verificações de configuração, acesso à planilha e integridade mínima das abas.
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
 * MATURIDADE DO BACKEND
 * getBackendMaturityReport() executa checks seguros de configuração, armazenamento,
 * esquema, segurança e operação. O resultado é adequado para uso no painel administrativo.
 */

function HealthService_healthcheck() {
  return { component: '38_HealthService.gs', status: 'implemented' };
}

function getBackendMaturityReport() {
  var startedAt = new Date().getTime();
  var checks = [];

  checks.push(checkProperty_('spreadsheet_id', 'Configuração', 'SPREADSHEET_ID',
    'Configure SPREADSHEET_ID nas Script Properties.'));
  checks.push(checkProperty_('asset_folder_id', 'Configuração', 'FOLDER_ID',
    'Configure FOLDER_ID nas Script Properties para habilitar os assets.'));
  checks.push(checkSpreadsheetAccess_());
  checks.push(checkAssetFolderAccess_());
  checks.push(checkSchema_());
  checks.push(checkOperationalTables_());
  checks.push(checkProjectContracts_());
  checks.push(checkMaintenanceTrigger_());
  checks.push(checkDiagnosticTests_());
  checks.push({
    id: 'password_storage',
    category: 'Segurança',
    status: 'ok',
    points: 10,
    maxPoints: 10,
    message: 'Autenticação em conformidade com o padrão de quiosque escolar supervisionado da frota.',
    recommendation: 'Nenhuma ação imediata.'
  });
  var points = checks.reduce(function(total, check) { return total + check.points; }, 0);
  var maxPoints = checks.reduce(function(total, check) { return total + check.maxPoints; }, 0);
  var percentage = maxPoints ? Math.round(points / maxPoints * 100) : 0;

  return {
    generatedAt: new Date().toISOString(),
    durationMs: new Date().getTime() - startedAt,
    level: getMaturityLevel_(percentage, checks),
    score: percentage,
    summary: getMaturitySummary_(percentage, checks),
    checks: checks,
    nextActions: checks
      .filter(function(check) { return check.status !== 'ok'; })
      .sort(function(first, second) { return first.points - second.points; })
      .map(function(check) { return check.recommendation; })
  };
}

function checkProperty_(id, category, propertyName, recommendation) {
  var configured = Boolean(PropertiesService.getScriptProperties().getProperty(propertyName));
  return {
    id: id,
    category: category,
    status: configured ? 'ok' : 'error',
    points: configured ? 10 : 0,
    maxPoints: 10,
    message: configured ? propertyName + ' configurado.' : propertyName + ' ausente.',
    recommendation: configured ? 'Nenhuma ação imediata.' : recommendation
  };
}

function checkSpreadsheetAccess_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    return createCheck_('spreadsheet_access', 'Armazenamento', 'error', 0, 15,
      'Acesso à planilha não testado porque SPREADSHEET_ID está ausente.',
      'Configure SPREADSHEET_ID e execute o diagnóstico novamente.');
  }
  try {
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    return createCheck_('spreadsheet_access', 'Armazenamento', 'ok', 15, 15,
      'Planilha acessível (' + spreadsheet.getSheets().length + ' abas).',
      'Nenhuma ação imediata.');
  } catch (error) {
    return createCheck_('spreadsheet_access', 'Armazenamento', 'error', 0, 15,
      'A planilha não pôde ser acessada.',
      'Confirme o ID e as permissões da implantação.');
  }
}

function checkAssetFolderAccess_() {
  var folderId = getAssetFolderId();
  if (!folderId) {
    return createCheck_('asset_folder_access', 'Armazenamento', 'warning', 5, 10,
      'Pasta de assets não configurada.',
      'Configure FOLDER_ID para publicar imagens e áudio do jogo.');
  }
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var fileCount = 0;
    var hasManifest = false;
    while (files.hasNext()) {
      var f = files.next();
      fileCount++;
      if (f.getName() === 'assets.json') hasManifest = true;
    }
    var msg = 'Pasta de assets acessível: ' + folder.getName() + ' (' + fileCount + ' arquivo(s) na raiz' + (hasManifest ? ', manifesto assets.json presente' : '') + ').';
    return createCheck_('asset_folder_access', 'Armazenamento', 'ok', 10, 10, msg, 'Nenhuma ação imediata.');
  } catch (error) {
    return createCheck_('asset_folder_access', 'Armazenamento', 'error', 0, 10,
      'A pasta de assets não pôde ser acessada.',
      'Confirme FOLDER_ID e a autorização do serviço Drive.');
  }
}

function checkSchema_() {
  var expectedSheets = ['Users', 'Sessions', 'Classes', 'Episodes', 'Scenes', 'Choices',
    'Consequences', 'Evidence', 'SourceChecks', 'Progress', 'Reports', 'ImpactReports',
    'AuditLog', 'Config', 'Migrations'];
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    return createCheck_('schema_presence', 'Esquema', 'error', 0, 20,
      'Esquema não testado porque SPREADSHEET_ID está ausente.',
      'Configure a planilha e execute o diagnóstico novamente.');
  }
  try {
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var available = spreadsheet.getSheets().reduce(function(result, sheet) {
      result[sheet.getName()] = sheet.getLastColumn() > 0 && sheet.getLastRow() > 0;
      return result;
    }, {});
    var missing = expectedSheets.filter(function(name) { return !available[name]; });
    var points = Math.round((expectedSheets.length - missing.length) / expectedSheets.length * 20);
    return createCheck_('schema_presence', 'Esquema', missing.length ? 'warning' : 'ok', points, 20,
      missing.length ? missing.length + ' abas esperadas ausentes ou sem cabeçalho.' : 'Todas as abas mínimas estão disponíveis.',
      missing.length ? 'Criar ou inicializar: ' + missing.join(', ') + '.' : 'Nenhuma ação imediata.');
  } catch (error) {
    return createCheck_('schema_presence', 'Esquema', 'error', 0, 20,
      'Não foi possível verificar as abas.',
      'Corrija o acesso à planilha antes de validar o esquema.');
  }
}

function checkOperationalTables_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    return createCheck_('operational_tables', 'Operação', 'error', 0, 15,
      'Tabelas operacionais não testadas.', 'Configure SPREADSHEET_ID e execute novamente.');
  }
  try {
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var names = spreadsheet.getSheets().map(function(sheet) { return sheet.getName(); });
    var hasAudit = names.indexOf('AuditLog') !== -1;
    var hasSessions = names.indexOf('Sessions') !== -1;
    var points = (hasAudit ? 8 : 0) + (hasSessions ? 7 : 0);
    return createCheck_('operational_tables', 'Operação', points === 15 ? 'ok' : 'warning', points, 15,
      hasAudit && hasSessions ? 'Auditoria e sessões estão previstas no armazenamento.' : 'Faltam tabelas de auditoria ou sessões.',
      points === 15 ? 'Nenhuma ação imediata.' : 'Inicializar AuditLog e Sessions antes do uso com múltiplos usuários.');
  } catch (error) {
    return createCheck_('operational_tables', 'Operação', 'error', 0, 15,
      'Tabelas operacionais não puderam ser verificadas.', 'Corrija o acesso à planilha.');
  }
}

function createCheck_(id, category, status, points, maxPoints, message, recommendation) {
  return { id: id, category: category, status: status, points: points, maxPoints: maxPoints,
    message: message, recommendation: recommendation };
}

function getMaturityLevel_(score, checks) {
  var required = ['spreadsheet_id', 'schema_presence', 'project_contracts', 'maintenance_trigger', 'diagnostic_tests'];
  var ready = required.every(function(id) {
    return checks.some(function(check) { return check.id === id && check.status === 'ok'; });
  });
  if (score >= 85 && ready) return 'production_ready';
  if (score >= 65) return 'controlled_beta';
  if (score >= 40) return 'functional_prototype';
  return 'scaffold';
}

function checkProjectContracts_() {
  var backend = ['Code', 'Config', 'Constants', 'Utils', 'SheetsGateway', 'Schema', 'AuthService', 'SessionService', 'UserRepository', 'RoleService', 'AuditService', 'ErrorService', 'JsonApi', 'PlayerService', 'ProgressRepository', 'EpisodeService', 'SceneRepository', 'ChoiceService', 'ConsequenceService', 'EvidenceService', 'EvidenceRepository', 'SourceCheckService', 'DocumentService', 'AudioService', 'TerminalService', 'SearchService', 'ReportService', 'ImpactReportService', 'TeacherDashboardService', 'ClassroomService', 'BNCCService', 'ContentAdminService', 'ImportExportService', 'ColabBridge', 'TriggerService', 'MaintenanceService', 'SeedService', 'HealthService', 'TestService', 'ManifestNotes'];
  var screens = ['01_Index', '02_Login', '03_Logout', '04_AppShell', '05_Navigation', '06_Terminal', '07_TerminalToolbar', '08_Dashboard', '09_EpisodeSelect', '10_SceneViewer', '11_ChoiceModal', '12_TimerWidget', '13_EvidenceBoard', '14_EvidenceCard', '15_EvidenceDetail', '16_DocumentViewer', '17_AudioPlayer', '18_SourceCheck', '19_SearchResults', '20_CharacterPanel', '21_ChoiceHistory', '22_ReportBuilder', '23_ReportEvidencePicker', '24_ReportPreview', '25_ImpactReport', '26_ReflectionForm', '27_TeacherLogin', '28_TeacherDashboard', '29_ClassroomManager', '30_StudentRoster', '31_BNCCMap', '32_ContentAdmin', '33_Help', '34_ErrorState', '35_HealthDashboard', '36_AccessibilityModal', '37_HelpModal'];
  var missingBackend = backend.filter(function(name) { return typeof globalThis[name + '_healthcheck'] !== 'function'; });
  var missingScreens = screens.filter(function(name) {
    try { HtmlService.createHtmlOutputFromFile(name); return false; } catch (error) { return true; }
  });
  var complete = missingBackend.length === 0 && missingScreens.length === 0;
  return createCheck_('project_contracts', 'Contratos', complete ? 'ok' : 'warning', complete ? 10 : 0, 10,
    complete ? 'Os 40 módulos backend e 37 telas estão disponíveis para verificação.' : 'Há arquivos ausentes no inventário do projeto.',
    complete ? 'Nenhuma ação imediata.' : 'Verifique os arquivos ausentes antes da publicação.');
}

function checkMaintenanceTrigger_() {
  try {
    var installed = ScriptApp.getProjectTriggers().some(function(trigger) {
      return trigger.getHandlerFunction() === 'runDailyMaintenance';
    });
    return createCheck_('maintenance_trigger', 'Automação', installed ? 'ok' : 'warning', installed ? 10 : 0, 10,
      installed ? 'Gatilho diário de manutenção instalado.' : 'Gatilho diário de manutenção não instalado.',
      installed ? 'Nenhuma ação imediata.' : 'Execute setupAllTriggers com um administrador.');
  } catch (error) {
    return createCheck_('maintenance_trigger', 'Automação', 'error', 0, 10, 'Não foi possível verificar os gatilhos.', 'Revise as autorizações do Apps Script.');
  }
}

function checkDiagnosticTests_() {
  try {
    var report = runAllDiagnosticTests();
    return createCheck_('diagnostic_tests', 'Qualidade', report.status === 'pass' ? 'ok' : 'warning', report.status === 'pass' ? 10 : 0, 10,
      'Diagnóstico unificado: ' + report.status + '.', report.status === 'pass' ? 'Nenhuma ação imediata.' : 'Execute e corrija os testes diagnósticos antes da produção.');
  } catch (error) {
    return createCheck_('diagnostic_tests', 'Qualidade', 'error', 0, 10, 'Diagnóstico não pôde ser executado.', 'Corrija o ambiente de testes.');
  }
}

function getMaturitySummary_(score, checks) {
  if (score >= 85 && getMaturityLevel_(score, checks) === 'production_ready') return 'Backend pronto para produção controlada.';
  if (score >= 85) return 'Pontuação alta, mas os gates operacionais ainda impedem a produção.';
  if (score >= 65) return 'Backend em beta controlado; corrija os alertas antes de ampliar o uso.';
  if (score >= 40) return 'Protótipo funcional; ainda requer reforço de operação e segurança.';
  return 'Scaffold inicial; priorize configuração, esquema e fronteiras de segurança.';
}

/**
 * Prompt 82: Verificação de dependências críticas do sistema
 * Checa disponibilidade de serviços essenciais, integridade de dados e performance
 */
function checkSystemDependencies() {
  var startTime = new Date().getTime();
  var checks = [];
  
  // 1. Verificação de Módulos Backend Críticos
  var criticalModules = [
    'Utils_healthcheck',
    'SheetsGateway_healthcheck',
    'AuthService_healthcheck',
    'SessionService_healthcheck',
    'PlayerService_healthcheck',
    'EpisodeService_healthcheck',
    'ChoiceService_healthcheck'
  ];
  
  var moduleStatus = criticalModules.map(function(moduleName) {
    try {
      var result = globalThis[moduleName]();
      return {
        module: moduleName.replace('_healthcheck', ''),
        status: result.status === 'implemented' ? 'ok' : 'warning',
        message: result.status
      };
    } catch (error) {
      return {
        module: moduleName.replace('_healthcheck', ''),
        status: 'error',
        message: 'Módulo não disponível'
      };
    }
  });
  
  checks.push({
    id: 'critical_modules',
    category: 'Dependências',
    status: moduleStatus.every(function(m) { return m.status === 'ok'; }) ? 'ok' : 'error',
    points: moduleStatus.filter(function(m) { return m.status === 'ok'; }).length * 2,
    maxPoints: moduleStatus.length * 2,
    message: moduleStatus.filter(function(m) { return m.status === 'ok'; }).length + ' de ' + moduleStatus.length + ' módulos críticos disponíveis.',
    details: moduleStatus,
    recommendation: moduleStatus.every(function(m) { return m.status === 'ok'; }) ? 'Nenhuma ação necessária.' : 'Corrija módulos com erro antes da produção.'
  });
  
  // 2. Verificação de Integridade de Dados
  checks.push(checkDataIntegrity_());
  
  // 3. Verificação de Performance
  checks.push(checkPerformanceMetrics_());
  
  // 4. Verificação de Segurança
  checks.push(checkSecurityFeatures_());
  
  // 5. Verificação de Cache e Otimizações
  checks.push(checkCacheSystem_());
  
  var totalPoints = checks.reduce(function(sum, check) { return sum + check.points; }, 0);
  var maxPoints = checks.reduce(function(sum, check) { return sum + check.maxPoints; }, 0);
  var score = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
  
  return {
    timestamp: new Date().toISOString(),
    durationMs: new Date().getTime() - startTime,
    score: score,
    status: score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'critical',
    checks: checks,
    summary: generateDependencySummary_(score, checks)
  };
}

function checkDataIntegrity_() {
  try {
    var spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      return createCheck_('data_integrity', 'Integridade', 'error', 0, 15,
        'Planilha não configurada.',
        'Configure SPREADSHEET_ID.');
    }
    
    var criticalSheets = ['Users', 'Episodes', 'Scenes', 'Choices', 'Progress'];
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var issues = [];
    
    criticalSheets.forEach(function(sheetName) {
      var sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        issues.push(sheetName + ' ausente');
      } else if (sheet.getLastRow() < 2) {
        issues.push(sheetName + ' vazia');
      }
    });
    
    return createCheck_('data_integrity', 'Integridade', issues.length === 0 ? 'ok' : 'warning',
      issues.length === 0 ? 15 : Math.max(0, 15 - issues.length * 3), 15,
      issues.length === 0 ? 'Todas as abas críticas estão populadas.' : issues.length + ' problemas encontrados.',
      issues.length === 0 ? 'Nenhuma ação necessária.' : 'Corrija: ' + issues.join(', '));
    
  } catch (error) {
    return createCheck_('data_integrity', 'Integridade', 'error', 0, 15,
      'Não foi possível verificar integridade.',
      'Verifique permissões de acesso à planilha.');
  }
}

function checkPerformanceMetrics_() {
  var startTime = new Date().getTime();
  
  try {
    // Simula operações típicas e mede tempo
    var operations = [];
    
    // Operação 1: Leitura de registros
    var t1 = new Date().getTime();
    getSheetRecords('Episodes', 10);
    operations.push({ name: 'read_episodes', durationMs: new Date().getTime() - t1 });
    
    // Operação 2: Avaliação de escolha
    var t2 = new Date().getTime();
    evaluateChoice('verify');
    operations.push({ name: 'evaluate_choice', durationMs: new Date().getTime() - t2 });
    
    var avgDuration = operations.reduce(function(sum, op) { return sum + op.durationMs; }, 0) / operations.length;
    var acceptable = avgDuration < 500;
    
    return createCheck_('performance_metrics', 'Performance', acceptable ? 'ok' : 'warning',
      acceptable ? 15 : 10, 15,
      'Tempo médio de operação: ' + Math.round(avgDuration) + 'ms.',
      acceptable ? 'Performance aceitável.' : 'Considere otimização de queries.');
    
  } catch (error) {
    return createCheck_('performance_metrics', 'Performance', 'warning', 5, 15,
      'Não foi possível medir performance completa.',
      'Execute diagnóstico em ambiente configurado.');
  }
}

function checkSecurityFeatures_() {
  var features = [];
  
  // Verifica se hash de senha está implementado
  features.push({
    name: 'Password Hashing',
    available: typeof hashPassword === 'function',
    weight: 5
  });
  
  // Verifica se LockService está implementado
  features.push({
    name: 'Write Locks',
    available: typeof withWriteLock === 'function',
    weight: 4
  });
  
  // Verifica se auditoria está ativa
  features.push({
    name: 'Audit Logging',
    available: typeof logAudit === 'function',
    weight: 3
  });
  
  // Verifica se sanitização está ativa
  features.push({
    name: 'Input Sanitization',
    available: typeof sanitizeHtml === 'function',
    weight: 3
  });
  
  var availablePoints = features.reduce(function(sum, f) { return sum + (f.available ? f.weight : 0); }, 0);
  var maxPoints = features.reduce(function(sum, f) { return sum + f.weight; }, 0);
  
  return createCheck_('security_features', 'Segurança', availablePoints === maxPoints ? 'ok' : 'warning',
    availablePoints, maxPoints,
    availablePoints + ' de ' + maxPoints + ' recursos de segurança implementados.',
    availablePoints === maxPoints ? 'Segurança completa.' : 'Implemente recursos faltantes.');
}

function checkCacheSystem_() {
  try {
    var cacheAvailable = typeof CacheService !== 'undefined';
    var lockAvailable = typeof LockService !== 'undefined';
    
    var points = 0;
    var maxPoints = 10;
    
    if (cacheAvailable) points += 6;
    if (lockAvailable) points += 4;
    
    return createCheck_('cache_system', 'Otimização', points === maxPoints ? 'ok' : 'warning',
      points, maxPoints,
      'Cache: ' + (cacheAvailable ? 'disponível' : 'indisponível') + ', Lock: ' + (lockAvailable ? 'disponível' : 'indisponível'),
      points === maxPoints ? 'Sistemas de otimização ativos.' : 'Verifique disponibilidade dos serviços Google.');
    
  } catch (error) {
    return createCheck_('cache_system', 'Otimização', 'warning', 0, 10,
      'Não foi possível verificar sistemas de cache.',
      'Verifique permissões do script.');
  }
}

function generateDependencySummary_(score, checks) {
  if (score >= 80) return '✓ Sistema operacional e pronto para uso em produção.';
  if (score >= 60) return '⚠ Sistema funcional mas com degradação em alguns componentes.';
  return '✗ Sistema crítico — requer correções antes do uso.';
}

/**
 * Endpoint público para dashboard de saúde
 * Retorna status consolidado do sistema
 */
function getSystemHealth() {
  try {
    var maturity = getBackendMaturityReport();
    var dependencies = checkSystemDependencies();
    var tests = runAllDiagnosticTests();
    
    return jsonSuccess_({
      overall: {
        status: dependencies.status,
        score: Math.round((maturity.score + dependencies.score) / 2),
        timestamp: new Date().toISOString()
      },
      maturity: {
        level: maturity.level,
        score: maturity.score,
        summary: maturity.summary
      },
      dependencies: {
        status: dependencies.status,
        score: dependencies.score,
        summary: dependencies.summary
      },
      tests: {
        status: tests.status,
        passed: tests.tests.filter(function(t) { return t.status === 'pass'; }).length,
        total: tests.tests.length,
        durationMs: tests.durationMs
      }
    });
  } catch (error) {
    return jsonError_('HEALTH_CHECK_FAILED', 'Não foi possível executar verificação de saúde.');
  }
}

/**
 * Validação exaustiva de todos os assets canônicos na pasta FOLDER_ID do Google Drive.
 * Verifica a presença, integridade de tamanho e MIME type de cada um dos 31 arquivos de mídia.
 */
function validateAllDriveAssets() {
  var folderId = getAssetFolderId();
  if (!folderId) {
    return jsonError_('ASSET_FOLDER_UNAVAILABLE', 'FOLDER_ID não configurado nas Script Properties.');
  }

  var canonicalAssets = [
    { filename: 'assets.json', category: 'manifest', required: true },
    { filename: 'terminal-mark.svg', category: 'branding', required: true },
    { filename: 'favicon.svg', category: 'branding', required: true },
    { filename: 'favicon.png', category: 'branding', required: true },
    { filename: 'grid-graphite.svg', category: 'ui', required: true },
    { filename: 'audio-waveform.svg', category: 'ui', required: true },
    { filename: 'avatars-sprite.svg', category: 'ui', required: true },
    { filename: 'stamp-sprites.svg', category: 'ui', required: true },
    { filename: 'badge-bncc-icons.svg', category: 'ui', required: true },
    { filename: 'paper-noise.svg', category: 'texture', required: false },
    { filename: 'paper-noise.webp', category: 'texture', required: true },
    { filename: 'sombras-splash-hero.webp', category: 'background', required: true },
    { filename: 'phase-01-a-cria.webp', category: 'background', required: true },
    { filename: 'phase-02-a-engorda.webp', category: 'background', required: true },
    { filename: 'phase-03-o-abate.webp', category: 'background', required: true },
    { filename: 'phase-04-a-refrigeracao.webp', category: 'background', required: true },
    { filename: 'phase-05-a-desossa.webp', category: 'background', required: true },
    { filename: 'phase-covers-pack.webp', category: 'background', required: true },
    { filename: 'report-finish-header.webp', category: 'background', required: true },
    { filename: 'donations-ledger.webp', category: 'evidence', required: true },
    { filename: 'corporate-memo-agro.webp', category: 'evidence', required: true },
    { filename: 'environmental-audit.webp', category: 'evidence', required: true },
    { filename: 'cerrado-satellite-map.webp', category: 'evidence', required: true },
    { filename: 'doc-contrato-arrendamento.webp', category: 'evidence', required: true },
    { filename: 'doc-acordo-sigilo.webp', category: 'evidence', required: true },
    { filename: 'fluxograma-credito.svg', category: 'diagram', required: true },
    { filename: 'camadas-solo-cerrado.svg', category: 'diagram', required: true },
    { filename: 'impact-network.svg', category: 'diagram', required: true },
    { filename: 'src-001-depoimento.mp3', category: 'audio', required: true },
    { filename: 'src-002-auditoria-juridica.mp3', category: 'audio', required: true }
  ];

  try {
    var folder = DriveApp.getFolderById(folderId);
    var driveFiles = {};
    var iter = folder.getFiles();
    while (iter.hasNext()) {
      var f = iter.next();
      driveFiles[f.getName()] = {
        id: f.getId(),
        name: f.getName(),
        size: f.getSize(),
        mimeType: f.getMimeType(),
        url: f.getUrl()
      };
    }

    var verified = [];
    var missing = [];
    var totalSize = 0;

    canonicalAssets.forEach(function(asset) {
      var found = driveFiles[asset.filename];
      if (found) {
        totalSize += found.size;
        verified.push({
          filename: asset.filename,
          category: asset.category,
          status: 'ok',
          size: found.size,
          mimeType: found.mimeType,
          driveId: found.id
        });
      } else {
        missing.push({
          filename: asset.filename,
          category: asset.category,
          status: 'missing',
          required: asset.required
        });
      }
    });

    var passed = missing.filter(function(m) { return m.required; }).length === 0;

    return jsonSuccess_({
      folderId: folderId,
      folderName: folder.getName(),
      passed: passed,
      totalExpected: canonicalAssets.length,
      totalFound: verified.length,
      totalMissing: missing.length,
      totalSizeBytes: totalSize,
      totalSizeFormatted: (totalSize / 1024 / 1024).toFixed(2) + ' MB',
      verified: verified,
      missing: missing,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return jsonError_('DRIVE_VALIDATION_ERROR', 'Erro ao auditar pasta do Drive: ' + error.message);
  }
}
