# Etapa 4 — confirmar exclusão antes de limpar fotos

Causas: ExperienceMenu aceitava DELETE sem erro como sucesso, mesmo sem linha afetada. Limpava arquivos de exp.photoItems, que só contém vínculos cujas URLs temporárias carregaram; fotos com erro de assinatura não entravam na limpeza. Erro de conexão no storage após DELETE concluído mostrava “Não foi possível excluir”, embora o registro já tivesse desaparecido.

Correção: deleteExperience consulta vínculos no banco por experience_id/user_id, exige linha retornada ao excluir experiences por id/user_id e só então considera arquivos. Não depende de URLs temporárias. Antes de remover, verifica se o caminho ainda está referenciado em experience_photos ou books. Caminhos precisam estar na pasta do próprio usuário. Erro na leitura inicial ou na confirmação do DELETE não remove fotos. Erro depois de exclusão confirmada retorna limpeza pendente e a tela informa isso separadamente.

Arquivos: src/routes/index.tsx, src/lib/delete-experience.ts, src/lib/delete-experience.test.ts e este documento. Confirmação de exclusão, fontes, cores, navegação, privacidade e regras existentes permanecem iguais. O lugar e os registros salvos não são excluídos.

Validação: 239 testes passaram, com 12 cenários novos: exclusão própria, erro/zero linhas/resposta perdida, falha ao consultar fotos, registro sem fotos, vínculos em experiência ou livro, falha de conferência, erro/exceção na limpeza e caminhos duplicados/alheios. TypeScript, build e diff --check passaram. Supabase simulado; nenhum SQL ou chamada paga.

Teste real pendente na prévia após integração: criar uma experiência de teste com foto, cancelar exclusão para confirmar preservação e depois confirmar exclusão. Não usar um registro importante. Função pressupõe os privilégios/políticas de leitura e exclusão já usados no app; não altera permissões.

Limitações: a listagem de vínculos e o DELETE não compartilham uma transação RPC; upload simultâneo pode deixar um arquivo fora da lista de limpeza. Storage e banco não têm transação conjunta. Resposta perdida após commit pode deixar arquivo pendente e aviso de falha; não remove arquivos cujo estado seja incerto. Não há limpeza automática ou de órfãos antigos.

Etapa 4 ainda tem pendências: idempotência na criação para impedir duplicatas após resposta perdida, conferência de limpeza parcial na edição, recuperação de arquivos pendentes. Etapa 5 (localização, expiração de coordenadas e paginação) ainda não começou. Melhorias de compartilhamento dos livros e escolha de privacidade no cadastro estão em docs/melhorias-pendentes.md.
