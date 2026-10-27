import { supabase } from "./supabase";
import { mergeMemberships } from "./memberships";

export async function loadMemberships(userId: string) {
  const [organization, portal] = await Promise.all([
    supabase.from("organization_members").select("organization_id,role").eq("user_id", userId),
    supabase.from("medsync_memberships").select("organization_id,role,status").eq("user_id", userId),
  ]);
  if (organization.error) throw organization.error;
  if (portal.error) throw portal.error;
  return mergeMemberships(organization.data || [], portal.data || []);
}
