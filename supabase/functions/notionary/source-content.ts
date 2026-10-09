export const SOURCE_TYPES = [
  "Lecture slides",
  "Tutorials",
  "Transcripts",
  "Board images",
  "Exam papers",
];
export const MAX_UPLOAD = 8 * 1024 * 1024;
export class SourceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function selectCourseText(id: string, text: string) {
  if (id === "dc83c70a-6285-83e3-a786-01ed1b21172b") {
    const start = text.indexOf("## VMs vs Containers"),
      end = text.indexOf("## Components of containerised apps", start);
    if (start < 0 || end < 0)
      throw new SourceError(
        "The lecture sections changed. Review its selected comparison before syncing.",
      );
    const table = text.indexOf("## Comparison of Virtualisation");
    return [
      "SOURCE NOTE: The early passage below says containers include the OS and do not use a hypervisor; later passages describe shared kernels. Preserve and discuss this ambiguity, including Docker Desktop.",
      ...text
        .split("\n")
        .filter(
          (s) =>
            s.startsWith("Containers are a lighter-weight") ||
            s.startsWith("Containers use a form"),
        ),
      text.slice(start, end),
      table >= 0 ? text.slice(table, text.indexOf("## VMs vs Containers", table)) : "",
    ]
      .join("\n\n")
      .trim();
  }
  if (id === "c543c70a-6285-8258-a992-8141222c14df") {
    const first = text.indexOf("What is Docker?"),
      firstEnd = text.indexOf("Work with the documentation", first),
      start = text.indexOf("Task 3: Some of you are on Linux"),
      end = text.indexOf("## Exercise Three", start);
    if ([first, firstEnd, start, end].some((i) => i < 0))
      throw new SourceError(
        "The tutorial sections changed. Review the lecturer-only selection before syncing.",
      );
    return (
      "Selected lecturer instructions/questions only; student-written answers elsewhere in this page are excluded.\n\n" +
      text.slice(first, firstEnd) +
      "\n\n" +
      text.slice(start, end)
    );
  }
  if (id === "2613c70a-6285-82b9-a278-01e85e924a8f")
    return (
      "Historical 2022/23 exam — not the current year assessment.\n" +
      text
        .split("\n")
        .filter((s) => /100 words|differences between virtual machines|2022|2023/.test(s))
        .join("\n")
    );
  return text.length > 18000
    ? text.slice(0, 18000) +
        "\n[Source excerpt truncated; open the original in Notion for the full text.]"
    : text;
}

export function detectFileType(bytes: Uint8Array) {
  if (new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-") return "application/pdf";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
  )
    return "image/webp";
  throw new SourceError("Choose a PDF, PNG, JPEG or WebP file.");
}
