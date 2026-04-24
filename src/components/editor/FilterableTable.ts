import Table from "@tiptap/extension-table";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FilterableTableNodeView } from "./FilterableTableNodeView";

export const FilterableTable = Table.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FilterableTableNodeView, {
      contentDOMElementTag: "tbody",
    });
  },
});
