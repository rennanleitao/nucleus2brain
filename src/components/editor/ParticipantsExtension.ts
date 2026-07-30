import { Node, mergeAttributes, nodeInputRule } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ParticipantsNodeView } from "./ParticipantsNodeView";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    participants: {
      setParticipants: (names?: string[]) => ReturnType;
    };
  }
}

function parseNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      return value.split(",").map((n) => n.trim()).filter(Boolean);
    }
  }
  return [];
}

export const Participants = Node.create({
  name: "participants",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      names: {
        default: [] as string[],
        parseHTML: (element) => parseNames(element.getAttribute("data-names")),
        renderHTML: (attributes) => ({ "data-names": JSON.stringify(attributes.names || []) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-participants]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const names: string[] = node.attrs.names || [];
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-participants": "", class: "note-participants" }),
      ["span", { class: "note-participants-label" }, "Participantes"],
      ...names.map((n) => ["span", { class: "note-participants-chip" }, n] as any),
    ];
  },

  addCommands() {
    return {
      setParticipants:
        (names = []) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { names } }),
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        // "participantes" / "participants" at the start of a line, followed by ":" or space
        find: /^(participantes|participants)\s*[:\s]$/i,
        type: this.type,
        getAttributes: () => ({ names: [] }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ParticipantsNodeView);
  },
});
