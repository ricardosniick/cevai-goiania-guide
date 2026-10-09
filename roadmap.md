# Roadmap

## Acabamento visual
- [x] Uniformizar resposta ao toque e indicador da navegação, preservando o botão central.
- [x] Suavizar entradas de listas, fotos e carregamento com redução de movimento.
- [x] Ajustar espaçamento, sombras e telas vazias com ações conectadas.
- [x] Executar testes e conferir a prévia; verificar o resultado automático da compilação.

## Nome do app e emails de autenticação
- [x] Usar “Cê vai” no logo em texto, títulos, metadados, compartilhamento, nome de instalação e README.
- [ ] Nome do projeto no editor: alterar manualmente nas configurações do projeto; não há ação de renomeação disponível nesta sessão.
- [ ] Emails de autenticação em português, remetente “Cê vai” e identidade visual: aguardam configuração de um domínio de envio próprio no Cloud → Emails; depois criar os seis templates gerenciados e aplicar os textos solicitados.

- [x] Conectar Splash ao Feed.
- [x] Filtrar lugares pelas categorias do Feed.
- [x] Conectar pins e cards do Mapa aos Detalhes.
- [x] Tornar abas e ações dos Detalhes funcionais.
- [x] Completar e conectar o formulário de experiência.
- [x] Conectar Explorar, Mapa, Salvos e Perfil pela navegação inferior.
- [x] Adicionar transições suaves e validar o fluxo completo.
- [x] Modelar lugares como respostas simuladas do Google Places.
- [x] Separar fotos oficiais das fotos da comunidade nos detalhes.
- [x] Salvar registros com foto no diário local e exibi-los no Perfil.
- [x] Corrigir a Splash rolável com slogan e ações sempre visíveis.
- [x] Adicionar Login/Cadastro com e-mail, senha e Google, salvando o perfil.
- [x] Atualizar categorias e locais simulados de Goiânia, incluindo clínicas.
- [x] Separar Fotos Oficiais (Google) e Fotos dos Usuários em abas próprias.
- [x] Adicionar seletor de telas para testes no preview desktop.- [ ] Reestruturação completa: Google Maps/Places reais (busca, mapa, detalhes, fotos) via backend seguro.
- [x] Login ("Que bom te ver por aqui", esqueci senha) e cadastro com confirmar senha.
- [x] Explorar com categorias (Restaurantes, Cafés, Parques, Hotéis, Lojas, Cultura, Saúde) e lugares reais.
- [x] Experiências na conta: critérios por categoria, várias por lugar, privadas; salvos (Quero conhecer/Já fui/Favoritos).
- [x] Remover lugares e fotos fictícios; revisar consistência mobile em 360/390/412.
- [x] Categorias em grupos (6 na Home + "Ver todas"), filtros do mapa por grupo, critérios por categoria.
- [x] Feiras com barraquinhas da comunidade e notas separadas da feira.
- [x] Livros no Perfil (status, nota, foto, recomendo), privados.

## Segurança e robustez (documento em etapas)
- [x] Etapa 1 — .env no .gitignore; explicar restrição da chave do Maps.
- [x] Etapa 2 — `places` gravado só pelo servidor (dados do Google); RLS sem insert/update para usuários.
- [x] Etapa 3a — Limites por usuário (busca 30/min, detalhes 60/min, lugar novo 20/min, presença 6/h, situação 1/10min por lugar + 10/h).
- [x] Etapa 3b — Fotos: capa na lista, cache 500/30min, photo_name no lugar, fallback "sem foto".
- [x] Etapa 4 — Presença, situação e edição de notas atômicas.
- [x] Etapa 5 — Tratar erros ignorados com aviso ao usuário.
- [x] Etapa 6 — Limites no chat/conexões, bloqueio no chat, denúncias únicas, auto-ocultar situação, people_here.
- [x] Etapa 7 — geo.ts extraído; divisão do index.tsx pausada após a 7B-4.
- [x] Etapa 8 — Testes de geo e categorias.
- [x] Etapa 9 — lang pt-BR, telas de erro em português, viewport-fit=cover.

## Parte 7B — PAUSADA após a 7B-4 (decisão do usuário)
- [x] 7B-1 tipos (types.ts), ManageCtx (manage-context.ts), Logo, distanceKm/formatKm (lib/geo-format.ts)
- [x] 7B-2 usePlaces (hooks/usePlaces.ts); peças comuns + Stars (cevai/shared.tsx)
- [x] 7B-3 loadExperiences, withFreshPhotos, useSaved (hooks/useExperiences.ts)
- [x] 7B-4 BooksPanel.tsx, StallsPanel.tsx (+ Field, CeVaiRating, fmt1 em shared.tsx; PlaceStat em types.ts)
- Continua no index.tsx: shell CeVaiApp + BottomNav, auth (Welcome/Login/Signup/Forgot/NewPassword), Explorar (HomeScreen, usePlaceStats, GoogleRating, PlaceRow), Mapa, Página do lugar (DetailScreen), ExperienceCard/Menu, Salvos, Perfil, ExperienceModal.
- [ ] Pausado (só retomar se o usuário pedir): 7B-5 auth · 7B-6 Explorar/Mapa · 7B-7 cards · 7B-8a/b/c · 7B-9 modal · 7B-10 shell · distanceKm via geo.ts · 7C Prettier
- [x] Separado: aviso do markerclusterer no servidor de desenvolvimento (só preview); importação adiada e prévia sem erro.

## Parte social — DESATIVADA nesta versão
- [x] Interface removida: "Estou aqui", pessoas no local, conexões, chat, bloqueio/denúncia de pessoas; linha "pessoas aqui agora" da Situação.
- [x] startPresence desligada (PRESENCE_DISABLED); migração 0009_disable_social_features revoga as funções e escritas sociais. Tabelas e dados mantidos.
- [ ] Para voltar: novo GRANT nas funções/tabelas, PRESENCE_DISABLED = false e recolocar o PresencePanel na página do lugar.
