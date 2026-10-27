-- Somente leitura: execute no SQL Editor do projeto para investigar o perfil.
select u.id, u.email, u.email_confirmed_at,
  om.organization_id, o.name as clinic, om.role as organization_role,
  mm.role as portal_role
from auth.users u
left join public.organization_members om on om.user_id = u.id
left join public.organizations o on o.id = om.organization_id
left join public.medsync_memberships mm on mm.user_id = u.id
  and (om.organization_id is null or mm.organization_id = om.organization_id)
where lower(u.email) = 'joao.p.ribeiro23@aluno.senai.br';

select id, organization_id, email, role, status, invited_user_id
from public.medsync_invitations
where lower(email) = 'joao.p.ribeiro23@aluno.senai.br'
order by created_at desc;

select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'medsync_accept_invitations';
