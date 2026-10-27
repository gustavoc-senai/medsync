export type Membership = { organization_id: string; role: string; status?: string };
export type ResolvedMembership = Membership & { conflict: boolean };

export function mergeMemberships(organization: Membership[], portal: Membership[]): ResolvedMembership[] {
  const merged = new Map<string, ResolvedMembership>();
  for (const member of [...organization, ...portal]) {
    const role = String(member.role || "").trim().toLowerCase();
    const previous = merged.get(member.organization_id);
    merged.set(member.organization_id, {
      ...member, role,
      status: member.status || previous?.status || "active",
      conflict: !!previous && (previous.conflict || previous.role !== role),
    });
  }
  return [...merged.values()].sort((a, b) => a.organization_id.localeCompare(b.organization_id));
}

export function selectMembership(members: ResolvedMembership[], preferred: string) {
  const selected = members.find((member) => member.organization_id === preferred) ||
    members.find((member) => !member.conflict && member.status === "active") || members[0];
  if (!selected) return null;
  if (selected.conflict) throw new Error("Esta conta tem perfis conflitantes na clínica. Solicite ao administrador a revisão do seu acesso.");
  if (selected.status !== "active") throw new Error("Seu acesso a esta clínica está suspenso. Entre em contato com o administrador.");
  return selected;
}
