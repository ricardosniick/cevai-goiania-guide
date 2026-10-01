# Simular Google Places e criar o diário de fotos

## Implementação
- Reorganizar os locais como respostas simuladas do Google Places, incluindo identificador, atribuição, avaliação e galeria oficial por estabelecimento.
- Atualizar Home, Mapa e Detalhes para consumirem a mesma fonte simulada e exibirem fotografias coerentes de restaurantes, parques, hotéis e lojas de Goiânia.
- Separar em Detalhes as galerias “Fotos oficiais” e “Comunidade / Diário”, com identificação visual da origem.
- Salvar cada experiência publicada no diário do aparelho, incluindo foto, local, categoria, avaliação, relato e resposta “Voltaria?”.
- Mostrar os registros do diário no Perfil e associar fotos da comunidade ao local correspondente nos Detalhes.

## Verificação
- Publicar uma experiência com foto e confirmar sua exibição no Perfil e na galeria da comunidade do local.
- Revisar Home, Mapa e Detalhes em celular e desktop, incluindo recarregamento para confirmar a permanência do diário.

## Detalhes técnicos
- Manter o Google Places em modo simulado, sem cobrança ou chamadas externas: os dados seguirão um formato compatível com futura integração real.
- Armazenar o diário localmente no navegador para funcionar sem login; a infraestrutura do Lovable Cloud fica pronta para futura sincronização entre aparelhos.
