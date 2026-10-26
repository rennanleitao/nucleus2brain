import { describe, expect, it } from "vitest";
import { buildTaskThemeBuckets, isTaskWithoutTheme, normalizeTaskThemes, shouldRenderTaskGroups } from "./taskThemes";

describe("Temas de atividades", () => {
  it("não permite Tema sem Space", () => {
    expect(() => normalizeTaskThemes(null, ["Projetos estratégicos"])).toThrow("Selecione um Space");
  });
  it("aceita vários Temas no mesmo Space", () => {
    expect(normalizeTaskThemes("space-cliente", ["Projetos estratégicos", "Pessoas-chave"])).toEqual(["Projetos estratégicos", "Pessoas-chave"]);
  });
  it("não repete um Tema com caixa ou espaços diferentes", () => {
    expect(normalizeTaskThemes("space-cliente", [" Pessoas-chave ", "pessoas-chave"])).toEqual(["Pessoas-chave"]);
  });
});

describe("Agrupamento por Tema", () => {
  const themed = { id: "t1", space_id: "space-a", themes: ["Projetos estratégicos"], spaces: { name: "Cliente A" } };
  const untitled = { id: "t2", space_id: "space-a", themes: [], spaces: { name: "Cliente A" } };

  it("não cria um grupo “Sem Tema”", () => {
    const buckets = buildTaskThemeBuckets([themed, untitled]);
    expect(buckets.map(b => b.label)).toEqual(["Projetos estratégicos"]);
    expect(buckets.some(b => /sem tema/i.test(b.label))).toBe(false);
  });

  it("deixa atividades sem tema fora de qualquer grupo", () => {
    expect(buildTaskThemeBuckets([untitled])).toEqual([]);
    expect(isTaskWithoutTheme(untitled)).toBe(true);
    expect(isTaskWithoutTheme(themed)).toBe(false);
  });

  it("separa o mesmo Tema quando pertence a Spaces diferentes", () => {
    const buckets = buildTaskThemeBuckets([
      { space_id: "space-a", themes: ["Pessoas-chave"], spaces: { name: "Cliente A" } },
      { space_id: "space-b", themes: ["Pessoas-chave"], spaces: { name: "Cliente B" } },
    ]);
    expect(buckets.map(b => `${b.label} — ${b.sublabel}`)).toEqual(["Pessoas-chave — Cliente A", "Pessoas-chave — Cliente B"]);
  });
});

describe("Visão Por Responsável", () => {
  it.each(["planner", "todo", "today", "week", "month", "done"])("não é substituída por agrupamentos na aba %s", filter => {
    expect(shouldRenderTaskGroups(filter, "owner", "owner", ["space", "theme"])).toBe(false);
  });
  it("mantém agrupamentos na Lista", () => {
    expect(shouldRenderTaskGroups("planner", "list", "owner", ["space", "theme"])).toBe(true);
  });
});
