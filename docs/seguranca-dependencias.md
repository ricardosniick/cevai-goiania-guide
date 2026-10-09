# Correção das dependências transitivas — 9/10/2026

O relatório do Lovable de 7/10/2026 identifica três falhas de consumo excessivo de CPU em dependências transitivas:

- js-yaml 4.3.0: GHSA-5p4m-2wfm-xmqj e GHSA-2883-xcg3-v3hh.
- source-map-js 1.2.1: GHSA-68fv-2mgg-jv7q.

Correção: overrides exatos de js-yaml 4.3.2 e source-map-js 1.2.2, ambos da mesma linha principal usada anteriormente. O override existente de rolldown permanece. TanStack, Tailwind, código do aplicativo e banco não são alterados.

Referências:
- https://github.com/advisories/GHSA-5p4m-2wfm-xmqj
- https://github.com/advisories/GHSA-2883-xcg3-v3hh
- https://github.com/advisories/GHSA-68fv-2mgg-jv7q

## Validação

As versões corrigidas já estavam instaladas no ambiente local. Versões, dependências e hashes foram obtidos do package-lock.json existente desse ambiente. bun.lock foi atualizado pontualmente usando esses metadados; não foi regenerado pelo Bun, que não está disponível aqui. Nenhum outro pacote foi atualizado.

241 testes passaram usando essas dependências locais. TypeScript e build passaram sem erros. A instalação limpa e congelada do novo bun.lock ainda deve ser validada em um ambiente com Bun e acesso ao registro antes de integrar este PR. Os testes locais não substituem essa verificação.

Procedimento pendente:
1. Em um checkout limpo desta branch, executar bun install --frozen-lockfile.
2. Conferir que todas as resoluções de js-yaml são 4.3.2 e de source-map-js são 1.2.2; executar bun pm ls --all.
3. Executar bun run test, bunx tsc --noEmit e bun run build.
4. Conferir visualmente a prévia: login, exploração como visitante, mapa, experiências e livros.
5. Integrar somente após as verificações e publicar somente com autorização.
6. Executar Scan dependencies no Lovable para atualizar o relatório antigo.

Não requer SQL, alterações no Supabase ou no Google Cloud. Reversão: reverter o commit de dependências (restaura as versões vulneráveis; somente se necessário, com avaliação do risco).
