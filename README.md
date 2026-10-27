# MedSync

Aplicação React + Vite com Supabase, com apresentação pública e workspaces para administração, paciente, profissional e recepção.

## Executar

```sh
npm install
npm run dev
```

Configure `.env.local` na raiz usando `.env.example`. Use somente a URL do projeto e a chave pública no navegador. As variáveis existentes foram preservadas. O cliente utiliza a URL base, sem `/rest/v1`.

O projeto utiliza o carregador nativo de configuração do Vite para evitar problemas com o carregamento de dependências nativas no Windows.

## Estrutura

- `src/components/AppShell.tsx`: navegação agrupada, menu mobile, conta e busca de páginas com Ctrl/Cmd+K.
- `src/components/Overview.tsx`: dashboard com indicadores, agenda e gráfico derivados dos registros carregados.
- `src/components/ScheduleCalendar.tsx`: agenda com seleção de semana, dia e profissional.
- `src/components/PortalAccess.tsx`: vínculo entre conta convidada e cadastro clínico.
- `src/pages/WorkspacePage.tsx`: organização autenticada, acesso administrativo e cadastros.
- `src/pages/PortalPage.tsx`: navegação e operações por perfil.
- `src/pages/AdminPages.tsx`: clínica, segurança e relatórios.
- `src/pages/UsersPage.tsx`: convites, filtros, paginação e feedback de envio.
- `src/pages/LandingPage.tsx`, `AuthPage.tsx` e `CreateClinicPage.tsx`: apresentação pública, acesso e configuração inicial.
- `src/index.css`: estilos compartilhados e regras responsivas.
- `public/images`: imagens geradas para a identidade visual; detalhes em `docs/design.md`.

## Páginas

Administração (`/app` e `/admin`): dashboard, agenda, fila, pacientes, profissionais, especialidades, serviços, convênios, unidades, disponibilidade, registros clínicos, pagamentos, contas a receber e pagar, usuários, perfil e configurações.

Novas páginas administrativas: `/app/minha-clinica`, `/app/seguranca`, `/app/relatorios-atendimentos`, `/app/relatorios-financeiro` e `/app/fluxo-caixa`.

Paciente (`/paciente`): resumo, consultas, solicitação de consulta, histórico, receitas, exames, atestados, documentos, pagamentos, perfil e segurança.

Profissional (`/profissional`): resumo, agenda, fila, pacientes associados, disponibilidade, prontuários, receitas, exames, atestados, documentos, perfil e segurança.

Recepção (`/recepcao`): resumo, agenda, fila, consultas, pacientes, pagamentos, perfil e segurança.

Os perfis são lidos do banco. Após o login, a aplicação redireciona para o portal adequado. Um endereço de portal não altera as permissões do usuário.

## Ativar os portais no Supabase existente

A configuração existente usa `organizations`, `organization_members`, `clinic_units`, `medsync_records`, `medsync_memberships`, `medsync_invitations` e as funções administrativas já instaladas no projeto. A criação inicial continua chamando `create_clinic(p_name, p_unit_name)`.

1. Execute **`supabase/migrations/202610220004_portals.sql`** no SQL Editor. A migração pressupõe que a estrutura dos cadastros e convites das etapas anteriores esteja instalada. Ela pode ser executada novamente sem excluir os dados.
2. O administrador pode cadastrar a pessoa em Pacientes ou Profissionais antes ou depois do aceite do convite, usando o mesmo e-mail da conta.
3. Após aceitar o convite, a conta é associada automaticamente quando há um único cadastro ativo com esse e-mail na clínica. Se o cadastro for criado depois, o vínculo também é feito automaticamente. Cadastros duplicados ou com e-mails diferentes precisam de revisão em **Usuários e convites → Usuários vinculados à clínica**.
4. Ao entrar, o convidado será direcionado para o portal do seu perfil. Sem correspondência única, nenhuma informação clínica é liberada até a revisão.

Para instalações existentes, aplique também as migrações 0005, 0006, 0007 e 0008 conforme [atualizacao-acessos.md](docs/atualizacao-acessos.md). A 0007 permite que membros autenticados leiam as clínicas às quais já pertencem, para abrir o portal; a 0008 associa contas e cadastros automaticamente pelo e-mail.

A migração foi validada em PostgreSQL local isolado. **Não foi aplicada remotamente por este trabalho.** Ela não redefine senhas nem altera administradores, credenciais ou configurações de SMTP.

Pacientes leem o próprio cadastro e registros relacionados permitidos; não recebem acesso ao prontuário de evolução. Pagamentos aparecem no portal somente quando associados ao cadastro correto do paciente. Profissionais leem pacientes associados às suas consultas e os registros clínicos atribuídos a eles. A recepção não tem acesso aos registros clínicos. Os controles estão em RLS e funções do banco, além da navegação da aplicação.

Registros clínicos novos exigem a seleção do profissional responsável. Para tornar um registro antigo visível no portal do profissional, o administrador precisa atribuí-lo explicitamente. Novos pagamentos exigem a seleção do paciente; lançamentos antigos sem `patient_id` não podem ser associados com segurança automaticamente e precisam ser conferidos. Não há correspondência automática por nome ou e-mail para lançamentos financeiros.

## Convites e e-mails

Para publicar as melhorias de convites, perfis, auditoria e proteção de formulários, siga [a ordem de atualização](docs/atualizacao-acessos.md). O `0005` preserva o nome instalado do parâmetro de `medsync_is_admin`; quando a conexão não é dona de `storage.objects`, as políticas de anexos são configuradas pelo painel, sem bloquear o restante da migração.

