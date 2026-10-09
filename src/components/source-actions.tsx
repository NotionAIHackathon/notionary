import { useRef, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  getModuleOverview,
  syncNotionSources,
  uploadCourseSource,
  type ModuleOverview,
} from "@/services/notionary";
const TYPES = ["Lecture slides", "Tutorials", "Transcripts", "Board images", "Exam papers"];
export function SourceActions({
  onRefresh,
}: {
  onRefresh: (overview: ModuleOverview, selected?: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState<"sync" | "upload" | null>(null);
  const [file, setFile] = useState<File | null>(null),
    [title, setTitle] = useState(""),
    [type, setType] = useState("Lecture slides");
  const [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [lastSync, setLastSync] = useState<string | null>(null);
  const requestId = useRef("");
  async function sync() {
    setBusy("sync");
    setError(null);
    setNotice(null);
    try {
      const result = await syncNotionSources();
      onRefresh(await getModuleOverview());
      setLastSync(result.syncedAt);
      setNotice(
        `${result.count} sources synced from Notion.${result.skipped.length ? ` ${result.skipped.length} attachment-only sources need readable text.` : ""}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("Choose a file up to 8 MB.");
      return;
    }
    setBusy("upload");
    setError(null);
    setNotice(null);
    try {
      requestId.current ||= crypto.randomUUID();
      const result = await uploadCourseSource(file, title, type, requestId.current);
      onRefresh(await getModuleOverview(), result.source.id);
      setLastSync(result.syncedAt);
      setNotice(`${result.source.title} saved in Notion and ready in your course sources.`);
      setOpen(false);
      setFile(null);
      setTitle("");
      requestId.current = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!!busy}
        onClick={sync}
        className="rounded border border-demo-foreground/30 bg-card px-2.5 py-1 font-medium hover:bg-secondary disabled:opacity-50"
      >
        {busy === "sync" ? "Syncing…" : "Sync from Notion"}
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded border border-demo-foreground/30 bg-card px-2.5 py-1 font-medium hover:bg-secondary disabled:opacity-50"
      >
        + Upload source
      </button>
      {lastSync && (
        <span className="text-xs">
          Last synced{" "}
          {new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
      {notice && (
        <p role="status" className="basis-full text-xs">
          {notice}
        </p>
      )}
      {error && !open && (
        <p role="alert" className="basis-full text-xs text-destructive">
          {error}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogTitle>Add course material</DialogTitle>
          <DialogDescription>
            Upload a PDF or image to the Cloud Computing Notion database. Its readable content will
            be added to the course sources.
          </DialogDescription>
          <form onSubmit={upload} className="space-y-4 text-sm">
            <label className="block font-medium">
              PDF or image
              <input
                disabled={!!busy}
                required
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="mt-2 block w-full rounded border p-2 file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  setFile(next);
                  setTitle(next?.name.replace(/\.[^.]+$/, "") ?? "");
                  if (next?.type.startsWith("image/")) setType("Board images");
                  requestId.current = "";
                  setError(
                    next && next.size > 8 * 1024 * 1024 ? "Choose a file up to 8 MB." : null,
                  );
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              PDF, PNG, JPEG or WebP · Up to 8 MB. Short documents and clear images work best.
            </p>
            <label className="block font-medium">
              Source title
              <input
                disabled={!!busy}
                required
                maxLength={180}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  requestId.current = "";
                }}
                className="mt-2 block w-full rounded border bg-background px-3 py-2"
              />
            </label>
            <label className="block font-medium">
              Source type
              <select
                disabled={!!busy}
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  requestId.current = "";
                }}
                className="mt-2 block w-full rounded border bg-background px-3 py-2"
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            {busy === "upload" && (
              <p role="status" className="rounded bg-secondary p-3">
                Reading the file and saving it to Notion… This can take about a minute.
              </p>
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setOpen(false)}
                className="rounded border px-4 py-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={!!busy || !file || file.size > 8 * 1024 * 1024 || !title.trim()}
                type="submit"
                className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
              >
                {busy === "upload" ? "Uploading…" : "Upload & sync"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
