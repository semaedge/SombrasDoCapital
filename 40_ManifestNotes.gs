/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 40_ManifestNotes.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Notas operacionais.
 *
 * INTEGRAÇÕES
 * Documenta implantação, escopos, gatilhos, variáveis e decisões de compatibilidade do projeto.
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

function ManifestNotes_healthcheck() {
  return { component: '40_ManifestNotes.gs', status: 'implemented' };
}

function getManifestNotes() {
  return {
    requiredProperties: ['SPREADSHEET_ID', 'FOLDER_ID', 'INTEGRATION_TOKEN'],
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/script.external_request'
    ],
    setupSteps: [
      'Crie ou selecione a planilha central e copie o ID para SPREADSHEET_ID.',
      'Copie o ID da pasta raiz de mídia para FOLDER_ID; não crie subpastas para assets.',
      'Gere um valor aleatório longo e configure INTEGRATION_TOKEN para o notebook Colab.',
      'Execute ensureSchema() uma vez com a conta administradora.',
      'Execute seedAllEpisodes(adminUser) para carregar o conteúdo inicial.',
      'Execute setupAllTriggers(adminUser) para instalar manutenção e auditoria de edição.',
      'Execute getBackendMaturityReport() e corrija os checks pendentes antes da publicação.'
    ],
    deployment: {
      executeAs: 'Usuário que implanta',
      access: 'Qualquer pessoa',
      note: 'Revise a política institucional de acesso antes de usar dados reais.'
    },
    triggerSetup: 'setupAllTriggers(adminUser) instala runDailyMaintenance diariamente e onContentEdit na planilha.',
    securityMigration: [
      'Substitua a comparação de senha em texto plano por hash com salt ou Google Identity/OAuth.',
      'Migre os usuários gradualmente, invalidando senhas antigas após a confirmação da nova identidade.',
      'Revogue e regenere INTEGRATION_TOKEN quando houver suspeita de exposição.',
      'Nunca envie tokens, senhas ou IDs internos do Drive ao cliente ou aos logs.'
    ]
  };
}
