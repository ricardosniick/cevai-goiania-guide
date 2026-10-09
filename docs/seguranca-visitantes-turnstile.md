# Proteção das consultas pagas de visitantes

Buscas e detalhes continuam disponíveis sem conta. Antes de cada chamada pública, o navegador obtém um token Turnstile novo e o servidor o valida com a Cloudflare. A validação exige sucesso explícito, ação `guest_places`, domínio permitido e token recente. Tokens não são guardados nem reutilizados: o provedor recusa replay. A validação acontece antes das cotas e do Google; fotos embutidas nas respostas ficam protegidas pela mesma entrada. As cotas de visitantes e o teto global continuam obrigatórios. Pessoas logadas usam os caminhos autenticados existentes.

## Configuração obrigatória ANTES de integrar/publicar

1. Criar um widget **Managed** no Cloudflare Turnstile. Cadastrar os domínios exatos do site publicado e da prévia (hostname, sem protocolo, porta ou caminho). Não permitir qualquer domínio nem usar chaves de teste em produção.
2. A Site Key pública fornecida pelo dono está versionada como padrão em `guest-challenge.browser.ts`, garantindo sua presença no build mesmo sem `.env.local`. Para usar outro widget, `VITE_TURNSTILE_SITE_KEY` no ambiente de build tem prioridade; exige novo build. Somente a chave pública pode ficar no código.
3. Definir `TURNSTILE_SECRET_KEY` nos segredos do servidor. Nunca usar prefixo `VITE_`, colocar no repositório ou enviar em conversa.
4. Definir `TURNSTILE_ALLOWED_HOSTNAMES` no servidor, com os mesmos hostnames exatos separados por vírgula. A aplicação não confia no Host enviado pela requisição para escolher esta lista.
5. Se houver CSP, permitir `https://challenges.cloudflare.com` em `script-src` e `frame-src`, seguindo a documentação oficial. O servidor precisa alcançar o Siteverify por HTTPS. Adicionar o uso do serviço à informação de privacidade do app, conforme as exigências aplicáveis do provedor.
6. Testar a branch em ambiente com essas configurações antes de integrar. Não ligar esta versão à main sem configuração: ela bloqueia visitantes em caso de ausência, indisponibilidade ou verificação inválida. Não existe modo de liberar consultas sem validação.

O widget usa `appearance: interaction-only`; aparece quando a Cloudflare pede interação, sem mudar as telas do app. Cada consulta usa seu próprio widget/token; chamadas paralelas não compartilham um token. Cancelamento, expiração, falha ou espera de dois minutos removem o widget e impedem a chamada. A chave secreta só é lida no módulo `.server.ts`.

## Validação antes da publicação

- Sem login: explorar lista, buscar texto, navegar no mapa e abrir detalhes/fotos. A validação bem-sucedida deve preservar resultados e navegação.
- Abrir um link de lugar compartilhado sem login: detalhes passam pela verificação. Favoritos e registro de experiências continuam pedindo conta.
- Chamar diretamente os dois endpoints sem token, com token falso/expirado/reutilizado ou originado em domínio não permitido: nenhum RPC de cota/reserva e nenhuma chamada ao Google.
- Pessoa logada: busca, detalhes e registro continuam sem widget de visitante.
- Falha do provedor: mensagem de verificação, sem liberar consulta paga. Repetir após recuperação deve obter novo token.
- Cache fresco do React Query: reutilização de resultados não chama o endpoint nem gera desafio adicional. Fotos já em cache continuam sem consumo adicional de fotos.
- Rodar `npm test`, `npx tsc --noEmit` e `npm run build`. Inspecionar os arquivos públicos gerados para garantir que não contêm a chave secreta nem a implementação do Siteverify.
- Depois de publicação validada, executar novo deep scan e revisar os detalhes: o endpoint continua público por decisão de produto. Não registrar automaticamente como ignorado e não prometer que a etiqueta desaparecerá.

## Diagnóstico de recusas

