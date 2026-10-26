export function normalizeTaskThemes(spaceId: string | null | undefined, themes: string[]): string[] {
  if (!spaceId && themes.some(name => name.trim())) throw new Error("Selecione um Space antes de adicionar Temas.");
  const unique = new Map<string, string>();
  for (const value of themes) {
    const name = value.trim().replace(/\s+/g, " ");
    if (name && !unique.has(name.toLocaleLowerCase("pt-BR"))) unique.set(name.toLocaleLowerCase("pt-BR"), name);
  }
  return [...unique.values()];
}

export function shouldRenderTaskGroups(filter: string, plannerView: string, viewMode: string, dimensions: string[]): boolean {
  return dimensions.length > 0 && (filter === "planner" ? plannerView === "list" : viewMode === "list");
}

type ThemeableTask = {
  id?: string;
  space_id?: string | null;
  themes?: string[] | null;
  spaces?: { name?: string | null } | null;
};

export type TaskThemeBucket = {
  key: string;
  label: string;
  sublabel?: string;
  patch: { space_id: string; themeTarget: string };
  sortOrder: number;
};

export function buildTaskThemeBuckets(tasks: ThemeableTask[]): TaskThemeBucket[] {
  const seen = new Map<string, TaskThemeBucket>();
  for (const task of tasks) {
    if (!task.space_id) continue;
    for (const name of normalizeTaskThemes(task.space_id, task.themes || [])) {
      const key = JSON.stringify([task.space_id, name]);
      if (seen.has(key)) continue;
      seen.set(key, {
        key,
        label: name,
        sublabel: task.spaces?.name || undefined,
        patch: { space_id: task.space_id, themeTarget: name },
        sortOrder: 0,
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function taskMatchesThemeBucket(task: ThemeableTask, bucketKey: string): boolean {
  return (task.themes || []).some(name => JSON.stringify([task.space_id ?? null, name]) === bucketKey);
}

export function isTaskWithoutTheme(task: ThemeableTask): boolean {
  return !task.space_id || !(task.themes || []).some(name => name.trim());
}
