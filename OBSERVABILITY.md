# Observability Runbook

## RevenueCat webhook monitoring

Monitor the `ingest-revenuecat-webhook` Supabase Edge Function and the
`billing_events` rows it writes with `provider = 'revenuecat'`. The function
stores RevenueCat's native event type in `event_type` and preserves the full
webhook body in `payload`.

### Suggested alert thresholds
- Any sustained increase in webhook responses with status 400 or 500: inspect function logs and authorization/configuration secrets.
- More than 5 RevenueCat `TEST` or `TRANSFER_ERROR` events in 10 minutes: investigate the affected product, customer, or store configuration.
- More than 20 webhook events in 10 minutes for one user or product: investigate duplicate delivery or unexpected purchase activity.

## SQL queries

### RevenueCat error-like events in the last 10 minutes
```sql
select event_type, count(*) as event_count
from public.billing_events
where provider = 'revenuecat'
  and event_type in ('TEST', 'TRANSFER_ERROR')
  and processed_at >= now() - interval '10 minutes'
group by event_type
order by event_count desc;
```

### RevenueCat event volume in the last 10 minutes
```sql
select event_type, count(*) as event_count
from public.billing_events
where provider = 'revenuecat'
  and processed_at >= now() - interval '10 minutes'
group by event_type
order by event_count desc;
```

### Recent RevenueCat event payloads
```sql
select event_type, event_id, payload, processed_at
from public.billing_events
where provider = 'revenuecat'
  and processed_at >= now() - interval '24 hours'
order by processed_at desc
limit 100;
```

## Client app monitoring

Ensure `sql/bootstrap/01_tables.sql` and `sql/bootstrap/04_rls_policies_grants.sql` are applied, then monitor auth and billing contexts:
- `auth.signIn`
- `auth.signUp`
- `auth.signOut`
- `billing.purchase`
- `billing.restore`

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

#### Archive or delete billing_events older than 90 days (optional)

Review retention, legal, and incident-response requirements before running this
in production. If an archive table exists, back up rows before deletion:

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
