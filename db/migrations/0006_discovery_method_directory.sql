-- Adds "directory" as a valid discovery_method — the new DBpedia
-- company-directory discovery source (src/services/discovery/dbpedia.ts),
-- alongside the existing seed/sitemap/link methods.

alter table discovery_queue drop constraint if exists discovery_queue_discovery_method_check;
alter table discovery_queue add constraint discovery_queue_discovery_method_check
  check (discovery_method in ('seed', 'sitemap', 'link', 'directory'));
