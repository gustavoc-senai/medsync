-- Requer medsync_records, medsync_memberships, medsync_invitations e medsync_is_admin.
-- Execute no SQL Editor. Não concede acesso anônimo nem altera os administradores existentes.
begin;
create table if not exists public.medsync_portal_links (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid not null references public.medsync_records(id) on delete cascade,
  role text not null check (role in ('patient','professional')),
  primary key (organization_id,user_id)
);
alter table public.medsync_portal_links enable row level security;
revoke all on public.medsync_portal_links from public,anon,authenticated;
grant select on public.medsync_portal_links to authenticated;
drop policy if exists portal_links_read on public.medsync_portal_links;
create policy portal_links_read on public.medsync_portal_links for select to authenticated
using (user_id=auth.uid() or public.medsync_is_admin(organization_id));

create or replace function public.medsync_link_portal_user(p_organization_id uuid,p_user_id uuid,p_record_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare member_role text;
begin
  if not public.medsync_is_admin(p_organization_id) then raise exception 'Acesso administrativo necessário'; end if;
  select role into member_role from public.medsync_memberships where organization_id=p_organization_id and user_id=p_user_id;
  if member_role not in ('patient','professional') or member_role is null then raise exception 'Usuário precisa aceitar um convite de paciente ou profissional'; end if;
  if not exists(select 1 from public.medsync_records where id=p_record_id and organization_id=p_organization_id and module=case when member_role='patient' then 'pacientes' else 'profissionais' end) then raise exception 'Cadastro incompatível ou de outra clínica'; end if;
  insert into public.medsync_portal_links(organization_id,user_id,record_id,role) values(p_organization_id,p_user_id,p_record_id,member_role)
  on conflict(organization_id,user_id) do update set record_id=excluded.record_id,role=excluded.role;
end;
$$;
create or replace function public.medsync_list_portal_users(p_organization_id uuid)
returns table(user_id uuid,email text,full_name text,role text,record_id uuid)
language plpgsql security definer set search_path='' as $$
begin
  if not public.medsync_is_admin(p_organization_id) then raise exception 'Acesso administrativo necessário'; end if;
  return query select m.user_id,u.email::text,coalesce(u.raw_user_meta_data->>'full_name',''),m.role,l.record_id
    from public.medsync_memberships m join auth.users u on u.id=m.user_id
    left join public.medsync_portal_links l on l.organization_id=m.organization_id and l.user_id=m.user_id
    where m.organization_id=p_organization_id;
end;
$$;
create or replace function public.medsync_portal_read(p_org uuid,p_id uuid,p_module text,p_payload jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare member_role text; linked uuid;
begin
  select m.role into member_role from public.medsync_memberships m where m.organization_id=p_org and m.user_id=auth.uid();
  if member_role='receptionist' then return p_module in ('pacientes','profissionais','consultas','disponibilidade','servicos','especialidades','convenios','pagamentos'); end if;
  select l.record_id into linked from public.medsync_portal_links l where l.organization_id=p_org and l.user_id=auth.uid() and l.role=member_role;
  if linked is null then return false; end if;
  if member_role='patient' then
    return (p_module='pacientes' and p_id=linked) or (p_module in ('consultas','receitas','exames','atestados','documentos','pagamentos') and p_payload->>'patient_id'=linked::text);
  end if;
  if member_role='professional' then
    if p_module='profissionais' and p_id=linked then return true; end if;
    if p_module in ('consultas','disponibilidade') then return p_payload->>'professional_id'=linked::text; end if;
    if p_module='pacientes' then return exists(select 1 from public.medsync_records r where r.organization_id=p_org and r.module='consultas' and r.payload->>'professional_id'=linked::text and r.payload->>'patient_id'=p_id::text); end if;
    if p_module in ('prontuario','receitas','exames','atestados','documentos') then return p_payload->>'professional_id'=linked::text; end if;
  end if;
  return false;
end;
$$;
create or replace function public.medsync_portal_write(p_org uuid,p_module text,p_payload jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare member_role text; linked uuid;
begin
  select m.role into member_role from public.medsync_memberships m where m.organization_id=p_org and m.user_id=auth.uid();
  if member_role='receptionist' then return p_module in ('pacientes','consultas','pagamentos'); end if;
  if member_role<>'professional' or member_role is null then return false; end if;
  select l.record_id into linked from public.medsync_portal_links l where l.organization_id=p_org and l.user_id=auth.uid() and l.role='professional';
  if linked is null or p_payload->>'professional_id' is distinct from linked::text then return false; end if;
  if p_module='disponibilidade' then return true; end if;
  if p_module in ('prontuario','receitas','exames','atestados','documentos') then
    return exists(select 1 from public.medsync_records r where r.organization_id=p_org and r.module='consultas' and r.payload->>'professional_id'=linked::text and r.payload->>'patient_id'=p_payload->>'patient_id');
  end if;
  return false;
end;
$$;
drop policy if exists portal_records_read on public.medsync_records;
create policy portal_records_read on public.medsync_records for select to authenticated using(public.medsync_portal_read(organization_id,id,module,payload));
drop policy if exists portal_records_insert on public.medsync_records;
create policy portal_records_insert on public.medsync_records for insert to authenticated with check(public.medsync_portal_write(organization_id,module,payload));
drop policy if exists portal_records_update on public.medsync_records;
create policy portal_records_update on public.medsync_records for update to authenticated using(public.medsync_portal_write(organization_id,module,payload)) with check(public.medsync_portal_write(organization_id,module,payload));
grant select,insert,update on public.medsync_records to authenticated;

create or replace function public.medsync_portal_catalog(p_organization_id uuid)
returns table(id uuid,payload jsonb) language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.medsync_memberships where organization_id=p_organization_id and user_id=auth.uid()) then raise exception 'Acesso negado'; end if;
  return query select r.id,jsonb_build_object('name',r.payload->>'name','specialty',r.payload->>'specialty') from public.medsync_records r
  where r.organization_id=p_organization_id and r.module='profissionais' and coalesce(r.payload->>'status','Ativo')<>'Inativo';
end;
$$;
create or replace function public.medsync_request_appointment(p_organization_id uuid,p_professional_id uuid,p_starts_at text)
returns uuid language plpgsql security definer set search_path='' as $$
declare patient uuid; result uuid;
begin
  select l.record_id into patient from public.medsync_portal_links l join public.medsync_memberships m on m.organization_id=l.organization_id and m.user_id=l.user_id
  where l.organization_id=p_organization_id and l.user_id=auth.uid() and l.role='patient' and m.role='patient';
  if patient is null then raise exception 'Seu cadastro de paciente precisa ser vinculado pela clínica'; end if;
  if p_starts_at !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' or p_starts_at::timestamp <= timezone('America/Sao_Paulo',now()) then raise exception 'Escolha uma data futura válida'; end if;
  if not exists(select 1 from public.medsync_records where id=p_professional_id and organization_id=p_organization_id and module='profissionais' and coalesce(payload->>'status','Ativo')<>'Inativo') then raise exception 'Profissional indisponível'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_professional_id::text || ':' || p_starts_at,0));
  if exists(select 1 from public.medsync_records where organization_id=p_organization_id and module='consultas' and payload->>'professional_id'=p_professional_id::text and payload->>'starts_at'=p_starts_at and coalesce(payload->>'status','')<>'Cancelada') then raise exception 'Este horário já possui uma consulta'; end if;
  insert into public.medsync_records(organization_id,module,payload) values(p_organization_id,'consultas',jsonb_build_object('patient_id',patient,'professional_id',p_professional_id,'starts_at',p_starts_at,'status','Agendada','notes','Solicitada pelo portal do paciente; confirmar disponibilidade com a clínica.')) returning id into result;
  return result;
