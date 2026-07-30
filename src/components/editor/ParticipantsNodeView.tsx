import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Users, X, Plus } from "lucide-react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ParticipantsNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const names: string[] = Array.isArray(node.attrs.names) ? node.attrs.names : [];
  const [input, setInput] = useState("");
  const editable = editor.isEditable;
  const inputRef = useRef<HTMLInputElement>(null);

  // Freshly inserted block (still empty) → focus the name field so the user can
  // just keep typing the participants right after writing "participantes:".
  useEffect(() => {
    if (!editable || names.length > 0 || !editor.isFocused) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .filter((n) => !names.some((existing) => existing.toLowerCase() === n.toLowerCase()));
    if (parts.length === 0) return;
    updateAttributes({ names: [...names, ...parts] });
    setInput("");
  };

  const remove = (name: string) => {
    updateAttributes({ names: names.filter((n) => n !== name) });
  };

  return (
    <NodeViewWrapper className="note-participants-wrapper my-3" data-drag-handle>
      <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Participantes
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {names.map((name) => (
            <span
              key={name}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background pl-1 pr-2.5 py-1"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {initials(name)}
              </span>
              <span className="text-xs text-foreground leading-none">{name}</span>
              {editable && (
                <button
                  type="button"
                  onClick={() => remove(name)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  title="Remover participante"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}

          {editable && (
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1">
              <Plus className="h-3 w-3 text-muted-foreground" />
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    add(input);
                  } else if (e.key === "Backspace" && !input && names.length > 0) {
                    e.preventDefault();
                    remove(names[names.length - 1]);
                  }
                }}
                onBlur={() => add(input)}
                placeholder={names.length === 0 ? "Nome do participante" : "Adicionar"}
                className="bg-transparent outline-none text-xs w-28 placeholder:text-muted-foreground"
              />
            </span>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
