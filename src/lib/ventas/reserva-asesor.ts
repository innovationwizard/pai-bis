const COLUMN_MISS = /asesor_id|PGRST204|42703|schema cache|does not exist/i;

let asesorColumnReady: boolean | null = null;

export function creditedAsesor(
  dealAsesorId: string,
  activityAsesorId: string | null,
  notRepIds: ReadonlySet<string>,
): string | null {
  if (!notRepIds.has(dealAsesorId)) return dealAsesorId;
  if (activityAsesorId && !notRepIds.has(activityAsesorId)) return activityAsesorId;
  return null;
}

export async function factComprobanteHasAsesor(
  probe: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<boolean> {
  if (asesorColumnReady === true) return true;
  const result = await probe();
  if (!result.error) {
    asesorColumnReady = true;
    return true;
  }
  if (COLUMN_MISS.test(result.error.message)) return false;
  throw new Error(result.error.message);
}
