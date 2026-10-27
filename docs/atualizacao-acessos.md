# Publicar a atualização de acessos

Os arquivos foram verificados localmente. A aplicação remota do SQL e o deploy da função não são feitos pelo build da Vercel.

## Ordem de publicação

1. Com a migração de portais 0004 instalada, execute o conteúdo inteiro de `supabase/migrations/202610220005_hardening_and_commercial.sql` em uma nova consulta no SQL Editor. Não misture com versões antigas abertas em outras abas.
2. Execute `supabase/migrations/202610270006_invitation_lifecycle.sql`.
3. Execute `supabase/migrations/202610270007_organization_member_read.sql`. Ela permite que membros vejam a clínica à qual pertencem, necessária para carregar o portal do paciente.
4. Execute `supabase/migrations/202610270008_automatic_portal_link.sql`. Ela associa automaticamente a conta ao único cadastro ativo da clínica com o mesmo e-mail, tanto no aceite quanto quando o cadastro é criado depois.
5. Republique a Edge Function `invite-user` com `supabase/functions/invite-user/index.ts` atualizado.
6. Publique o frontend atualizado na Vercel, incluindo `vercel.json`.
7. Caso o 0005 emita o aviso de propriedade do Storage, configure as políticas pelo painel conforme [supabase-storage.md](supabase-storage.md). Isso afeta anexos; os convites são independentes.

Faça os passos 2–6 juntos: a nova versão usa RPCs e colunas da migração 0006, a 0007 libera a leitura necessária da clínica e a 0008 automatiza os vínculos. A aceitação antiga é revogada para que convites cancelados ou expirados não possam ser aceitos pela função anterior.

## Endereços de produção

Mantenha `APP_URL=https://medsync-smoky.vercel.app` nos Secrets da função, e Site URL com o mesmo domínio em Authentication → URL Configuration.

Autorize as URLs de retorno de convite (incluindo o identificador na query):

```text
https://medsync-smoky.vercel.app/aceitar-convite**
https://medsync-smoky.vercel.app/redefinir-senha
https://medsync-smoky.vercel.app/onboarding
```

O template de convite deve usar `{{ .ConfirmationURL }}` no link para verificar o e-mail antes do retorno. Não substitua pelo endereço simples da landing page. Não compartilhe os tokens do link.

## Comportamento

- Um convite pode ser criado na página de detalhes do paciente/profissional, ou no formulário de convites selecionando o cadastro.
- Ao aceitar, a conta recebe exclusivamente o perfil do convite. Se não houver cadastro escolhido no convite, a clínica associa automaticamente a conta ao único cadastro ativo do mesmo tipo com e-mail correspondente. Se o cadastro for criado depois, o vínculo é feito nesse momento. Duplicidades não são associadas automaticamente e podem ser revisadas na gestão de usuários.
- Convites têm validade de 7 dias; reenvios renovam a validade. Há intervalo de 60 segundos entre tentativas, além dos limites do Supabase/SMTP.
- Cancelar impede aceitar o convite. Um novo convite é independente; o anterior continua cancelado. Isso não exclui contas do Auth.
- Reenvios para um destinatário já verificado, com identidade registrada no convite pendente, usam a recuperação de acesso para permitir concluir o aceite. Contas existentes sem essa identidade registrada continuam exigindo revisão administrativa.
- A lista diferencia enviado, aceito, acesso liberado, falha, expirado e cancelado. Acesso liberado significa vínculo cadastral concluído; suspensão é exibida separadamente nos controles do usuário.
- Para aparecer no portal, cada pagamento precisa estar associado ao cadastro correto do paciente. O formulário exige essa seleção nos novos lançamentos. Pagamentos antigos sem `patient_id` não podem ser associados com segurança por nome ou descrição e precisam ser conferidos pela clínica.
- Administradores podem alterar o perfil de portal e suspender/reativar o acesso. Trocar o perfil remove o vínculo anterior para evitar acesso ao cadastro errado. Este fluxo não promove nem rebaixa administradores da organização.
- Perfis conflitantes bloqueiam o acesso e exigem revisão no banco. A atualização não corrige automaticamente contas antigas com papel administrativo indevido.
- As próximas alterações de convites, perfis e vínculos ficam no histórico de acessos. O histórico anterior à migração não é reconstruído.
- A agenda verifica disponibilidade, duração e descanso de 10 minutos. Gravações de consultas da mesma clínica são serializadas no banco antes da validação. Os testes locais verificam sobreposição e disponibilidade; não substituem um teste de concorrência no PostgreSQL remoto.
- Formulários de cadastro avisam antes de sair com alterações não salvas; salvar com sucesso permite continuar sem aviso.

## Conferência após publicar

Use contas de teste de paciente e profissional: envie pelo cadastro, aceite pelo e-mail mais recente e confira o portal correspondente e os dados pessoais. Cancele outro convite e confirme que não é aceito. Suspenda uma conta de teste e confirme que os registros ficam indisponíveis. Não use dados reais de pacientes nessas verificações.

Para investigar uma conta com perfil incorreto, consulte `supabase/diagnose-invitation.sql`, ajustando o e-mail. Esse arquivo apenas lê os vínculos; não altera administradores.
