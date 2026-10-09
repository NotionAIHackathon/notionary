import type { Source } from "@/services/notionary";

const DEMO_URL = "https://app.notion.com/p/3f43c70a6285806a98e5e77839ad5c74";

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
  const height = Math.max(320, sources.length * 88 + 64);
  const center = height / 2;
  return (
    <div
      className="mt-6 overflow-x-auto rounded-lg border bg-card p-4"
      tabIndex={0}
      role="region"
      aria-label="Scrollable source graph"
    >
      <svg
        viewBox={`0 0 920 ${height}`}
        className="w-full min-w-[720px]"
        role="group"
        aria-label="Cloud Computing module connects to the Notion Demo page, which contains the listed sources"
      >
        <title>Notionary source connections</title>
        <path d={`M 230 ${center} H 340`} stroke="var(--border)" strokeWidth="2" />
        {sources.map((source, index) => (
          <path
            key={source.id}
            d={`M 560 ${center} C 610 ${center}, 600 ${76 + index * 88}, 650 ${76 + index * 88}`}
            fill="none"
            stroke={selected === source.id ? "var(--primary)" : "var(--border)"}
            strokeWidth={selected === source.id ? 2 : 1.5}
          />
        ))}
        <rect
          x="10"
          y={center - 37}
          width="220"
          height="74"
          rx="8"
          fill="var(--sidebar)"
          stroke="var(--border)"
        />
        <text x="28" y={center - 9} fill="var(--muted-foreground)" fontSize="12">
          MODULE
        </text>
        <text x="28" y={center + 15} fill="var(--foreground)" fontSize="16" fontWeight="600">
          Cloud Computing
        </text>
        <title>{title}</title>
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open the shared Demo page in Notion"
          className="graph-node"
        >
          <rect
            x="340"
            y={center - 37}
            width="220"
            height="74"
            rx="8"
            fill="var(--accent)"
            stroke="var(--primary)"
          />
          <text x="358" y={center - 9} fill="var(--accent-foreground)" fontSize="12">
            NOTION PAGE
          </text>
          <text
            x="358"
            y={center + 15}
            fill="var(--accent-foreground)"
            fontSize="16"
            fontWeight="600"
          >
            Demo · shared sources ↗
          </text>
        </a>
        {sources.map((source, index) => (
          <g
            key={source.id}
            role="button"
            tabIndex={0}
            aria-label={`Inspect ${source.title}`}
            aria-pressed={selected === source.id}
            onClick={() => onSelect(source.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(source.id);
              }
            }}
            className="graph-node cursor-pointer"
          >
            <title>{source.title}</title>
            <rect
              x="650"
              y={44 + index * 88}
              width="260"
              height="64"
              rx="8"
              fill={selected === source.id ? "var(--accent)" : "var(--card)"}
              stroke={selected === source.id ? "var(--primary)" : "var(--border)"}
            />
            <text x="666" y={67 + index * 88} fill="var(--muted-foreground)" fontSize="11">
              {source.status === "superseded"
                ? "SUPERSEDED"
                : source.isDemo
                  ? "DEMO SOURCE"
                  : "COURSE SOURCE"}
            </text>
            <text
              x="666"
              y={91 + index * 88}
              fill="var(--foreground)"
              fontSize="13"
              fontWeight="500"
            >
              {source.title.length > 33 ? `${source.title.slice(0, 32)}…` : source.title}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-3 text-xs text-muted-foreground">
        Lines show the demo page hierarchy. They do not imply verified semantic relationships
        between sources.
      </p>
    </div>
  );
}
