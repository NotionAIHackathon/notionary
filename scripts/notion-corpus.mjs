import fs from "node:fs/promises";
const env = Object.fromEntries(
  (await fs.readFile(".env.backend.local", "utf8"))
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    }),
);
async function get(path) {
  const r = await fetch("https://api.notion.com/v1/" + path, {
    headers: { Authorization: `Bearer ${env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28" },
  });
  if (!r.ok) throw new Error(`Notion API returned ${r.status} for ${path}`);
  return r.json();
}
async function blocks(id) {
  const out = [];
  let cursor;
  do {
    const page = await get(
      `blocks/${id}/children?page_size=100${cursor ? "&start_cursor=" + cursor : ""}`,
    );
    for (const b of page.results) {
      const value = b[b.type];
      if (b.type === "table_row")
        out.push(
          "| " +
            value.cells
              .map((c) => c.map((t) => t.plain_text ?? t.text?.content ?? "").join(""))
              .join(" | ") +
            " |",
        );
      else {
        const text = (value?.rich_text || [])
          .map((t) => t.plain_text ?? t.text?.content ?? "")
          .join("");
        if (text) out.push((b.type.startsWith("heading") ? "## " : "") + text);
      }
      if (b.has_children && b.type !== "child_page") out.push(...(await blocks(b.id)));
    }
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return out;
}
const defs = [
  [
    "dc83c70a-6285-83e3-a786-01ed1b21172b",
    "Lecture · W2 Intro to virtualisation",
    "VMs vs Containers; characteristics; source ambiguity",
    (text) => {
      const start = text.indexOf("## VMs vs Containers");
      const end = text.indexOf("## Components of containerised apps", start);
      const comparison = text.slice(start, end);
      const early = text
        .split("\n")
        .filter(
          (s) =>
            s.startsWith("Containers are a lighter-weight") ||
            s.startsWith("Containers use a form"),
        );
      const tableStart = text.indexOf("## Comparison of Virtualisation");
      return [
        "SOURCE NOTE: The early passage below says containers include the OS and do not use a hypervisor; later passages describe shared kernels. Preserve and discuss this ambiguity, including Docker Desktop.",
        ...early,
        comparison,
        tableStart >= 0
          ? text.slice(tableStart, text.indexOf("## VMs vs Containers", tableStart))
          : "",
      ].join("\n\n");
    },
  ],
  [
    "c543c70a-6285-8258-a992-8141222c14df",
    "Tutorial · practical1",
    "Before you begin; Exercise Two, Task 3 · lecturer prompt (not student answers)",
    (text) => {
      const first = text.indexOf("What is Docker?");
      const firstEnd = text.indexOf("Work with the documentation", first);
      const start = text.indexOf("Task 3: Some of you are on Linux");
      const end = text.indexOf("## Exercise Three", start);
      return (
        "Selected lecturer instructions/questions only; student-written answers elsewhere in this page are excluded.\n\n" +
        text.slice(first, firstEnd) +
        "\n\n" +
        text.slice(start, end)
      );
    },
  ],
  [
    "2613c70a-6285-82b9-a278-01e85e924a8f",
    "Historical exam · 2022/23 Cloud Computing",
    "Question 1, part 5 (Q1E), 7% · historical paper",
    (text) => {
      const lines = text.split("\n");
      return (
        "Historical 2022/23 exam — not the current year assessment.\n" +
        lines
          .filter((s) => /100 words|differences between virtual machines|2022|2023/.test(s))
          .join("\n")
      );
    },
  ],
];
const sources = [];
for (const [id, title, reference, select] of defs) {
  const page = await get("pages/" + id);
  const text = (await blocks(id)).join("\n");
  const excerpt = select(text).trim();
  if (excerpt.length < 80) throw new Error("Empty selected source " + id);
  sources.push({
    id,
    module_id: "COMP30520",
    kind: "course",
    title,
    reference,
    excerpt,
    notion_url: page.url,
    is_demo: false,
  });
  console.log(`${title}: ${excerpt.length} characters selected from real Notion API read`);
}
// Discover added readable sources beneath Demo, excluding app-owned announcement pages.
let cursor;
do {
  const children = await get(
    `blocks/3f43c70a-6285-806a-98e5-e77839ad5c74/children?page_size=100${cursor ? "&start_cursor=" + cursor : ""}`,
  );
  for (const b of children.results) {
    if (b.type !== "child_page" || sources.some((s) => s.id === b.id)) continue;
    const title = b.child_page.title;
    if (title.startsWith("Demo deadline revision ") || title.startsWith("Demo fixture —")) continue;
    const page = await get("pages/" + b.id);
    const text = (await blocks(b.id)).join("\n").trim();
    if (!text) {
      console.log("Skipped unreadable/attachment-only page: " + title);
      continue;
    }
    const isDemo = /synthetic|demo/i.test(title);
    sources.push({
      id: b.id,
      module_id: "COMP30520",
      kind: "course",
      title,
      reference: isDemo
        ? "Synthetic demo source — not an actual class record"
        : "Demo source page · readable text",
      excerpt: text,
      notion_url: page.url,
      is_demo: isDemo,
    });
    console.log(
      `${title}: ${text.length} characters synced${isDemo ? " (labelled synthetic demo)" : ""}`,
    );
  }
  cursor = children.has_more ? children.next_cursor : undefined;
} while (cursor);
await fs.writeFile("supabase/corpus.json", JSON.stringify(sources, null, 2) + "\n");