end;
$$;
create or replace function public.medsync_portal_appointment_status(p_appointment_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.medsync_records; linked uuid; member_role text;
begin
  select * into item from public.medsync_records where id=p_appointment_id and module='consultas' for update;
  if not found then raise exception 'Consulta não encontrada'; end if;
  select m.role into member_role from public.medsync_memberships m where m.organization_id=item.organization_id and m.user_id=auth.uid();
  select l.record_id into linked from public.medsync_portal_links l where l.organization_id=item.organization_id and l.user_id=auth.uid() and l.role=member_role;
  if member_role='patient' and linked::text=item.payload->>'patient_id' and p_status='Cancelada' and item.payload->>'status' in ('Agendada','Confirmada') then null;
  elsif member_role='professional' and linked::text=item.payload->>'professional_id' and p_status in ('Em atendimento','Concluída') and item.payload->>'status' in ('Agendada','Confirmada','Em espera','Em atendimento') then null;
  elsif member_role='receptionist' and p_status in ('Confirmada','Em espera','Cancelada') and item.payload->>'status' in ('Agendada','Confirmada','Em espera') then null;
  else raise exception 'Alteração não permitida para esta consulta'; end if;
  update public.medsync_records set payload=jsonb_set(payload,'{status}',to_jsonb(p_status)) where id=p_appointment_id;
end;
$$;
revoke all on function public.medsync_link_portal_user(uuid,uuid,uuid), public.medsync_list_portal_users(uuid), public.medsync_portal_read(uuid,uuid,text,jsonb), public.medsync_portal_write(uuid,text,jsonb), public.medsync_portal_catalog(uuid), public.medsync_request_appointment(uuid,uuid,text), public.medsync_portal_appointment_status(uuid,text) from public,anon;
grant execute on function public.medsync_link_portal_user(uuid,uuid,uuid), public.medsync_list_portal_users(uuid), public.medsync_portal_read(uuid,uuid,text,jsonb), public.medsync_portal_write(uuid,text,jsonb), public.medsync_portal_catalog(uuid), public.medsync_request_appointment(uuid,uuid,text), public.medsync_portal_appointment_status(uuid,text) to authenticated;
commit;
