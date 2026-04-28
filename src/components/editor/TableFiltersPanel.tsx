import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Columns3, Rows3, Plus, Minus, Trash2 } from "lucide-react";

interface TableFiltersPanelProps {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

const TABLE_ACTIONS: Array<{
  key: string;
  label: string;
  icon: typeof Plus;
  command: "addColumnAfter" | "addRowAfter" | "deleteColumn" | "deleteRow" | "deleteTable";
  destructive?: boolean;
}> = [
  { key: "add-column", label: "Coluna", icon: Columns3, command: "addColumnAfter" },
  { key: "add-row", label: "Linha", icon: Rows3, command: "addRowAfter" },
  { key: "remove-column", label: "Coluna", icon: Minus, command: "deleteColumn", destructive: true },
  { key: "remove-row", label: "Linha", icon: Minus, command: "deleteRow", destructive: true },
  { key: "delete-table", label: "Tabela", icon: Trash2, command: "deleteTable", destructive: true },
];

export function TableFiltersPanel({ editor }: TableFiltersPanelProps) {
  if (!editor) return null;

  const getActiveTableElement = () => {
    const node = editor.view.domAtPos(editor.state.selection.from).node;
    const element = node instanceof HTMLElement ? node : node.parentElement;
    return element?.closest("table.note-table") as HTMLTableElement | null;
  };

  const runTableCommand = (command: (typeof TABLE_ACTIONS)[number]["command"]) => {
    const chain = editor.chain().focus() as any;
    const commandFn = chain[command];
    if (typeof commandFn !== "function") return;
    commandFn.call(chain).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableBubbleMenu"
      options={{ placement: "top", offset: 8 }}
      shouldShow={() => Boolean(getActiveTableElement())}
      getReferencedVirtualElement={() => {
        const table = getActiveTableElement();
        return table ? { getBoundingClientRect: () => table.getBoundingClientRect() } : null;
      }}
      className="z-50 flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1 py-0.5 shadow-elevated"
    >
      <div className="flex items-center gap-0.5" onMouseDown={(event) => event.preventDefault()}>
        {TABLE_ACTIONS.map((action, index) => {
          const Icon = action.icon;
          const showDivider = index === 2 || index === 4;

          return (
            <div key={action.key} className="flex items-center gap-0.5">
              {showDivider && <div className="mx-0.5 h-4 w-px bg-border" />}
              <button
                type="button"
                title={
                  action.command === "addColumnAfter"
                    ? "Adicionar coluna"
                    : action.command === "addRowAfter"
                    ? "Adicionar linha"
                    : action.command === "deleteColumn"
                    ? "Remover coluna"
                    : action.command === "deleteRow"
                    ? "Remover linha"
                    : "Excluir tabela"
                }
                onClick={() => runTableCommand(action.command)}
                className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors hover:bg-accent ${
                  action.destructive ? "text-destructive" : "text-foreground"
                }`}
              >
                {action.command === "addColumnAfter" || action.command === "addRowAfter" ? (
                  <Plus className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                <span>{action.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </BubbleMenu>
  );
}