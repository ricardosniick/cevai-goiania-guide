# Segurança — catálogo de barraquinhas e alertas do verificador

## Causa confirmada na auditoria por leitura do Lovable

fair_stalls é um catálogo compartilhado, mas a leitura da tabela também permite obter created_by (UUID do criador). A interface consultava esse campo sem usá-lo. anon/authenticated têm ALL na tabela, mais do que o necessário. RLS protege operações por linha, mas não substitui privilégios de tabela para comandos como TRUNCATE.

places contém dados de catálogo do Google, com leitura para authenticated e escrita só pelo servidor. Storage é privado e a leitura compartilhada exige experiência pública, dono consistente e pasta desse dono. Esses dois comportamentos são intencionais; não foram bloqueados ou ignorados neste PR.

## Correção preparada

Código: StallsPanel deixa de solicitar created_by na listagem; tipo visual Stall remove esse campo e edição de experiências deixa de fabricar um valor vazio. Cadastro continua enviando created_by=user.id, exigido pela RLS.

SQL separado: revoga ALL de anon, revoga SELECT de tabela de authenticated e concede SELECT somente a id/place_id/name/kind/emoji/created_at. INSERT/UPDATE/DELETE de authenticated continuam através das políticas existentes. Remove TRUNCATE/REFERENCES/TRIGGER/MAINTAIN de authenticated. Não altera políticas, registros, funções, schema, design ou navegação. O dono/servidor mantém seus privilégios.

O SQL contém pré-checagens do estado auditado (RLS, ALL para anon/authenticated, nenhum grant PUBLIC ou de coluna) e pós-checagens para impedir commit com creator ID legível. Estado divergente aborta, sem improvisar permissões. MAINTAIN exige PostgreSQL 17+, compatível com o privilégio m relatado na auditoria; confirmar a versão real antes de aplicar.

## Ordem obrigatória

1. Integrar apenas o código deste PR; os arquivos SQL são de revisão, não migrações automáticas.
2. Testar na prévia listagem, cadastro e “Eu fui” de barraquinha.
3. Com autorização do usuário, publicar a versão que NÃO consulta created_by e confirmar sincronização. Abas antigas podem manter código anterior e precisar de recarga.
4. Só depois, mediante autorização explícita para o banco, aplicar docs/sql/seguranca_fair_stalls_NAO_APLICADO.sql numa transação e registrar a migração no fluxo existente. Aplicar antes da publicação quebraria a listagem da versão antiga.
5. Conferir permissões e testar no app publicado. Rodar nova varredura de segurança e revisar o resultado, sem ignorar automaticamente os alertas.

Reversão preparada em docs/sql/seguranca_fair_stalls_REVERSAO.sql: restaura ALL auditado para anon/authenticated e remove os grants de coluna acrescentados. Reexpõe created_by e restaura permissões excessivas; usar somente se necessário e autorizado. Antes de restaurar código antigo que consulta created_by, restaurar privilégios de leitura correspondentes.

## Arquivos

src/components/cevai/StallsPanel.tsx; src/components/cevai/types.ts; src/routes/index.tsx; src/test/stalls-catalog.test.tsx; docs/sql/seguranca_fair_stalls_NAO_APLICADO.sql; docs/sql/seguranca_fair_stalls_REVERSAO.sql; scripts/test-stall-privacy.mjs; este documento.

## Validação

241 testes do app passaram, incluindo 2 novos para listar/registrar experiência sem creator ID e cadastrar com o dono da sessão. TypeScript, build e diff --check OK. Mais 13 cenários SQL passaram no PGlite isolado com as quatro políticas auditadas: ID legível antes/bloqueado depois, catálogo preservado, inserção própria, dono falso recusado, edição/exclusão próprias e alheias, transferência de dono recusada, join de experiências, TRUNCATE bloqueado, anon sem permissões e reversão com mesmos privilégios efetivos (ordem da ACL pode mudar).

Sem dados reais, chamadas pagas, mudanças no banco ou publicação. Testes não substituem a conferência no backend real.

## Riscos restantes

Até aplicar o SQL, remover o campo da consulta da tela NÃO bloqueia consultas diretas ao created_by. Depois do SQL, clientes que selecionem * ou created_by falham por permissão; o código preparado usa projeção compatível. Catálogo continua com leitura de todas as linhas autorizadas: um verificador genérico pode continuar marcando USING(true), mesmo sem ID exposto. Não maquiar a política apenas para eliminar o aviso; avaliar a varredura atual e documentar a finalidade. Nenhum alerta foi ignorado por ferramenta.
