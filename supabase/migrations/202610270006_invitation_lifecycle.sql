-- Apply after 004 and 005. Does not promote/demote existing administrators.
begin;

alter table public.medsync_invitations
  add column if not exists record_id uuid references public.medsync_records(id),
  add column if not exists expires_at timestamptz not null default (now() + interval '7 days'),
  add column if not exists cancelled_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists last_sent_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists send_count integer not null default 0;

-- Preserve delivery history for invitations sent before these columns existed.
update public.medsync_invitations set send_count=1,last_sent_at=coalesce(last_sent_at,created_at)
  where status in ('sent','accepted') and send_count=0;

create table if not exists public.medsync_access_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  actor_id uuid,
  subject_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists medsync_access_events_org_date on public.medsync_access_events(organization_id, created_at desc);
alter table public.medsync_access_events enable row level security;
revoke all on public.medsync_access_events from public, anon, authenticated;
grant select on public.medsync_access_events to authenticated;

-- Preserve the parameter name installed by earlier versions; policies keep their OID.
do $migration$
declare argument_name text;
begin
  select coalesce(proargnames[1],'target_organization') into argument_name
    from pg_proc where oid=to_regprocedure('public.medsync_is_admin(uuid)');
  execute format($definition$
create or replace function public.medsync_is_admin(%I uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_members m
    where m.organization_id=$1 and m.user_id=auth.uid()
      and lower(m.role) in ('owner','admin','administrator','super_admin')
  ) and not exists (
    select 1 from public.medsync_memberships m
    where m.organization_id=$1 and m.user_id=auth.uid()
      and m.role in ('patient','professional','receptionist')
  );
$$;
$definition$,coalesce(argument_name,'target_organization'));
end;
$migration$;
revoke all on function public.medsync_is_admin(uuid) from public, anon;
grant execute on function public.medsync_is_admin(uuid) to authenticated;
drop policy if exists access_events_admin_read on public.medsync_access_events;
create policy access_events_admin_read on public.medsync_access_events for select to authenticated
  using (public.medsync_is_admin(organization_id));

create or replace function public.medsync_audit_access()
returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb; previous jsonb; actor uuid;
begin
  item := case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  previous := case when TG_OP='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  actor := auth.uid();
  if TG_TABLE_NAME='medsync_invitations' then actor := coalesce(actor,(item->>'invited_by')::uuid); end if;
  insert into public.medsync_access_events(organization_id,actor_id,subject_id,action,details)
  values ((item->>'organization_id')::uuid, actor, coalesce(item->>'user_id',item->>'id'),
    TG_TABLE_NAME || '.' || lower(TG_OP), jsonb_build_object(
      'role',item->>'role','previous_role',previous->>'role',
      'status',item->>'status','previous_status',previous->>'status',
      'record_id',item->>'record_id','cancelled_at',item->>'cancelled_at',
      'send_count',item->>'send_count'));
  return case when TG_OP='DELETE' then old else new end;
end;
$$;
do $$ declare tab text; begin
  foreach tab in array array['organization_members','medsync_memberships','medsync_portal_links','medsync_invitations'] loop
    execute format('drop trigger if exists medsync_audit_access_trigger on public.%I',tab);
    execute format('create trigger medsync_audit_access_trigger after insert or update or delete on public.%I for each row execute function public.medsync_audit_access()',tab);
  end loop;
end $$;

-- No direct client writes to invitation/portal membership tables. RPCs validate actors.
revoke insert, update, delete on public.medsync_invitations, public.medsync_memberships, public.medsync_portal_links from public, anon, authenticated;
revoke insert, update, delete on public.organization_members from public, anon, authenticated;
alter table public.organization_members enable row level security;
alter table public.medsync_invitations enable row level security;
alter table public.medsync_memberships enable row level security;
do $$ declare p record; begin
  for p in select tablename,policyname from pg_policies where schemaname='public'
    and tablename in ('medsync_invitations','medsync_memberships','organization_members') loop
    execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  end loop;
