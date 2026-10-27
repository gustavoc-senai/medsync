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
2. O paciente ou profissional aceita o convite e define a senha pelo e-mail.
3. Como administrador, cadastre a pessoa em Pacientes ou Profissionais.
4. Em **Usuários e convites → Usuários vinculados à clínica**, associe a conta ao cadastro correto.
5. Ao entrar, o convidado será direcionado para o portal do seu perfil. Sem vínculo, nenhuma informação clínica é liberada.

A migração foi validada em PostgreSQL local isolado. **Não foi aplicada remotamente por este trabalho.** Ela não redefine senhas nem altera administradores, credenciais ou configurações de SMTP.

Pacientes leem o próprio cadastro e registros relacionados permitidos; não recebem acesso ao prontuário de evolução. Profissionais leem pacientes associados às suas consultas e os registros clínicos atribuídos a eles. A recepção não tem acesso aos registros clínicos. Os controles estão em RLS e funções do banco, além da navegação da aplicação.

Registros clínicos novos exigem a seleção do profissional responsável. Para tornar um registro antigo visível no portal do profissional, o administrador precisa atribuí-lo explicitamente. Pagamentos podem ser associados a um paciente para aparecer no portal correspondente. Não há correspondência automática por nome ou e-mail.

## Convites e e-mails

Em `/aceitar-convite`, a pessoa define a senha, marca a confirmação de que deseja entrar na clínica e clica em **Aceitar convite e entrar na clínica**. A função existente `medsync_accept_invitations` só é chamada após esse envio. Sem sessão válida, a página orienta abrir o link do e-mail. A validação definitiva do convite e a criação do vínculo continuam sob responsabilidade dessa função no banco.

O envio utiliza a Edge Function `invite-user` e o Supabase Auth. A função valida a sessão e o papel administrativo na organização antes de usar as credenciais de servidor. Nunca coloque uma chave secret/service_role em variável VITE.

O ambiente da função usa `APP_URL` como endereço do aplicativo. Configure no Supabase Auth a URL do site e os redirects `/aceitar-convite`, `/redefinir-senha` e `/onboarding`. O endereço deve refletir a porta real do desenvolvimento; em produção, use o domínio publicado. Um link `localhost` só aponta para o computador de quem abre o convite.

Os dados de SMTP ficam no painel do Supabase. O redesenho preserva a configuração de e-mail já realizada.

A função local inclui códigos de erro detalhados e logs do servidor. Para disponibilizar mudanças feitas nesse arquivo, republique a função no Supabase. A publicação remota não é feita automaticamente pelo build do frontend. Não foram enviados convites reais durante os testes deste trabalho.

## Limites atuais

- Consultas solicitadas pelo paciente dependem de confirmação da clínica. A solicitação não calcula sobreposição por duração nem garante aderência à disponibilidade cadastrada.
- Receitas, exames, atestados e documentos são registros textuais/referências internas. Upload de arquivos, emissão assinada e assinatura digital não foram implementados.
- Pagamentos são lançamentos; não existe processamento de cartão, Pix ou cobrança de assinatura.
- Listas de registros carregam no máximo 1.000 itens, com indicação ao atingir esse limite. Busca, indicadores, relatórios e CSV consideram os dados carregados. O histórico de convites carrega 100 itens.
- Recebimentos no fluxo de caixa são pagamentos marcados como pagos; despesas são contas a pagar marcadas como pagas. Contas a receber são separadas para evitar somar o mesmo recebimento duas vezes.
- Auditoria clínica, versionamento de prontuário, notificações externas, MFA e gestão de assinaturas continuam fora desta implementação.
- Convites pendentes podem ser reenviados pelo formulário usando o mesmo e-mail e perfil, reutilizando o registro existente. Falhas no reenvio preservam o convite anterior. Os limites de envio do Supabase/SMTP continuam valendo. Contas com e-mail já confirmado no Auth e revogação por interface ainda requerem um fluxo específico.
- A seleção da organização usa o primeiro vínculo encontrado. Não foi acrescentado um seletor de múltiplas organizações.

## Validação

```sh
npm run build
node tests/invite-user.test.mjs
```

Para reproduzir os testes adicionais sem adicionar dependências ao aplicativo:

```sh
npm install --prefix .tmp/validation --no-save --package-lock=false @playwright/test @electric-sql/pglite
node tests/portal-permissions.mjs
node tests/browser.mjs
```

O teste de banco usa PostgreSQL local via PGlite e confere a migração, as permissões, tentativas de forjar autor/perfil, isolamento entre organizações e solicitações/cancelamentos de consultas.

O teste de navegador usa Chrome instalado no Windows e `http://localhost:5174`. Todas as chamadas ao Supabase são simuladas, incluindo autenticação. Não utiliza dados de pacientes nem envia e-mails. Capturas locais ficam em `.tmp/screenshots`, pasta ignorada pelo projeto. O teste não substitui uma validação com contas de teste e a migração aplicada ao Supabase remoto.
