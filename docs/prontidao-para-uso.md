# Prontidão para uso: evidências e pendências

Esta lista descreve o estado revisado em 09/10/2026. Não significa que o app esteja livre de todos os defeitos. A liberação deve usar os resultados reais do ambiente publicado, não apenas o número de testes ou a cor do scanner.

| Item | Evidência disponível | O que falta para encerrar |
| --- | --- | --- |
| Dependências vulneráveis | PR #11 integrado; scanner informado pelo usuário mostra zero problemas conhecidos | Manter lockfile congelado e scans periódicos |
| Consultas pagas de visitantes | PR #12 integrado; limites próprios e globais, erros bloqueiam, testes sem Google | Monitorar consumo real e testar visitante/logado na versão publicada; robôs ainda podem gastar a cota compartilhada |
| Catálogo `places` | Só dados de lugares; leitura intencional; escrita do servidor, RLS ativo conforme auditoria | Conferir novamente privilégios efetivos e colunas no banco atual; documentar leitura de catálogo no achado |
| Catálogo `fair_stalls` | Migração 0018 informada como aplicada; `created_by` ilegível para autenticado, seis colunas de catálogo legíveis, escrita restrita ao criador | Testar cadastro/edição/exclusão de uma barraquinha com autorização, e negativa para outra conta; rever o achado atualizado |
| Fotos privadas | Bucket privado; vínculo/pasta/dono protegidos por P1; compartilhamento restrito por P3 | Testar duas contas no Storage real e confirmar que nenhum endpoint alternativo expõe fotos privadas |
| URLs de fotos compartilhadas | Novo cliente + guard 0019 preparados, testes isolados | Publicar cliente, validar operação HTTP, autorizar/aplicar guard, testar e tratar URLs antigas/cache; ainda não encerrado |
| Experiências e livros | Correções anteriores informadas como testadas/publicadas, gravação atômica/idempotente de experiência | Repetir fluxos reais criar/editar/excluir, com e sem fotos, falha de rede e tentativa de acesso de outra conta |
| Localização e coordenadas | Código contém geofence e atualização de `coords_fetched_at` | Etapa 5 ainda pendente: revisar posição antiga/precisão, cron de expiração ativo no banco, limites de área e paginação |

## Validação mínima antes de ampliar o público

- Visitante: entrar por “Explorar sem entrar”, buscar, mapa, detalhes; salvar/registrar pede conta. Cota visitante não deve impedir consulta de uma conta logada enquanto houver saldo global.
- Autenticado: login, recuperação de senha, salvar/remover lugar; experiência privada por padrão, publicar/tornar privada, avaliar geral e critérios opcionais; fotos e livros criar/editar/excluir.
- Privacidade entre A/B: dados privados não aparecem para B; B não consegue editar/excluir dados de A; fotos compartilhadas abrem por download autenticado, fotos privadas e assinatura por terceiros são negadas depois do guard.
- Rede/custos: falha de limite não chama Google; reenvio de formulário não duplica experiência; erro de upload não remove arquivos confirmados; cotas exibem mensagens e o cache disponível continua funcionando.
- Celular: testar imagem compartilhada, retorno entre abas, troca de conta, rede lenta, GPS negado/impreciso e mapa sem coordenadas.

Não usar “Try to fix all” para trocar automaticamente acesso público de catálogo por acesso individual: isso pode quebrar feiras e lugares. Não ignorar alertas antes da análise e das evidências. Ausência de alertas também não substitui testes funcionais.

Google Cloud/Lovable: confirmar cotas e preços reais do conector, chave restrita ao servidor e às APIs usadas e alertas de orçamento. Os tetos atuais são quantidades por operação, não um valor monetário nem um limite de dez usuários.
