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

/** Canonical names first, then any other project. Unmatched canonical names keep an empty id until the dimension arrives. */
export function projectPillOptions(choices: readonly ProjectChoice[]): ProjectChoice[] {
  const byKey = new Map<string, ProjectChoice>();
  for (const choice of choices) {
    const key = projectKey(choice.label);
    if (!byKey.has(key)) byKey.set(key, choice);
  }
  const used = new Set<string>();
  const ordered: ProjectChoice[] = [];
  for (const name of PROJECT_DISPLAY_ORDER) {
    const match = byKey.get(projectKey(name));
    if (!match) {
      ordered.push({ id: "", label: name });
      continue;
    }
    used.add(match.id);
    ordered.push({ id: match.id, label: name });
  }
  const extras = choices.filter((choice) => !used.has(choice.id));
  extras.sort((a, b) => compareProjectLabels(a.label, b.label));
  for (const extra of extras) ordered.push(extra);
  return ordered;
}