O servidor acrescenta uma referência fixa `[TSxx]` à mensagem de recusa e registra somente a classificação correspondente. Não registra tokens, segredos, a lista de domínios, respostas brutas nem exceções do provedor. A referência aparece na resposta da função mesmo quando o transporte retorna HTTP 200; não implica sucesso da verificação. O bloqueio continua obrigatório em todos os casos.

| Referência | Causa |
| --- | --- |
| TS01 | Secret Key ausente no servidor que executa a requisição |
| TS02 | Lista de hostnames ausente nesse servidor |
| TS03 | Lista de hostnames com formato inválido (usar hostnames separados por vírgulas, sem protocolo/caminho) |
| TS04 | Token ausente ou com formato inválido |
| TS05 | Siteverify respondeu com falha HTTP |
| TS06 | Falha de conexão não classificada ao acessar Siteverify |
| TS07 | Siteverify não devolveu JSON válido |
| TS08 | Resposta do provedor não tem o formato esperado |
| TS09 | Cloudflare recusou a Secret Key |
| TS10 | Cloudflare recusou token expirado ou já utilizado |
| TS11 | Cloudflare recusou o token enviado |
| TS12 | Outra recusa do provedor |
| TS13 | Ação do token diferente de `guest_places` |
| TS14 | Hostname do token não está na lista configurada no servidor |
| TS15 | Data do token ausente, inválida ou fora do prazo |
| TS16 | Prazo de 8 segundos esgotado ou timeout identificado pelo runtime |
| TS17 | Falha de resolução DNS identificada pelo runtime |
| TS18 | Falha de certificado TLS identificada pelo runtime |
| TS19 | Acesso de rede negado identificado pelo runtime (EACCES/EPERM) |
| TS20 | Runtime sem fetch ou AbortController |
| TS21 | Falha ao criar o controlador ou o corpo da requisição, antes do fetch |

As exceções recebem também uma etapa (`prepare`, `send`, `read`) e uma classe segura de erro. Exemplo: `[TS06] [send:type_error]` indica rejeição durante a chamada ao fetch, mas não prova que houve tráfego externo nem identifica por si só uma opção inválida. `[TS06] [read:type_error]` indica que o fetch devolveu uma resposta e a leitura falhou. Só classes conhecidas são copiadas; nomes arbitrários viram `unknown`. Não registrar mensagens/stack brutos do erro. A alteração separa o diagnóstico sem mudar redirect, prazo, domínio, chave, cotas ou autorização.

O prazo usa AbortController e um temporizador cancelado ao terminar, sem depender de AbortSignal.timeout. O prazo vale também para a leitura da resposta. Não há repetição automática nem mudança de teto: tokens continuam de uso único. Apenas nomes/códigos reconhecidos são classificados; exceções sem esses sinais continuam TS06, sem inferir a causa por texto. TS17–TS19 exigem verificar DNS, certificados ou regras de saída do ambiente que executa o Draft 1; testes locais em outra máquina não confirmam essa infraestrutura. Não ignorar validação TLS nem liberar chamadas pagas quando a rede falha.

Essa mudança permite identificar a causa de uma tentativa real; não prova que qualquer configuração específica está incorreta. Depois de atualizar a versão executada no Draft 1, repetir a tentativa e ler a referência na resposta da função. Alterações no PR não atualizam necessariamente uma cópia de rascunho já criada. Não publicar antes de testar sucesso real em busca e detalhes.

## Risco residual

Turnstile reduz abuso automatizado; não torna visitante uma conta nem elimina todos os robôs. Visitantes legítimos ainda consomem a cota compartilhada, limitada pelos tetos existentes. Ataques à disponibilidade do servidor precisam de controles na hospedagem; esta mudança protege a saída paga ao Google. Testes locais simulam Cloudflare, banco e Google; validação real do widget/domínios ainda é necessária.

Nenhuma migração SQL ou alteração de permissões é necessária. Para reverter o código, restaurar a versão anterior por novo commit; isso também retira esta proteção adicional, mantendo as cotas anteriores.

Referências: [validação no servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [configuração do widget](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/), [CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).
