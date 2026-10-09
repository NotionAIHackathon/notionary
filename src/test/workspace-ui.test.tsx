import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownContent } from "@/components/markdown-content";
import { SourceGraph } from "@/components/source-graph";
import { Route } from "@/routes/index";
import type { ComponentType, ReactNode } from "react";

// jsdom has no panel geometry; exercise navigation independently of drag layout.
vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div role="separator" />,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "student-ui-test" } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => {},
    },
  },
}));
vi.mock("@/services/notionary", () => ({
  getModuleOverview: async () => ({
    id: "COMP30520",
    title: "Cloud Computing",
    description: "Shared course",
    canRevise: false,
    version: 1,
    deadline: { assessment: "Exercise", dueLabel: "19 October", sourceId: "lecture" },
    sources: [
      {
        id: "lecture",
        kind: "course",
        title: "Lecture slides",
        reference: "W2",
        excerpt: "**Shared kernel**",
        notionUrl: "https://www.notion.so/lecture",
        isDemo: false,
      },
    ],
  }),
  getMyProfile: async () => ({
    studentId: "timmy",
    name: "Timmy",
    level: "Beginner",
    preferences: ["Analogies"],
  }),
  askQuestion: vi.fn(),
  addDeadlineRevision: vi.fn(),
}));

afterEach(cleanup);

describe("Course Markdown presentation", () => {
  it("renders headings, emphasis, lists and comparison tables instead of literal markers", () => {
    render(
      <MarkdownContent>
        {
          "## Comparison\n\n**Shared kernel**\n\n- Containers\n- Virtual machines\n\n| Type | Kernel |\n| --- | --- |\n| Container | Shared |"
        }
      </MarkdownContent>,
    );
    expect(screen.getByRole("heading", { name: "Comparison" })).toBeInTheDocument();
    expect(screen.getByText("Shared kernel").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("table")).toHaveTextContent("Container");
    expect(screen.queryByText("**Shared kernel**")).not.toBeInTheDocument();
  });

  it("does not execute source HTML or expose javascript links", () => {
    const { container } = render(
      <MarkdownContent>
        {"<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)"}
      </MarkdownContent>,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("unsafe")).not.toHaveAttribute(
      "href",
      expect.stringContaining("javascript:"),
    );
  });
});

describe("Source graph", () => {
  it("links the real Notion library and allows selecting a source with the keyboard", () => {
    const onSelect = vi.fn();
    render(
      <SourceGraph
        title="Cloud Computing"
        selected={null}
        onSelect={onSelect}
        sources={[
          {
            id: "transcript",
            kind: "course",
            title: "Synthetic transcript",
            reference: "Demo",
            excerpt: "Shared kernel",
            notionUrl: "https://www.notion.so/transcript",
            isDemo: true,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Open Cloud Computing Sources database in Notion" }),
    ).toHaveAttribute("href", "https://app.notion.com/p/becbee4e9bfa43e2a36c91d9e922247d");
    fireEvent.keyDown(screen.getByRole("button", { name: "Inspect Synthetic transcript" }), {
      key: "Enter",
    });
    expect(onSelect).toHaveBeenCalledWith("transcript");
  });
});

describe("Workspace navigation", () => {
  it("opens Sources and My Learning as full views rather than sidebar anchors", async () => {
    window.location.hash = "chat";
    const Workspace = Route.options.component as ComponentType;
    render(<Workspace />);
    await screen.findByRole("heading", { name: "Cloud Computing" });
    fireEvent.click(screen.getByRole("link", { name: "Sources" }));
    await screen.findByRole("heading", { name: "Sources", level: 1 });
    expect(screen.getByRole("button", { name: /Lecture slides/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Question about this module" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "My Learning" }));
    await screen.findByRole("heading", { name: "My Learning", level: 1 });
    expect(screen.getByRole("heading", { name: "Timmy" })).toBeInTheDocument();
    expect(screen.getByText("Learning preferences")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "← Back to chat" }));
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Question about this module" }),
      ).toBeInTheDocument(),
    );
  });
});
