import { Node, mergeAttributes } from "@tiptap/react";

export interface IframeOptions {
  allowFullscreen: boolean;
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    iframe: {
      setIframe: (options: { src: string; title?: string }) => ReturnType;
    };
  }
}

export const Iframe = Node.create<IframeOptions>({
  name: "iframe",
  group: "block",
  atom: true,

  addOptions() {
    return {
      allowFullscreen: true,
      HTMLAttributes: {
        class: "iframe-wrapper",
      },
    };
  },

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
      frameborder: { default: "0" },
      allowfullscreen: { default: this.options.allowFullscreen },
      style: { default: "width: 100%; height: 500px; border: 1px solid hsl(var(--border)); border-radius: 8px;" },
    };
  },

  parseHTML() {
    return [{ tag: "iframe" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { class: "iframe-embed my-3" }, ["iframe", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]];
  },
});
