import { supabase } from "@/lib/supabase";
// Identity and access are derived from the authenticated session by the backend.

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
  canRevise: boolean;
  version: number;
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
  requestId: string;
  expectedVersion: number;
  newDueISO: string; // yyyy-mm-ddThh:mm (Europe/Dublin local)
}

async function call<T>(action: string, input: Record<string, unknown> = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to access this module.");
  const { data, error } = await supabase.functions.invoke("notionary", {
    body: { action, ...input },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    let message = error.message;
    try {
      message = (await error.context.json()).error || message;
    } catch {
      /* network failure */
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const getModuleOverview = () => call<ModuleOverview>("overview");
export const getMyProfile = () => call<LearningProfile>("profile");
export const askQuestion = (question: string) => call<Answer>("ask", { question });
export const addDeadlineRevision = (input: DeadlineRevisionInput) =>
  call<ModuleOverview>("revise", { ...input });

export interface SyncResult {
  count: number;
  skipped: string[];
  syncedAt: string;
}
export const syncNotionSources = () => call<SyncResult>("sync");
export async function uploadCourseSource(
  file: File,
  title: string,
  sourceType: string,
  requestId: string,
): Promise<{ source: Source; syncedAt: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to upload course sources.");
  const body = new FormData();
  body.append("file", file);
  body.append("title", title);
  body.append("sourceType", sourceType);
  body.append("requestId", requestId);
  const { data, error } = await supabase.functions.invoke("notionary", {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    let message = error.message;
    try {
      const detail = await error.context?.json();
      message = detail?.error || message;
    } catch {
      /* keep the original request error */
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
