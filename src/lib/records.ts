import { supabase } from "./supabase";

export type RecordRow = {
  id: string;
  organization_id: string;
  module: string;
  payload: Record<string, string>;
  created_at: string;
};

const pageSize = 500;

export async function fetchOrganizationRecords(
  organizationId: string,
): Promise<RecordRow[]> {
  const records: RecordRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("medsync_records")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    records.push(...(data as RecordRow[]));
    if (data.length < pageSize) return records;
  }
}

export async function fetchOrganizationInvitations(organizationId: string) {
  const invitations: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    status: string;
    created_at: string;
    record_id?: string | null;
    invited_user_id?: string | null;
    expires_at?: string;
    cancelled_at?: string | null;
    last_sent_at?: string | null;
  }[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("medsync_invitations")
      .select("id,email,full_name,role,status,created_at,record_id,invited_user_id,expires_at,cancelled_at,last_sent_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    invitations.push(...data);
    if (data.length < pageSize) return invitations;
  }
}

export async function uploadPrivateAttachment(
  organizationId: string,
  recordId: string,
  file: File,
) {
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (!allowedTypes.includes(file.type))
    throw new Error("Envie um arquivo PDF, JPEG ou PNG.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("O arquivo deve ter no máximo 20 MB.");
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
  const path = `${organizationId}/${recordId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from("medsync-private")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function openPrivateAttachment(path: string) {
  const { data, error } = await supabase.storage
    .from("medsync-private")
    .createSignedUrl(path, 60);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
