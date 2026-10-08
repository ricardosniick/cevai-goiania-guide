# Etapa 4 — criação atômica de experiência e notas

## Causa e correção

A criação fazia INSERT em experiences e depois INSERT em experience_scores em outra requisição. Uma falha no segundo INSERT deixava o primeiro confirmado. Agora uma nova RPC create_experience grava ambos na mesma transação. O formulário só começa a enviar fotos após o retorno bem-sucedido. Em erro, preserva os campos e permite tentar novamente. A edição continua usando update_experience, sem alterações.

A função nova é SECURITY INVOKER: não contorna RLS nem permissões das tabelas. O dono vem de auth.uid(), sem parâmetro de usuário; experiências novas continuam privadas. Validações das notas seguem as já usadas na edição. Não muda tabelas, políticas, funções existentes, design ou navegação.

## Arquivos

- src/routes/index.tsx — substitui os dois INSERTs pela RPC.
- src/integrations/supabase/types.ts — assinatura da nova RPC.
- docs/sql/etapa4_create_experience_NAO_APLICADO.sql — criação e permissões, numa transação; NÃO APLICADO em produção.
- docs/sql/etapa4_create_experience_REVERSAO.sql — remove apenas a nova função; NÃO EXECUTADO.
- scripts/test-create-experience.mjs — testes isolados.
- Este documento.

## Validação

190 testes do app passaram; TypeScript, build e git diff --check passaram. Mais 12 cenários SQL passaram num banco embutido PGlite, descartado ao final, com tabelas mínimas e políticas modeladas: gravação completa, nenhuma nota, erro durante o INSERT de notas com rollback da experiência, parâmetros inválidos, sessão ausente, anônimo recusado, isolamento A/B, respeito a RLS restritiva e reversão sem perda de registros.

Os testes SQL não reproduzem todas as restrições/triggers/configurações do Supabase real. Não houve chamadas ao Google ou ao banco de produção. A dependência de teste foi instalada apenas em /tmp, sem mudar package.json nem lockfile do app. A execução está documentada no início do script.

## Ordem de aplicação — autorização necessária

1. No Supabase, conferir por leitura que a assinatura create_experience(text,text,integer,text,boolean,uuid,jsonb) não existe; verificar colunas e defaults de experiences/experience_scores e as permissões de INSERT/SELECT de authenticated já usadas pelo app. Caso haja divergência, parar e revisar.
2. Após autorização explícita, aplicar SOMENTE docs/sql/etapa4_create_experience_NAO_APLICADO.sql numa transação, registrar a migração no fluxo existente e conferir: função SECURITY INVOKER (prosecdef=false), search_path vazio, EXECUTE authenticated; PUBLIC/anon sem EXECUTE; políticas/tabelas existentes intactas. Não inserir dados reais para teste sem autorização.
3. Só então integrar este PR à main e testar na prévia: criar com notas e fotos, criar sem critérios, verificar no diário e editar normalmente.
4. Publicar apenas após autorização do usuário e validação da prévia.

Não integrar/publicar o consumidor antes da função existir: não há fallback para os INSERTs antigos, pois reintroduziria o salvamento parcial. A versão atual publicada continua funcionando enquanto este PR está separado.

Reversão: primeiro restaurar o consumidor anterior na prévia e na versão publicada; depois, com autorização, remover a função pelo arquivo de reversão. Não apagar registros ou notas existentes.

## Riscos e escopo restante

Se a transação for confirmada mas a resposta se perder, o app pode avisar falha e uma nova tentativa pode criar uma experiência duplicada. Idempotência é uma correção separada. Fotos e saved_places continuam sendo operações posteriores, fora desta transação; a compensação de uploads do PR anterior permanece. Limpeza de livros e exclusões ainda não foram tratadas. A escolha de privacidade no cadastro segue pendente, sem mudar o padrão privado neste PR.
