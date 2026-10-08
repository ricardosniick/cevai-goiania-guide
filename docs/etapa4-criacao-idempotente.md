# Etapa 4 — repetir criação sem duplicar experiência

Causa: create_experience gera um UUID no banco em cada chamada. Se o commit termina e a resposta se perde, o formulário informa falha; repetir cria outra experiência com as mesmas notas.

Correção: formulário gera um request ID uma vez e chama create_experience_once. A nova função usa esse ID como chave primária da experiência. INSERT ON CONFLICT DO NOTHING decide atomicamente se é nova ou repetida. Em repetição, exige mesmo dono e mesmos dados/notas normalizados para devolver o mesmo ID; dados diferentes são recusados com request_conflict. Não sobrescreve registros anteriores. Uma falha na primeira transação não consome o ID. Notas continuam na mesma transação.

Função é SECURITY INVOKER, com auth.uid(), search_path vazio e EXECUTE só para authenticated (além do dono). Não cria tabelas/colunas ou modifica políticas. create_experience antiga permanece intacta, permitindo aplicar o SQL antes de integrar/publicar o consumidor.

O formulário também trava envio simultâneo e libera a trava em falha. Fotos com envio/vínculo confirmado nessa tentativa são lembradas enquanto o formulário estiver aberto, evitando enviá-las novamente se uma operação posterior falhar. Mensagem de conflito orienta conferir o diário. Privacidade, design, regras de notas e navegação permanecem iguais.

## Arquivos

src/routes/index.tsx; src/integrations/supabase/types.ts; docs/sql/etapa4_create_experience_once_NAO_APLICADO.sql; docs/sql/etapa4_create_experience_once_REVERSAO.sql; scripts/test-create-experience-once.mjs; este documento.

## Validação

239 testes do app, TypeScript, build e diff --check passaram. Mais 19 cenários SQL passaram no PGlite isolado, com tabelas mínimas e RLS modelada. Cobrem repetição, conflito de dados, outro dono, falha inicial e nova tentativa, ID nulo, visitas distintas, função antiga, atomicidade, privacidade, permissões e reversão. Chamadas são sequenciais; isso não é um teste de concorrência entre conexões no Supabase real. A unicidade do ID vem da primary key existente. Não houve acesso ao banco real ou chamadas pagas.

## Aplicação e ordem de integração

Status: aplicação e conferência no banco relatadas pelo Lovable como migração 0017. O repositório contém drizzle/migrations/0017_create_experience_once.sql com a mesma lógica do SQL revisado. O PR foi atualizado com a main mantendo os tipos auto-gerados e o cast localizado que preserva stall_id nulo; 239 testes, TypeScript e build passaram na versão combinada. Não reaplicar o SQL sem revisar o estado.

Ordem usada:

1. Conferir por leitura no Supabase: nova assinatura ausente, experiences.id UUID e PRIMARY KEY, INSERT/SELECT de authenticated e leitura de experience_scores sob RLS existente. Se houver divergência, parar e revisar.
2. Com autorização explícita, aplicar só docs/sql/etapa4_create_experience_once_NAO_APLICADO.sql numa transação e registrar a migração no fluxo existente. Conferir assinatura (uuid,text,text,integer,text,boolean,uuid,jsonb), SECURITY INVOKER, search_path vazio, anon/PUBLIC sem EXECUTE e função antiga intacta.
3. Se o Lovable gerar tipos após a migração, conferir o diff antes de integrar para manter apenas uma declaração de create_experience_once, aceitando stall_id nulo. Não integrar um tipo duplicado.
4. Integrar o PR somente depois da função existir. Na prévia, registrar experiência com notas/fotos, reabrir e conferir, editar normalmente. Repetição após resposta perdida foi testada isoladamente; não induzir falha/dados de teste no banco real sem autorização.
5. Publicar após aprovação e validação.

Reversão: restaurar o código que chama create_experience antes de remover a função nova, com autorização. Não remove experiências nem notas.

## Limitações

Request ID dura enquanto o formulário está aberto. Fechar/recarregar inicia outra tentativa; persistência da tentativa após reload ainda é pendente. Se o registro anterior foi excluído, o mesmo ID pode criar novamente. Alterações nos dados depois de uma resposta perdida podem gerar conflito; conferir o diário antes de repetir com novos dados. Fotos e saved_places não têm transação conjunta com o cadastro; envio de foto com resultado incerto ainda pode duplicar arquivos ao tentar novamente. Idempotência dos livros continua pendente. Sem limpeza de órfãos antigos.
