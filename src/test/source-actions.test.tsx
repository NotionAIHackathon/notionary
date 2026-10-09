import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SourceActions } from "@/components/source-actions";
import {
  detectFileType,
  selectCourseText,
} from "../../supabase/functions/notionary/source-content";
const api = vi.hoisted(() => ({ sync: vi.fn(), upload: vi.fn(), overview: vi.fn() }));
vi.mock("@/services/notionary", () => ({
  syncNotionSources: api.sync,
  uploadCourseSource: api.upload,
  getModuleOverview: api.overview,
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  api.overview.mockResolvedValue({ id: "COMP30520", sources: [] });
});
describe("Course source controls", () => {
  it("refreshes the workspace after a successful sync and reports skipped sources", async () => {
    api.sync.mockResolvedValue({
      count: 5,
      skipped: ["Unreadable attachment"],
      syncedAt: "2026-10-09T17:00:00Z",
    });
    const refresh = vi.fn();
    render(<SourceActions onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Sync from Notion" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "5 sources synced from Notion. 1 attachment-only",
    );
    expect(refresh).toHaveBeenCalledWith({ id: "COMP30520", sources: [] });
  });
  it("keeps the sync retry available after an error", async () => {
    api.sync.mockRejectedValue(new Error("Notion connection unavailable"));
    render(<SourceActions onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Sync from Notion" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Notion connection unavailable");
    expect(screen.getByRole("button", { name: "Sync from Notion" })).toBeEnabled();
  });
  it("uploads a file with its type and title and selects the newly saved source", async () => {
    const refresh = vi.fn();
    api.upload.mockResolvedValue({
      source: { id: "new-source", title: "Board notes" },
      syncedAt: "2026-10-09T17:00:00Z",
    });
    render(<SourceActions onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Upload source" }));
    const file = new File(["image"], "board.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("PDF or image"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("Source title"), { target: { value: "Board notes" } });
    fireEvent.submit(screen.getByRole("button", { name: "Upload & sync" }).closest("form")!);
    await waitFor(() =>
      expect(api.upload).toHaveBeenCalledWith(
        file,
        "Board notes",
        "Board images",
        expect.stringMatching(/^[0-9a-f-]{36}$/),
      ),
    );
    await waitFor(() =>
      expect(refresh).toHaveBeenCalledWith({ id: "COMP30520", sources: [] }, "new-source"),
    );
    expect(screen.getByRole("status")).toHaveTextContent("saved in Notion");
  });
  it("blocks oversized files before sending them", () => {
    render(<SourceActions onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Upload source" }));
    const file = new File(["large"], "slides.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 9 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("PDF or image"), { target: { files: [file] } });
    expect(screen.getByRole("alert")).toHaveTextContent("up to 8 MB");
    expect(screen.getByRole("button", { name: "Upload & sync" })).toBeDisabled();
    expect(api.upload).not.toHaveBeenCalled();
  });
});
describe("Source ingestion safeguards", () => {
  it("rejects a renamed non-file and identifies PDF and image signatures", () => {
    expect(() => detectFileType(new TextEncoder().encode("not a PDF"))).toThrow("Choose a PDF");
    expect(detectFileType(new TextEncoder().encode("%PDF-1.4"))).toBe("application/pdf");
    expect(detectFileType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
  });
  it("excludes student-written tutorial answers and fails safely when the selected sections disappear", () => {
    const text =
      "What is Docker?\nLecturer introduction\nWork with the documentation\nStudent-written answer\nTask 3: Some of you are on Linux\nLecturer question\n## Exercise Three\nOther student answer";
    const selected = selectCourseText("c543c70a-6285-8258-a992-8141222c14df", text);
    expect(selected).toContain("Lecturer question");
    expect(selected).not.toContain("Student-written answer");
    expect(selected).not.toContain("Other student answer");
    expect(() =>
      selectCourseText("c543c70a-6285-8258-a992-8141222c14df", "changed structure"),
    ).toThrow("sections changed");
  });
});
