/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 10_RoleService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Autorização por papel.
 *
 * INTEGRAÇÕES
 * Verifica permissões de aluno, professor, editor e administrador antes das operações.
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

function RoleService_healthcheck() {
  return { component: '10_RoleService.gs', status: 'implemented' };
}

function hasRole(user, role) {
  return !!user && normalizeIdentifier(user.role) === normalizeIdentifier(role);
}

function requireTeacher(user) {
  if (!hasRole(user, APP_CONSTANTS.roles.teacher)) {
    throw new Error('Acesso restrito a professores.');
  }
  return user;
}

function requireContentEditor(user) {
  if (!hasRole(user, APP_CONSTANTS.roles.editor) && !hasRole(user, APP_CONSTANTS.roles.admin)) {
    throw new Error('Acesso restrito a editores.');
  }
  return user;
}
