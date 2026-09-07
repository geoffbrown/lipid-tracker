-- Theme follows the account, not the browser.
--
-- It stays mirrored into localStorage as well, and that is not redundant: the
-- pre-paint script in app/layout.tsx has to decide light or dark before React
-- runs and before any network call could return, so it reads the mirror. This
-- column is what makes the choice the same on the next device; the mirror is
-- what stops the first paint flashing the wrong one.
alter table public.profiles
  add column if not exists theme text not null default 'auto'
    check (theme in ('auto', 'light', 'dark'));
