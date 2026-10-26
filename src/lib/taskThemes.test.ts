import { describe, expect, it } from "vitest";
import { normalizeTaskThemes, shouldRenderTaskGroups } from "./taskThemes";

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

describe("Visão Por Responsável", () => {
  it.each(["planner", "todo", "today", "week", "month", "done"])("não é substituída por agrupamentos na aba %s", filter => {
    expect(shouldRenderTaskGroups(filter, "owner", "owner", ["space", "theme"])).toBe(false);
  });
  it("mantém agrupamentos na Lista", () => {
    expect(shouldRenderTaskGroups("planner", "list", "owner", ["space", "theme"])).toBe(true);
  });
});