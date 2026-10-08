# Etapa 4 — fotos de livros sem vínculo

Causa: BooksPanel enviava a foto e depois criava o livro. Uma falha no cadastro não removia o arquivo enviado.

Correção: saveBook mantém a ordem atual e centraliza a reconciliação. Após falha no INSERT, consulta books pelo caminho único (UUID) da foto. Livro encontrado preserva a foto e confirma sucesso; ausência confirmada permite remover somente esse arquivo. Se a consulta falhar, preserva a foto e mantém o formulário para nova tentativa. Mensagens, campos, notas, status, privacidade, design e navegação permanecem iguais.

Arquivos: src/lib/save-book.ts, src/lib/save-book.test.ts, src/components/cevai/BooksPanel.tsx, src/test/books-save.test.tsx e este documento.

Validação: 203 testes passaram (13 novos, Supabase simulado), incluindo upload/cadastro bem-sucedido, cadastro com erro retornado ou exceção, resposta perdida com livro confirmado, conferência inconclusiva, limpeza falha, upload rejeitado ou com exceção, manutenção do formulário e nova tentativa. TypeScript passa com a correção separada da duplicação de create_experience no arquivo de tipos. Build e diff --check passaram. Sem chamadas pagas ou acesso ao banco real.

Pré-requisito de checagem de tipos: integrar primeiro o PR separado da declaração duplicada create_experience, gerada pela união do tipo manual e do tipo atualizado após a migração 0016. Esta alteração de livros não inclui esse arquivo.

Teste real pendente após integração na prévia: registrar livro com foto; reabrir a seção e conferir; registrar outro sem foto. Não provocar erros no banco de produção para testar. Não exige SQL nem novas permissões.

Limitações: banco e storage não compartilham transação. Falha de upload com resultado desconhecido, falha de conferência ou de remoção ainda podem deixar arquivos. Sem foto, uma resposta perdida após INSERT pode causar duplicata numa nova tentativa; idempotência permanece pendente para livros e experiências. Não remove arquivos órfãos antigos nem adiciona limpeza periódica. Sem publicação automática.