end $$;
grant select on public.medsync_invitations, public.medsync_memberships to authenticated;
grant select on public.organization_members to authenticated;
create policy organization_members_self_admin_read on public.organization_members for select to authenticated using(user_id=auth.uid() or public.medsync_is_admin(organization_id));
create policy invitations_admin_read on public.medsync_invitations for select to authenticated using(public.medsync_is_admin(organization_id));
create policy memberships_self_admin_read on public.medsync_memberships for select to authenticated using(user_id=auth.uid() or public.medsync_is_admin(organization_id));

-- Bound older permissive policies as well as the current portal policies.
drop policy if exists medsync_records_read_boundary on public.medsync_records;
create policy medsync_records_read_boundary on public.medsync_records as restrictive for select to authenticated
  using(public.medsync_is_admin(organization_id) or public.medsync_portal_read(organization_id,id,module,payload));
drop policy if exists medsync_records_insert_boundary on public.medsync_records;
create policy medsync_records_insert_boundary on public.medsync_records as restrictive for insert to authenticated
  with check(public.medsync_is_admin(organization_id) or public.medsync_portal_write(organization_id,module,payload));
drop policy if exists medsync_records_update_boundary on public.medsync_records;
create policy medsync_records_update_boundary on public.medsync_records as restrictive for update to authenticated
  using(public.medsync_is_admin(organization_id) or public.medsync_portal_write(organization_id,module,payload))
  with check(public.medsync_is_admin(organization_id) or public.medsync_portal_write(organization_id,module,payload));
drop policy if exists medsync_records_delete_boundary on public.medsync_records;
create policy medsync_records_delete_boundary on public.medsync_records as restrictive for delete to authenticated using(public.medsync_is_admin(organization_id));

create or replace function public.medsync_prepare_invitation(
  p_actor uuid,p_organization_id uuid,p_email text,p_full_name text,p_role text,p_record_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation public.medsync_invitations; target_record public.medsync_records;
begin
  perform 1 from public.organizations where id=p_organization_id for update;
  if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=p_actor
    and lower(role) in ('owner','admin','administrator','super_admin'))
    or exists(select 1 from public.medsync_memberships where organization_id=p_organization_id and user_id=p_actor and role in ('patient','professional','receptionist')) then
    raise exception 'Somente administradores desta clínica podem convidar';
  end if;
  if p_role not in ('patient','professional','receptionist') or p_role is null then raise exception 'Perfil inválido'; end if;
  if p_email is null or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>254
    or length(btrim(coalesce(p_full_name,''))) not between 2 and 120 then raise exception 'Confira nome e e-mail'; end if;
  if p_record_id is not null then
    select * into target_record from public.medsync_records where id=p_record_id and organization_id=p_organization_id
      and module=case p_role when 'patient' then 'pacientes' when 'professional' then 'profissionais' else '' end;
    if not found or coalesce(target_record.payload->>'status','Ativo')='Inativo' then raise exception 'Cadastro incompatível, inativo ou de outra clínica'; end if;
    if lower(btrim(coalesce(target_record.payload->>'email','')))<>lower(btrim(p_email)) then raise exception 'O e-mail deve ser o mesmo do cadastro selecionado'; end if;
  end if;
  select * into invitation from public.medsync_invitations
    where organization_id=p_organization_id and lower(email)=lower(btrim(p_email))
      and cancelled_at is null and status in ('sending','sent','pending','failed')
      order by case when status in ('sending','sent','pending') then 0 else 1 end,created_at desc limit 1 for update;
  if found then
    if invitation.role<>p_role or invitation.record_id is distinct from p_record_id then
      raise exception 'O convite existente tem outro perfil ou cadastro. Cancele-o antes de criar outro';
    end if;
    if invitation.last_attempt_at > now()-interval '60 seconds' then raise exception 'Aguarde 60 segundos antes de reenviar'; end if;
    update public.medsync_invitations set status='sending',last_attempt_at=now(),expires_at=now()+interval '7 days',full_name=btrim(p_full_name),invited_by=p_actor where id=invitation.id returning * into invitation;
  else
    if exists(select 1 from public.medsync_invitations where organization_id=p_organization_id and lower(email)=lower(btrim(p_email)) and status='accepted') then
      raise exception 'Esta pessoa já aceitou o convite. Gerencie o acesso na lista de usuários';
    end if;
    insert into public.medsync_invitations(organization_id,email,full_name,role,record_id,invited_by,status,last_attempt_at)
      values(p_organization_id,lower(btrim(p_email)),btrim(p_full_name),p_role,p_record_id,p_actor,'sending',now()) returning * into invitation;
  end if;
  return jsonb_build_object('id',invitation.id,'invited_user_id',invitation.invited_user_id,'resend',invitation.send_count>0);
