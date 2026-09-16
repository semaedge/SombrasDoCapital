/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 22_SourceCheckService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Checagem de fontes.
 *
 * INTEGRAÇÕES
 * Compara alegações e evidências e grava o resultado da verificação do aluno.
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

function SourceCheckService_healthcheck() {
  return { component: '22_SourceCheckService.gs', status: 'implemented' };
}

function verifyClaim(userId, characterId, claimId, evidenceId) {
  var player = normalizeText(userId, 160);
  var character = normalizeText(characterId, 160);
  var claim = normalizeText(claimId, 160);
  var evidence = getUnlockedEvidenceDetailById(player, evidenceId);
  if (!player || !character || !claim || !evidence) return jsonError_('INVALID_SOURCE_CHECK', 'Dados insuficientes ou evidência bloqueada.');
  try {
    var matchesClaim = String(evidence.claim_id || '') === claim;
    var matchesCharacter = !evidence.character_id || String(evidence.character_id) === character;
    
    var verdict = 'contradictory';
    var message = 'Contraditório: a evidência refuta ou não possui respaldo nesta alegação.';
    var status = 'pending';

    if (matchesClaim && matchesCharacter) {
      verdict = 'confirmed';
      status = 'checked';
      message = 'Confirmado: a evidência documental apoia diretamente o depoimento.';
    } else if (matchesCharacter || String(evidence.type || '').toLowerCase() === 'document' || String(evidence.reliability || '').toLowerCase().indexOf('alta') >= 0) {
      verdict = 'inconsistent';
      status = 'pending';
      message = 'Inconsistente: a evidência tangencia o personagem ou tema, mas não sustenta a alegação específica.';
    }

    var check = insertRecord('SourceChecks', {
      id: generateUuid(), user_id: player, character_id: character, claim_id: claim,
      evidence_id: normalizeText(evidenceId, 160), status: status, verdict: verdict
    });
    return jsonSuccess_({
      status: status,
      verdict: verdict,
      checkId: check.id,
      message: message,
      characterId: character,
      claimId: claim,
      evidenceId: normalizeText(evidenceId, 160)
    });
  } catch (error) {
    return jsonError_('SOURCE_CHECK_NOT_SAVED', 'Não foi possível registrar a checagem.');
  }
}

function getCharacterContexts() {
  return [
    {
      id: 'anonymous-source',
      name: 'Fonte Anônima',
      role: 'Informante Confidencial',
      contentNature: 'fiction',
      contentNatureLabel: 'FICÇÃO DIDÁTICA',
      context: 'Personagem ficcional que remete um áudio criado para o caso didático.',
      claims: [
        { id: 'claim-01', contentNature: 'fiction', text: 'O áudio do gabinete central comprova pagamento ilícito a intermediários do consórcio.' },
        { id: 'claim-02', contentNature: 'fiction', text: 'Planilhas paralelas detalhavam repasses a comitês antes de decisões regulatórias.' }
      ]
    },
    {
      id: 'chief-editor',
      name: 'Editor-Chefe',
      role: 'Supervisão Editorial',
      contentNature: 'fiction',
      contentNatureLabel: 'FICÇÃO DIDÁTICA',
      context: 'Responsável por decidir se a apuração atinge o rigor necessário para publicação.',
      claims: [
        { id: 'claim-03', contentNature: 'fiction', text: 'Não podemos publicar a denúncia sem ao menos um documento oficial cruzado com fontes independentes.' },
        { id: 'claim-04', contentNature: 'fiction', text: 'O consórcio só bancará a matéria se o rigor documental permitir declarar limites e possíveis vieses.' }
      ]
    },
    {
      id: 'lobbyist',
      name: 'Lobista',
      role: 'Intermediário Corporativo',
      contentNature: 'fiction',
      contentNatureLabel: 'FICÇÃO DIDÁTICA',
      context: 'Personagem ficcional que articula interesses de uma empresa inventada com gabinetes regulatórios.',
      claims: [
        { id: 'claim-05', contentNature: 'fiction', text: 'As doações declaradas seguiram estritamente o rito legal sem exigência de contrapartida.' },
        { id: 'claim-06', contentNature: 'fiction', text: 'Os contratos de consultoria apresentavam relatórios periódicos de inteligência de mercado.' }
      ]
    },
    {
      id: 'public-figure',
      name: 'Figura Pública',
      role: 'Agente Político',
      contentNature: 'fiction',
      contentNatureLabel: 'FICÇÃO DIDÁTICA',
      context: 'Líder citado nas alegações que demandam conferência minuciosa de dados públicos.',
      claims: [
        { id: 'claim-07', contentNature: 'fiction', text: 'Minha agenda oficial comprova que estive fora do país na data mencionada pelo informante.' },
        { id: 'claim-08', contentNature: 'fiction', text: 'Todas as liberações de crédito pelo banco estatal cumpriram critérios técnicos do comitê de risco.' }
      ]
    }
  ];
}
