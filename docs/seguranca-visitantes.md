# Cotas separadas para visitantes

## Causa e correção

As funções públicas de exploração já tinham limite compartilhado por minuto e teto global. Porém, não tinham cota diária própria: solicitações públicas poderiam consumir todo o saldo diário das contas logadas.

Agora o servidor verifica, nesta ordem: limite original de visitantes, cota específica de visitantes por minuto e por 24 horas, teto global, Google. Os limites próprios das pessoas logadas e os tetos globais não mudam.

| Tipo | Visitantes/minuto | Visitantes/24h | Global/minuto | Global/dia |
|---|---:|---:|---:|---:|
| Texto | 10 | 100 | 20 | 200 |
| Proximidade | 10 | 100 | 20 | 200 |
| Detalhes | 15 | 150 | 30 | 300 |
| Fotos novas | 75 | 1000 | 150 | 2000 |

Os valores globais acima são os últimos informados pelo usuário. As cotas são compartilhadas entre todos os visitantes, fixadas no servidor e não podem ser aumentadas por parâmetros do cliente ou limpeza de cookies. Janela de 24h é móvel; não representa o dia civil de São Paulo do teto global. Se os tetos globais forem alterados, revisar também GUEST_BUDGET.

As fotos em cache não gastam cota. Quando a cota de fotos acaba, o lugar abre sem fotos novas. Quando a cota de busca/detalhes acaba, o app informa que o visitante pode tentar mais tarde ou entrar na conta. As contas logadas continuam sujeitas a seus próprios limites e ao teto global; login não remove o limite global.

## Segurança e limitações

- Usa hit_rate_limit existente, service_role, com a mesma trava e limpeza de eventos com mais de 1 dia documentadas na migração 0003. Não há migração nova, novas permissões RLS ou armazenamento de IP.
- Reservas podem ser consumidas mesmo se um limite posterior negar a consulta. Isso reduz o saldo conservadoramente, sem autorizar custo extra.
- Todas as instâncias compartilham o banco; nenhum limite depende de memória local.
- O acesso público permanece intencional. Não há CAPTCHA/WAF nem identificação por visitante. Um robô ainda pode esgotar a cota destinada aos visitantes; a correção limita esse consumo, não elimina automação. O saldo global também depende do tráfego legítimo das contas logadas.
- A tela de segurança pode continuar alertando sobre funções públicas. Não ignorar automaticamente nem afirmar que não existem riscos.
- A validade de 1 hora dos links de fotos é outro problema, ainda pendente. Acesso autorizado ao catálogo e fotos compartilhadas deve ser documentado, não removido para silenciar o verificador.

## Validação e publicação

254 testes passaram, incluindo limites novos, erros, parâmetros forjados, isolamento das contas logadas, fotos bloqueadas sem bloquear o lugar e cache sem consumo. Nenhuma chamada real ao Google ou banco de produção.

Conferir TypeScript e build, integrar somente após revisão, testar visitante e pessoa logada na prévia e publicar somente com autorização. Não muda cores, fontes, navegação ou telas de cadastro.
