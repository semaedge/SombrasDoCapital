/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 03_Constants.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Constantes do domínio.
 *
 * INTEGRAÇÕES
 * Define papéis, status, fases, tipos de evidência e códigos de erro; integra todos os módulos.
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
 * APP_CONSTANTS concentra valores compartilhados sem duplicação entre serviços.
 */

function Constants_healthcheck() {
  return { component: '03_Constants.gs', status: 'implemented' };
}

var APP_CONSTANTS = {
  roles: { student: 'student', teacher: 'teacher', editor: 'editor', admin: 'admin' },
  statuses: { active: 'active', inactive: 'inactive', pending: 'pending', checked: 'checked' },
  phases: ['A Cria', 'A Engorda', 'O Abate', 'A Refrigeração', 'A Desossa'],
  evidenceTypes: ['audio', 'document', 'spreadsheet', 'link', 'alert'],
  sheets: ['Users', 'Sessions', 'Classes', 'Episodes', 'Scenes', 'Choices',
    'Consequences', 'Evidence', 'SourceChecks', 'Progress', 'Reports', 'ImpactReports',
    'AuditLog', 'Config', 'Migrations'],
  sessionTtlSeconds: 21600,
  maxTextLength: 5000,
  maxPageSize: 100,
  maxDashboardRecords: 24
};

function getAppConstants() {
  return JSON.parse(JSON.stringify(APP_CONSTANTS));
}
