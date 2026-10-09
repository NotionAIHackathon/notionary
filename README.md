# Notionary

Cloud Computing (COMP30520) study demo: one shared course corpus, two authenticated students, private learning profiles, and a shared deadline revision.

Continue in the [Lovable editor](https://lovable.dev/projects/12642f48-d734-4628-aeac-cdc91b1ae508). The connected repository is `NotionAIHackathon/notionary`.

## Run

```sh
npm ci
npm run dev
```

The frontend defaults to the demo Supabase URL and **public** publishable key. Override with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` if required. All private keys belong in Supabase Edge Function secrets.

## Demo

Use Timmy in a normal browser window and John in an incognito window. Sign-in credentials are stored locally in the ignored `.demo-accounts.json` file; they are never committed or embedded in the app.

1. Sign in as both students. Each sees the same lecture, tutorial, historical exam and current assignment announcement, but only their own learning profile.
2. Ask both: “What's the difference between a virtual machine and a container?” Timmy gets beginner teaching; John gets a concise exam answer and challenging practice. Select citations to inspect cached real source excerpts.
3. As Timmy (the demo editor), publish a deadline revision. John is a student and cannot publish. Both windows refresh the shared state every five seconds.
4. Inspect the original announcement in the source list. It remains available as superseded history.

Assignment dates are **invented demo fixtures**, not actual course deadlines. The exam is from **2022/23**, not the current year's assessment. The lecture's ambiguous OS/hypervisor passages are retained. Only selected lecturer instructions from the tutorial are cached; student-written answers are excluded.

## Backend

- `supabase/migrations/`: module memberships, owner-only profile policies, read-only shared source policies, atomic publication and retry leases.
- `supabase/functions/notionary/`: session verification, membership checks, private profile access, Claude answers, citation validation and editor-only deadline revisions.
- `supabase/corpus.json`: selected excerpts fetched using the **Notionary Demo token** via the real Notion API, including table rows. Added readable child pages and rows inside per-module Notion databases are discovered on resync; synthetic transcript and board pages are labelled as demo material.
- The source cache is in Supabase; shared announcement pages are written beneath the Notion **Demo** page (`3f43c70a-6285-806a-98e5-e77839ad5c74`). Private profiles never go to Notion.

Deadline writes create/recover the Notion announcement first, then publish the source and assessment together in a database transaction. Failed writes preserve the serving deadline. Stable request IDs, database leases and a deterministic Notion page marker prevent duplicate retries. Changed deadlines reject stale revisions. A Notion page can remain as an unpublished draft if the database step fails; it is not shown as a current app source.

## Setup and verification

Store `NOTION_TOKEN` and `ANTHROPIC_API_KEY` in an ignored `.env.backend.local` file, and `SUPABASE_SECRET_KEY` in an ignored `.env.admin.local` file. Set the first two as Edge Function secrets. `ANTHROPIC_MODEL` defaults to `claude-sonnet-4-6`.

```sh
node scripts/notion-corpus.mjs
node scripts/setup-demo.mjs
node scripts/verify-demo.mjs
# Publishes the demo extension to 19 October at 17:00 Dublin, preserving history:
node scripts/verify-demo.mjs --revise
npm run test
npx tsc --noEmit
npx deno check supabase/functions/notionary/index.ts
npm run lint
npm run build
```

Setup uses Supabase's Auth admin API to create confirmed demo users with random passwords. It does not reset existing deadlines or passwords. Apply migrations before setup, and deploy `notionary` before verification. The transient `deadline_revisions` table deliberately has no student policies or grants.

The Sources, My Learning and Graph links open full workspace views; the chat inspector and navigation have draggable dividers (also keyboard accessible). The live graph connects the Cloud Computing Hub, module source database, source pages and announcements. Demo mode presents the long-term vision as a 29-node course network across five topics, with slides, tutorials, transcripts, board images and exam questions. Both views support pan, zoom, node dragging, filtering, keyboard selection and an expanded presentation view. The vision graph is local presentation data; it does not add sources to Notion or affect AI retrieval.

The Cloud Computing source database is `becbee4e-9bfa-43e2-a36c-91d9e922247d`, inside Demo. Its five original source pages retain their IDs and content. The inline board groups by Source type: Lecture slides, Transcripts, Tutorials, Board images and Exam papers. Announcements stay directly under Demo so the existing revision writer and recovery continue working.

This is a bounded hackathon demo: selected cached text, no embeddings, PDF ingestion or memory evolution. Citation IDs are validated against the supplied corpus; this does not prove every generated claim is entailed by its cited passage.
