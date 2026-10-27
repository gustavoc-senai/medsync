begin;

alter table public.medsync_memberships
  add column if not exists status text not null default 'active';

create table if not exists public.medsync_record_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_id uuid not null,
  module text not null,
  operation text not null check (operation in ('INSERT','UPDATE')),
  actor_id uuid,
  actor_name text,
  actor_email text,
  changed_at timestamptz not null default now(),
  old_payload jsonb,
  new_payload jsonb not null
);
create index if not exists medsync_record_history_record_idx
  on public.medsync_record_history (organization_id, record_id, changed_at desc);
alter table public.medsync_record_history enable row level security;
revoke all on public.medsync_record_history from public, anon, authenticated;
grant select on public.medsync_record_history to authenticated;
drop policy if exists medsync_record_history_admin_read on public.medsync_record_history;
create policy medsync_record_history_admin_read on public.medsync_record_history
  for select to authenticated
  using (public.medsync_is_admin(organization_id) or actor_id = auth.uid());

create or replace function public.medsync_audit_record_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); actor_name text; actor_email text;
begin
  select coalesce(u.raw_user_meta_data->>'full_name', u.email), u.email
    into actor_name, actor_email
    from auth.users u where u.id=actor;
  insert into public.medsync_record_history
    (organization_id,record_id,module,operation,actor_id,actor_name,actor_email,old_payload,new_payload)
  values (
    new.organization_id,new.id,new.module,TG_OP,actor,actor_name,actor_email,
    case when TG_OP='UPDATE' then old.payload else null end,new.payload
  );
  return new;
end;
$$;
drop trigger if exists medsync_record_history_trigger on public.medsync_records;
create trigger medsync_record_history_trigger
  after insert or update on public.medsync_records
  for each row execute function public.medsync_audit_record_change();

create or replace function public.medsync_validate_record_payload()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  start_time timestamp;
  end_time timestamp;
  appointment_duration integer;
  service_duration integer;
  service_key text;
