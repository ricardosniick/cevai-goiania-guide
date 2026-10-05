# Parte 7B: dividir src/routes/index.tsx (963 linhas)

O objetivo é mover código sem mudar o comportamento. Uma parte por vez, e cada parte espera o seu "ok". Cores, textos, layout e banco não mudam. Ao fim de cada parte: verificação de código, `npm test` (inclusive o teste de rota, que agora reprova se a tela quebra) e build.

## Seções atuais (linhas aproximadas)

| # | Seção | Linhas | Tamanho |
|---|---|---|---|
| A | Tipos e utilidades: Screen, LatLng, SavedList, LIST_LABELS, Stall, Experience, ManageCtx, distanceKm, formatKm, Logo | 25–69 | ~45 |
| B | Estrutura principal do app (CeVaiApp) e barra inferior (BottomNav) | 72–193 | ~120 |
| C | Entrada e conta: Welcome, AuthLayout, Field, PasswordField, GoogleButton, Login, Signup, SignupDone, Forgot, NewPassword | 194–326 | ~130 |
| D | Peças comuns: usePlaces, LoginPrompt, CategoryChips, CategoriesScreen, PlacePhoto, Skeleton, ErrorBox, ListError | 327–391 | ~65 |
| E | Explorar: HomeScreen, usePlaceStats, GoogleRating, CeVaiRating, PlaceRow | 392–465 | ~75 |
| F | Mapa: MapScreen | 466–508 | ~45 |
| G | Dados: loadExperiences, withFreshPhotos, useSaved | 509–559 | ~50 |
| H | Página do lugar: DetailScreen, Stars, ExperienceCard, ExperienceMenu | 560–706 | ~145 |
| I | Barraquinhas: StallsPanel | 707–743 | ~37 |
| J | Livros: BooksPanel | 744–789 | ~45 |
| K | Salvos: SavedScreen | 790–808 | ~20 |
| L | Perfil: ProfileScreen | 809–845 | ~37 |
| M | Registrar ou editar experiência: ExperienceModal | 846–963 | ~118 |

## Dependências

- Quase todas as seções usam A: tipos, LIST_LABELS e Logo.
- D é usada por E, F, H, K, L e M.
- G (dados) é usada por H, K, L e M. Depende de `resolvePlacePhotos` e da QueryClient.
- ManageCtx (em A) é fornecido por B e lido por ExperienceMenu (H). Liga a página do lugar e o Perfil ao formulário de edição em B.
- H usa D, G, I, ExperienceCard e os quadros de presença e situação.
- L usa G, J, ExperienceCard (H) e MapView.
- M usa D (usePlaces e chips), `ensurePlace`, categorias e o tipo Experience.
- B guarda todo o estado compartilhado: tela atual, usuário, centro e localização, categoria, formulário aberto e avisos. Ele chama todas as telas.
- `notify` (avisos) é passado como propriedade, não como estado global.

## Ordem proposta (das partes mais soltas para as mais ligadas)

1. **7B-1 Tipos e utilidades (A)** → `src/components/cevai/types.ts` e `src/lib/geo-format.ts` (distanceKm, formatKm). Logo → `src/components/cevai/Logo.tsx`.
   Risco: um import circular ou um tipo esquecido. Teste no app: abrir o app, ver a tela inicial e a distância nos cards.
2. **7B-2 Peças comuns (D)** → `src/components/cevai/shared.tsx`; `usePlaces` → `src/hooks/usePlaces.ts`.
   Risco: mudar a chave do cache das buscas, o que faria o Google ser chamado de novo. A chave será mantida idêntica. Teste: Explorar, trocar de categoria, voltar e confirmar que não recarrega.
3. **7B-3 Dados (G)** → `src/hooks/useExperiences.ts` (loadExperiences, withFreshPhotos, useSaved).
   Risco: fotos dos Salvos e do Perfil e o cache de 20 minutos. Teste: abrir Salvos, sair e voltar, e as fotos não devem recarregar.
4. **7B-4 Livros (J) e Barraquinhas (I)** → `BooksPanel.tsx` e `StallsPanel.tsx`.
   Risco baixo, porque são isoladas. Teste: registrar um livro; numa feira, ver e adicionar uma barraquinha.
5. **7B-5 Entrada e conta (C)** → `src/components/cevai/auth/*.tsx`.
   Risco: o fluxo de login e cadastro, com Google e com e-mail. Teste: sair, entrar com e-mail, entrar com Google e abrir "esqueci a senha".
6. **7B-6 Explorar (E) e Mapa (F)** → `HomeScreen.tsx` e `MapScreen.tsx`.
   Risco: rolagem inicial no topo e busca única ao abrir o Mapa. Teste: abrir Explorar (o topo deve aparecer inteiro), abrir o Mapa (uma única busca) e usar "Buscar nesta área".
7. **7B-7 Cards e menu de experiência (parte de H)** → `ExperienceCard.tsx`, com ManageCtx movido para o mesmo arquivo.
   Risco: o menu ⋮ some se o contexto ficar duplicado. Teste: no Perfil e no lugar, conferir o ⋮ nas experiências próprias, a privacidade e a exclusão.
8. **7B-8 Página do lugar (H), Salvos (K) e Perfil (L)** → `DetailScreen.tsx`, `SavedScreen.tsx` e `ProfileScreen.tsx`.
   Risco: abas, salvar ou remover dos Salvos e compartilhar. Teste: abrir um lugar, salvar e remover, abrir as abas, usar o Perfil com as abas Lista, Mapa, Fotos e Livros.
9. **7B-9 Formulário de experiência (M)** → `ExperienceModal.tsx`.
   Risco: a edição numa operação só e os avisos de foto. Teste: registrar e editar uma experiência com foto.
10. **7B-10 Estrutura principal (B)**: fica em `index.tsx`, com cerca de 130 linhas, só com o estado e a troca de telas. BottomNav → `BottomNav.tsx`.
    Risco: a troca de telas e o scroll. Teste: percorrer todas as abas e o fluxo de link compartilhado (`?lugar=`).

## Detalhes técnicos

- Funções de componente exportadas de arquivos novos em `src/components/cevai/`, nunca do arquivo da rota, para não atrapalhar a divisão automática do código.
- Nenhum nome de chave de cache, texto ou classe de estilo muda. Cada parte é só recortar e colar, mais os imports.
- A regra de estrutura vai para o `AGENTS.md` ao final: a rota única contém só o estado e as telas ficam em `src/components/cevai/`.
- Prettier (7C) só depois da 7B inteira, num passo separado.
