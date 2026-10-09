alter table public.deadline_revisions add column lease_until timestamptz;
create function public.claim_deadline_revision(revision_id uuid) returns boolean
language sql security invoker set search_path = '' as $$
 with claimed as (
 update public.deadline_revisions set lease_until=now()+interval '120 seconds'
 where id=revision_id and state='pending' and (lease_until is null or lease_until<now())
 returning id) select exists(select 1 from claimed);
$$;
revoke all on function public.claim_deadline_revision(uuid) from public, anon, authenticated;
grant execute on function public.claim_deadline_revision(uuid) to service_role;
