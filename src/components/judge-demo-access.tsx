import { useState } from "react";
import { supabase } from "@/lib/supabase";
import accounts from "@/lib/judge-demo.json";

// These deliberately public demo accounts have student-only module membership.
// Never replace them with an editor's credentials or a Supabase server key.
export function JudgeDemoAccess({ disabled = false }: { disabled?: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function enter(account: (typeof accounts)[number]) {
    setPending(account.email);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      if (error) throw error;
    } catch {
      setError("The demo could not sign in. Please try again.");
    } finally {
      setPending(null);
    }
  }
  return (
    <section aria-label="Judge demo" className="space-y-3 border-b pb-5">
      <p className="font-medium">Explore the demo — no credentials needed</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {accounts.map((account) => (
          <button
            key={account.email}
            type="button"
            disabled={disabled || pending !== null}
            onClick={() => void enter(account)}
            className="rounded-md border bg-card px-3 py-3 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {pending === account.email ? "Opening demo…" : account.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Shared demo accounts. Ask questions and explore sources; deadline editing is disabled.
      </p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