end;
$$;

create or replace function public.medsync_finish_invitation(p_id uuid,p_user_id uuid,p_success boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_success and not exists(select 1 from auth.users u join public.medsync_invitations i on lower(u.email)=lower(i.email) where i.id=p_id and u.id=p_user_id) then raise exception 'Destinatário incompatível'; end if;
  update public.medsync_invitations set
    status=case when p_success then 'sent' when send_count>0 then 'sent' else 'failed' end,
    invited_user_id=case when p_success then p_user_id else invited_user_id end,
    last_sent_at=case when p_success then now() else last_sent_at end,
    send_count=send_count+case when p_success then 1 else 0 end
    where id=p_id and status='sending' and cancelled_at is null;
  if not found then raise exception 'Convite alterado ou cancelado durante o envio'; end if;
end;
$$;

create or replace function public.medsync_cancel_invitation(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare invitation public.medsync_invitations;
begin
  select * into invitation from public.medsync_invitations where id=p_id for update;
  if not found or not public.medsync_is_admin(invitation.organization_id) then raise exception 'Acesso negado'; end if;
  if invitation.status='accepted' then raise exception 'Convite já aceito. Gerencie o acesso do usuário'; end if;
  update public.medsync_invitations set cancelled_at=now(),status='failed' where id=p_id;
end;
$$;

create or replace function public.medsync_accept_invitation(p_invitation_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation public.medsync_invitations; current_user_id uuid:=auth.uid(); current_email text; current_org uuid;
begin
  select lower(email) into current_email from auth.users where id=current_user_id and email_confirmed_at is not null;
  if current_email is null then raise exception 'Confirme seu e-mail pelo link do convite'; end if;
  if p_invitation_id is null and (select count(*) from public.medsync_invitations where lower(email)=current_email and invited_user_id=current_user_id and status='sent' and cancelled_at is null and expires_at>now())<>1 then
    raise exception 'Abra o link do convite específico recebido por e-mail';
  end if;
  select organization_id into current_org from public.medsync_invitations where
    (p_invitation_id is null or id=p_invitation_id) and lower(email)=current_email and invited_user_id=current_user_id and status in ('sent','accepted') and cancelled_at is null and expires_at>now() order by created_at desc limit 1;
  if current_org is null then raise exception 'Convite inválido, expirado ou cancelado. Solicite um novo envio'; end if;
  perform 1 from public.organizations where id=current_org for update;
  select * into invitation from public.medsync_invitations where organization_id=current_org
    and (p_invitation_id is null or id=p_invitation_id) and lower(email)=current_email and invited_user_id=current_user_id
    and status in ('sent','accepted') and cancelled_at is null and expires_at>now() order by created_at desc limit 1 for update;
  if not found then raise exception 'Convite indisponível'; end if;
  if invitation.role not in ('patient','professional','receptionist') then raise exception 'Perfil inválido'; end if;
  if exists(select 1 from public.organization_members where organization_id=current_org and user_id=current_user_id and role<>invitation.role) then
    raise exception 'A conta já possui outro perfil nesta clínica. Solicite revisão ao administrador';
  end if;
  if exists(select 1 from public.medsync_memberships where organization_id=current_org and user_id=current_user_id and (role<>invitation.role or status<>'active')) then
    raise exception 'A conta possui um perfil diferente ou suspenso. Solicite revisão ao administrador';
  end if;
  if invitation.record_id is not null and not exists(select 1 from public.medsync_records where id=invitation.record_id and organization_id=current_org
    and module=case invitation.role when 'patient' then 'pacientes' when 'professional' then 'profissionais' else '' end and coalesce(payload->>'status','Ativo')<>'Inativo') then raise exception 'O cadastro do convite não está disponível'; end if;
  if not exists(select 1 from public.medsync_memberships where organization_id=current_org and user_id=current_user_id) then
    insert into public.medsync_memberships(organization_id,user_id,role,status) values(current_org,current_user_id,invitation.role,'active');
  end if;
  if invitation.record_id is not null then
    if exists(select 1 from public.medsync_portal_links where organization_id=current_org and user_id=current_user_id and record_id<>invitation.record_id) then raise exception 'A conta já está vinculada a outro cadastro'; end if;
    insert into public.medsync_portal_links(organization_id,user_id,record_id,role) values(current_org,current_user_id,invitation.record_id,invitation.role)
      on conflict(organization_id,user_id) do nothing;
  end if;
  if invitation.status<>'accepted' then update public.medsync_invitations set status='accepted',accepted_at=now() where id=invitation.id; end if;
  return jsonb_build_object('organization_id',current_org,'role',invitation.role,'linked',invitation.record_id is not null);
end;
$$;

-- Disable the legacy acceptance path so cancelled/expired invitations cannot bypass validation.
do $$ begin
  if to_regprocedure('public.medsync_accept_invitations()') is not null then
    execute 'revoke all on function public.medsync_accept_invitations() from public,anon,authenticated';
  end if;
end $$;

create or replace function public.medsync_set_portal_access(p_org uuid,p_user uuid,p_role text,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare previous_role text;
begin
  perform 1 from public.organizations where id=p_org for update;
  if not public.medsync_is_admin(p_org) or p_user=auth.uid() then raise exception 'Acesso negado'; end if;
  if p_role is null or p_role not in ('patient','professional','receptionist') or p_status is null or p_status not in ('active','suspended') then raise exception 'Perfil ou situação inválidos'; end if;
  if exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_user and lower(role) in ('owner','admin','administrator','super_admin')) then raise exception 'Não é permitido alterar administradores por este fluxo'; end if;
  select role into previous_role from public.medsync_memberships where organization_id=p_org and user_id=p_user for update;
  if not found then raise exception 'Usuário não encontrado na clínica'; end if;
  if previous_role<>p_role then delete from public.medsync_portal_links where organization_id=p_org and user_id=p_user; end if;
  update public.medsync_memberships set role=p_role,status=p_status where organization_id=p_org and user_id=p_user;
  update public.organization_members set role=p_role where organization_id=p_org and user_id=p_user;
end;
$$;

-- Serialize ALL appointment writers before the existing availability/overlap validator runs.
create or replace function public.medsync_serialize_schedule()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.module='consultas' then
    perform 1 from public.organizations where id=new.organization_id for update;
    if not exists(select 1 from public.medsync_records where id::text=new.payload->>'patient_id' and organization_id=new.organization_id and module='pacientes')
      or not exists(select 1 from public.medsync_records where id::text=new.payload->>'professional_id' and organization_id=new.organization_id and module='profissionais') then raise exception 'Paciente ou profissional inválido para esta clínica'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists a_medsync_serialize_schedule on public.medsync_records;
create trigger a_medsync_serialize_schedule before insert or update on public.medsync_records for each row execute function public.medsync_serialize_schedule();

revoke all on function public.medsync_prepare_invitation(uuid,uuid,text,text,text,uuid),public.medsync_finish_invitation(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.medsync_prepare_invitation(uuid,uuid,text,text,text,uuid),public.medsync_finish_invitation(uuid,uuid,boolean) to service_role;
revoke all on function public.medsync_accept_invitation(uuid),public.medsync_cancel_invitation(uuid),public.medsync_set_portal_access(uuid,uuid,text,text) from public,anon;
grant execute on function public.medsync_accept_invitation(uuid),public.medsync_cancel_invitation(uuid),public.medsync_set_portal_access(uuid,uuid,text,text) to authenticated;
revoke all on function public.medsync_audit_access(),public.medsync_serialize_schedule() from public,anon,authenticated;
commit;