begin
  if jsonb_typeof(new.payload) <> 'object' then
    raise exception 'Os dados do registro precisam ser um objeto JSON.';
  end if;

  if new.module='consultas' then
    if nullif(btrim(new.payload->>'starts_at'),'') is null then
      raise exception 'Informe a data e o horário da consulta.';
    end if;
    if new.payload->>'starts_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$' then
      raise exception 'A data e o horário da consulta são inválidos.';
    end if;
    begin
      start_time := (new.payload->>'starts_at')::timestamp;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception 'A data e o horário da consulta são inválidos.';
    end;
    if nullif(new.payload->>'patient_id','') is null or nullif(new.payload->>'professional_id','') is null then
      raise exception 'Selecione o paciente e o profissional.';
    end if;

    service_key := nullif(new.payload->>'service_id','');
    if service_key is not null then
      select nullif(r.payload->>'duration','')::integer into service_duration
      from public.medsync_records r
      where r.organization_id=new.organization_id and r.module='servicos'
        and r.id::text=service_key and coalesce(r.payload->>'status','Ativo')<>'Inativo';
      if service_duration is null then
        raise exception 'O serviço selecionado não está disponível.';
      end if;
    end if;
    appointment_duration := coalesce(
      service_duration,
      case when coalesce(new.payload->>'duration_minutes','') ~ '^\d+$'
        then (new.payload->>'duration_minutes')::integer end,
      30
    );
    if appointment_duration < 1 or appointment_duration > 480 then
      raise exception 'A duração da consulta deve estar entre 1 e 480 minutos.';
    end if;
    end_time := start_time + make_interval(mins => appointment_duration);
    new.payload := jsonb_set(new.payload,'{duration_minutes}',to_jsonb(appointment_duration),true);

    if coalesce(new.payload->>'status','Agendada') <> 'Cancelada' then
      if not exists (
        select 1 from public.medsync_records a
        where a.organization_id=new.organization_id and a.module='disponibilidade'
          and a.payload->>'professional_id'=new.payload->>'professional_id'
          and (a.payload->>'starts_at')::timestamp <= start_time
          and (a.payload->>'ends_at')::timestamp >= end_time
      ) then
        raise exception 'O horário não está dentro da disponibilidade cadastrada do profissional.';
      end if;
      if exists (
        select 1 from public.medsync_records a
        where a.organization_id=new.organization_id and a.module='consultas'
          and a.id is distinct from new.id
          and a.payload->>'professional_id'=new.payload->>'professional_id'
          and coalesce(a.payload->>'status','')<>'Cancelada'
          and (a.payload->>'starts_at')::timestamp <
            end_time + interval '10 minutes'
          and (a.payload->>'starts_at')::timestamp +
            make_interval(mins => case
              when coalesce(a.payload->>'duration_minutes','') ~ '^\d+$'
                then (a.payload->>'duration_minutes')::integer
              else 30 end) + interval '10 minutes' > start_time
      ) then
        raise exception 'O profissional já possui uma consulta nesse intervalo ou no intervalo de descanso.';
      end if;
    end if;
  elsif new.module='disponibilidade' then
    if nullif(new.payload->>'starts_at','') is null or nullif(new.payload->>'ends_at','') is null then
      raise exception 'Informe o início e o fim da disponibilidade.';
    end if;
    begin
      start_time := (new.payload->>'starts_at')::timestamp;
      end_time := (new.payload->>'ends_at')::timestamp;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception 'A disponibilidade contém uma data inválida.';
    end;
    if end_time <= start_time then
      raise exception 'O fim da disponibilidade precisa ser posterior ao início.';
    end if;
    if nullif(new.payload->>'professional_id','') is null then
      raise exception 'Selecione o profissional da disponibilidade.';
    end if;
  elsif new.module in ('pagamentos','contas-receber','contas-pagar','prontuario','receitas','atestados') then
    if nullif(btrim(new.payload->>'date'),'') is null then
      raise exception 'Informe a data do registro.';
    end if;
    if new.payload->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'A data do registro é inválida.';
    end if;
    begin
      perform (new.payload->>'date')::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception 'A data do registro é inválida.';
    end;
  end if;
  return new;
end;
$$;
drop trigger if exists medsync_validate_record_payload_trigger on public.medsync_records;
create trigger medsync_validate_record_payload_trigger
  before insert or update of module,payload on public.medsync_records
  for each row execute function public.medsync_validate_record_payload();

