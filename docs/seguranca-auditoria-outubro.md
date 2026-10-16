# Auditoria de segurança e dados — outubro/2026

Revisão do código (servidor, cliente) e do banco publicado (RLS, permissões, funções, Storage), feita só com leitura. Nada foi alterado no banco.

## O que está bem

- **Dados privados:** livros, salvos, perfil e experiências privadas só são lidos pelo dono (RLS por `auth.uid()`). Experiências nascem privadas (`is_public = false`).
- **Lugares:** `places` só é gravado pelo servidor com dados do Google; usuários só leem.
- **Funções sensíveis:** `hit_rate_limit`, `reserve_global_budget`, `post_situation`, `upsert_presence` e as do recurso social não podem ser chamadas por `anon`/`authenticated`.
- **Funções SECURITY DEFINER** abertas a usuários (`update_experience`, estatísticas, `place_situation_now`) conferem dono ou só devolvem dados públicos agregados, com `search_path` fixo.
- **Servidor:** toda função paga exige login (ou Turnstile para visitantes), limite por pessoa e orçamento global; entradas validadas com zod; CSRF ativo para server functions.
- **Assistente de IA:** só devolve ids que vieram da busca do Google (`parsePicks`); texto do modelo é exibido como texto.
- **Segredos:** o `.env` do repositório só tem chaves públicas (publishable/browser). Chaves de servidor ficam nos segredos do Lovable.
- **Bucket de fotos:** privado, 10 MB por arquivo, pasta por usuário.

## Problemas encontrados

| # | Gravidade | Problema | Correção |
|---|-----------|----------|----------|
| 1 | Média | Em `experience_scores`, a política `ALL` aceita no USING linhas de experiências públicas de outras pessoas, e o WITH CHECK só olha a linha nova. Um usuário logado consegue, pela API, mover uma nota de critério da experiência pública de outra pessoa para uma experiência sua (a nota some da experiência original). Apagar já é bloqueado por política restritiva. | Política restritiva de UPDATE só para o dono. |
| 2 | Média | Limites de tamanho (comentário 2000, critério 60) só existem dentro das funções. INSERT/UPDATE direto pela API grava textos de qualquer tamanho, inclusive em experiências públicas que outros veem. O mesmo vale para `profiles.full_name`/`avatar_url`. | CHECKs no banco (dados atuais já cabem). |
| 3 | Média | O bucket `experience-photos` aceita qualquer tipo de arquivo. Um SVG ou HTML enviado como "foto" e compartilhado é servido para outras pessoas. | `allowed_mime_types` só com imagens comuns. |
| 4 | Média | A política restritiva de download autenticado (migração 0019 de fotos compartilhadas) **ainda não está aplicada** no banco publicado. Hoje um usuário logado ainda pode gerar link assinado de longa duração para fotos compartilhadas por outras pessoas. | Seguir `docs/seguranca-fotos-download-autenticado.md` e aplicar a 0019. |
| 5 | Média (dados) | Existe um backup completo do banco (`cevai-goiania-guide_261007.backup`, 07/10) no bucket `database_export_07_10_26`. Está privado, mas é uma cópia com dados pessoais guardada sem necessidade. | **Não apagar ainda.** Primeiro confirmar o que o arquivo contém e se existe outro backup válido; só então decidir. |
| 6 | Baixa | Barraquinhas, experiências e salvos não têm limite de criação por pessoa; dá para encher o banco com spam. | Limite por usuário (ex.: gatilho com `rate_events`), em etapa futura. |
| 7 | Baixa | "Situação agora" confia no GPS enviado pelo aparelho; GPS falso consegue publicar. Limitação conhecida de qualquer geofence no cliente; já há limite de frequência. | Aceitar e monitorar denúncias. |
| 8 | Baixa | Os logs de busca registram o texto pesquisado. Não tem identificação da pessoa, mas é dado de uso. | Opcional: remover `query` do log. |

## SQL pronto para revisão

- `docs/sql/seguranca_reforco_dados_NAO_APLICADO.sql` — itens 1, 2 e 3, com checagens antes de mudar.
- `docs/sql/seguranca_reforco_dados_REVERSAO.sql` — desfaz tudo.

Aplicar só com autorização, numa transação, depois de testar registrar, editar e compartilhar uma experiência com foto.

## Não verificado aqui

- Configurações de Auth (proteção contra senhas vazadas, confirmação de e-mail, URLs de redirecionamento) — conferir no painel do Cloud.
- Restrição da chave do Google Maps do navegador por domínio — conferir no Google Cloud.
- Auditoria de dependências (`npm audit`): o lockfile aponta para o registro privado do Lovable e não pôde ser lido neste ambiente.
