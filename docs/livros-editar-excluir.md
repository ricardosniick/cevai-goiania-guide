# Livros — editar e excluir

## Causa e comportamento

A tela BooksPanel só tinha criação e listagem; publicar o app não adicionaria os controles inexistentes. Este PR reutiliza o formulário para editar e acrescenta ações Editar/Excluir em cada livro.

Edição preenche título, autor, status, nota, comentário e recomendação existentes. Permite manter, substituir ou remover a foto. O UPDATE usa id e user_id e exige o photo_path que estava aberto no editor, evitando sobrescrever uma troca de foto feita em outra aba. Uma operação sem linha retornada é falha, não sucesso. Erros mantêm os campos para nova tentativa.

Exclusão pede confirmação explícita e informa que não pode ser desfeita. DELETE usa id/user_id e retorna o caminho atual da foto. Apenas depois da exclusão confirmada considera a limpeza do arquivo.

Fotos só são removidas quando estão em userId/books/ e uma consulta confirma que nenhum livro visível ainda referencia o arquivo. Se houver vínculo, a foto é preservada; se a conferência ou limpeza falhar, informa pendência sem desfazer a edição/exclusão confirmada. Não apaga a foto anterior antes de confirmar uma substituição. Se UPDATE falha depois de upload, tenta limpar somente a foto nova sem vínculo; a anterior permanece.

Livros continuam privados. Não altera compartilhamento, schema, RLS, fontes, cores, navegação ou as regras de notas/status existentes. Cancela cadastro mantendo o rascunho como antes.

## Arquivos

- src/components/cevai/BooksPanel.tsx
- src/lib/manage-book.ts
- src/lib/manage-book.test.ts
- src/test/books-save.test.tsx
- docs/melhorias-pendentes.md
- Este documento.

## Validação e ambiente real

19 cenários novos: edição por dono, preservar/trocar/remover foto, falha no upload/UPDATE, resposta perdida, conferência incerta, zero linhas, exclusão por dono com caminho atual, recusa na exclusão, limpeza falha, foto compartilhada por registros, pasta alheia, foto nula; UI preenche, atualiza, mantém campos, cancela e confirma exclusão.

227 testes passaram; TypeScript, build e diff --check passaram. Testes usam Supabase simulado, sem rede ou dados reais. O banco de produção não foi consultado nem alterado. As políticas por dono de books foram relatadas na auditoria, mas UPDATE/DELETE via backend real precisam ser confirmados na prévia. Não afrouxar políticas para contornar erro.

Após integrar, testar com livro de teste próprio: editar dados e reabrir; substituir/remover foto; cancelar exclusão e confirmar que livro existe; excluir definitivamente e confirmar que não aparece. Não usar um registro importante para o teste de exclusão. Se houver erro de permissão, conferir no Supabase se authenticated tem UPDATE/DELETE e se as políticas limitam pelo dono; qualquer ajuste no banco exige autorização separada.

## Limitações

Storage e banco não têm transação conjunta. Falha de comunicação após confirmar UPDATE/DELETE pode exibir erro apesar de alteração concluída; preserva arquivos em caso de dúvida. Limpeza pode ficar pendente sem tarefa automática. O editor pode ficar desatualizado após conflito de foto; fechar/reabrir atualiza. Não limpa órfãos antigos. Compartilhar livros e opiniões da comunidade continua na lista de melhorias. Sem publicação automática.