create or replace function public.medsync_portal_read(p_org uuid,p_id uuid,p_module text,p_payload jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare member_role text; member_status text; linked uuid;
begin
  select m.role,coalesce(m.status,'active') into member_role,member_status
    from public.medsync_memberships m
    where m.organization_id=p_org and m.user_id=auth.uid();
  if member_status is distinct from 'active' then return false; end if;
  if member_role='receptionist' then return p_module in ('pacientes','profissionais','consultas','disponibilidade','servicos','especialidades','convenios','pagamentos'); end if;
  select l.record_id into linked from public.medsync_portal_links l
    where l.organization_id=p_org and l.user_id=auth.uid() and l.role=member_role;
  if linked is null then return false; end if;
  if member_role='patient' then
    return (p_module='pacientes' and p_id=linked) or
      (p_module in ('consultas','receitas','exames','atestados','documentos','pagamentos') and p_payload->>'patient_id'=linked::text);
  end if;
  if member_role='professional' then
    if p_module='profissionais' and p_id=linked then return true; end if;
    if p_module in ('consultas','disponibilidade') then return p_payload->>'professional_id'=linked::text; end if;
    if p_module='pacientes' then return exists(
      select 1 from public.medsync_records r where r.organization_id=p_org and r.module='consultas'
        and r.payload->>'professional_id'=linked::text and r.payload->>'patient_id'=p_id::text);
    end if;
    if p_module in ('prontuario','receitas','exames','atestados','documentos') then return p_payload->>'professional_id'=linked::text; end if;
  end if;
  return false;
end;
$$;

create or replace function public.medsync_portal_write(p_org uuid,p_module text,p_payload jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare member_role text; member_status text; linked uuid;
begin
  select m.role,coalesce(m.status,'active') into member_role,member_status
    from public.medsync_memberships m
    where m.organization_id=p_org and m.user_id=auth.uid();
  if member_status is distinct from 'active' then return false; end if;
  if member_role='receptionist' then return p_module in ('pacientes','consultas','pagamentos'); end if;
  if member_role<>'professional' or member_role is null then return false; end if;
  select l.record_id into linked from public.medsync_portal_links l
    where l.organization_id=p_org and l.user_id=auth.uid() and l.role='professional';
  if linked is null or p_payload->>'professional_id' is distinct from linked::text then return false; end if;
  if p_module='disponibilidade' then return true; end if;
  if p_module in ('prontuario','receitas','exames','atestados','documentos') then
    return exists(select 1 from public.medsync_records r where r.organization_id=p_org and r.module='consultas'
      and r.payload->>'professional_id'=linked::text and r.payload->>'patient_id'=p_payload->>'patient_id');
  end if;
  return false;
end;
$$;

create or replace function public.medsync_portal_update(p_org uuid,p_module text,p_payload jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare member_role text; member_status text;
begin
  if public.medsync_is_admin(p_org) then return true; end if;
  select m.role,coalesce(m.status,'active') into member_role,member_status
    from public.medsync_memberships m where m.organization_id=p_org and m.user_id=auth.uid();
  if member_status is distinct from 'active' or p_module='consultas' then return false; end if;
  return public.medsync_portal_write(p_org,p_module,p_payload);
end;
$$;
drop policy if exists portal_records_update on public.medsync_records;
create policy portal_records_update on public.medsync_records for update to authenticated
  using (public.medsync_portal_update(organization_id,module,payload))
  with check (public.medsync_portal_update(organization_id,module,payload));

create or replace function public.medsync_portal_catalog(p_organization_id uuid)
returns table(id uuid,payload jsonb) language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.medsync_memberships where organization_id=p_organization_id
    and user_id=auth.uid() and coalesce(status,'active')='active') then raise exception 'Acesso negado'; end if;
  return query select r.id,jsonb_build_object('name',r.payload->>'name','specialty',r.payload->>'specialty')
    from public.medsync_records r where r.organization_id=p_organization_id and r.module='profissionais'
      and coalesce(r.payload->>'status','Ativo')<>'Inativo';
end;
$$;

create or replace function public.medsync_request_appointment(p_organization_id uuid,p_professional_id uuid,p_starts_at text)
returns uuid language plpgsql security definer set search_path='' as $$
declare patient uuid; result uuid; requested_start timestamp;
begin
  select l.record_id into patient
    from public.medsync_portal_links l
    join public.medsync_memberships m on m.organization_id=l.organization_id and m.user_id=l.user_id
    where l.organization_id=p_organization_id and l.user_id=auth.uid() and l.role='patient'
      and m.role='patient' and coalesce(m.status,'active')='active';
  if patient is null then raise exception 'Seu cadastro de paciente precisa ser vinculado pela clínica'; end if;
  if p_starts_at !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$' then
    raise exception 'Escolha uma data futura válida';
  end if;
  begin
    requested_start := p_starts_at::timestamp;
  exception when datetime_field_overflow or invalid_datetime_format then
    raise exception 'Escolha uma data futura válida';
  end;
  if requested_start <= timezone('America/Sao_Paulo',now()) then
    raise exception 'Escolha uma data futura válida';
  end if;
  if not exists(select 1 from public.medsync_records where id=p_professional_id
    and organization_id=p_organization_id and module='profissionais'
    and coalesce(payload->>'status','Ativo')<>'Inativo') then
    raise exception 'Profissional indisponível';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_professional_id::text,0));
  insert into public.medsync_records(organization_id,module,payload)
    values(p_organization_id,'consultas',jsonb_build_object(
      'patient_id',patient,'professional_id',p_professional_id,'starts_at',p_starts_at,
      'duration_minutes',30,'status','Agendada',
      'notes','Solicitada pelo portal do paciente; confirmar disponibilidade com a clínica.'
    )) returning id into result;
  return result;
