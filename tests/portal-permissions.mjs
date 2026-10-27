import fs from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "../.tmp/validation/node_modules/@electric-sql/pglite/dist/index.js";
const db = new PGlite();
const ids = {
  org: "00000000-0000-4000-8000-000000000001",
  otherOrg: "00000000-0000-4000-8000-000000000002",
  admin: "10000000-0000-4000-8000-000000000001",
  patient: "10000000-0000-4000-8000-000000000002",
  otherPatient: "10000000-0000-4000-8000-000000000003",
  doctor: "10000000-0000-4000-8000-000000000004",
  reception: "10000000-0000-4000-8000-000000000005",
  p1: "20000000-0000-4000-8000-000000000001",
  p2: "20000000-0000-4000-8000-000000000002",
  doc: "20000000-0000-4000-8000-000000000003",
  a1: "20000000-0000-4000-8000-000000000004",
  a2: "20000000-0000-4000-8000-000000000005",
  note: "20000000-0000-4000-8000-000000000006",
  availability: "20000000-0000-4000-8000-000000000009",
  otherAvailability: "20000000-0000-4000-8000-000000000010",
  document: "20000000-0000-4000-8000-000000000011",
};
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);create table public.organizations(id uuid primary key,name text);create table public.organization_members(organization_id uuid,user_id uuid,role text);create table public.medsync_memberships(organization_id uuid,user_id uuid,role text);create table public.medsync_records(id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id),module text,payload jsonb,created_at timestamptz default now());alter table public.medsync_records enable row level security;create function public.medsync_is_admin(target uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organization_members where organization_id=target and user_id=auth.uid() and role='owner')$$;create policy admin_read on public.medsync_records for select to authenticated using(public.medsync_is_admin(organization_id));create policy admin_write on public.medsync_records for all to authenticated using(public.medsync_is_admin(organization_id)) with check(public.medsync_is_admin(organization_id));`,
);
await db.exec(
  fs
    .readFileSync(
      new URL(
        "../supabase/migrations/202610220004_portals.sql",
        import.meta.url,
      ),
      "utf8",
    )
    .replace(/^\uFEFF/, ""),
);
await db.exec(
  fs
    .readFileSync(
      new URL(
        "../supabase/migrations/202610220004_portals.sql",
        import.meta.url,
      ),
      "utf8",
    )
    .replace(/^\uFEFF/, ""),
);
const hardeningMigration = fs
  .readFileSync(
    new URL(
      "../supabase/migrations/202610220005_hardening_and_commercial.sql",
      import.meta.url,
    ),
    "utf8",
  )
  .replace(/^\uFEFF/, "");
await db.exec(hardeningMigration);
await db.exec(hardeningMigration);
for (const id of [
  ids.admin,
  ids.patient,
  ids.otherPatient,
  ids.doctor,
  ids.reception,
])
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    id,
    id + "@example.com",
  ]);
await db.query("insert into public.organizations values($1,$2),($3,$4)", [
  ids.org,
  "Clinic A",
  ids.otherOrg,
  "Clinic B",
]);
await db.query(
  "insert into public.organization_members values($1,$2,'owner')",
  [ids.org, ids.admin],
);
for (const [uid, role] of [
  [ids.patient, "patient"],
  [ids.otherPatient, "patient"],
  [ids.doctor, "professional"],
  [ids.reception, "receptionist"],
])
  await db.query("insert into public.medsync_memberships values($1,$2,$3)", [
    ids.org,
    uid,
    role,
  ]);
async function record(id, org, module, payload) {
  return db.query(
    "insert into public.medsync_records(id,organization_id,module,payload) values($1,$2,$3,$4)",
    [id, org, module, payload],
  );
}
await record(ids.p1, ids.org, "pacientes", { name: "Patient One" });
await record(ids.p2, ids.org, "pacientes", { name: "Patient Two" });
await record(ids.doc, ids.org, "profissionais", {
  name: "Doctor",
  status: "Ativo",
});
await record(ids.availability, ids.org, "disponibilidade", {
  professional_id: ids.doc,
  starts_at: "2099-12-01T08:00",
  ends_at: "2099-12-03T17:00",
});
await record(ids.otherAvailability, ids.org, "disponibilidade", {
  professional_id: "other-doctor",
  starts_at: "2099-12-01T08:00",
  ends_at: "2099-12-01T17:00",
});
const privateFilePath = `${ids.org}/${ids.document}/report.pdf`;
await record(ids.document, ids.org, "documentos", {
  patient_id: ids.p1,
  professional_id: ids.doc,
  storage_path: privateFilePath,
});
await db.query(
  "insert into storage.objects(bucket_id,name) values('medsync-private',$1)",
  [privateFilePath],
);
await record(ids.a1, ids.org, "consultas", {
  patient_id: ids.p1,
  professional_id: ids.doc,
  starts_at: "2099-12-01T09:00",
  status: "Agendada",
});
await record(ids.a2, ids.org, "consultas", {
  patient_id: ids.p2,
  professional_id: "other-doctor",
  starts_at: "2099-12-01T10:00",
  status: "Agendada",
});
await record(ids.note, ids.org, "prontuario", {
  patient_id: ids.p1,
  professional_id: ids.doc,
  date: "2099-12-01",
  notes: "Private note",
});
await record(
  "20000000-0000-4000-8000-000000000007",
  ids.otherOrg,
  "pacientes",
  { name: "Other clinic patient" },
);
async function asUser(user) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
}
async function visible() {
  return (
    await db.query("select id from public.medsync_records order by id")
  ).rows.map((r) => r.id);
}
await asUser(ids.admin);
await db.query("select public.medsync_link_portal_user($1,$2,$3)", [
  ids.org,
  ids.patient,
  ids.p1,
]);
await db.query("select public.medsync_link_portal_user($1,$2,$3)", [
  ids.org,
  ids.otherPatient,
  ids.p2,
]);
await db.query("select public.medsync_link_portal_user($1,$2,$3)", [
  ids.org,
  ids.doctor,
  ids.doc,
]);
await assert.rejects(() =>
  db.query(
    "insert into public.medsync_records(organization_id,module,payload) values($1,'consultas',$2)",
    [
      ids.org,
      {
        patient_id: ids.p1,
        professional_id: ids.doc,
        status: "Agendada",
      },
    ],
  ),
);
await assert.rejects(() =>
  db.query("select public.medsync_link_portal_user($1,$2,$3)", [
    ids.otherOrg,
    ids.patient,
    ids.p1,
  ]),
);
await asUser(ids.patient);
assert.deepEqual(await visible(), [ids.p1, ids.a1, ids.document].sort());
assert.equal(
  (
    await db.query("select name from storage.objects")
  ).rows.some((row) => row.name === privateFilePath),
  true,
);
await asUser(ids.otherPatient);
assert.equal((await db.query("select name from storage.objects")).rows.length, 0);
await asUser(ids.patient);
await assert.rejects(() =>
  record("30000000-0000-4000-8000-000000000001", ids.org, "prontuario", {
    patient_id: ids.p1,
    notes: "forged",
  }),
);
assert.equal(
  (
    await db.query(
      "update public.medsync_records set payload='{}' where id=$1 returning id",
      [ids.a1],
    )
  ).rows.length,
  0,
);
await assert.rejects(() =>
  db.query("select public.medsync_link_portal_user($1,$2,$3)", [
    ids.org,
    ids.patient,
    ids.p2,
  ]),
);
await assert.rejects(() =>
  db.query("select public.medsync_list_portal_users($1)", [ids.org]),
);
await assert.rejects(() =>
  db.query("select public.medsync_request_appointment($1,$2,$3)", [
    ids.otherOrg,
    ids.doc,
    "2099-12-02T09:00",
  ]),
);
await assert.rejects(() =>
  db.query("select public.medsync_request_appointment($1,$2,$3)", [
    ids.org,
    ids.doc,
    "2099-12-01T09:00",
  ]),
);
await db.query("select public.medsync_request_appointment($1,$2,$3)", [
  ids.org,
  ids.doc,
  "2099-12-03T09:00",
]);
await assert.rejects(() =>
  db.query("select public.medsync_request_appointment($1,$2,$3)", [
    ids.org,
    ids.doc,
    "2099-12-03T09:20",
  ]),
);
await db.query("select public.medsync_portal_appointment_status($1,$2)", [
  ids.a1,
  "Cancelada",
]);
await assert.rejects(() =>
  db.query("select public.medsync_portal_appointment_status($1,$2)", [
    ids.a2,
    "Cancelada",
  ]),
);
await asUser(ids.doctor);
assert(!(await visible()).includes(ids.p2));
assert((await visible()).includes(ids.note));
assert((await visible()).includes(ids.p1));
await record("30000000-0000-4000-8000-000000000002", ids.org, "receitas", {
  patient_id: ids.p1,
  professional_id: ids.doc,
  date: "2099-12-01",
  notes: "Own authored record",
});
await assert.rejects(() =>
  record("30000000-0000-4000-8000-000000000003", ids.org, "receitas", {
    patient_id: ids.p2,
    professional_id: ids.doc,
    date: "2099-12-01",
    notes: "Wrong patient",
  }),
);
await assert.rejects(() =>
  record("30000000-0000-4000-8000-000000000004", ids.org, "receitas", {
    patient_id: ids.p1,
    professional_id: "forged",
    date: "2099-12-01",
    notes: "Wrong author",
  }),
);
await asUser(ids.reception);
assert((await visible()).includes(ids.p2));
assert(!(await visible()).includes(ids.note));
await assert.rejects(() =>
  record("30000000-0000-4000-8000-000000000005", ids.org, "prontuario", {
    patient_id: ids.p1,
    notes: "Reception cannot write clinical data",
  }),
);
await db.query("select public.medsync_portal_appointment_status($1,$2)", [
  ids.a2,
  "Em espera",
]);
await assert.rejects(() =>
  db.query("select public.medsync_portal_appointment_status($1,$2)", [
    ids.a2,
    "Concluída",
  ]),
);
await db.exec("reset role");
await db.query(
  "update public.medsync_memberships set status='suspended' where organization_id=$1 and user_id=$2",
  [ids.org, ids.reception],
);
await asUser(ids.reception);
assert(!(await visible()).includes(ids.p2));
await db.exec("reset role");
await db.exec("set role anon");
await assert.rejects(() => db.query("select * from public.medsync_records"));
await assert.rejects(() =>
  db.query("select public.medsync_list_portal_users($1)", [ids.org]),
);
await db.close();
console.log(
  "OK: migration applies twice; patient/professional/reception/anonymous isolation; cross-clinic denials; role and author forgery blocked; appointment requests and status permissions verified in local PostgreSQL.",
);
