/**
 * Display order by date of birth.
 * Changing display order is a config change only.
 */
export const PROJECT_DISPLAY_ORDER = [
  "BOULEVARD 5",
  "BENESTARE",
  "BOSQUE LAS TAPIAS",
  "SANTA ELENA",
] as const;

export type ProjectChoice = { id: string; label: string };

export function projectKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

const DISPLAY_PROJECT_KEYS = new Set(PROJECT_DISPLAY_ORDER.map((name) => projectKey(name)));

/** True for the four names in PROJECT_DISPLAY_ORDER. Casa Elisa and any other project are false. */
export function isDisplayProject(label: string): boolean {
  return DISPLAY_PROJECT_KEYS.has(projectKey(label));
}

export function compareProjectLabels(a: string, b: string): number {
  const rank = (label: string) => {
    const key = projectKey(label);
    const index = PROJECT_DISPLAY_ORDER.findIndex((name) => projectKey(name) === key);
    return index === -1 ? PROJECT_DISPLAY_ORDER.length : index;
  };
  const diff = rank(a) - rank(b);
  return diff !== 0 ? diff : a.localeCompare(b, "es");
}

export function sortByProjectLabel<T extends { label: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => compareProjectLabels(a.label, b.label));
}

/** TODOS is the pill row's own control. This list is only the four names in PROJECT_DISPLAY_ORDER. Unmatched names keep an empty id until the dimension arrives. */
export function projectPillOptions(choices: readonly ProjectChoice[]): ProjectChoice[] {
  const byKey = new Map<string, ProjectChoice>();
  for (const choice of choices) {
    const key = projectKey(choice.label);
    if (!byKey.has(key)) byKey.set(key, choice);
  }
  const ordered: ProjectChoice[] = [];
  for (const name of PROJECT_DISPLAY_ORDER) {
    const match = byKey.get(projectKey(name));
    ordered.push(match ? { id: match.id, label: name } : { id: "", label: name });
  }
  return ordered;
}
