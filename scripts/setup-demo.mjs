import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const readEnv = async (path) =>
  Object.fromEntries(
    (await fs.readFile(path, "utf8"))
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [
          l.slice(0, i).trim(),
          l
            .slice(i + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
const env = { ...(await readEnv(".env.backend.local")), ...(await readEnv(".env.admin.local")) };
const db = createClient("https://lchejzmcvogqcsgjbdde.supabase.co", env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function check(r) {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
let accounts;
try {
  accounts = JSON.parse(await fs.readFile(".demo-accounts.json", "utf8"));
} catch {
  accounts = [];
}
const existing = check(await db.auth.admin.listUsers({ perPage: 100 })).users;
for (const [name, level, preferences, role] of [
  ["Timmy", "Beginner", ["Analogies", "Worked examples"], "editor"],
  [
    "John",
    "Understands the basics",
    ["Concise exam-focused explanations", "Challenging practice"],
    "student",
  ],
]) {
  let account = accounts.find((a) => a.name === name);
  if (!account) {
    const email = name.toLowerCase() + ".notionary@example.com";
    if (existing.some((u) => u.email === email))
      throw new Error(
        "An existing demo account has no local password; restore .demo-accounts.json before rerunning.",
      );
    const password = randomBytes(18).toString("base64url");
    const { user } = check(
      await db.auth.admin.createUser({ email, password, email_confirm: true }),
    );
    account = { name, email, password, id: user.id };
    accounts.push(account);
    await fs.writeFile(".demo-accounts.json", JSON.stringify(accounts, null, 2) + "\n", {
      mode: 0o600,
    });
  }
  check(
    await db
      .from("module_memberships")
      .upsert({ module_id: "COMP30520", user_id: account.id, role }),
  );
  check(
    await db
      .from("learning_profiles")
      .upsert({ user_id: account.id, student_id: name.toLowerCase(), name, level, preferences }),
  );
  console.log(name + " account and private profile ready.");
}
check(
  await db.from("sources").upsert(JSON.parse(await fs.readFile("supabase/corpus.json", "utf8"))),
);
// Recover an existing serving announcement; never reset an already revised deadline.
let announcement = check(
  await db.from("sources").select("*").eq("id", "ann-original").maybeSingle(),
);
if (!announcement) {
  const title = "Demo fixture — VMs and Containers Exercise — Original deadline";
  const request = async (path, method = "GET", body) => {
    const r = await fetch("https://api.notion.com/v1/" + path, {
      method,
      headers: {
        Authorization: `Bearer ${env.NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error("Notion original announcement write failed: " + r.status);
    return r.json();
  };
  const parent = "3f43c70a-6285-806a-98e5-e77839ad5c74";
  let page;
  let cursor;
  do {
    const children = await request(
      `blocks/${parent}/children?page_size=100${cursor ? "&start_cursor=" + cursor : ""}`,
    );
    page = children.results.find((b) => b.type === "child_page" && b.child_page.title === title);
    cursor = children.has_more ? children.next_cursor : undefined;
  } while (cursor && !page);
  const excerpt =
    "DEMO FIXTURE — invented dates, not an actual course deadline. The VMs and Containers Exercise is due on 16 October 2026 at 17:00 (Europe/Dublin).";
  if (!page)
    page = await request("pages", "POST", {
      parent: { page_id: parent },
      properties: { title: { title: [{ text: { content: title } }] } },
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: excerpt } }] },
        },
      ],
    });
  announcement = {
    id: "ann-original",
    module_id: "COMP30520",
    kind: "announcement",
    title,
    reference: "Demo announcement · Original deadline",
    excerpt,
    notion_url: "https://www.notion.so/" + page.id.replaceAll("-", ""),
    is_demo: true,
    status: "current",
  };
  check(await db.from("sources").insert(announcement));
}
const assessment = check(
  await db.from("assessments").select("id").eq("id", "vm-containers-exercise").maybeSingle(),
);
if (!assessment)
  check(
    await db.from("assessments").insert({
      id: "vm-containers-exercise",
      module_id: "COMP30520",
      title: "VMs and Containers Exercise",
      due_at: "2026-10-16T16:00:00Z",
      source_id: "ann-original",
    }),
  );
console.log(
  "Shared sources and original deadline ready. Credentials are in ignored .demo-accounts.json.",
);
