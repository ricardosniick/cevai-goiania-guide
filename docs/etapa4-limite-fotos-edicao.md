# Etapa 4 — limite de fotos na edição

Causa: addFiles limitava apenas a lista de fotos novas a cinco, embora a interface contasse fotos mantidas e novas juntas. Selecionar um lote de cinco com duas fotos mantidas criava um total de sete.

Correção: a seleção agora usa a capacidade restante (cinco menos fotos mantidas), preserva primeiro os arquivos já selecionados e mantém a filtragem por imagem e tamanho máximo de 10 MB. O botão usa a mesma constante de limite. Cadastro novo continua permitindo cinco. Fotos antigas não são apagadas ou modificadas.

Arquivos: src/routes/index.tsx, src/lib/experience-photo-selection.ts, src/lib/experience-photo-selection.test.ts, este documento e docs/melhorias-pendentes.md (lista solicitada para os livros e melhorias já discutidas).

Validação: cinco testes novos cobrem lote na edição, arquivos selecionados previamente, cadastro novo, arquivos inválidos e vaga aberta ao remover uma foto. 208 testes do app passaram; TypeScript, build e diff --check passaram. Sem chamadas pagas ou alterações no banco.

Limitações: validação de quantidade é do formulário, não uma cota imposta pelo banco. Clientes externos podem tentar inserir mais registros sob as políticas existentes. Experiências antigas que já excedam cinco não são corrigidas automaticamente. Falhas de upload, limpeza e criação com resposta perdida continuam registradas nas outras correções da Etapa 4.

Não exige SQL, mudança no Supabase ou Google Cloud. Teste real após integração na prévia: editar uma experiência com duas fotos, selecionar cinco novas e conferir que só três são adicionadas; salvar e reabrir. Nenhuma publicação automática.
