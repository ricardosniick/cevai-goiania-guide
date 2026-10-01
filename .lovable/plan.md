# Interconectar e finalizar as cinco telas

## Implementação
- Centralizar a navegação das cinco áreas no estado do aplicativo: Splash, Feed, Mapa, Salvos/Perfil e Detalhes, mantendo o formulário como modal.
- Fazer as categorias do Feed filtrarem imediatamente os lugares exibidos, com estado ativo visível e cards clicáveis.
- Filtrar os pins do Mapa por categoria e abrir o local correspondente ao tocar em um pin ou card.
- Tornar todas as abas de Detalhes úteis, além de conectar Salvar, Quero ir, compartilhar e voltar ao contexto anterior.
- Completar o formulário de experiência com prévia de foto, avaliação por estrelas, campos controlados, categoria e toggle “Voltaria?”.
- Aplicar transições suaves, incluindo direção de avanço/retorno, respeitando a preferência de movimento reduzido.

## Verificação
- Percorrer Splash → Feed → filtro → Detalhes → Mapa → pin → modal → Salvos/Perfil em tamanhos mobile e desktop.
- Confirmar estados ativos, conteúdo filtrado, mensagens de ação e ausência de erros visuais ou de execução.

## Detalhes técnicos
- Permanecer em uma única rota, usando estado React para preservar a experiência de aplicativo móvel.
- Reaproveitar os tokens visuais, imagens e componentes existentes, sem adicionar serviços externos ou persistência.
