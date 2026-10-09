import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const envText = await fs.readFile(".env.admin.local", "utf8");
const secret = envText.split("\n").find((line) => line.startsWith("SUPABASE_SECRET_KEY="))
  ?.slice("SUPABASE_SECRET_KEY=".length).trim().replace(/^['"]|['"]$/g, "");
assert.ok(secret, "Local admin key is required");
const url = "https://lchejzmcvogqcsgjbdde.supabase.co";
const publicKey = "sb_publishable_615YnQk_FsFXLP0bz87wmw_tbEiuiGR";
const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const accounts = JSON.parse(await fs.readFile("src/lib/judge-demo.json", "utf8"));
function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}
const users = checked(await db.auth.admin.listUsers({ perPage: 100 })).users;
let baseline;
for (const account of accounts) {
  const user = users.find((user) => user.email === account.email)
    ?? checked(await db.auth.admin.createUser({
      email: account.email, password: account.password, email_confirm: true,
    })).user;
  checked(await db.from("module_memberships").upsert({
    module_id: "COMP30520", user_id: user.id, role: "student",
  }));
  checked(await db.from("learning_profiles").upsert({
    user_id: user.id, student_id: account.level === "Beginner" ? "timmy" : "john", name: account.name,
    level: account.level, preferences: account.preferences,
  }));
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  checked(await client.auth.signInWithPassword({ email: account.email, password: account.password }));
  const own = checked(await client.from("learning_profiles").select("user_id,name"));
  assert.deepEqual(own, [{ user_id: user.id, name: account.name }]);
  const overview = checked(await client.functions.invoke("notionary", { body: { action: "overview" } }));
  assert.equal(overview.canRevise, false);
  assert.ok(overview.sources.length >= 5);
  const shared = { sources: overview.sources, deadline: overview.deadline };
  if (baseline) assert.deepEqual(shared, baseline);
  baseline = shared;
  const denied = await client.functions.invoke("notionary", { body: { action: "revise" } });
  assert.equal(denied.error?.context?.status, 403);
  console.log(`${account.name}: login works; own profile only; shared sources and deadline; revision denied.`);
}