end;
$$;

create or replace function public.medsync_portal_appointment_status(p_appointment_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.medsync_records; linked uuid; member_role text; member_status text; prior_status text;
begin
  select * into item from public.medsync_records where id=p_appointment_id and module='consultas' for update;
  if not found then raise exception 'Consulta não encontrada'; end if;
  select m.role,coalesce(m.status,'active') into member_role,member_status
    from public.medsync_memberships m where m.organization_id=item.organization_id and m.user_id=auth.uid();
  if member_status is distinct from 'active' then raise exception 'Acesso suspenso para esta clínica'; end if;
  select l.record_id into linked from public.medsync_portal_links l
    where l.organization_id=item.organization_id and l.user_id=auth.uid() and l.role=member_role;
  prior_status := item.payload->>'status';
  if member_role='patient' and linked::text=item.payload->>'patient_id'
    and p_status='Cancelada' and prior_status in ('Agendada','Confirmada') then null;
  elsif member_role='professional' and linked::text=item.payload->>'professional_id'
    and p_status in ('Em atendimento','Concluída')
    and prior_status in ('Agendada','Confirmada','Em espera','Em atendimento') then null;
  elsif member_role='receptionist' and linked is null
    and ((p_status='Confirmada' and prior_status='Agendada')
      or (p_status='Em espera' and prior_status in ('Agendada','Confirmada'))
      or (p_status='Cancelada' and prior_status in ('Agendada','Confirmada','Em espera'))) then null;
  else raise exception 'Alteração não permitida para esta consulta'; end if;
  update public.medsync_records set payload=jsonb_set(payload,'{status}',to_jsonb(p_status)) where id=p_appointment_id;
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('medsync-private','medsync-private',false,20971520,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.medsync_private_file_read(p_path text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_organization_id uuid; v_record_id uuid; item public.medsync_records;
begin
  if p_path !~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[^/]+$' then return false; end if;
  v_organization_id := split_part(p_path,'/',1)::uuid;
  v_record_id := split_part(p_path,'/',2)::uuid;
  select * into item from public.medsync_records r
    where r.organization_id=v_organization_id and r.id=v_record_id;
  if not found or item.payload->>'storage_path' is distinct from p_path then return false; end if;
  return public.medsync_is_admin(v_organization_id)
    or public.medsync_portal_read(v_organization_id,item.id,item.module,item.payload);
end;
$$;

create or replace function public.medsync_private_file_write(p_path text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_organization_id uuid; v_record_id uuid; item public.medsync_records;
begin
  if p_path !~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[^/]+$' then return false; end if;
  v_organization_id := split_part(p_path,'/',1)::uuid;
  v_record_id := split_part(p_path,'/',2)::uuid;
  select * into item from public.medsync_records r
    where r.organization_id=v_organization_id and r.id=v_record_id;
  if not found or item.module<>'documentos' then return false; end if;
  return public.medsync_is_admin(v_organization_id)
    or public.medsync_portal_write(v_organization_id,item.module,item.payload);
end;
$$;

alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to authenticated;
drop policy if exists medsync_private_file_read on storage.objects;
create policy medsync_private_file_read on storage.objects for select to authenticated
  using (bucket_id='medsync-private' and public.medsync_private_file_read(name));
drop policy if exists medsync_private_file_insert on storage.objects;
create policy medsync_private_file_insert on storage.objects for insert to authenticated
  with check (bucket_id='medsync-private' and public.medsync_private_file_write(name));
drop policy if exists medsync_private_file_update on storage.objects;
create policy medsync_private_file_update on storage.objects for update to authenticated
  using (bucket_id='medsync-private' and public.medsync_private_file_write(name))
  with check (bucket_id='medsync-private' and public.medsync_private_file_write(name));
drop policy if exists medsync_private_file_delete on storage.objects;
create policy medsync_private_file_delete on storage.objects for delete to authenticated
  using (bucket_id='medsync-private' and public.medsync_private_file_write(name));

create table if not exists public.medsync_plans (
  code text primary key,
  name text not null,
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  max_professionals integer not null check (max_professionals > 0),
  max_units integer not null check (max_units > 0),
  max_users integer not null check (max_users > 0),
  active boolean not null default true
);
insert into public.medsync_plans(code,name,monthly_price_cents,max_professionals,max_units,max_users)
values
  ('essencial','Essencial',14900,3,1,6),
  ('clinica','Clínica',29900,12,3,25),
  ('rede','Rede',79900,50,10,100)
on conflict(code) do update set name=excluded.name,
  monthly_price_cents=excluded.monthly_price_cents,
  max_professionals=excluded.max_professionals,max_units=excluded.max_units,
  max_users=excluded.max_users,active=true;
alter table public.medsync_plans enable row level security;
revoke all on public.medsync_plans from public,anon,authenticated;
grant select on public.medsync_plans to authenticated;
drop policy if exists medsync_plans_read on public.medsync_plans;
create policy medsync_plans_read on public.medsync_plans for select to authenticated using(active);

create table if not exists public.medsync_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_code text not null references public.medsync_plans(code),
  status text not null check(status in ('pending','trialing','active','past_due','cancelled')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.medsync_subscriptions enable row level security;
revoke all on public.medsync_subscriptions from public,anon,authenticated;
grant select on public.medsync_subscriptions to authenticated;
drop policy if exists medsync_subscriptions_admin_read on public.medsync_subscriptions;
create policy medsync_subscriptions_admin_read on public.medsync_subscriptions
  for select to authenticated using(public.medsync_is_admin(organization_id));

create or replace function public.medsync_list_plans()
returns table(code text,name text,monthly_price_cents integer,max_professionals integer,max_units integer,max_users integer)
language sql stable security definer set search_path='' as $$
  select p.code,p.name,p.monthly_price_cents,p.max_professionals,p.max_units,p.max_users
  from public.medsync_plans p where p.active order by p.monthly_price_cents;
$$;

create or replace function public.medsync_request_plan(p_organization_id uuid,p_plan_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.medsync_is_admin(p_organization_id) then raise exception 'Acesso administrativo necessário'; end if;
  if not exists(select 1 from public.medsync_plans where code=p_plan_code and active) then raise exception 'Plano indisponível'; end if;
  insert into public.medsync_subscriptions(organization_id,plan_code,status,provider,updated_at)
  values(p_organization_id,p_plan_code,'pending',null,now())
  on conflict(organization_id) do update set plan_code=excluded.plan_code,
    status=case when public.medsync_subscriptions.status='active' then 'active' else 'pending' end,
    updated_at=now();
end;
$$;

revoke all on function public.medsync_audit_record_change(),
  public.medsync_validate_record_payload(),
  public.medsync_portal_update(uuid,text,jsonb),
  public.medsync_private_file_read(text),
  public.medsync_private_file_write(text),
  public.medsync_list_plans(),
  public.medsync_request_plan(uuid,text)
  from public,anon;
grant execute on function public.medsync_portal_update(uuid,text,jsonb),
  public.medsync_list_plans(),
  public.medsync_request_plan(uuid,text),
  public.medsync_request_appointment(uuid,uuid,text) to authenticated;
commit;
