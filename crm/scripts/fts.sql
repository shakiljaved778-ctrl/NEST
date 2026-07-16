-- Expression GIN indexes for Postgres full-text global search.
-- Run once per database (the seed script applies this automatically).

CREATE INDEX IF NOT EXISTS lead_fts_idx ON "Lead" USING GIN (
  to_tsvector('simple',
    coalesce("firstName",'') || ' ' || coalesce("lastName",'') || ' ' ||
    coalesce(company,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,''))
);

CREATE INDEX IF NOT EXISTS account_fts_idx ON "Account" USING GIN (
  to_tsvector('simple',
    coalesce("legalName",'') || ' ' || coalesce("tradeName",'') || ' ' ||
    coalesce("crNumber",'') || ' ' || coalesce(website,''))
);

CREATE INDEX IF NOT EXISTS contact_fts_idx ON "Contact" USING GIN (
  to_tsvector('simple',
    coalesce("firstName",'') || ' ' || coalesce("lastName",'') || ' ' ||
    coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(position,''))
);

CREATE INDEX IF NOT EXISTS deal_fts_idx ON "Deal" USING GIN (
  to_tsvector('simple', coalesce(name,''))
);
