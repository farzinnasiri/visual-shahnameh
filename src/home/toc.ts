/** Shape of src/content/toc.json, built by scripts/build_toc.py from the text. */
export interface Toc {
  /** Retired heading-only IDs redirect to their intact reading section. */
  sectionAliases: Record<string, string>;
  /** The book's traditional ages, in order. */
  eras: { id: string; title: string }[];
  chapters: {
    id: string;
    title: string;
    era: string;
    /** [section id, title, couplet count]. The id is chapter.place, as in "10.01". */
    sections: [string, string, number][];
  }[];
}
