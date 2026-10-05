# Roadmap

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
- [ ] Etapa 3 — Limites de uso por usuário nas buscas ao Google; fotos e cache. (aguarda confirmação dos limites)
- [ ] Etapa 4 — Presença, situação e edição de notas atômicas.
- [ ] Etapa 5 — Tratar erros ignorados com aviso ao usuário.
- [ ] Etapa 6 — Limites no chat/conexões, bloqueio no chat, denúncias únicas, auto-ocultar situação, people_here.
- [ ] Etapa 7 — Extrair geo.ts e dividir index.tsx aos poucos.
- [ ] Etapa 8 — Testes de geo e categorias.
- [ ] Etapa 9 — lang pt-BR, telas de erro em português, viewport-fit=cover.
