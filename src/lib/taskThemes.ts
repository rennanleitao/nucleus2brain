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