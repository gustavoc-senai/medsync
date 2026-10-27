# Configuração do Storage privado

O Supabase gerencia a tabela `storage.objects`. A migração 0005 configura as políticas automaticamente somente quando a conexão tem a propriedade/permissão necessária. Caso contrário, ela mostra um aviso e mantém o restante da atualização. Não altere o proprietário da tabela nem desative RLS.

Após aplicar o 0005, no painel Supabase abra **Storage → Policies → medsync-private → New policy → For full customization**. O bucket deve continuar **privado**. Crie ou atualize as quatro políticas abaixo, com papel **authenticated**:

| Nome | Operação | Expressão |
| --- | --- | --- |
| medsync_private_file_read | SELECT | `bucket_id = 'medsync-private' AND public.medsync_private_file_read(name)` |
| medsync_private_file_insert | INSERT | `bucket_id = 'medsync-private' AND public.medsync_private_file_write(name)` |
| medsync_private_file_update | UPDATE | `bucket_id = 'medsync-private' AND public.medsync_private_file_write(name)` |
| medsync_private_file_delete | DELETE | `bucket_id = 'medsync-private' AND public.medsync_private_file_write(name)` |

Em UPDATE, use a expressão tanto em **USING** quanto em **WITH CHECK**, se esses campos forem exibidos. Em INSERT, a expressão é **WITH CHECK**; SELECT e DELETE usam **USING**. Se uma política já existir, confira e edite em vez de duplicar.

Não adicione políticas com `true` ou acesso público. As funções verificam o registro, a clínica e as permissões do usuário. Sem essas políticas os arquivos devem permanecer inacessíveis ao cliente; não afeta a criação/aceitação de convites.
