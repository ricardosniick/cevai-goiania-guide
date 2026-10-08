# Etapa 4 — compensação de upload sem vínculo

Causa: criação e edição enviavam o arquivo antes de inserir experience_photos. Uma falha no INSERT deixava o arquivo sem vínculo, sem tentativa de limpeza.

Correção: saveExperiencePhoto centraliza os dois fluxos. Após falha do vínculo, consulta o caminho único do arquivo: vínculo confirmado é preservado; ausência confirmada permite remover apenas esse arquivo; verificação inconclusiva preserva o arquivo. Nomes usam UUID para evitar colisões. O aviso de falha parcial e a experiência já salva permanecem como antes.

Arquivos: src/lib/experience-photo.ts, src/lib/experience-photo.test.ts, src/routes/index.tsx e este documento.

Validação: 190 testes passando (7 novos, Supabase simulado); TypeScript e build passando. Nenhuma chamada paga, alteração de banco ou publicação. Teste real de criação e edição com fotos ainda precisa ser feito na prévia após integração.

Limitações: armazenamento e banco não compartilham transação. Falhas de comunicação no upload, na conferência do vínculo ou na remoção podem deixar arquivos pendentes; a correção prefere preservar uma foto potencialmente válida. Não há limpeza automática periódica. Confiabilidade das notas, uploads de livros, exclusões e recuperação de registros parcialmente salvos ficam para correções separadas da Etapa 4.