A lista de convites oferece reenvio direto para convites pendentes ou com falha. A seção de vínculos permite buscar por nome/e-mail, filtrar contas aguardando cadastro e atualizar os dados. Ao iniciar um cadastro pela conta convidada, nome e e-mail vêm preenchidos e o salvamento retorna à lista de vínculos; a associação permanece explícita. No portal, o usuário pode verificar se a clínica já liberou seu acesso sem sair da conta.

Em `/aceitar-convite`, a pessoa define a senha, marca a confirmação de que deseja entrar na clínica e clica em **Aceitar convite e entrar na clínica**. A nova função `medsync_accept_invitation` valida identidade, perfil, validade e cancelamento e cria o vínculo antes de abrir o portal correspondente. Sem sessão válida, a página orienta abrir o link do e-mail.

O envio utiliza a Edge Function `invite-user` e o Supabase Auth. A função valida a sessão e o papel administrativo na organização antes de usar as credenciais de servidor. Nunca coloque uma chave secret/service_role em variável VITE.

O ambiente da função usa `APP_URL` como endereço do aplicativo. Configure no Supabase Auth a URL do site e os redirects `/aceitar-convite`, `/redefinir-senha` e `/onboarding`. O endereço deve refletir a porta real do desenvolvimento; em produção, use o domínio publicado. Um link `localhost` só aponta para o computador de quem abre o convite.

Os dados de SMTP ficam no painel do Supabase. O redesenho preserva a configuração de e-mail já realizada.

A função local inclui códigos de erro detalhados e logs do servidor. Para disponibilizar mudanças feitas nesse arquivo, republique a função no Supabase. A publicação remota não é feita automaticamente pelo build do frontend. Não foram enviados convites reais durante os testes deste trabalho.

## Limites atuais

- Consultas solicitadas pelo paciente dependem de confirmação da clínica, disponibilidade cadastrada e intervalo de descanso. O banco valida duração e sobreposição; solicitações do portal usam duração inicial de 30 minutos.
- Documentos aceitam anexos privados com as políticas de Storage configuradas. Emissão assinada e assinatura digital não foram implementadas.
- Pagamentos são lançamentos; não existe processamento de cartão, Pix ou cobrança de assinatura.
- Registros e convites são carregados em lotes para busca, indicadores e relatórios; conjuntos muito grandes ainda precisam de paginação e filtros no servidor. O histórico de acessos mostra até 50 eventos recentes.
- Recebimentos no fluxo de caixa são pagamentos marcados como pagos; despesas são contas a pagar marcadas como pagas. Contas a receber são separadas para evitar somar o mesmo recebimento duas vezes.
- Alterações de registros e acessos têm histórico no banco. Notificações externas, MFA, assinatura digital e cobrança de assinaturas continuam fora desta implementação.
- Reenvio, validade e cancelamento de convites estão disponíveis. Contas já confirmadas sem identidade registrada no convite pendente ainda requerem revisão administrativa.
- A clínica selecionada é preservada no navegador; ao aceitar, a organização do convite passa a ser selecionada.

## Validação

A agenda permite selecionar uma data, buscar por paciente e filtrar a situação. O agendamento iniciado nela preserva o dia e o profissional escolhidos e começa às 09:00, horário que pode ser ajustado antes de salvar. A duração pode ser informada no cadastro da consulta; quando há serviço selecionado, vale a duração do serviço. Novos cadastros sugerem a situação inicial e os seletores de novos agendamentos omitem cadastros inativos.

Os portais de paciente, profissional e recepção oferecem atualização manual dos dados, filtros de data/situação para consultas e busca por nomes de pacientes/profissionais nos registros autorizados. O resumo mostra consultas futuras e atendimentos em espera/em andamento hoje. Pacientes e profissionais têm atalhos para documentos recentes; a recepção tem atalhos para fila, cadastros e agendamento. Nenhuma consulta adicional amplia as permissões: os cartões usam os registros já autorizados pelo banco. As telas são verificadas em desktop e celular para os quatro perfis.

A verificação de clínicas usa os vínculos administrativos e de portal em conjunto, incluindo suspensão e conflito de papéis. Contas convidadas não são encaminhadas para criar outra clínica. A troca de clínica está disponível também nos portais e avisa se houver formulário não salvo. Erros inesperados exibem uma tela de recuperação; falhas de carregamento de registros podem ser repetidas na própria tela.

```sh
npm run build
npm test
node tests/invite-user.test.mjs
node tests/auth-redirect.test.mjs
```

Para reproduzir os testes adicionais sem adicionar dependências ao aplicativo:

```sh
npm install --prefix .tmp/validation --no-save --package-lock=false @playwright/test @electric-sql/pglite
node tests/portal-permissions.mjs
node tests/invitation-lifecycle.mjs
node tests/browser.mjs
```

O teste de banco usa PostgreSQL local via PGlite e confere a migração, as permissões, tentativas de forjar autor/perfil, isolamento entre organizações e solicitações/cancelamentos de consultas.

O teste de navegador usa Chrome instalado no Windows e `http://localhost:5174`. Todas as chamadas ao Supabase são simuladas, incluindo autenticação. Não utiliza dados de pacientes nem envia e-mails. Capturas locais ficam em `.tmp/screenshots`, pasta ignorada pelo projeto. O teste não substitui uma validação com contas de teste e a migração aplicada ao Supabase remoto.
