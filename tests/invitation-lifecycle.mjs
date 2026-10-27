import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '../.tmp/validation/node_modules/@electric-sql/pglite/dist/index.js'
const db = new PGlite()
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const org=id(1), other=id(2), admin=id(3), patient=id(4), professional=id(5), stranger=id(6), autoPatient=id(9), latePatient=id(10), patientRecord=id(7), professionalRecord=id(8), autoPatientRecord=id(11), latePatientRecord=id(12)
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
create table public.organizations(id uuid primary key,name text);
create table public.organization_members(organization_id uuid,user_id uuid,role text,primary key(organization_id,user_id));
create table public.medsync_memberships(organization_id uuid,user_id uuid,role text,primary key(organization_id,user_id));
alter table public.organizations enable row level security;
create table public.medsync_records(id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id),module text,payload jsonb,created_at timestamptz default now());
alter table public.medsync_records enable row level security;
create table public.medsync_invitations(id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id),email text,full_name text,role text,status text default 'sending',invited_by uuid,invited_user_id uuid,created_at timestamptz default now());
create unique index pending_invite on public.medsync_invitations(organization_id,email) where status in ('sending','sent');
create function public.medsync_is_admin(target_organization uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organization_members where organization_id=target_organization and user_id=auth.uid() and role='owner')$$;
create policy admin_read on public.medsync_records for select to authenticated using(public.medsync_is_admin(organization_id));
create policy admin_write on public.medsync_records for all to authenticated using(public.medsync_is_admin(organization_id)) with check(public.medsync_is_admin(organization_id));
`)
for (const file of ['202610220004_portals.sql','202610220005_hardening_and_commercial.sql','202610270006_invitation_lifecycle.sql','202610270007_organization_member_read.sql','202610270008_automatic_portal_link.sql']) {
  const sql=fs.readFileSync(new URL('../supabase/migrations/'+file, import.meta.url),'utf8').replace(/^\uFEFF/,'')
  await db.exec(sql)
  if (!file.includes('004')) await db.exec(sql)
}
assert.equal((await db.query(`select proargnames[1] as name from pg_proc where oid='public.medsync_is_admin(uuid)'::regprocedure`)).rows[0].name,'target_organization')
await db.query('insert into public.organizations values($1,$2),($3,$4)',[org,'Clinic',other,'Other'])
for (const [uid,email] of [[admin,'admin@example.com'],[patient,'patient@example.com'],[professional,'professional@example.com'],[stranger,'stranger@example.com'],[autoPatient,'auto@example.com'],[latePatient,'late@example.com']]) await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid,email])
await db.query("insert into public.organization_members values($1,$2,'owner')",[org,admin])
// A legacy broad SELECT policy must not bypass the new restrictive boundary.
await db.exec('create policy legacy_allow_everything on public.medsync_records for select to authenticated using(true)')
for (const [rid,module,email] of [[patientRecord,'pacientes','patient@example.com'],[professionalRecord,'profissionais','professional@example.com']]) await db.query('insert into public.medsync_records(id,organization_id,module,payload) values($1,$2,$3,$4)',[rid,org,module,{name:'Test Person',email,status:'Ativo'}])
await db.query("insert into public.medsync_records(id,organization_id,module,payload) values($1,$2,'pacientes',$3)",[autoPatientRecord,org,{name:'Auto Patient',email:'auto@example.com',status:'Ativo'}])
async function asUser(uid) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]); await db.exec('set role authenticated') }
async function prepare(email,role,record=null,actor=admin,clinic=org) {
  await db.exec('reset role')
  return (await db.query('select public.medsync_prepare_invitation($1,$2,$3,$4,$5,$6) as invitation',[actor,clinic,email,'Test Person',role,record])).rows[0].invitation
}
async function finish(invitation,uid) { await db.exec('reset role'); await db.query('select public.medsync_finish_invitation($1,$2,true)',[invitation.id,uid]) }
await assert.rejects(()=>prepare('patient@example.com','admin'))
await assert.rejects(()=>prepare('patient@example.com','patient',professionalRecord))
await assert.rejects(()=>prepare('stranger@example.com','patient',patientRecord))
await assert.rejects(()=>prepare('patient@example.com','patient',patientRecord,stranger))
await assert.rejects(()=>prepare('patient@example.com','patient',patientRecord,admin,other))
const invite=await prepare('patient@example.com','patient',patientRecord)
await assert.rejects(()=>prepare('patient@example.com','patient',patientRecord))
await finish(invite,patient)
await asUser(stranger)
assert.equal((await db.query('select id from public.organizations where id=$1',[org])).rows.length,0)
await assert.rejects(()=>db.query('select public.medsync_accept_invitation($1)',[invite.id]))
await assert.rejects(()=>db.query('select public.medsync_cancel_invitation($1)',[invite.id]))
await asUser(patient)
const accepted=(await db.query('select public.medsync_accept_invitation($1) as result',[invite.id])).rows[0].result
assert.equal(accepted.role,'patient'); assert.equal(accepted.linked,true)
assert.equal((await db.query('select name from public.organizations where id=$1',[org])).rows[0].name,'Clinic')
await db.query('select public.medsync_accept_invitation($1)',[invite.id]) // idempotent
assert.equal((await db.query('select * from public.medsync_memberships')).rows.length,1)
assert.equal((await db.query('select record_id from public.medsync_portal_links')).rows[0].record_id,patientRecord)
assert.deepEqual((await db.query('select id from public.medsync_records')).rows.map(x=>x.id),[patientRecord])
const autoInvite=await prepare('auto@example.com','patient')
await finish(autoInvite,autoPatient)
await asUser(autoPatient)
const autoAccepted=(await db.query('select public.medsync_accept_invitation($1) as result',[autoInvite.id])).rows[0].result
assert.equal(autoAccepted.linked,true)
assert.equal((await db.query('select record_id from public.medsync_portal_links where user_id=$1',[autoPatient])).rows[0].record_id,autoPatientRecord)
const lateInvite=await prepare('late@example.com','patient')
await finish(lateInvite,latePatient)
await asUser(latePatient)
const lateAccepted=(await db.query('select public.medsync_accept_invitation($1) as result',[lateInvite.id])).rows[0].result
assert.equal(lateAccepted.linked,false)
await db.exec('reset role')
await db.query("insert into public.medsync_records(id,organization_id,module,payload) values($1,$2,'pacientes',$3)",[latePatientRecord,org,{name:'Late Patient',email:'late@example.com',status:'Ativo'}])
await asUser(latePatient)
assert.equal((await db.query('select record_id from public.medsync_portal_links where user_id=$1',[latePatient])).rows[0].record_id,latePatientRecord)
await assert.rejects(()=>db.query("update public.medsync_memberships set role='admin'"))
await assert.rejects(()=>db.query('select public.medsync_prepare_invitation($1,$2,$3,$4,$5,null)',[patient,org,'x@example.com','Test','patient']))
await assert.rejects(()=>db.query('select * from public.medsync_access_events').then(result=>assert.notEqual(result.rows.length,0)))
const docInvite=await prepare('professional@example.com','professional',professionalRecord)
await finish(docInvite,professional)
await asUser(admin); await db.query('select public.medsync_cancel_invitation($1)',[docInvite.id])
await asUser(professional); await assert.rejects(()=>db.query('select public.medsync_accept_invitation($1)',[docInvite.id]))
const docInvite2=await prepare('professional@example.com','professional',professionalRecord)
assert.notEqual(docInvite2.id,docInvite.id)
await finish(docInvite2,professional)
await db.exec('reset role'); await db.query("update public.medsync_invitations set expires_at=now()-interval '1 day' where id=$1",[docInvite2.id])
await asUser(professional); await assert.rejects(()=>db.query('select public.medsync_accept_invitation($1)',[docInvite2.id]))
await db.exec('reset role'); await db.query("update public.medsync_invitations set expires_at=now()+interval '1 day' where id=$1",[docInvite2.id])
await asUser(professional); await db.query('select public.medsync_accept_invitation($1)',[docInvite2.id])
assert.equal((await db.query('select public.medsync_is_admin($1) as admin',[org])).rows[0].admin,false)
await asUser(admin)
await assert.rejects(()=>db.query("insert into public.organization_members values($1,$2,'admin')",[org,patient]))
await db.query("insert into public.medsync_records(organization_id,module,payload) values($1,'disponibilidade',$2)",[org,{professional_id:professionalRecord,starts_at:'2099-12-01T08:00',ends_at:'2099-12-01T12:00'}])
async function appointment(time,duration=30) { return db.query("insert into public.medsync_records(organization_id,module,payload) values($1,'consultas',$2)",[org,{patient_id:patientRecord,professional_id:professionalRecord,starts_at:'2099-12-01T'+time,duration_minutes:duration,status:'Agendada'}]) }
await appointment('09:00',60)
await assert.rejects(()=>appointment('09:30'))
await assert.rejects(()=>appointment('10:05'))
await appointment('10:10')
await assert.rejects(()=>appointment('12:15'))
await db.query("select public.medsync_set_portal_access($1,$2,'patient','suspended')",[org,patient])
await asUser(patient); assert.equal((await db.query('select id from public.medsync_records')).rows.length,0)
await asUser(admin)
await assert.rejects(()=>db.query("select public.medsync_set_portal_access($1,$2,'admin','active')",[org,patient]))
assert((await db.query('select * from public.medsync_access_events')).rows.length>0)
await db.exec('reset role; set role anon')
await assert.rejects(()=>db.query('select public.medsync_accept_invitation(null)'))
await db.exec('reset role; create role storage_migration_runner; grant usage on schema storage to storage_migration_runner; set role storage_migration_runner')
const hardening=fs.readFileSync(new URL('../supabase/migrations/202610220005_hardening_and_commercial.sql',import.meta.url),'utf8')
const storageSetup=hardening.match(/do \$storage_setup\$[\s\S]*?\$storage_setup\$;/)?.[0]
assert(storageSetup)
await db.exec(storageSetup) // non-owner must skip protected Storage DDL without aborting.
await db.exec('reset role')
await db.close()
console.log('OK: migration twice, original argument name preserved, invitation ownership/role/expiry/cancel, automatic links, patient isolation, suspension and audit permissions.')
