import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { FileText, Plus } from "lucide-react";

interface NoteItem {
  id: string;
  title: string;
}

interface MentionListProps {
  items: NoteItem[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef<any, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        if (item.id === "__create__") {
          command({ id: "__create__", label: item.title });
        } else {
          command({ id: item.id, label: item.title });
        }
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) return null;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden py-1 min-w-[200px] max-w-[320px] z-50">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "text-foreground hover:bg-accent/50"
            }`}
          >
            {item.id === "__create__" ? (
              <Plus className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            )}
            <span className="truncate">{item.title}</span>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = "MentionList";

export function createNoteMentionSuggestion(
  fetchNotesFn: () => Promise<NoteItem[]>
) {
  return {
    char: "@",
    items: async ({ query }: { query: string }) => {
      const notes = await fetchNotesFn();
      const filtered = notes.filter((n) =>
        n.title.toLowerCase().includes(query.toLowerCase())
      );

      const results = filtered.slice(0, 8);

      if (query.trim().length > 0) {
        results.push({
          id: "__create__",
          title: `Criar nota "${query.trim()}"`,
        });
      }

      return results;
    },
    render: () => {
      let component: ReactRenderer | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },
        onUpdate: (props: any) => {
          component?.updateProps(props);
          if (popup && props.clientRect) {
            popup[0]?.setProps({
              getReferenceClientRect: props.clientRect,
            });
          }
        },
        onKeyDown: (props: any) => {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }
          return (component?.ref as any)?.onKeyDown(props);
        },
        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}
