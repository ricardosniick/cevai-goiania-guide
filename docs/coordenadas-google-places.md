# Expiração de coordenadas — entrega 0020

## Causa e escopo

A migração 0010 adiciona `coords_fetched_at`, marca registros antigos com a hora da migração e habilita pg_cron, mas não contém `cron.schedule`. Isso comprova a ausência de agendamento **nesse arquivo**, não no banco atual: uma tarefa pode ter sido criada por outra via.

A consulta real não pôde ser executada nesta sessão: o conector Lovable retornou `404 project_not_found` para o projeto conectado. Não se deve reportar zero tarefas ou zero linhas limpas em produção com base nisso. O resultado real precisa ser obtido pelo administrador do projeto.

O código também tinha dois defeitos: `null` era convertido implicitamente em zero no cálculo de distância, e palavras/separadores eram renderizados mesmo quando `formatKm` devolvia vazio. A correção valida coordenadas e agrupa distância, ícone, separador e “de você” num elemento que some inteiro. Não altera classes, cores ou textos válidos, nem remove linhas/IDs/conteúdo do usuário.

## Aplicação autorizada, sem deploy automático

O usuário solicitou esta correção incluindo a tarefa de banco; não é necessário pedir novamente a mesma autorização. O bloqueio nesta sessão é de **acesso ao projeto**, não de aprovação. A migração não foi aplicada ao banco real por esta sessão.

1. Como administrador que consegue ver todos os jobs (superuser/BYPASSRLS), executar e registrar:

```sql
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
SELECT current_user,
       current_setting('cron.timezone', true) AS cron_timezone,
       current_setting('cron.launch_active_jobs', true) AS cron_enabled;
```

2. Conferir funções existentes com o mesmo nome e guardar definição/permissões anteriores, se houver, antes de substituí-las. Não confundir com a migração 0019 de fotos, que é independente desta.
3. Executar `drizzle/migrations/0020_clear_stale_place_coords.sql` numa única transação. Uma tarefa equivalente com outro nome, uma colisão de nome não relacionada, um fuso não reconhecido ou executor sem acesso administrativo interrompe a migração sem adicionar job. Revisar a tarefa encontrada em vez de contornar a proteção.
4. Registrar resultados reais:

