# Links das fotos de experiências compartilhadas

## Causa

loadExperiences gerava todos os links de Storage com validade de 3600 segundos. Tornar uma experiência privada impede novos acessos autorizados pelas políticas, mas não revoga os links já emitidos.

## Melhoria gradual

- Para outras pessoas, o app passa a solicitar links de 300 segundos.
- Para a pasta do próprio usuário, mantém 3600 segundos. Livros continuam privados e não foram modificados.
- A tela do lugar renova os dados e links a cada 240 segundos enquanto há fotos de outras pessoas e a tela está ativa. Ao retornar à aba, o comportamento normal do React Query recarrega os dados.
- A chave de cache das experiências do lugar inclui o usuário, evitando aproveitar a consulta de outra conta.
- Em falha ou negativa na assinatura, a nova resposta não reaproveita links antigos. O registro continua carregando sem fotos.
- Novos uploads de experiências pedem cacheControl=60. Fotos antigas não são alteradas.
- Sem migração, mudanças RLS, exclusão de arquivos ou alterações em cores, fontes e navegação.

O viewerId somente escolhe a duração solicitada pelo app. A autorização continua sendo feita pelo Supabase, pelas políticas existentes. Não é uma credencial ou barreira de acesso.

## Limitações: mitigação, não revogação imediata

1. Links emitidos anteriormente mantêm sua duração original. Publicar código novo não os revoga.
2. Um link de 5 minutos pode continuar acessível até expirar. Imagens já carregadas, salvas ou capturadas por outra pessoa não podem ser retiradas de sua posse pelo aplicativo.
3. cacheControl e validade do token são independentes. Se Smart CDN estiver ativo, cache de uma foto antiga pode permitir entrega além da expiração do token. Conferir configuração e metadados do Storage por leitura. Não declarar um prazo máximo de 5 minutos para todas as fotos.
4. O prazo de 5 minutos é a solicitação do aplicativo, não um limite imposto ao serviço de Storage. Enquanto uma pessoa tiver SELECT permitido para uma foto compartilhada, pode chamar diretamente a API de assinatura com outro prazo. Não afirmar que esta mudança elimina o alerta ou impede esse comportamento.
5. Revogação por experiência requer desenho e validação adicionais do fluxo de entrega/autorização, incluindo impedir assinaturas diretas prolongadas. Não retirar a leitura compartilhada sem substituir seu funcionamento.
6. A renovação aumenta leituras de experiências/Storage. Fotos de capa do Google continuam passando pelo cache e limites existentes; permanecer na tela pode renovar esses dados quando o cache expirar. Não houve chamadas reais nos testes.

Referências oficiais:
- https://supabase.com/docs/guides/storage/serving/downloads
- https://supabase.com/docs/guides/storage/cdn/smart-cdn
- https://supabase.com/docs/reference/javascript/file-buckets-createsignedurls

## Validação e sequência

Testes simulados: assinatura separada dono/terceiro, diário privado, identidade ausente, deduplicação, negativa e exceção na assinatura, remoção da experiência na recarga e cacheControl de novos uploads.

Antes de integrar: conferir instalação congelada, testes, TypeScript e build em cópia do PR. Por leitura, conferir se Smart CDN está ativo e o cacheControl das fotos antigas, sem divulgar paths ou dados pessoais. Não modificar arquivos existentes no Storage.

Depois de integrar, testar prévia com uma experiência própria já existente e uma compartilhada acessível com outra conta já existente, se autorizado. Conferir abertura, renovação após 4 minutos em primeiro plano, tornar privada e negativa de novos links. Distinguir teste simulado de real; não prometer revogação dos links antigos. Publicar só com autorização.

Os avisos de catálogo compartilhado e fotos compartilhadas devem ser justificados com a auditoria das permissões, não apagados ou ignorados automaticamente.
