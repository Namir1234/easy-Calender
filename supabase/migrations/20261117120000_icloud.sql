-- easy-Calender: iCloud als dritter Anbieter
--
-- Konten dürfen jetzt auch von iCloud stammen. Das app-spezifische Passwort
-- liegt wie alle Tokens nur verschlüsselt auf dem Gerät, nie hier.

alter table public.accounts drop constraint if exists accounts_provider_check;
alter table public.accounts
  add constraint accounts_provider_check
  check (provider in ('google', 'microsoft', 'icloud', 'demo'));

-- Ein Paar verbindet seither zwei beliebige Kalender (z. B. Google ↔ iCloud).
-- Die Spalten behalten ihre alten Namen und stehen für Seite A und Seite B.
comment on column public.sync_pairs.google_calendar_id is 'Seite A des Paars (früher immer Google)';
comment on column public.sync_pairs.ms_calendar_id is 'Seite B des Paars (früher immer Outlook)';
comment on column public.event_links.google_event_id is 'ID des Termins auf Seite A';
comment on column public.event_links.ms_event_id is 'ID des Termins auf Seite B';
comment on column public.event_links.google_etag is 'Fingerabdruck von Seite A beim letzten Abgleich';
comment on column public.event_links.ms_changekey is 'Fingerabdruck von Seite B beim letzten Abgleich';
