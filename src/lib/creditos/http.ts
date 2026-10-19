import { jsonError } from "@/lib/api";
import { createUserClient, getUserRole } from "@/lib/auth";
import { CreditoService, DomainError } from "./service";
import { RepoError, ReservationConflictError } from "./repo";
import { SupabaseCreditoRepo } from "./supabase-repo";

/** Authenticate and query with the same user session so RLS applies to every call. */
export async function requireCreditoService() {
  const client = await createUserClient();
  if (!client) return { response: jsonError(500, "Faltan variables de entorno de Supabase") };
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { response: jsonError(401, "No autorizado") };
  const role = getUserRole(data.user);
  if (role !== "creditos" && role !== "master") {
    return { response: jsonError(403, "No autorizado") };
  }
  return { user: data.user, service: new CreditoService(new SupabaseCreditoRepo(client)) };
}

export function creditoError(error: unknown) {
  if (error instanceof ReservationConflictError) return jsonError(409, error.message);
  if (error instanceof DomainError) return jsonError(400, error.message);
  console.error("[creditos]", error);
  return jsonError(500, error instanceof RepoError ? error.message : "No se pudo completar la operación. Intente de nuevo.");
}
