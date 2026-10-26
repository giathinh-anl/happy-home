-- Khung giả lập Supabase để chạy các tệp supabase/*.sql trên Postgres thường (không cần tài khoản Supabase).
-- CHỈ DÙNG CHO KIỂM THỬ. Hai điểm khác bản thật:
--   * pgcrypto không có sẵn trong bản Postgres nhúng nên crypt/gen_salt/gen_random_bytes/digest được giả bằng md5.
--     Logic (khớp mã, cấp token, khóa) vẫn thử thật; độ mạnh của bcrypt/sha256 thì do pgcrypto thật bảo đảm.
--   * auth.uid() đọc từ biến phiên request.jwt.claim.sub như PostgREST/Supabase làm.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;
create schema if not exists extensions;
grant usage on schema auth, extensions, public to anon, authenticated;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select jsonb_build_object('email', nullif(current_setting('request.jwt.claim.email', true), '')) $$;

create or replace function extensions.gen_salt(text) returns text language sql as
$$ select '$bf$' || substr(md5(random()::text || clock_timestamp()::text), 1, 8) $$;
create or replace function extensions.crypt(pw text, salt text) returns text language sql immutable as
$$ select substr(salt, 1, 12) || md5(pw || substr(salt, 1, 12)) $$;
create or replace function extensions.gen_random_bytes(n int) returns bytea language sql as
$$ select decode(substr(md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text), 1, 2 * n), 'hex') $$;
create or replace function extensions.digest(t text, algo text) returns bytea language sql immutable as
$$ select decode(md5(t) || md5(t || 'x'), 'hex') $$;

-- Supabase cấp sẵn quyền cho anon/authenticated trên mọi bảng và hàm mới tạo trong schema public.
-- Giả lập đúng như vậy để bắt lỗi "quên thu hồi quyền".
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
