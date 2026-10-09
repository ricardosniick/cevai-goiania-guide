# Fotos compartilhadas: corrigir a causa, preservar o fluxo

## Causa comprovada

A regra de leitura compartilhada permite SELECT sobre arquivos de experiências públicas. No Storage, SELECT também autoriza a geração de URLs assinadas. Um usuário logado podia pedir um prazo maior diretamente, mesmo que o app pedisse apenas cinco minutos. Diminuir o prazo no cliente não resolvia essa possibilidade.

## Correção proposta

- `loadExperiences` só gera URLs assinadas para fotos do próprio usuário. Fotos compartilhadas retornam caminhos para download autenticado, sem token compartilhável.
- `SharedExperiencePhoto` usa o cliente Supabase com a sessão atual e `download(path, {}, { cache: "no-store", signal })`. O resultado é uma URL Blob local, liberada ao sair da tela ou trocar de conta. Falha de acesso não reutiliza uma foto antiga.
- A migração 0019 acrescenta uma política SELECT **restritiva**, que exige `storage.object.get_authenticated` para terceiros nesse bucket. Ela não concede acesso: a política existente continua exigindo experiência pública, mesmo dono e pasta correta.
- O dono mantém leitura, assinatura, envio e exclusão como antes. Livros privados, Google Places, estilos, classes de imagem e navegação não mudam.
- O cache de experiências do lugar passa a ser separado por conta. A lista com fotos compartilhadas recarrega a cada quatro minutos enquanto a tela estiver em primeiro plano; isso atualiza a tela, não é a autorização do arquivo.

Fontes oficiais consultadas:

- [Helpers de operações do Storage](https://supabase.com/docs/guides/storage/schema/helper-functions)
- [Nomes das operações](https://github.com/supabase/storage/blob/master/src/http/routes/operations.ts)
- [Download autenticado e consulta RLS antes de servir o objeto](https://github.com/supabase/storage/blob/master/src/http/routes/object/getObject.ts)
- [URLs assinadas e revogação](https://supabase.com/docs/guides/storage/serving/downloads)
- [Cache e URLs assinadas no Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn)

Os nomes vêm da implementação oficial atual. A existência dos helpers no banco conectado foi confirmada na auditoria, mas a versão efetiva do serviço HTTP ainda precisa ser validada: existência da função não prova o contexto enviado pelo endpoint.

## Ordem segura, sem execução automática

1. Validar instalação com o lockfile congelado, testes, tipos e build deste PR.
2. Integrar/publicar o cliente de download autenticado e testar com duas contas existentes: A abre suas fotos e livros; B abre uma experiência compartilhada de A. O novo cliente funciona com as regras antigas, pois download já é autorizado por SELECT.
3. Antes da migração, conferir bucket privado, RLS, permissões do helper, as quatro políticas auditadas e que o serviço usa `storage.object.get_authenticated`. Se a operação não for reconhecida, parar e adaptar o guard; não ampliar a leitura.
4. Com autorização específica, executar somente 0019 numa transação. Não criar novas contas ou arquivos nem alterar registros reais automaticamente.
5. Testar B baixando a foto pública, B tentando criar URL assinada simples/em lote, B tentando ler foto privada, A abrindo livros/fotos e visitante sem sessão. Tornar privada uma experiência de teste exige autorização do dono; o próximo download de B deve falhar. Não imprimir tokens nem URLs assinadas nos resultados.
6. Registrar resultado real, versão do Storage e horário. Rodar novamente o scan e conferir o achado específico, sem ignorá-lo automaticamente.

`scripts/test-shared-photo-guard.mjs` executa a migração e a reversão num banco PGlite vazio com usuários/contextos simulados. Exemplo, com PGlite já instalado:

```sh
PGLITE_MODULE=/caminho/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-shared-photo-guard.mjs
```

O roteiro não contém credenciais nem acessa rede. Não instala dependências no app. Testa a combinação de políticas e as operações simuladas, **não** o serviço HTTP real.

## Reversão

`docs/sql/0019_shared_photo_authenticated_download_rollback.sql` remove somente o guard. O cliente de download autenticado continua compatível com as regras anteriores. Reverter o guard reabre a possibilidade de terceiros gerarem URLs assinadas; não fazê-lo por conveniência nem executar automaticamente.

Para reverter o cliente para a versão que assina fotos de terceiros, primeiro remover o guard com autorização; caso contrário essas fotos não carregarão no cliente antigo. Não existe deploy automático neste PR.

## Limites que precisam ficar explícitos

- O guard impede **novas** assinaturas por terceiros. URLs emitidas antes continuam com sua validade original; o CDN pode manter cópias além da expiração do token. Não se deve declarar revogação retroativa. Confirmar comportamento/configuração com Supabase e, se necessário, solicitar invalidação ao suporte. Não apagar arquivos existentes automaticamente.
- Uma foto já baixada, capturada ou enviada pelo dono não pode ser retirada do dispositivo de outra pessoa. Ao tornar privada, o endpoint deve bloquear **novos downloads**; a lista pode levar até quatro minutos para atualizar enquanto estiver aberta.
- O dono ainda pode assinar e compartilhar seus próprios arquivos. Um link emitido pelo dono também não é revogado pela mudança de visibilidade.
- Clientes antigos podem perder fotos comunitárias depois do guard. Validar a versão publicada e orientar recarregar a página antes da aplicação.
- Download Blob carrega o arquivo completo em memória, como o navegador faria para exibir a imagem; o bucket limita cada arquivo a 10 MB. Os objetos locais são liberados ao desmontar. Não há cache persistente de fotos compartilhadas.
- A validação isolada não substitui testes reais de sessão, Storage e cache. Não declarar a falha encerrada antes dessas verificações.
