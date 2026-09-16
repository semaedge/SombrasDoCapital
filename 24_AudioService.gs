/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 24_AudioService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Áudios e transcrições.
 *
 * INTEGRAÇÕES
 * Controla faixas, transcrições, duração, desbloqueio e status de reprodução.
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

function AudioService_healthcheck() {
  return { component: '24_AudioService.gs', status: 'implemented' };
}

function markAudioListened(userId, evidenceId) {
  var evidence = getUnlockedEvidenceDetailById(userId, evidenceId);
  if (!evidence || normalizeIdentifier(evidence.type || evidence.format) !== 'audio') {
    return jsonError_('AUDIO_NOT_FOUND', 'Áudio não encontrado ou bloqueado.');
  }
  try {
    var progress = insertRecord('Progress', { id: generateUuid(), player_id: normalizeText(userId, 160),
      evidence_id: normalizeText(evidenceId, 160), event: 'audio_listened', phase: normalizeText(evidence.phase, 80),
      status: APP_CONSTANTS.statuses.checked });
    return jsonSuccess_({ progressId: progress.id, status: progress.status });
  } catch (error) {
    return jsonError_('AUDIO_STATUS_NOT_SAVED', 'Não foi possível registrar a escuta.');
  }
}

function getAudioTranscript(userId, evidenceId) {
  var evidence = getUnlockedEvidenceDetailById(userId, evidenceId);
  if (!evidence || normalizeIdentifier(evidence.type || evidence.format) !== 'audio') {
    return jsonError_('AUDIO_NOT_FOUND', 'Áudio não encontrado ou bloqueado.');
  }
  var transcript = evidence.transcript || '';
  if (Array.isArray(evidence.transcript_segments)) {
    transcript = evidence.transcript_segments.map(function(segment) {
      return '[' + formatAudioTimestamp_(segment.timestamp || segment.start || 0) + '] ' + (segment.speaker || 'Fonte') + ': "' + (segment.text || '') + '"';
    }).join('\n');
  }
  return jsonSuccess_({ evidenceId: sanitizeHtml(evidence.id), transcript: sanitizeHtml(transcript) });
}

function getAudioMetadata(userId, evidenceId) {
  try {
    var evidence = getUnlockedEvidenceDetailById(userId, evidenceId);
    if (!evidence) return jsonError_('AUDIO_NOT_FOUND', 'Áudio não encontrado ou bloqueado.');
    var fileName = normalizeText(evidence.file_name || evidence.asset_name || evidence.audio_name, 180);
    var metadata = {
      title: sanitizeHtml(evidence.title || evidence.name || 'Áudio investigativo'),
      duration: Number(evidence.duration) || 0,
      size: 0,
      transcript: sanitizeHtml(evidence.transcript || ''),
      fileName: fileName,
      contentNature: getContentNatureCode_(evidence.content_nature || evidence.nature || evidence.epistemic_status),
      contentNatureLabel: getContentNatureLabel_(evidence.content_nature || evidence.nature || evidence.epistemic_status),
      natureNote: sanitizeHtml(evidence.nature_note || 'Natureza do conteúdo não informada; requer revisão docente.'),
      sourceTitle: sanitizeHtml(evidence.source_title || ''),
      sourceOrganization: sanitizeHtml(evidence.source_organization || ''),
      sourceUrl: sanitizeHtml(evidence.source_url || ''),
      accessedAt: sanitizeHtml(evidence.accessed_at || ''),
      sourceVersion: sanitizeHtml(evidence.source_version || evidence.sourceVersion || ''),
      ageBand: sanitizeHtml(evidence.age_band || ''),
      pedagogicalObjective: sanitizeHtml(evidence.pedagogical_objective || '')
    };
    if (fileName) {
      var folderId = getAssetFolderId();
      if (!folderId) return jsonError_('ASSET_FOLDER_UNAVAILABLE', 'Pasta de assets não configurada (FOLDER_ID).');
      var files = DriveApp.getFolderById(folderId).getFilesByName(fileName);
      if (files.hasNext()) {
        var file = files.next();
        var mime = file.getMimeType() || 'audio/mpeg';
        metadata.mimeType = sanitizeHtml(mime);
        metadata.size = file.getSize();
        metadata.driveUrl = file.getUrl();
        metadata.downloadUrl = file.getDownloadUrl();
        // Áudio leve (~250-360KB) entregue em Data URI para reprodução instantânea e sem problemas de CORS
        var blob = file.getBlob();
        metadata.audioUrl = 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes());
      }
    }
    return jsonSuccess_(metadata);
  } catch (error) {
    return jsonError_('AUDIO_UNAVAILABLE', 'Não foi possível carregar o áudio: ' + error.message);
  }
}

/**
 * Permite buscar diretamente uma faixa de áudio por nome de arquivo na pasta FOLDER_ID
 */
function getAudioDataUri(fileName) {
  var cleanName = normalizeText(fileName, 180);
  if (!cleanName) return jsonError_('INVALID_FILENAME', 'Nome de arquivo inválido.');
  var folderId = getAssetFolderId();
  if (!folderId) return jsonError_('ASSET_FOLDER_UNAVAILABLE', 'Pasta de assets não configurada (FOLDER_ID).');
  try {
    var files = DriveApp.getFolderById(folderId).getFilesByName(cleanName);
    if (!files.hasNext()) return jsonError_('AUDIO_NOT_FOUND', 'Faixa de áudio não encontrada na pasta.');
    var file = files.next();
    var mime = file.getMimeType() || 'audio/mpeg';
    var dataUrl = 'data:' + mime + ';base64,' + Utilities.base64Encode(file.getBlob().getBytes());
    return jsonSuccess_({
      fileName: file.getName(),
      mimeType: mime,
      size: file.getSize(),
      dataUrl: dataUrl,
      driveUrl: file.getUrl()
    });
  } catch (error) {
    return jsonError_('AUDIO_READ_ERROR', 'Falha ao ler áudio: ' + error.message);
  }
}

function formatAudioTimestamp_(value) {
  if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) return value.padStart(5, '0');
  var seconds = Number(value) || 0;
  if (seconds > 3600) seconds = Math.floor(seconds / 1000);
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
}
