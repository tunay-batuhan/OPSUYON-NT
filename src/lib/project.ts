import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export type ProjectContext = {
  project: Project & { organizations: { id: string; name: string } | null };
  /** Effective permissions of the caller on this project (global ones included for staff). */
  perms: Set<string>;
};

/** Loads a project through RLS (404 if the caller cannot see it) plus the caller's effective permissions. */
export const getProjectContext = cache(async (id: string): Promise<ProjectContext> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const [{ data: project }, { data: perms }] = await Promise.all([
    supabase.from("projects").select("*, organizations(id, name)").eq("id", id).maybeSingle(),
    supabase.rpc("my_project_permissions", { p_project_id: id }),
  ]);
  if (!project) notFound();

  return {
    project: project as ProjectContext["project"],
    perms: new Set((perms as string[] | null) ?? []),
  };
});

export function can(ctx: ProjectContext, permission: string) {
  return ctx.perms.has(permission);
}
