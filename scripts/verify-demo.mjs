import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const url = "https://lchejzmcvogqcsgjbdde.supabase.co";
const key = "sb_publishable_615YnQk_FsFXLP0bz87wmw_tbEiuiGR";
const accounts = JSON.parse(await fs.readFile(".demo-accounts.json", "utf8"));
const clients = [];
for (const account of accounts) {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  assert.equal(error, null, "Login " + account.name);
  clients.push({ db, account, session: data.session });
}
const [timmy, john] = clients;
async function call(client, body) {
  const r = await fetch(url + "/functions/v1/notionary", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${client.session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}
for (const c of clients) {
  const profile = await call(c, { action: "profile" });
  assert.equal(profile.status, 200, JSON.stringify(profile.body));
  assert.equal(profile.body.name, c.account.name);
  const other = clients.find((o) => o.account.id !== c.account.id);
  const cross = await c.db.from("learning_profiles").select("*").eq("user_id", other.account.id);
  assert.equal(cross.error, null);
  assert.deepEqual(cross.data, []);
  const all = await c.db.from("learning_profiles").select("*");
  assert.equal(all.data.length, 1);
  const change = await c.db
    .from("learning_profiles")
    .update({ user_id: other.account.id })
    .eq("user_id", c.account.id);
  assert.ok(change.error);
  const sharedWrite = await c.db
    .from("sources")
    .update({ excerpt: "malicious" })
    .eq("id", "ann-original");
  assert.ok(sharedWrite.error);
  console.log(
    c.account.name +
      ": real login, own profile, cross-user read denied, ownership mutation denied, shared write denied.",
  );
}
const anonymous = await fetch(url + "/functions/v1/notionary", {
  method: "POST",
  headers: { apikey: key, "content-type": "application/json" },
  body: JSON.stringify({ action: "overview" }),
});
assert.equal(anonymous.status, 401);
console.log("Unauthenticated function request denied.");
const before = await call(timmy, { action: "overview" });
assert.equal(before.status, 200, JSON.stringify(before.body));
const sources = before.body.sources;
assert.ok(sources.filter((s) => s.kind === "course").length >= 3);
assert.ok(sources.every((s) => s.notionUrl.startsWith("https://")));
const otherOverview = await call(john, { action: "overview" });
assert.deepEqual(otherOverview.body.deadline, before.body.deadline);
assert.equal(otherOverview.body.canRevise, false);
assert.equal(before.body.canRevise, true);
const denied = await call(john, { action: "revise" });
assert.equal(denied.status, 403);
console.log(
  "Both users share the course source store and current deadline; editor control enforced.",
);
const answers = [];
for (const c of clients) {
  const answer = await call(c, {
    action: "ask",
    question: "What's the difference between a virtual machine and a container?",
  });
  assert.equal(answer.status, 200, JSON.stringify(answer.body));
  assert.ok(answer.body.blocks.some((b) => b.citations.length));
  assert.ok(
    answer.body.blocks.every((b) => b.citations.every((id) => sources.some((s) => s.id === id))),
  );
  assert.ok(!JSON.stringify(answer.body).includes(clients.find((x) => x !== c).account.name));
  answers.push({ name: c.account.name, ...answer.body });
  console.log(
    c.account.name +
      ": live AI returned " +
      answer.body.blocks.length +
      " blocks with resolvable citations.",
  );
}
assert.notDeepEqual(answers[0].blocks, answers[1].blocks);
const unsupported = await call(john, { action: "ask", question: "What is the capital of France?" });
assert.equal(unsupported.status, 200);
assert.ok(unsupported.body.blocks.every((b) => b.citations.length === 0));
console.log("Unsupported question acknowledged without invented citations.");
const invalid = await call(timmy, {
  action: "revise",
  requestId: crypto.randomUUID(),
  announcement: "Demo invalid date",
  assessment: before.body.deadline.assessment,
  newDueISO: "2026-02-30T17:00",
  expectedVersion: before.body.version,
});
assert.equal(invalid.status, 400);
assert.deepEqual((await call(timmy, { action: "overview" })).body.deadline, before.body.deadline);
console.log("Failed revision leaves published deadline unchanged.");
if (process.argv.includes("--revise")) {
  const newDueISO = "2026-10-19T17:00";
  const input = {
    action: "revise",
    requestId: crypto.randomUUID(),
    announcement:
      "DEMO FIXTURE — the VMs and Containers Exercise deadline has been extended to 19 October 2026 at 17:00 (Europe/Dublin). These dates are invented.",
    assessment: before.body.deadline.assessment,
    newDueISO,
    expectedVersion: before.body.version,
  };
  const revised = await call(timmy, input);
  assert.equal(revised.status, 200, JSON.stringify(revised.body));
  assert.match(revised.body.deadline.dueISO, /2026-10-19T16:00/);
  assert.ok(revised.body.sources.some((s) => s.id === "ann-original" && s.status === "superseded"));
  const retry = await call(timmy, input);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.version, revised.body.version);
  assert.equal(retry.body.sources.filter((s) => s.id === input.requestId).length, 1);
  const visible = await call(john, { action: "overview" });
  assert.deepEqual(visible.body.deadline, revised.body.deadline);
  for (const c of clients) {
    const a = await call(c, { action: "ask", question: "When is the exercise deadline?" });
    assert.ok(a.body.blocks[0].citations.includes(input.requestId));
  }
  console.log(
    "Revision published once; retry does not duplicate; original preserved; both students see and cite the new deadline.",
  );
}
await fs.writeFile(".demo-answers.local.json", JSON.stringify(answers, null, 2) + "\n");
console.log("Demo verification passed.");
