# Observability Runbook

## Edge function monitoring

Monitor `verify-google-play-purchase` failures in Supabase logs and billing events.

### Suggested alert thresholds
- `verification.error` events > 5 in 10 minutes: investigate immediately.
- `verification.request` events with 429 responses > 20 in 10 minutes: investigate abuse/throttling tuning.
- Google API verification failures (`Google Play verification failed`) > 3 in 10 minutes: check service account health and package config.

## SQL queries

### Error count in last 10 minutes
```sql
select count(*) as error_count
from public.billing_events
where provider = 'google_play'
  and event_type = 'verification.error'
  and processed_at >= now() - interval '10 minutes';
```

### High request volume in last 10 minutes
```sql
select count(*) as request_count
from public.billing_events
where provider = 'google_play'
  and event_type = 'verification.request'
  and processed_at >= now() - interval '10 minutes';
```

### Top error payloads in last 24 hours
```sql
select payload->>'error' as error_message, count(*)
from public.billing_events
where provider = 'google_play'
  and event_type = 'verification.error'
  and processed_at >= now() - interval '24 hours'
group by 1
order by 2 desc;
```

## Client app monitoring

Ensure `sql/bootstrap/01_tables.sql` and `sql/bootstrap/04_rls_policies_grants.sql` are applied, then monitor auth/billing contexts:
- `auth.signIn`
- `auth.signUp`
- `auth.signOut`
- `auth.signInWithOAuth`
- `billing.checkout`

### Client error query
```sql
select context, count(*)
from public.client_error_logs
where created_at >= now() - interval '24 hours'
group by context
order by count(*) desc;
```

## Data retention and purge policy

### Retention guidelines

- **billing_events:** Keep for 90 days (compliance + debugging window). Older records can be safely archived or deleted.
- **client_error_logs:** Keep for 30 days (performance and debugging). Rotate out older logs to control table growth.
- **subscriptions & profiles:** Keep indefinitely (core user data; archive if user deletes account).

### Archive / delete queries

#### Archive billing_events older than 90 days (optional)

Before deletion, back up to a cold storage table if needed:

```sql
-- Copy to archive table (create billing_events_archive if not exists)
insert into public.billing_events_archive
select * from public.billing_events
where processed_at < now() - interval '90 days';

-- Delete archived records from live table
delete from public.billing_events
where processed_at < now() - interval '90 days';
```

#### Delete client_error_logs older than 30 days (optional)

```sql
delete from public.client_error_logs
where created_at < now() - interval '30 days';
```

#### Recommended schedule

- **Weekly:** Send alerts if `client_error_logs` table size grows beyond threshold (e.g., > 100K rows).
- **Monthly:** Run archival/deletion queries above to keep tables lean.
- **Quarterly:** Review subscription/user data for accounts due for deletion (per privacy policy).

### Monitoring table growth

```sql
-- Check approximate row counts
select tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
from pg_tables
where schemaname = 'public'
  and tablename in ('billing_events', 'client_error_logs', 'subscriptions', 'user_profiles')
order by pg_total_relation_size(schemaname||'.'||tablename) desc;
```
