import Heading from "@tiptap/extension-heading";

// Extends the default Heading node with a `dataEntryDate` attribute so
// date-entry markers persist through HTML <-> ProseMirror roundtrips.
export const DateHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      dataEntryDate: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-entry-date"),
        renderHTML: (attributes) => {
          if (!attributes.dataEntryDate) return {};
          return {
            "data-entry-date": attributes.dataEntryDate,
            id: `entry-${attributes.dataEntryDate}`,
            class: "note-date-entry",
          };
        },
      },
    };
  },
});
