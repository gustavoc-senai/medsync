begin;

create or replace function public.medsync_auto_link_portal_user(p_org uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare
  user_email text;
  matched_record uuid;
  match_count integer;
begin
  if p_role not in ('patient','professional') then return; end if;

  select lower(btrim(email)) into user_email
  from auth.users
  where id=p_user and email_confirmed_at is not null;
  if user_email is null then return; end if;

  if not exists (
    select 1 from public.medsync_memberships
    where organization_id=p_org and user_id=p_user and role=p_role and status='active'
  ) or exists (
    select 1 from public.medsync_portal_links
    where organization_id=p_org and user_id=p_user
  ) then return; end if;

  select count(*) into match_count
  from public.medsync_records
  where organization_id=p_org
    and module=case p_role when 'patient' then 'pacientes' else 'profissionais' end
    and lower(btrim(coalesce(payload->>'email','')))=user_email
    and coalesce(payload->>'status','Ativo')<>'Inativo';

  if match_count<>1 then return; end if;

  select id into matched_record
  from public.medsync_records
  where organization_id=p_org
    and module=case p_role when 'patient' then 'pacientes' else 'profissionais' end
    and lower(btrim(coalesce(payload->>'email','')))=user_email
    and coalesce(payload->>'status','Ativo')<>'Inativo'
  limit 1;

  insert into public.medsync_portal_links(organization_id,user_id,record_id,role)
  values(p_org,p_user,matched_record,p_role)
  on conflict(organization_id,user_id) do nothing;
end;
$$;

revoke all on function public.medsync_auto_link_portal_user(uuid,uuid,text) from public,anon,authenticated;

create or replace function public.medsync_auto_link_portal_record()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  candidate record;
  target_role text;
  record_email text;
begin
  target_role:=case new.module when 'pacientes' then 'patient' when 'profissionais' then 'professional' else null end;
  record_email:=lower(btrim(coalesce(new.payload->>'email','')));
  if target_role is null or record_email='' or coalesce(new.payload->>'status','Ativo')='Inativo' then return new; end if;

  for candidate in
    select m.user_id
    from public.medsync_memberships m
    join auth.users u on u.id=m.user_id
    where m.organization_id=new.organization_id
      and m.role=target_role
      and m.status='active'
      and u.email_confirmed_at is not null
      and lower(btrim(u.email))=record_email
  loop
    perform public.medsync_auto_link_portal_user(new.organization_id,candidate.user_id,target_role);
  end loop;

  return new;
end;
$$;

revoke all on function public.medsync_auto_link_portal_record() from public,anon,authenticated;
drop trigger if exists medsync_auto_link_portal_record_trigger on public.medsync_records;
create trigger medsync_auto_link_portal_record_trigger
after insert or update of organization_id,module,payload on public.medsync_records
for each row execute function public.medsync_auto_link_portal_record();

create or replace function public.medsync_accept_invitation(p_invitation_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  invitation public.medsync_invitations;
  current_user_id uuid:=auth.uid();
  current_email text;
  current_org uuid;
  linked boolean;
begin
  select lower(email) into current_email from auth.users
  where id=current_user_id and email_confirmed_at is not null;
  if current_email is null then raise exception 'Confirme seu e-mail pelo link do convite'; end if;
  if p_invitation_id is null and (
    select count(*) from public.medsync_invitations
    where lower(email)=current_email and invited_user_id=current_user_id
      and status='sent' and cancelled_at is null and expires_at>now()
  )<>1 then raise exception 'Abra o link do convite específico recebido por e-mail'; end if;

  select organization_id into current_org from public.medsync_invitations
  where (p_invitation_id is null or id=p_invitation_id)
    and lower(email)=current_email and invited_user_id=current_user_id
    and status in ('sent','accepted') and cancelled_at is null and expires_at>now()
  order by created_at desc limit 1;
  if current_org is null then raise exception 'Convite inválido, expirado ou cancelado. Solicite um novo envio'; end if;

  perform 1 from public.organizations where id=current_org for update;
  select * into invitation from public.medsync_invitations
  where organization_id=current_org
    and (p_invitation_id is null or id=p_invitation_id)
    and lower(email)=current_email and invited_user_id=current_user_id
    and status in ('sent','accepted') and cancelled_at is null and expires_at>now()
  order by created_at desc limit 1 for update;
  if not found then raise exception 'Convite indisponível'; end if;
  if invitation.role not in ('patient','professional','receptionist') then raise exception 'Perfil inválido'; end if;
  if exists(
    select 1 from public.organization_members
    where organization_id=current_org and user_id=current_user_id and role<>invitation.role
  ) then raise exception 'A conta já possui outro perfil nesta clínica. Solicite revisão ao administrador'; end if;
  if exists(
    select 1 from public.medsync_memberships
    where organization_id=current_org and user_id=current_user_id
      and (role<>invitation.role or status<>'active')
  ) then raise exception 'A conta possui um perfil diferente ou suspenso. Solicite revisão ao administrador'; end if;
  if invitation.record_id is not null and not exists(
    select 1 from public.medsync_records
    where id=invitation.record_id and organization_id=current_org
      and module=case invitation.role when 'patient' then 'pacientes' when 'professional' then 'profissionais' else '' end
      and coalesce(payload->>'status','Ativo')<>'Inativo'
  ) then raise exception 'O cadastro do convite não está disponível'; end if;

  if not exists(
    select 1 from public.medsync_memberships
    where organization_id=current_org and user_id=current_user_id
  ) then
    insert into public.medsync_memberships(organization_id,user_id,role,status)
    values(current_org,current_user_id,invitation.role,'active');
  end if;

  if invitation.record_id is not null then
    if exists(
      select 1 from public.medsync_portal_links
      where organization_id=current_org and user_id=current_user_id and record_id<>invitation.record_id
    ) then raise exception 'A conta já está vinculada a outro cadastro'; end if;
    insert into public.medsync_portal_links(organization_id,user_id,record_id,role)
    values(current_org,current_user_id,invitation.record_id,invitation.role)
    on conflict(organization_id,user_id) do nothing;
  else
    perform public.medsync_auto_link_portal_user(current_org,current_user_id,invitation.role);
  end if;

  if invitation.status<>'accepted' then
    update public.medsync_invitations set status='accepted',accepted_at=now() where id=invitation.id;
  end if;

  select exists(
    select 1 from public.medsync_portal_links
    where organization_id=current_org and user_id=current_user_id
      and role=invitation.role
  ) into linked;

  return jsonb_build_object(
    'organization_id',current_org,
    'role',invitation.role,
    'linked',linked
  );
end;
$$;

grant execute on function public.medsync_accept_invitation(uuid) to authenticated;

do $$
declare member record;
begin
  for member in
    select organization_id,user_id,role
    from public.medsync_memberships
    where role in ('patient','professional') and status='active'
  loop
    perform public.medsync_auto_link_portal_user(member.organization_id,member.user_id,member.role);
  end loop;
end;
$$;

commit;
