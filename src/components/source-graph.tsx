import type { Source } from "@/services/notionary";

const SOURCE_DATABASE_URL = "https://app.notion.com/p/becbee4e9bfa43e2a36c91d9e922247d";
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
  const orderedSources = [
    ...sources.filter((source) => source.kind === "course"),
    ...sources.filter((source) => source.kind === "announcement"),
  ].map((source) => ({
    ...source,
    title: source.title
      .replace(/^Synthetic Demo Transcript/, "Transcript")
      .replace(/^Synthetic Demo Board/, "Board image")
      .replace(/^Demo fixture — /, ""),
  }));
  const libraryCenter = Math.max(
    120,
    sources.filter((source) => source.kind === "course").length * 44 + 32,
  );
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
        viewBox={`0 0 1120 ${height}`}
        className="w-full min-w-[880px]"
        role="group"
        aria-label="Cloud Computing connects to the Notion Cloud Computing Hub, its source database, and the source documents. Announcements are directly under the hub."
      >
        <title>Notionary source connections</title>
        <path d={`M 190 ${center} H 240`} stroke="var(--border)" strokeWidth="2" />
        {orderedSources.map((source, index) => (
          <path
            key={source.id}
            d={
              source.kind === "course"
                ? `M 720 ${libraryCenter} C 745 ${libraryCenter}, 755 ${76 + index * 88}, 790 ${76 + index * 88}`
                : `M 420 ${center + 30} C 460 ${76 + index * 88}, 740 ${76 + index * 88}, 790 ${76 + index * 88}`
            }
            strokeDasharray={source.kind === "announcement" ? "5 4" : undefined}
            fill="none"
            stroke={selected === source.id ? "var(--primary)" : "var(--border)"}
            strokeWidth={selected === source.id ? 2 : 1.5}
          />
        ))}
        <rect
          x="10"
          y={center - 37}
          width="180"
          height="74"
          rx="8"
          fill="var(--sidebar)"
          stroke="var(--border)"
        />
        <text x="28" y={center - 9} fill="var(--muted-foreground)" fontSize="12">
          MODULE
        </text>
        <text x="28" y={center + 15} fill="var(--foreground)" fontSize="15" fontWeight="600">
          Cloud Computing
        </text>
        <title>{title}</title>
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open the Cloud Computing Hub in Notion"
          className="graph-node"
        >
          <rect
            x="240"
            y={center - 37}
            width="180"
            height="74"
            rx="8"
            fill="var(--accent)"
            stroke="var(--primary)"
          />
          <text x="258" y={center - 9} fill="var(--accent-foreground)" fontSize="12">
            NOTION PAGE
          </text>
          <text
            x="258"
            y={center + 15}
            fill="var(--accent-foreground)"
            fontSize="16"
            fontWeight="600"
          >
            Cloud Computing Hub ↗
          </text>
        </a>
        <path
          d={`M 420 ${center} C 445 ${center}, 455 ${libraryCenter}, 490 ${libraryCenter}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth="2"
        />
        <a
          href={SOURCE_DATABASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Cloud Computing Sources database in Notion"
          className="graph-node"
        >
          <rect
            x="490"
            y={libraryCenter - 37}
            width="230"
            height="74"
            rx="8"
            fill="var(--secondary)"
            stroke="var(--border)"
          />
          <text x="508" y={libraryCenter - 9} fill="var(--muted-foreground)" fontSize="12">
            NOTION DATABASE
          </text>
          <text
            x="508"
            y={libraryCenter + 15}
            fill="var(--foreground)"
            fontSize="15"
            fontWeight="600"
          >
            Cloud Computing · Sources ↗
          </text>
        </a>
        {orderedSources.map((source, index) => (
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
              x="790"
              y={44 + index * 88}
              width="320"
              height="64"
              rx="8"
              fill={selected === source.id ? "var(--accent)" : "var(--card)"}
              stroke={selected === source.id ? "var(--primary)" : "var(--border)"}
            />
            <text x="806" y={67 + index * 88} fill="var(--muted-foreground)" fontSize="11">
              {source.status === "superseded"
                ? "SUPERSEDED"
                : source.kind === "announcement"
                  ? "ANNOUNCEMENT"
                  : "COURSE SOURCE"}
            </text>
            <text
              x="806"
              y={91 + index * 88}
              fill="var(--foreground)"
              fontSize="13"
              fontWeight="500"
            >
              {source.title.length > 41 ? `${source.title.slice(0, 40)}…` : source.title}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-3 text-xs text-muted-foreground">
        Solid lines connect the module’s source library; dashed lines connect announcements directly
        under the hub. Select a source to read its excerpt below.
      </p>
    </div>
  );
}
