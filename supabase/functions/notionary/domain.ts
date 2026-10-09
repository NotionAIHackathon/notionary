export function dublinInstant(local: unknown): string {
  if (typeof local !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Choose a valid deadline in Europe/Dublin.");
  const parts = local.split(/[-T:]/).map(Number);
  const guess = Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!, parts[3]!, parts[4]!);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const matches: number[] = [];
  for (const offset of [0, 60]) {
    const candidate = guess - offset * 60_000;
    const p = Object.fromEntries(fmt.formatToParts(candidate).map((p) => [p.type, p.value]));
    if (`${p["year"]}-${p["month"]}-${p["day"]}T${p["hour"]}:${p["minute"]}` === local)
      matches.push(candidate);
  }
  if (matches.length !== 1)
    throw new Error(
      "That Dublin time is invalid or ambiguous because of daylight saving. Choose another time.",
    );
  return new Date(matches[0]!).toISOString();
}
export function deadlineLabel(instant: string): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Dublin",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(instant)) + " Europe/Dublin"
  );
}
export function validateAnswer(value: unknown, sourceIds: string[]) {
  const answer = value as {
    supported?: boolean;
    blocks?: { text: string; citations: string[]; teachingExample?: boolean }[];
  };
  if (
    !answer ||
    !Array.isArray(answer.blocks) ||
    !answer.blocks.length ||
    answer.blocks.length > 10
  )
    throw new Error("The assistant returned an invalid answer. Please retry.");
  if (answer.supported === false) {
    return {
      blocks: [
        {
          text: "The supplied course sources do not cover this question, so I cannot give a grounded answer. Try asking about virtual machines, containers or the exercise deadline.",
          citations: [],
          teachingExample: false,
        },
      ],
    };
  }
  for (const b of answer.blocks) {
    if (
      typeof b.text !== "string" ||
      !b.text.trim() ||
      b.text.length > 6000 ||
      !Array.isArray(b.citations) ||
      b.citations.some((c) => typeof c !== "string" || !sourceIds.includes(c)) ||
      (b.teachingExample !== undefined && typeof b.teachingExample !== "boolean")
    )
      throw new Error("The assistant returned an invalid citation. Please retry.");
  }
  return {
    blocks: answer.blocks.map((b) => ({
      text: b.text,
      citations: [...new Set(b.citations)],
      teachingExample: b.teachingExample === true,
    })),
  };
}

// Preserve complete sentences while keeping the exam portion within its word budget.
export function examFormat(answer: ReturnType<typeof validateAnswer>) {
  const first = answer.blocks[0];
  if (!first || !first.citations.length || first.teachingExample) return answer;
  const text = first.text.replace(/^Exam answer[^:]*:\s*/i, "");
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];
  let short = "";
  let rest = "";
  let overflow = false;
  for (const sentence of sentences) {
    if (!overflow && (short + sentence).trim().split(/\s+/).length <= 85) short += sentence;
    else {
      overflow = true;
      rest += sentence;
    }
  }
  if (!short) throw new Error("The assistant returned an invalid answer. Please retry.");
  return {
    blocks: [
      { ...first, text: "Exam answer: " + short.trim() },
      ...(rest.trim() ? [{ ...first, text: "Further explanation: " + rest.trim() }] : []),
      ...answer.blocks.slice(1),
    ],
  };
}
