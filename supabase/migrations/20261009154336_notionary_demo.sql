-- One shared module; learning profiles remain owned by auth users.
create table public.modules (
 id text primary key, title text not null, description text not null
);
create table public.module_memberships (
 module_id text not null references public.modules(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'student' check (role in ('student','editor')),
 primary key (module_id,user_id)
);
create table public.learning_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 student_id text not null check(student_id in ('timmy','john')),
 name text not null, level text not null, preferences jsonb not null default '[]'
);
create table public.sources (
 id text primary key, module_id text not null references public.modules(id),
 kind text not null check(kind in ('course','announcement')),
 title text not null, reference text not null, excerpt text not null,
 notion_url text not null, is_demo boolean not null default false,
 status text check(status in ('current','superseded')),
 posted_at timestamptz not null default now()
);
create table public.assessments (
 id text primary key, module_id text not null references public.modules(id),
 title text not null, due_at timestamptz not null, source_id text not null references public.sources(id),
 version integer not null default 0
);
-- In-flight writes are never exposed to students. Stable request IDs allow retries.
create table public.deadline_revisions (
 id uuid primary key, module_id text not null references public.modules(id),
 assessment_id text not null references public.assessments(id),
 requested_by uuid not null references auth.users(id),
 announcement text not null, new_due_at timestamptz not null,
 expected_version integer not null, notion_page_id text,
 state text not null default 'pending' check(state in ('pending','published')),
 created_at timestamptz not null default now()
);
create index memberships_user_idx on public.module_memberships(user_id);
create index sources_module_idx on public.sources(module_id);
create index assessments_module_idx on public.assessments(module_id);
create index revisions_assessment_idx on public.deadline_revisions(assessment_id);
create index revisions_requester_idx on public.deadline_revisions(requested_by);

alter table public.modules enable row level security;
alter table public.module_memberships enable row level security;
alter table public.learning_profiles enable row level security;
alter table public.sources enable row level security;
alter table public.assessments enable row level security;
alter table public.deadline_revisions enable row level security;
create policy membership_own on public.module_memberships for select to authenticated using(user_id = (select auth.uid()));
create policy profile_own on public.learning_profiles for select to authenticated using(user_id = (select auth.uid()));
create policy modules_member on public.modules for select to authenticated using(exists(select 1 from public.module_memberships m where m.module_id=modules.id and m.user_id=(select auth.uid())));
create policy sources_member on public.sources for select to authenticated using(exists(select 1 from public.module_memberships m where m.module_id=sources.module_id and m.user_id=(select auth.uid())));
create policy assessments_member on public.assessments for select to authenticated using(exists(select 1 from public.module_memberships m where m.module_id=assessments.module_id and m.user_id=(select auth.uid())));
revoke all on public.modules, public.module_memberships, public.learning_profiles, public.sources, public.assessments, public.deadline_revisions from anon, authenticated;
grant select on public.modules, public.module_memberships, public.learning_profiles, public.sources, public.assessments to authenticated;

-- Only the authenticated edge handler calls this through the service role, after
-- verifying an editor membership and completing the shared Notion write.
create function public.publish_deadline_revision(revision_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare r public.deadline_revisions; a public.assessments;
begin
 select * into r from public.deadline_revisions where id=revision_id for update;
 if not found then raise exception 'Unknown revision'; end if;
 if r.state='published' then return; end if;
 if r.notion_page_id is null then raise exception 'Notion write incomplete'; end if;
 select * into a from public.assessments where id=r.assessment_id for update;
 if a.version<>r.expected_version then raise exception 'Deadline changed. Refresh and create a new revision.'; end if;
 update public.sources set status='superseded' where id=a.source_id;
 insert into public.sources(id,module_id,kind,title,reference,excerpt,notion_url,is_demo,status)
 values(r.id::text,r.module_id,'announcement',a.title||' — Deadline revision','Demo announcement · Revision',
 r.announcement||E'\n\nConfirmed deadline: '||to_char(r.new_due_at at time zone 'Europe/Dublin','DD Month YYYY HH24:MI')||' Europe/Dublin',
 'https://www.notion.so/'||replace(r.notion_page_id,'-',''),true,'current');
 update public.assessments set due_at=r.new_due_at, source_id=r.id::text,version=version+1 where id=a.id;
 update public.deadline_revisions set state='published' where id=r.id;
end $$;
revoke all on function public.publish_deadline_revision(uuid) from public, anon, authenticated;
grant execute on function public.publish_deadline_revision(uuid) to service_role;
insert into public.modules values ('COMP30520','Cloud Computing · COMP30520','Virtual machines, containers and cloud infrastructure — one shared course, personalised teaching.');
