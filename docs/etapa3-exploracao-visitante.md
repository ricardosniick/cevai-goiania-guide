# Etapa 3 — Explorar sem entrar

## Causa e correção

O botão abria a tela Explorar, mas usePlaces desativava a consulta sem usuário,
as telas mostravam bloqueios de login e as funções do servidor exigiam sessão.

A correção permite busca, filtros, mapa, detalhes e fotos do Google por duas
funções públicas separadas: searchGuestPlaces e getGuestPlaceDetails. A validação
de entrada e a consulta de dados do Google são compartilhadas com as funções
existentes; as funções autenticadas e suas permissões permanecem preservadas.
Links compartilhados também podem abrir os detalhes sem login.

## Privacidade e custos

As funções de visitante não consultam conteúdo pessoal ou comunitário e não
gravam lugares. Elas não criam usuários anônimos nem ampliam permissões RLS.
Salvar, favoritar, registrar experiências e publicar situações exigem conta.
Experiências, barraquinhas e avaliações da comunidade continuam protegidas.

Todos os visitantes compartilham um identificador interno de contagem (não é uma
conta Auth), com buckets separados: guest_search, 30/minuto, e guest_details,
60/minuto. O cliente não escolhe esse identificador. Depois desse limite,
as chamadas de busca, detalhes e fotos consomem o mesmo teto global já existente.
A soma de visitantes pode esgotar a cota compartilhada; abrir uma janela anônima
não restaura a cota. Não há limite individual por visitante nesta versão.

## Configuração e aplicação

Não é necessária migration nova nem habilitar login anônimo no Supabase.
O banco precisa manter hit_rate_limit e reserve_global_budget com execução
somente para service_role e os cinco limites globais já configurados.
O carregamento do mapa no navegador continua fora do teto do servidor.

Revisar e integrar o PR antes de testar no preview. Conferir sem sessão: explorar,
buscar, abrir detalhes/fotos, navegar pelo mapa e tentar salvar ou registrar.
Repetir com conta para confirmar o fluxo existente. Publicação é uma ação separada,
a ser autorizada pelo usuário. Não executar os testes automatizados com APIs reais.

## Melhorias registradas, fora desta etapa

- Escolher privada ou compartilhada ao criar uma experiência, privada por padrão.
- Investigar raio e precisão do GPS de Situação agora com testes de campo.