```sql
SELECT jobname, schedule, command, active, username
FROM cron.job WHERE jobname = 'clear-stale-place-coords';
SELECT public.clear_stale_place_coords() AS cleaned_rows;
SELECT prosecdef, proconfig, proacl
FROM pg_proc WHERE oid = 'public.clear_stale_place_coords()'::regprocedure;
SELECT jobid, status, return_message, start_time, end_time
FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

Nunca exigir que a contagem seja zero: pode haver coordenadas vencidas/sem data. Não resetar a data de coleta para obter um resultado esperado. A marcação inicial da 0010 não comprova que as coordenadas históricas tenham sido buscadas naquele momento; avaliar essa origem no banco real.

## Função e horário

`public.clear_stale_place_coords()` devolve bigint com o total de linhas alteradas, é SECURITY DEFINER e fixa `search_path=pg_catalog`. EXECUTE é revogado de PUBLIC, anon e authenticated; o proprietário executa, e o job roda com o usuário que o cadastrou. Não criar RPC público para esta operação.

Ela modifica **somente lat e lng**, tornando ambos NULL para coordenadas com mais de 25 dias ou data NULL, inclusive quando só uma coordenada existe. Não modifica `coords_fetched_at`, nome, endereço, fotos, IDs, experiências, favoritos nem outras tabelas. Coordenadas já NULL não contam novamente.

Job: **clear-stale-place-coords**, diariamente às **03:00 de Brasília**. Se o fuso efetivo do pg_cron for GMT/UTC, a expressão é `0 6 * * *`; em America/Sao_Paulo é `0 3 * * *`. Outros fusos exigem revisão explícita. A reexecução remove/recria o mesmo job, sem duplicar. Monitorar `cron.job_run_details`: um job cadastrado não comprova que executa. Falhas prolongadas por cinco dias podem superar a margem até o prazo máximo de 30 dias.

Desfazer a limpeza não recupera coordenadas antigas: buscar novamente no Google com as cotas atuais. Para desfazer mudanças de agendamento/função, restaurar os metadados/definição anteriores registrados no passo 2; se não existiam, unschedule do job e DROP da função removem apenas o mecanismo novo. Não fazer rollback automático nem apagar lugares.

## Gravações e restauração

Leitura do código e testes com Google/Supabase simulados confirmam que `searchPlaces`, `getPlaceDetails`, `ensurePlace` e `postSituation` enviam lat, lng e `coords_fetched_at` juntos no mesmo upsert. `ensurePlace` busca novamente quando lat ou lng estiver NULL; detalhes/busca/situação também restauram coordenadas a partir de uma resposta nova. Visitantes continuam sem gravar no catálogo e nenhuma chamada paga foi feita nos testes.

## Inventário do conteúdo Google identificado no código

| Local | Dados | Cuidado |
| --- | --- | --- |
| Banco `places` | `google_place_id` | Place ID pode ser mantido conforme exceção oficial; não apagar vínculos do usuário |
| Banco `places` | `lat`, `lng` | Retenção temporária até 30 dias; limpeza aos 25 dias e monitoramento do job |
| Banco `places` | `name`, `address` | Conteúdo Google persistente: a exceção de coordenadas não permite automaticamente guardar esses campos indefinidamente |
| Banco `places` | `category` | Rótulo local obtido por tipos/nome ou filtro; revisar origem e uso derivado de conteúdo Google, não presumir exceção de armazenamento |
| Banco `places` | `photo_name`, `photo_url` legado | A documentação de Place Photos diz expressamente que photo name não deve ser armazenado em cache; a estratégia atual precisa de correção separada, com novas consultas e cotas preservadas |
| Banco `places` | `updated_at`, `coords_fetched_at` | Metadados do app; o horário real de coleta deve corresponder à resposta Google, sem prorrogação artificial |
| Cache em memória do servidor | URL de foto e chave formada por photo name + tamanho, validade 30 min, até 500 entradas | Revisar políticas de cache e expiração; não são bytes de imagens salvos pelo app, mas continuam sendo referência/conteúdo Google |
| Estado/React Query no navegador | Resultados de busca/detalhes, coordenadas, nome/endereço, categoria/tipos/rótulo, avaliação Google e contagem, resumo, telefone, website, link Maps, horários, fotos/URLs e atribuição dos autores | Memória temporária; verificar permissões de cache e atribuição de cada resposta, não aplicar regra de 30 dias a todos os campos |
| Cache React Query de URLs | URLs resolvidas a partir de photo names (staleTime 20 min, gcTime 25 min) | Mesmo cuidado específico de fotos e atribuições |
| Logs de busca do servidor, adicionados na otimização recente do mapa | Nome/tipos de resultados descartados, categoria, texto de busca e métricas | Revisar retenção dos logs e origem Google; textos de busca também merecem cuidado de privacidade |

Fotos/avaliações/comentários de experiências, livros e barraquinhas criadas pelo usuário não são conteúdo do Google. IDs dos lugares nessas tabelas são referências. Backups/exportações do banco e caches/CDNs do provedor não foram inspecionados; verificar se conservam coordenadas antigas e quais obrigações se aplicam à infraestrutura/conector.

**Esta entrega corrige a expiração das coordenadas e a UI. Não declara adequação completa de todo o armazenamento Google**: nomes, endereços, fotos/referências, cache e atribuições ainda exigem revisão do contrato do conector e ajuste específico, preservando os fluxos. Não apagar esses campos automaticamente nesta correção.

Fontes oficiais verificadas:

- [Google Maps Platform Service Specific Terms, Places API 14.3](https://cloud.google.com/maps-platform/terms/maps-service-terms): coordenadas por até 30 dias.
- [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies): restrições de armazenamento, exceção de place ID e atribuições.
- [Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos): photo name não pode ser cacheado; autoria deve ser atribuída quando fornecida.
- [pg_cron](https://github.com/citusdata/pg_cron): fuso efetivo, permissões do usuário executor e acompanhamento das execuções.

## Como testar

Validação final: **292/292 testes em 20 arquivos**, TypeScript sem erros e build concluído. A main recebeu otimizações de mapa durante o trabalho; elas foram preservadas, o conflito de distância foi resolvido sem reescrever histórico, e a validação foi repetida sobre a combinação final. O teste SQL isolado passou em **20 verificações**: zero linhas limpas no cenário fresco; quatro no cenário com coordenadas vencidas/sem data/parciais; reexecução sem duplicar tarefas; permissões, campos/vínculos preservados e parada segura diante de colisões/fuso desconhecido. O cron foi simulado; nenhum agendador real nem banco de produção foi usado.

- `npm test`, `npx --no-install tsc --noEmit`, `npm run build` com as variáveis de ambiente de build.
- Banco isolado: instalar PGlite fora do app e executar `PGLITE_MODULE=/caminho/pglite/dist/index.js node scripts/test-place-coordinate-expiry.mjs`. Simula apenas metadados do cron, não o agendador em funcionamento.
- No celular/prévia, testar lugar normal e experiência ligada a um lugar sem coordenadas: nenhum “NaN”, “de você” solto, “·” de distância ou marcador inválido. Nome, registro e edição devem continuar disponíveis. Abrir os detalhes do lugar deve buscar dados novos e restaurar coordenadas sem perder IDs ou conteúdo.
- Não criar dados fictícios em produção para testar; usar ambiente isolado ou registros existentes cuja alteração esteja autorizada.
