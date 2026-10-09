import { useEffect, useMemo, useRef, useState } from "react";
import type { Source } from "@/services/notionary";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type GraphNode = {
  id: string;
  title: string;
  type: string;
  x: number;
  y: number;
  description: string;
  url?: string;
  sourceId?: string;
};
type Edge = { from: string; to: string };
const HUB = "https://app.notion.com/p/3f43c70a6285806a98e5e77839ad5c74";
const LIBRARY = "https://app.notion.com/p/becbee4e9bfa43e2a36c91d9e922247d";
const colors: Record<string, string> = {
  Hub: "#63a5df",
  Topic: "#b899e1",
  "Lecture slides": "#63a5df",
  Tutorials: "#64bda3",
  Transcripts: "#d9aa62",
  "Board images": "#d989aa",
  "Exam papers": "#b899e1",
  Announcement: "#a3aaa9",
};
const topics = [
  "Cloud foundations",
  "VMs vs Containers",
  "Storage & databases",
  "Networking",
  "Distributed systems",
];
const materials = [
  [
    "Lecture slides",
    "Lecture",
    "Lecturer-authored explanations and diagrams, linked to the concepts they introduce.",
  ],
  [
    "Tutorials",
    "Tutorial",
    "Practice tasks connected to the lecture concepts and relevant assessment questions.",
  ],
  [
    "Transcripts",
    "Transcript",
    "Searchable lecture discussion, with explanations linked back to the slides and course topics.",
  ],
  [
    "Board images",
    "Board",
    "Whiteboard diagrams and their readable descriptions, connected to the same course concepts.",
  ],
] as const;
function typeOf(source: Source) {
  if (source.kind === "announcement") return "Announcement";
  if (/transcript/i.test(source.title)) return "Transcripts";
  if (/board/i.test(source.title)) return "Board images";
  if (/practical|tutorial/i.test(source.title)) return "Tutorials";
  if (/exam|final/i.test(source.title)) return "Exam papers";
  return "Lecture slides";
}
function buildGraph(sources: Source[], vision: boolean) {
  const nodes: GraphNode[] = [
    {
      id: "hub",
      title: "Cloud Computing Hub",
      type: "Hub",
      x: 600,
      y: 390,
      url: HUB,
      description: vision
        ? "Vision: a course knowledge graph maintained by lecturers and the school. Shared, versioned course knowledge supports each student’s private learning profile."
        : "The authoritative shared course page in Notion.",
    },
  ];
  const edges: Edge[] = [];
  if (vision) {
    topics.forEach((topic, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / topics.length;
      const x = 600 + Math.cos(angle) * 340,
        y = 390 + Math.sin(angle) * 230;
      const topicId = `topic-${i}`;
      nodes.push({
        id: topicId,
        title: topic,
        type: "Topic",
        x,
        y,
        description:
          "Vision: lecturers curate this concept and its relationships. Students can trace one idea across explanations, practice, discussion and assessment.",
      });
      edges.push({ from: "hub", to: topicId });
      materials.forEach(([type, label, description], j) => {
        const a = angle + (j - 1.5) * 0.65;
        const id = `vision-${i}-${j}`;
        nodes.push({
          id,
          title: `W${i + 1} · ${label}: ${topic}`,
          type,
          x: x + Math.cos(a) * 108,
          y: y + Math.sin(a) * 100,
          description,
        });
        edges.push({ from: topicId, to: id });
        if (j > 0) edges.push({ from: `vision-${i}-0`, to: id });
      });
    });
    [1, 2, 4].forEach((topic, i) => {
      const id = `exam-${i}`;
      nodes.push({
        id,
        title: `Exam · ${topics[topic]}`,
        type: "Exam papers",
        x: 470 + i * 125,
        y: 455 + (i % 2) * 80,
        description:
          "Vision: assessment questions connect to the concepts and supporting course material, helping students understand what to revise.",
      });
      edges.push({ from: `topic-${topic}`, to: id });
    });
    edges.push(
      { from: "topic-0", to: "topic-1" },
      { from: "topic-3", to: "topic-4" },
      { from: "topic-2", to: "topic-4" },
    );
  } else {
    nodes.push({
      id: "library",
      title: "Cloud Computing · Sources",
      type: "Hub",
      x: 600,
      y: 230,
      url: LIBRARY,
      description: "The module’s Notion database, organised by source type.",
    });
    edges.push({ from: "hub", to: "library" });
    sources.forEach((source, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / Math.max(sources.length, 1);
      nodes.push({
        id: source.id,
        sourceId: source.id,
        title: source.title,
        type: typeOf(source),
        x: 600 + Math.cos(a) * 360,
        y: 390 + Math.sin(a) * 275,
        description: source.excerpt,
        url: source.notionUrl,
      });
      edges.push({ from: source.kind === "announcement" ? "hub" : "library", to: source.id });
    });
  }
  return { nodes, edges };
}
export function SourceGraph({
  title,
  sources,
  selected,
  onSelect,
}: {
  title: string;
  sources: Source[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [vision, setVision] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [labels, setLabels] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string | undefined; x: number; y: number; moved: boolean } | null>(
    null,
  );
  const graph = useMemo(() => buildGraph(sources, vision), [sources, vision]);
  const current = active ?? (!vision ? selected : null);
  const inspected = graph.nodes.find((n) => n.id === current);
  const neighbors = new Set(
    graph.edges
      .filter((e) => e.from === current || e.to === current)
      .flatMap((e) => [e.from, e.to]),
  );
  const visible = graph.nodes.filter(
    (n) => filter === "All" || n.type === filter || n.type === "Hub" || n.type === "Topic",
  );
  const visibleIds = new Set(visible.map((n) => n.id));
  const nodeAt = (id: string) => {
    const n = graph.nodes.find((n) => n.id === id)!;
    return { ...n, ...positions[id] };
  };
  useEffect(() => {
    const element = svg.current;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setViewport((v) => ({
        ...v,
        zoom: Math.max(0.5, Math.min(3, v.zoom * (event.deltaY < 0 ? 1.1 : 0.9))),
      }));
    };
    element?.addEventListener("wheel", wheel, { passive: false });
    return () => element?.removeEventListener("wheel", wheel);
  }, [expanded]);
  function choose(node: GraphNode) {
    setActive(node.id);
    if (node.sourceId) onSelect(node.sourceId);
  }
  function reset() {
    setViewport({ x: 0, y: 0, zoom: 1 });
    setPositions({});
  }
  const content = (
    <section className="mt-4 rounded-lg border bg-card" aria-label="Course knowledge graph">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div
          className="flex gap-1 rounded-md bg-secondary p-1"
          role="group"
          aria-label="Graph mode"
        >
          {[false, true].map((mode) => (
            <button
              key={String(mode)}
              className={`rounded px-3 py-2 text-sm ${vision === mode ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"}`}
              aria-pressed={vision === mode}
              onClick={() => {
                setVision(mode);
                setActive(null);
                setFilter("All");
                reset();
              }}
            >
              {mode ? "Demo mode · Long-term vision" : "Live course"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            aria-label="Zoom out"
            className="rounded border px-3 py-1"
            onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(0.5, v.zoom - 0.2) }))}
          >
            −
          </button>
          <span className="min-w-12 text-center tabular-nums">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <button
            aria-label="Zoom in"
            className="rounded border px-3 py-1"
            onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(3, v.zoom + 0.2) }))}
          >
            +
          </button>
          <button className="rounded border px-3 py-1" onClick={reset}>
            Reset
          </button>
          {!expanded && (
            <button className="rounded border px-3 py-1" onClick={() => setExpanded(true)}>
              Expand graph
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
        <label>
          Show{" "}
          <select
            aria-label="Filter graph by source type"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="ml-2 rounded border bg-card p-1"
          >
            <option>All</option>
            {Object.keys(colors)
              .filter((t) => t !== "Hub" && t !== "Topic")
              .map((type) => (
                <option key={type}>{type}</option>
              ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />{" "}
          Labels
        </label>
        <span className="text-muted-foreground">
          {graph.nodes.length} nodes · {graph.edges.length} connections · Drag to explore
        </span>
      </div>
      {vision && (
        <p className="border-y bg-secondary/40 px-4 py-3 text-sm">
          Lecturer-maintained course graphs. One concept connects slides, tutorials, transcripts,
          board images and assessment across the semester.
        </p>
      )}
      <svg
        ref={svg}
        viewBox="0 0 1200 780"
        className={`w-full touch-none bg-background ${expanded ? "max-h-[65vh]" : "min-h-[400px] max-h-[650px]"}`}
        role="group"
        aria-label={`${title} interactive knowledge network`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const id =
            (e.target as Element).closest("[data-node]")?.getAttribute("data-node") ?? undefined;
          drag.current = { id, x: e.clientX, y: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const bounds = e.currentTarget.getBoundingClientRect();
          const dx = ((e.clientX - d.x) * 1200) / bounds.width,
            dy = ((e.clientY - d.y) * 780) / bounds.height;
          if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
          if (d.id) {
            const node = nodeAt(d.id);
            setPositions((p) => ({
              ...p,
              [d.id!]: { x: node.x + dx / viewport.zoom, y: node.y + dy / viewport.zoom },
            }));
          } else setViewport((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
          d.x = e.clientX;
          d.y = e.clientY;
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (d?.id && !d.moved) choose(nodeAt(d.id));
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <title>Notionary course knowledge network</title>
        <g
          transform={`translate(${600 + viewport.x} ${390 + viewport.y}) scale(${viewport.zoom}) translate(-600 -390)`}
        >
          {graph.edges
            .filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to))
            .map((edge) => {
              const a = nodeAt(edge.from),
                b = nodeAt(edge.to),
                highlighted = edge.from === current || edge.to === current;
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={
                    highlighted ? colors[inspected?.type ?? "Hub"] : "var(--muted-foreground)"
                  }
                  strokeWidth={highlighted ? 2 : 1}
                  opacity={current ? (highlighted ? 0.85 : 0.12) : 0.28}
                />
              );
            })}
          {visible.map((n) => {
            const node = nodeAt(n.id);
            const r = node.type === "Hub" ? 19 : node.type === "Topic" ? 13 : 7;
            const emphasized = !current || neighbors.has(n.id) || n.id === current;
            return (
              <g
                key={n.id}
                data-node={n.id}
                role="button"
                tabIndex={0}
                aria-label={`Inspect ${n.title}`}
                aria-pressed={current === n.id}
                className="graph-node cursor-grab focus:outline-none active:cursor-grabbing"
                opacity={emphasized ? 1 : 0.3}
                onClick={(e) => {
                  if (e.detail === 0) choose(n);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose(n);
                  }
                }}
              >
                <title>
                  {n.type}: {n.title}
                </title>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 7}
                  fill="transparent"
                  stroke={current === n.id ? colors[n.type] : "transparent"}
                  strokeWidth="1.5"
                />
                <circle cx={node.x} cy={node.y} r={r} fill={colors[n.type]} />
                {(labels || current === n.id || n.type === "Hub" || n.type === "Topic") && (
                  <text
                    x={node.x}
                    y={node.y + r + 18}
                    textAnchor="middle"
                    fill="var(--foreground)"
                    fontSize={n.type === "Hub" ? 15 : n.type === "Topic" ? 13 : 10}
                    fontWeight={n.type === "Hub" || n.type === "Topic" ? 600 : 400}
                    style={{
                      paintOrder: "stroke",
                      stroke: "var(--background)",
                      strokeWidth: 4,
                      strokeLinejoin: "round",
                    }}
                  >
                    {n.title.length > 31 ? n.title.slice(0, 30) + "…" : n.title}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t px-4 py-3 text-xs text-muted-foreground">
        {Object.entries(colors)
          .filter(([type]) => (vision ? type !== "Announcement" : type !== "Topic"))
          .map(([type, color]) => (
            <span key={type} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              {type}
            </span>
          ))}
      </div>
      {inspected && (
        <div className="border-t p-4" aria-live="polite">
          <p className="text-xs text-muted-foreground">
            {inspected.type} · {neighbors.size - 1} connections
          </p>
          <h3 className="mt-1 font-semibold">{inspected.title}</h3>
          <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-muted-foreground">
            {vision || !inspected.sourceId
              ? inspected.description
              : "Read the source excerpt below, or open the original course material."}
          </p>
          {!vision && inspected.url && (
            <a
              className="mt-3 inline-block text-sm text-primary underline"
              href={inspected.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={
                inspected.id === "library"
                  ? "Open Cloud Computing Sources database in Notion"
                  : undefined
              }
            >
              Open in Notion ↗
            </a>
          )}
        </div>
      )}
      {!vision && !inspected && (
        <a
          href={LIBRARY}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Cloud Computing Sources database in Notion"
          className="inline-block px-4 pb-4 text-xs text-primary underline"
        >
          Open source library in Notion ↗
        </a>
      )}
    </section>
  );
  return expanded ? (
    <Dialog open onOpenChange={setExpanded}>
      <DialogContent className="max-h-[95vh] w-[96vw] max-w-[1500px] overflow-y-auto">
        <DialogTitle>{title} knowledge graph</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  ) : (
    content
  );
}
