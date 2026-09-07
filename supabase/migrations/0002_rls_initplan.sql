-- Evaluate auth.uid() once per query instead of once per row.
--
-- `auth.uid() = user_id` is re-evaluated for every candidate row, because the
-- planner treats the function call as volatile in that position. Wrapping it as
-- `(select auth.uid())` turns it into an InitPlan: computed once, then compared
-- against each row. Supabase's own database linter flags the unwrapped form
-- (auth_rls_initplan), and it fired on all eight policies here.
--
-- This changes performance only. The predicate is identical, so the security
-- boundary is exactly what it was: a row is visible if and only if its user_id
-- matches the caller.
--
-- Safe to run repeatedly — each policy is dropped first, as in 0001.
do $$
declare t text;
begin
  foreach t in array array['readings', 'profiles'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select using ((select auth.uid()) = user_id)',
                   t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert with check ((select auth.uid()) = user_id)',
                   t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
                   t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete using ((select auth.uid()) = user_id)',
                   t || '_delete_own', t);
  end loop;
end $$;
