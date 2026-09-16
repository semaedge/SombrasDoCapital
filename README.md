# O Terminal: Sombras do Capital

## Arquitetura e Engenharia

Este diretório contém o código do jogo narrativo investigativo **O Terminal: Sombras do Capital**. O **Google Sheets é o repositório CRUD central**, estruturado em 15 abas para usuários, sessões, turmas, episódios, cenas, escolhas, consequências, evidências, checagens de fontes, progresso, relatórios investigativos, relatórios de impacto, auditoria, configurações e migrações. O Google Apps Script (runtime V8) opera como backend de serviços e API RPC, com integração ao Google Drive para entrega de mídias e notebook Colab para orquestração pedagógica. A prontidão operacional depende de verificação externa e não é inferida pelo inventário local.

### Configuração de Ambiente
- `SPREADSHEET_ID`: Identificador da planilha central nas Script Properties (`PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')`).
- `FOLDER_ID`: Identificador único da pasta de assets no Google Drive nas Script Properties. Todos os arquivos de mídia (imagens WebP/PNG, SVGs e áudios) residem diretamente nessa pasta, sem subpastas internas.

### Contrato de Envelope RPC
Todas as respostas de API e bridges públicas seguem o contrato canônico dual da frota:
- **Sucesso**: `{ ok: true, success: true, data: <payload>, error: null }`
- **Erro**: `{ ok: false, success: false, data: null, error: { code, message, correlation_id } }`

### Modelo de Autenticação Escolar (Quiosque Supervisionado)
Em conformidade com a decisão canônica da frota para quiosques escolares supervisionados, as senhas de estudantes e professores são gerenciadas e validadas em texto plano (sem rotinas de hash na escrita ou mutações automáticas), permitindo suporte, recuperação e auditoria pedagógica direta pela coordenação escolar através da aba `Users` no Google Sheets.

---

## Inventário do Código-Fonte

| Grupo | Quantidade | Convenção | Descrição |
|---|---:|---|---|
| Google Apps Script | 40 | `NN_Nome.gs` | Serviços de domínio, repositórios, schema e gateways |
| Interface HTML | 37 | `NN_Nome.html` | Telas e componentes com sinais estruturais de acessibilidade em tema dark graphite |
| Suíte de Testes | 10 artefatos | `tests/*.test.js` + `test_project_maturity.py` | 50 testes Node.js + 7 contratos Python do avaliador |
| Assets & Mídia | 54 | `assets/*` | SVGs, PNGs, WebPs e áudios com manifesto `assets.json` |
| Google Colab | 1 | `notebook.py` | Pipeline de preparação e sincronização autorizada |

---

## Comandos de Verificação e Gates

O projeto conta com harness npm completo:

```bash
# Executar 50 contratos Node.js + 7 contratos Python do avaliador
npm test

# Executar a auditoria estrutural; o score não prova runtime ou produção
npm run maturity

# Gate completo de verificação pré-release
npm run verify

# Comandos de implantação via clasp
npm run push
npm run deploy
```

A reavaliação atual está em
[`REAVALIACAO_MATURIDADE_2026-09-04.md`](REAVALIACAO_MATURIDADE_2026-09-04.md).
Os contratos editoriais e pedagógicos da intervenção C4 estão em
[`DADOS_C4_2026-09-04.md`](DADOS_C4_2026-09-04.md).
O protocolo de acessibilidade, mediação e piloto da intervenção C5 está em
[`DADOS_C5_2026-09-04.md`](DADOS_C5_2026-09-04.md); seus resultados de campo
continuam pendentes.
O resultado vigente é 95/100 — **Beta Controlada** — e não há evidência
operacional externa suficiente para declarar produção.

### Escopo narrativo e curricular

O caso interativo identifica cada conteúdo como **ficção didática**, **dado
simulado**, **informação factual com fonte externa** ou **conceito curricular**.
Os assets autorais não são prova de fatos reais. A proposta está desenhada para
o **Ensino Médio, com mediação docente**, e ainda não foi validada para anos
iniciais ou demais etapas da Escola Classe 115 Norte. A devolutiva usa uma
rubrica formativa de perguntas, fontes, incerteza, justificativa e revisão;
velocidade é apenas contexto, não critério de nota. Proveniências registram
título, organização, URL, data de acesso e versão; registros externos sem esses
campos ficam pendentes de revisão docente.

Dentro da frota analisada, este é o único projeto com escopo declarado para o
Ensino Médio. Esse recorte não deve ser aplicado aos demais projetos.

### Roteamento protegido

`doGet()` aplica uma política de rota no servidor. Páginas estudantis, docentes,
editoriais e administrativas exigem sessão e papel compatível; componentes
parciais não são entry points. O login emite um `route_ticket` opaco de curta
duração para a primeira navegação, mantendo o token de sessão fora da URL.
Consulte [`ROTEAMENTO_C2_2026-09-04.md`](ROTEAMENTO_C2_2026-09-04.md) para a
matriz e as pendências de verificação no Web App publicado.

---

## Modelo Mínimo de Abas (15)

`Users`, `Sessions`, `Classes`, `Episodes`, `Scenes`, `Choices`, `Consequences`, `Evidence`, `SourceChecks`, `Progress`, `Reports`, `ImpactReports`, `AuditLog`, `Config`, `Migrations`. Todas as abas possuem cabeçalhos padronizados com identificadores únicos e timestamps rastreáveis.
