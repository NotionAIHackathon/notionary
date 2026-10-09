// Notionary data service — async mock implementations backed by fixtures.
// Replace the bodies of these functions with real backend calls.
// The backend is responsible for identity and profile privacy.

export type StudentId = "timmy" | "john";

export interface Source {
  id: string;
  kind: "course" | "announcement";
  title: string;
  reference: string;
  excerpt: string;
  notionUrl: string;
  isDemo: boolean;
  status?: "current" | "superseded";
  postedAt?: string;
}

export interface Deadline {
  assessment: string;
  dueISO: string;
  dueLabel: string;
  sourceId: string;
}

export interface ModuleOverview {
  id: string;
  title: string;
  description: string;
  deadline: Deadline;
  sources: Source[];
}

export interface LearningProfile {
  studentId: StudentId;
  name: string;
  level: string;
  preferences: string[];
}

export interface AnswerBlock {
  text: string;
  citations: string[]; // source ids
  teachingExample?: boolean;
}

export interface Answer {
  blocks: AnswerBlock[];
}

export interface DeadlineRevisionInput {
  announcement: string;
  assessment: string;
  newDueISO: string; // yyyy-mm-ddThh:mm (Europe/Dublin local)
}

const NOTION = "https://www.notion.so/";

const lecture: Source = {
  id: "lec-scaling",
  kind: "course",
  title: "Cloud Scaling — Lecture excerpt",
  reference: "Lecture 4 · Slides 12–14",
  excerpt:
    "Vertical scaling means increasing a single server's capacity (more CPU, memory or storage). Horizontal scaling means adding more servers and distributing the load between them. (Fixture content — to be replaced by the actual lecture excerpt.)",
  notionUrl: NOTION + "cloud-scaling-lecture",
  isDemo: true,
};

const originalAnnouncement: Source = {
  id: "ann-original",
  kind: "announcement",
  title: "Cloud Scaling Exercise — Deadline announcement",
  reference: "Module announcements · Week 3",
  excerpt:
    "The Cloud Scaling Exercise is due on 16 October 2026 at 17:00 (Europe/Dublin). Submit via the module page.",
  notionUrl: NOTION + "cloud-scaling-deadline",
  isDemo: true,
  status: "current",
  postedAt: "2 October 2026",
};

let state: ModuleOverview = {
  id: "cloud-computing",
  title: "Cloud Computing",
  description:
    "Foundations of cloud infrastructure: virtualisation, elasticity, scaling strategies and service models.",
  deadline: {
    assessment: "Cloud Scaling Exercise",
    dueISO: "2026-10-16T17:00",
    dueLabel: "16 October 2026, 17:00 Europe/Dublin",
    sourceId: originalAnnouncement.id,
  },
  sources: [lecture, originalAnnouncement],
};

const profiles: Record<StudentId, LearningProfile> = {
  timmy: {
    studentId: "timmy",
    name: "Timmy",
    level: "Beginner",
    preferences: ["Analogies", "Worked examples"],
  },
  john: {
    studentId: "john",
    name: "John",
    level: "Understands the basics",
    preferences: ["Concise explanations", "Challenging practice"],
  },
};

const delay = (ms = 700) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function formatDublin(iso: string) {
  const [d, t] = iso.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return `${day} ${month} ${y}, ${t} Europe/Dublin`;
}

export async function getModuleOverview(): Promise<ModuleOverview> {
  await delay(300);
  return clone(state);
}

// Demo only: identity is passed explicitly. A real backend derives it from the session.
export async function getMyProfile(demoStudent: StudentId): Promise<LearningProfile> {
  await delay(200);
  return clone(profiles[demoStudent]);
}

export async function askQuestion(question: string, demoStudent: StudentId): Promise<Answer> {
  await delay(1100);
  const q = question.toLowerCase();
  if (q.includes("fail")) throw new Error("The study assistant couldn't be reached. Please try again.");

  if (q.includes("due") || q.includes("deadline") || q.includes("exercise")) {
    const src = state.sources.find((s) => s.id === state.deadline.sourceId)!;
    return {
      blocks: [
        {
          text:
            demoStudent === "timmy"
              ? `The ${state.deadline.assessment} is due on ${state.deadline.dueLabel}. Tip: plan to submit a day early so a slow upload doesn't catch you out.`
              : `Due ${state.deadline.dueLabel}.`,
          citations: [src.id],
        },
      ],
    };
  }

  if (q.includes("scal") || q.includes("visit") || q.includes("people") || q.includes("traffic")) {
    if (demoStudent === "timmy") {
      return {
        blocks: [
          {
            text: "When lots of people visit a website at once, the servers behind it need more capacity. There are two main ways to get it: vertical scaling, which makes one server more powerful, and horizontal scaling, which adds more servers that share the work.",
            citations: [lecture.id],
          },
          {
            text: "Think of a busy shop. Vertical scaling is like giving your one cashier a faster till — they serve people quicker, but there's a limit to how fast one person can go. Horizontal scaling is opening more tills with more cashiers, so the queue splits up. Big websites usually do the second: when a crowd arrives, they add more servers.",
            citations: [lecture.id],
            teachingExample: true,
          },
          {
            text: "Worked example: a site handles 1,000 visitors per server. If 5,000 visitors arrive, horizontal scaling means running 5 servers instead of 1.",
            citations: [lecture.id],
            teachingExample: true,
          },
        ],
      };
    }
    return {
      blocks: [
        {
          text: "Two options: vertical scaling (increase one server's capacity) or horizontal scaling (add servers and distribute load). Vertical is simpler but hits a hardware ceiling; horizontal scales further but requires load balancing and stateless design.",
          citations: [lecture.id],
        },
        {
          text: "Practice: a ticketing site spikes from 2k to 40k concurrent users when sales open, and sessions are stored in server memory. Which scaling approach would you choose, and what must change in the architecture first?",
          citations: [lecture.id],
          teachingExample: true,
        },
      ],
    };
  }

  return {
    blocks: [
      {
        text: "I can only answer from this module's sources. Try asking about scaling or the Cloud Scaling Exercise deadline.",
        citations: [],
      },
    ],
  };
}

export async function addDeadlineRevision(input: DeadlineRevisionInput): Promise<ModuleOverview> {
  await delay(900);
  if (!input.announcement.trim()) throw new Error("Announcement text is required.");
  if (input.assessment !== state.deadline.assessment) throw new Error("Unknown assessment.");
  const label = formatDublin(input.newDueISO);
  const id = `ann-rev-${Date.now()}`;
  const revision: Source = {
    id,
    kind: "announcement",
    title: `${input.assessment} — Deadline revision`,
    reference: "Module announcements · Revision",
    excerpt: input.announcement.trim(),
    notionUrl: NOTION + "cloud-scaling-deadline-revision",
    isDemo: true,
    status: "current",
    postedAt: "9 October 2026",
  };
  state = {
    ...state,
    deadline: { ...state.deadline, dueISO: input.newDueISO, dueLabel: label, sourceId: id },
    sources: [
      ...state.sources.map((s) => (s.kind === "announcement" ? { ...s, status: "superseded" as const } : s)),
      revision,
    ],
  };
  return clone(state);
}
