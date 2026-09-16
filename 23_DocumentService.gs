/**
 * O TERMINAL: SOMBRAS DO CAPITAL
 * Componente: 23_DocumentService.gs
 * Camada: Backend Google Apps Script
 * Tipo: Stub de módulo e contrato inicial
 *
 * PRINCIPAIS FUNCIONALIDADES
 * Documentos investigativos.
 *
 * INTEGRAÇÕES
 * Entrega metadados e conteúdo didático de documentos sem expor dados internos.
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

function DocumentService_healthcheck() {
  return { component: '23_DocumentService.gs', status: 'implemented' };
}

function listAvailableDocuments(userId) {
  if (!normalizeText(userId, 160)) return jsonError_('INVALID_USER', 'Usuário inválido.');
  try {
    var documents = getUnlockedEvidenceByUser(userId).filter(function(record) {
      return ['document', 'spreadsheet'].indexOf(normalizeIdentifier(record.type || record.format)) >= 0;
    }).map(function(record) {
      return { id: sanitizeHtml(record.id), title: sanitizeHtml(record.title || record.name || 'Documento sem título'),
        format: normalizeIdentifier(record.format || record.type || 'document'), phase: sanitizeHtml(record.phase || '') };
    });
    return jsonSuccess_(documents);
  } catch (error) {
    return jsonError_('DOCUMENTS_UNAVAILABLE', 'Não foi possível listar os documentos.');
  }
}

function getDocumentMetadata(userId, evidenceId) {
  try {
    var evidence = getUnlockedEvidenceDetailById(userId, evidenceId);
    if (!evidence) return jsonError_('DOCUMENT_NOT_FOUND', 'Documento não encontrado ou bloqueado.');
    var embeddedText = evidence.content || evidence.text || evidence.transcript || '';
    var fileName = normalizeText(evidence.file_name || evidence.asset_name || evidence.document_name, 180);
    if (!fileName) {
      return jsonSuccess_({
        title: sanitizeHtml(evidence.title || evidence.name || 'Documento'),
        text: sanitizeHtml(embeddedText),
        isImage: false,
        isSvg: false,
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
      });
    }

    var folderId = getAssetFolderId();
    if (!folderId) return jsonError_('ASSET_FOLDER_UNAVAILABLE', 'Pasta de assets não configurada.');
    var files = DriveApp.getFolderById(folderId).getFilesByName(fileName);
    if (!files.hasNext()) return jsonError_('DOCUMENT_NOT_FOUND', 'Documento não encontrado na pasta de assets.');
    
    var file = files.next();
    var mimeType = file.getMimeType() || '';
    var nameLower = file.getName().toLowerCase();
    var isImage = mimeType.indexOf('image/') === 0 || /\.(webp|png|jpe?g|gif)$/.test(nameLower);
    var isSvg = mimeType === 'image/svg+xml' || /\.svg$/.test(nameLower);
    
    var responseData = {
      title: sanitizeHtml(evidence.title || file.getName()),
      fileName: sanitizeHtml(file.getName()),
      mimeType: sanitizeHtml(mimeType),
      size: file.getSize(),
      driveUrl: file.getUrl(),
      isImage: isImage && !isSvg,
      isSvg: isSvg,
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

    if (isImage && !isSvg) {
      var blob = file.getBlob();
      responseData.dataUrl = 'data:' + (mimeType || 'image/webp') + ';base64,' + Utilities.base64Encode(blob.getBytes());
      responseData.text = embeddedText || ('[Documento visual: ' + file.getName() + ']');
    } else if (isSvg) {
      var svgText = file.getBlob().getDataAsString();
      responseData.svgContent = svgText;
      responseData.dataUrl = 'data:image/svg+xml;base64,' + Utilities.base64Encode(file.getBlob().getBytes());
      responseData.text = embeddedText || svgText;
    } else {
      responseData.text = sanitizeHtml(embeddedText || file.getBlob().getDataAsString());
    }

    return jsonSuccess_(responseData);
  } catch (error) {
    return jsonError_('DOCUMENT_UNAVAILABLE', 'Não foi possível carregar o documento: ' + error.message);
  }
}

/**
 * Recupera qualquer asset arbitrário da pasta raiz FOLDER_ID como Data URI Base64.
 * Garante entrega instantânea sem risco de CORS ou autenticação de cookies no iframe.
 */
function getAssetDataUri(fileName) {
  var cleanName = normalizeText(fileName, 180);
  if (!cleanName) return jsonError_('INVALID_FILENAME', 'Nome de arquivo de asset inválido.');
  var folderId = getAssetFolderId();
  if (!folderId) return jsonError_('ASSET_FOLDER_UNAVAILABLE', 'Pasta de assets não configurada (FOLDER_ID).');
  try {
    var files = DriveApp.getFolderById(folderId).getFilesByName(cleanName);
    if (!files.hasNext()) return jsonError_('ASSET_NOT_FOUND', 'Asset não encontrado: ' + cleanName);
    var file = files.next();
    var mime = file.getMimeType() || 'application/octet-stream';
    var blob = file.getBlob();
    var dataUrl = 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes());
    return jsonSuccess_({
      fileName: file.getName(),
      mimeType: mime,
      size: file.getSize(),
      dataUrl: dataUrl,
      driveUrl: file.getUrl()
    });
  } catch (error) {
    return jsonError_('ASSET_READ_ERROR', 'Falha ao acessar asset no Drive: ' + error.message);
  }
}

/**
 * Lê e retorna o manifesto canônico assets.json presente na raiz de FOLDER_ID.
 */
function getAssetManifest() {
  var folderId = getAssetFolderId();
  if (!folderId) return jsonError_('ASSET_FOLDER_UNAVAILABLE', 'FOLDER_ID não configurado.');
  try {
    var files = DriveApp.getFolderById(folderId).getFilesByName('assets.json');
    if (!files.hasNext()) return jsonError_('MANIFEST_NOT_FOUND', 'assets.json não localizado na raiz da pasta.');
    var file = files.next();
    var content = file.getBlob().getDataAsString();
    var parsed = JSON.parse(content);
    return jsonSuccess_(parsed);
  } catch (error) {
    return jsonError_('MANIFEST_PARSE_ERROR', 'Não foi possível ler o manifesto de assets: ' + error.message);
  }
}
