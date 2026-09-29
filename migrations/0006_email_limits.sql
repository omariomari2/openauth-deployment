CREATE TABLE auth_email_budget (
  month TEXT PRIMARY KEY NOT NULL,
  day TEXT NOT NULL,
  daily INTEGER NOT NULL,
  monthly INTEGER NOT NULL
);

CREATE TABLE auth_email_recipient (
  key TEXT PRIMARY KEY NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX auth_email_recipient_day_idx ON auth_email_recipient(day);
CREATE UNIQUE INDEX auth_account_provider_idx ON auth_account(providerId, accountId);
