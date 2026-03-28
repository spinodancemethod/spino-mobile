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
