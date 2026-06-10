alter table hotels drop constraint if exists check_enabled_languages_count;
alter table hotels add constraint check_enabled_languages_count
  check (array_length(enabled_languages, 1) >= 1
         and array_length(enabled_languages, 1) <= 6);
