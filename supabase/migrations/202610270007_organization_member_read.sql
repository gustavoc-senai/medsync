begin;

grant select on public.organizations to authenticated;

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = id and m.user_id = auth.uid()
  )
  or exists (
    select 1 from public.medsync_memberships m
    where m.organization_id = id and m.user_id = auth.uid()
  )
);

commit;
