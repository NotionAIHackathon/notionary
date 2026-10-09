import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  addDeadlineRevision,
  askQuestion,
  getModuleOverview,
  getMyProfile,
  type Answer,
  type LearningProfile,
  type ModuleOverview,
  type Source,
} from "@/services/notionary";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Notionary — Cloud Computing study workspace" },
      {
        name: "description",
        content: "One shared course knowledge base, personalised teaching for every student.",
      },
      { property: "og:title", content: "Notionary — Cloud Computing study workspace" },
      {
        property: "og:description",
        content: "One shared course knowledge base, personalised teaching for every student.",
      },
    ],
  }),
  component: AuthenticatedWorkspace,
});

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; answer: Answer }
  | { role: "error"; text: string; retry: string };

const SUGGESTIONS = [
  "What’s the difference between a virtual machine and a container?",
  "When is the VMs and Containers Exercise due?",
];

function Workspace() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overview, setOverview] = useState<ModuleOverview | null>(null);
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      getModuleOverview()
        .then((o) => {
          if (active) {
            setOverview(o);
            setLoadError(null);
          }
        })
        .catch((e) => {
          if (active) setLoadError(e.message);
        });
    refresh();
    getMyProfile()
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      });
    const timer = setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const sourceById = (id: string) => overview?.sources.find((s) => s.id === id);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const answer = await askQuestion(q);
      setMessages((m) => [...m, { role: "assistant", answer }]);
      const first = answer.blocks.flatMap((b) => b.citations)[0];
      if (first) setSelected(first);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", text: (e as Error).message, retry: q }]);
    } finally {
      setLoading(false);
    }
  }

  // Ordered citation numbers across the whole conversation
  const citationOrder: string[] = [];
  messages.forEach((m) => {
    if (m.role === "assistant")
      m.answer.blocks.forEach((b) =>
        b.citations.forEach((c) => !citationOrder.includes(c) && citationOrder.push(c)),
      );
  });
  const numFor = (id: string) => citationOrder.indexOf(id) + 1;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
        <div className="px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-md bg-primary font-serif text-lg text-primary-foreground">
              N
            </div>
            <span className="font-serif text-xl font-semibold">Notionary</span>
          </div>
        </div>
        <nav className="flex-1 space-y-6 px-3 text-sm">
          <div>
            <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Modules
            </p>
            <div className="rounded-md bg-accent px-3 py-2 font-medium text-accent-foreground">
              Cloud Computing
            </div>
          </div>
          <div className="space-y-1">
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Workspace
            </p>
            <a href="#sources" className="block rounded-md px-3 py-2 hover:bg-secondary">
              Sources
            </a>
            <a href="#learning" className="block rounded-md px-3 py-2 hover:bg-secondary">
              My Learning
            </a>
          </div>
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="m-3 rounded-md border px-3 py-2 text-sm hover:bg-secondary"
        >
          Sign out
        </button>
        <div className="flex items-center gap-3 border-t px-5 py-4">
          <div className="grid size-9 place-items-center rounded-full bg-primary/15 font-medium text-primary">
            {profile?.name[0] ?? "·"}
          </div>
          <div className="text-sm">
            <p className="font-medium">{profile?.name ?? "Loading…"}</p>
            <p className="text-xs text-muted-foreground">Student</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b bg-demo/50 px-8 py-1.5 text-xs text-demo-foreground">
          <span>
            <strong>Connected demo</strong> · Shared Notion sources · Invented assignment dates
          </span>
          {overview?.canRevise && (
            <button
              onClick={() => setDialogOpen(true)}
              className="rounded border border-demo-foreground/30 bg-card px-2.5 py-1 font-medium hover:bg-secondary"
            >
              + Add deadline revision
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-8 py-8">
            {loadError && (
              <div role="alert" className="mb-4 rounded-md border p-4 text-sm text-destructive">
                {loadError}
                <button className="ml-3 underline" onClick={() => window.location.reload()}>
                  Reload
                </button>
              </div>
            )}
            {!overview ? (
              <div className="space-y-3">
                <div className="h-8 w-60 animate-pulse rounded bg-muted" />
                <div className="h-24 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-semibold">{overview.title}</h1>
                <p className="mt-1 text-muted-foreground">{overview.description}</p>

                <div
                  className={`mt-6 flex items-center justify-between rounded-xl border bg-card p-5 transition-shadow ${flash ? "ring-2 ring-primary" : ""}`}
                >
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Shared deadline
                    </p>
                    <p className="mt-1 font-serif text-lg font-semibold">
                      {overview.deadline.assessment}
                    </p>
                    <p className="text-sm">{overview.deadline.dueLabel}</p>
                  </div>
                  <button
                    onClick={() => setSelected(overview.deadline.sourceId)}
                    className="rounded-md border px-3 py-1.5 text-sm text-primary hover:bg-accent"
                  >
                    View source →
                  </button>
                </div>

                {/* Chat */}
                <section className="mt-8">
                  <h2 className="text-lg font-semibold">Ask about this module</h2>
                  <div className="mt-4 space-y-5">
                    {messages.length === 0 && !loading && (
                      <div className="rounded-xl border border-dashed p-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          Ask anything — answers are grounded in course sources and tailored to{" "}
                          {profile?.name ?? "you"}.
                        </p>
                        <div className="mt-4 flex flex-col items-center gap-2">
                          {SUGGESTIONS.map((s) => (
                            <button
                              key={s}
                              onClick={() => ask(s)}
                              className="rounded-full border bg-card px-4 py-2 text-sm hover:border-primary hover:text-primary"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((m, i) =>
                      m.role === "user" ? (
                        <div key={i} className="flex justify-end">
                          <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                            {m.text}
                          </div>
                        </div>
                      ) : m.role === "error" ? (
                        <div
                          key={i}
                          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
                        >
                          {m.text}{" "}
                          <button className="ml-2 underline" onClick={() => ask(m.retry)}>
                            Retry
                          </button>
                        </div>
                      ) : (
                        <div key={i} className="space-y-3 text-[15px] leading-relaxed">
                          {m.answer.blocks.map((b, j) => (
                            <div
                              key={j}
                              className={
                                b.teachingExample
                                  ? "rounded-lg border-l-4 border-teaching-foreground/40 bg-teaching/60 px-4 py-3"
                                  : ""
                              }
                            >
                              {b.teachingExample && (
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-teaching-foreground">
                                  Teaching example
                                </p>
                              )}
                              {b.text}
                              {b.citations.map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setSelected(c)}
                                  className={`ml-1 inline-grid size-5 place-items-center rounded align-text-top text-[11px] font-semibold ${selected === c ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground"}`}
                                  aria-label={`Source ${numFor(c)}`}
                                >
                                  {numFor(c)}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      ),
                    )}
                    {loading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="size-2 animate-bounce rounded-full bg-primary" />
                        <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
                        <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
                        Searching course sources…
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
        <Composer onSend={ask} disabled={loading || !overview || !profile} />
      </main>

      {/* Right panel */}
      <aside className="w-96 shrink-0 overflow-y-auto border-l bg-card">
        <section id="sources" className="border-b p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Source
          </h2>
          {selected && sourceById(selected) ? (
            <SourceDetail source={sourceById(selected)!} num={numFor(selected)} />
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Select a numbered citation to inspect its source.
            </p>
          )}
          {overview && (
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                All sources
              </p>
              <ul className="mt-2 space-y-1">
                {overview.sources.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelected(s.id)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary ${selected === s.id ? "bg-secondary" : ""} ${s.status === "superseded" ? "text-muted-foreground line-through" : ""}`}
                    >
                      {s.kind === "course" ? "📘 " : "📣 "}
                      {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        <section id="learning" className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              My learning profile
            </h2>
            <span className="text-[11px] text-muted-foreground">🔒 Private</span>
          </div>
          {profile ? (
            <div className="mt-3 rounded-lg bg-secondary p-4 text-sm">
              <p className="font-serif text-lg font-semibold">{profile.name}</p>
              <p className="text-muted-foreground">Level: {profile.level}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.preferences.map((p) => (
                  <span key={p} className="rounded-full bg-card px-2.5 py-1 text-xs">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 h-24 animate-pulse rounded-lg bg-muted" />
          )}
        </section>
      </aside>

      {dialogOpen && overview && (
        <RevisionDialog
          expectedVersion={overview.version}
          assessment={overview.deadline.assessment}
          onClose={() => setDialogOpen(false)}
          onDone={(o) => {
            setOverview(o);
            setSelected(o.deadline.sourceId);
            setDialogOpen(false);
            setFlash(true);
            setTimeout(() => setFlash(false), 1800);
          }}
        />
      )}
    </div>
  );
}

function SourceDetail({ source, num }: { source: Source; num: number }) {
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-1.5">
        {num > 0 && (
          <span className="rounded bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {num}
          </span>
        )}
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${source.kind === "course" ? "bg-accent text-accent-foreground" : "bg-demo text-demo-foreground"}`}
        >
          {source.kind === "course" ? "Course material" : "Demo announcement"}
        </span>
        {source.status === "superseded" && (
          <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
            Superseded
          </span>
        )}
        {source.status === "current" && source.kind === "announcement" && (
          <span className="rounded bg-teaching px-2 py-0.5 text-[11px] font-semibold uppercase text-teaching-foreground">
            Current
          </span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug">{source.title}</h3>
      <p className="text-sm text-muted-foreground">
        {source.reference}
        {source.postedAt ? ` · ${source.postedAt}` : ""}
      </p>
      <blockquote className="mt-3 whitespace-pre-wrap break-words border-l-2 border-primary pl-3 font-serif text-[15px] leading-relaxed">
        “{source.excerpt}”
      </blockquote>
      {source.isDemo && <p className="mt-2 text-xs text-demo-foreground">Demo data</p>}
      <a
        href={source.notionUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        Open in Notion ↗
      </a>
    </div>
  );
}

function Composer({ onSend, disabled }: { onSend: (q: string) => void; disabled: boolean }) {
  const [v, setV] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!v.trim()) return;
    onSend(v);
    setV("");
  };
  return (
    <form onSubmit={submit} className="border-t bg-card px-8 py-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
        <textarea
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          rows={1}
          placeholder="Ask a question about virtual machines and containers…"
          maxLength={2000}
          disabled={disabled}
          className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
        />
        <button
          disabled={disabled || !v.trim()}
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          Ask
        </button>
      </div>
    </form>
  );
}

function RevisionDialog({
  assessment,
  expectedVersion,
  onClose,
  onDone,
}: {
  expectedVersion: number;
  assessment: string;
  onClose: () => void;
  onDone: (o: ModuleOverview) => void;
}) {
  const [text, setText] = useState(
    "Demo announcement: the VMs and Containers Exercise deadline has been extended to 19 October 2026 at 17:00 (Europe/Dublin).",
  );
  const [sel, setSel] = useState(assessment);
  const [due, setDue] = useState("2026-10-19T17:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const retry = useRef<{ fingerprint: string; id: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const fingerprint = JSON.stringify([text, sel, due, expectedVersion]);
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = { fingerprint, id: crypto.randomUUID() };
      onDone(
        await addDeadlineRevision({
          announcement: text,
          assessment: sel,
          newDueISO: due,
          expectedVersion,
          requestId: retry.current.id,
        }),
      );
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <span className="rounded bg-demo px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-demo-foreground">
          Demo control
        </span>
        <DialogTitle>Add deadline revision</DialogTitle>
        <DialogDescription>
          Updates the shared demo deadline for every student. The original announcement stays
          available.
        </DialogDescription>
        <form onSubmit={submit} className="mt-5 space-y-4 text-sm">
          <label className="block">
            <span className="font-medium">Announcement text</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              required
              maxLength={4000}
              disabled={busy}
              className="mt-1 w-full rounded-md border bg-background p-2"
            />
          </label>
          <label className="block">
            <span className="font-medium">Assessment</span>
            <select
              value={sel}
              onChange={(e) => setSel(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background p-2"
            >
              <option>{assessment}</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium">New deadline (Europe/Dublin)</span>
            <input
              type="datetime-local"
              required
              disabled={busy}
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background p-2"
            />
          </label>
          {err && <p className="text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-md border px-4 py-2 hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Publishing…" : "Publish revision"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AuthenticatedWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, value) => {
      setSession(value);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!ready)
    return <main className="grid min-h-screen place-items-center">Loading your session…</main>;
  if (session) return <Workspace key={session.user.id} />;
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <form onSubmit={signIn} className="w-full max-w-sm space-y-5">
        <h1 className="font-serif text-3xl font-semibold">Notionary</h1>
        <p className="text-muted-foreground">Sign in to your Cloud Computing workspace.</p>
        <label className="block">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-md border bg-card p-3"
          />
        </label>
        <label className="block">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-md border bg-card p-3"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full rounded-md bg-primary p-3 font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-sm text-muted-foreground">
          Demo accounts have private profiles. Assignment dates are invented for the demo.
        </p>
      </form>
    </main>
  );
}
