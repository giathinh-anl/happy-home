-- ============================================================
-- Happy Home — Chạy ban đêm: tự ghi phí trễ hạn + tự báo nhắc nợ vào app khách
--
-- Máy chủ tự làm lúc 0 giờ 05 (giờ Việt Nam) mỗi đêm, kể cả khi không ai mở web:
--   1. PHÍ TRỄ HẠN (nếu chủ trọ bật cho tòa): ghi / cập nhật dòng "Phí trễ hạn" vào hóa đơn còn nợ,
--      đúng luật ở js/reminders.js (miễn N ngày đầu, X ₫/ngày, trần 10% tiền gốc, tính trên tiền gốc).
--      Chỉ TĂNG phí, không bao giờ tự giảm. Hóa đơn chủ trọ đã tự ghi / gỡ phí bằng tay thì KHÔNG đụng tới
--      (cờ late_fee_locked), nên khi chủ trọ miễn phí cho một khách, đêm sau hệ thống không ghi lại.
--   2. NHẮC NỢ (nếu chủ trọ bật cho tòa): gửi thông báo vào APP KHÁCH THUÊ khi hóa đơn sắp đến hạn,
--      quá hạn 1-3 ngày, 4-7 ngày, và từ 8 ngày (nhắc lại mỗi tuần). Mỗi hóa đơn mỗi mức chỉ một thông báo.
--      KHÔNG gửi Zalo / SMS (cần tài khoản dịch vụ ngoài), chủ trọ vẫn nhắc bằng tay ở trang Nhắc nợ.
--   3. Đổi trạng thái hóa đơn còn nợ sang "Quá hạn" (hoặc về lại "Trả một phần" / "Đã phát hành") theo ngày.
--
-- Mặc định TẮT cho mọi tòa. Bật ở trang Nhắc nợ → Phí trễ hạn.
--
-- Giờ chạy tự động dùng pg_cron. Nếu Supabase chưa bật pg_cron, tệp này vẫn chạy được và báo ở cuối: bật
-- Database → Extensions → pg_cron rồi chạy lại tệp này một lần nữa. Chưa có pg_cron thì nút "Chạy ngay" vẫn dùng được.
--
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần). Chạy lại nhiều lần vẫn an toàn.
-- ============================================================

-- ---------- Cột mới ----------
-- (hai cột phí là của migration-late-fee.sql, thêm lại ở đây cho chắc: chạy lại không sao)
alter table public.buildings add column if not exists late_fee_per_day bigint default 0;
alter table public.buildings add column if not exists late_grace_days int default 3;
alter table public.buildings add column if not exists late_fee_auto boolean default false;
alter table public.buildings add column if not exists auto_remind boolean default false;
alter table public.buildings add column if not exists nightly_last_run timestamptz;
alter table public.buildings add column if not exists nightly_last_note text;
-- Chủ trọ tự ghi / gỡ phí trễ hạn của hóa đơn này: lần chạy đêm bỏ qua hóa đơn đó
alter table public.invoices add column if not exists late_fee_locked boolean default false;

-- ---------- Thông báo vào app khách ----------
create table if not exists public.tenant_notices (
  owner_id   uuid not null references auth.users(id) on delete cascade,
  id         text not null,
  building_id text not null,
  room_code  text not null,
  invoice_id text,
  kind       text not null,                 -- sap-han | nhac-nhe | nhac-phi | khan
  dedupe_key text not null,                 -- một hóa đơn, một mức: không gửi trùng khi chạy lại
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, id),
  unique (owner_id, dedupe_key)
);
create index if not exists tenant_notices_room_idx on public.tenant_notices (owner_id, building_id, room_code, created_at desc);

-- Chủ trọ chỉ ĐỌC được thông báo của mình; ghi chỉ qua hàm bên dưới.
alter table public.tenant_notices enable row level security;
drop policy if exists own_read on public.tenant_notices;
create policy own_read on public.tenant_notices for select to authenticated using (owner_id = auth.uid());
revoke all on public.tenant_notices from public, anon, authenticated;
grant select on public.tenant_notices to authenticated;

-- ---------- Hàm nội bộ (khớp js/reminders.js) ----------
create or replace function public._fmt_vnd(p numeric)
returns text language sql immutable set search_path = public as $$
  select translate(to_char(round(coalesce(p, 0)), 'FM999,999,999,999,999'), ',', '.') || ' ₫'
$$;

create or replace function public._nhan_ky(p text)
returns text language sql immutable set search_path = public as $$
  select case when p ~ '^\d{4}-\d{2}$' then 'T' || ltrim(split_part(p, '-', 2), '0') || '/' || split_part(p, '-', 1) else coalesce(p, '') end
$$;

-- Hôm nay theo giờ Việt Nam = UTC+7 (không có giờ mùa hè). Không dùng tên múi giờ để khỏi phụ thuộc bảng múi giờ của máy.
create or replace function public._vn_today(p_at timestamptz default now())
returns date language sql stable set search_path = public as $$
  select ((p_at at time zone 'UTC') + interval '7 hours')::date
$$;

-- Mức nhắc theo số ngày trễ (âm = chưa tới hạn): sắp hạn -3..0, nhắc nhẹ 1..3, có phí 4..7, khẩn từ 8
create or replace function public._remind_level(p_tre int)
returns text language sql immutable set search_path = public as $$
  select case when p_tre is null then null
              when p_tre between -3 and 0 then 'sap-han'
              when p_tre between 1 and 3 then 'nhac-nhe'
              when p_tre between 4 and 7 then 'nhac-phi'
              when p_tre >= 8 then 'khan' end
$$;

-- Phí trễ hạn của một hóa đơn: min((ngày trễ - ngày miễn) × phí/ngày, 10% tiền gốc). Khớp tinhPhi() trong js/reminders.js.
create or replace function public._late_fee(p_goc numeric, p_tre int, p_moi bigint, p_mien int)
returns numeric language sql immutable set search_path = public as $$
  select case when coalesce(p_moi, 0) <= 0 or p_tre is null or p_tre - p_mien <= 0 then 0
              else least((p_tre - p_mien) * p_moi, floor(coalesce(p_goc, 0) * 0.10)) end
$$;

revoke execute on function public._vn_today(timestamptz) from public, anon, authenticated;
revoke execute on function public._fmt_vnd(numeric) from public, anon, authenticated;
revoke execute on function public._nhan_ky(text) from public, anon, authenticated;
revoke execute on function public._remind_level(int) from public, anon, authenticated;
revoke execute on function public._late_fee(numeric, int, bigint, int) from public, anon, authenticated;

-- ---------- Việc làm ban đêm ----------
-- p_owner null = mọi chủ trọ (pg_cron gọi); p_today để thử bằng ngày giả; p_building giới hạn một tòa.
-- KHÔNG cấp quyền cho trình duyệt: chủ trọ gọi qua owner_run_nightly (chỉ chạy cho chính mình).
create or replace function public.hh_nightly(p_owner uuid default null, p_today date default null, p_building text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_today date := coalesce(p_today, public._vn_today());
  b record; i record;
  v_moi bigint; v_mien int; v_fee_on boolean; v_remind boolean;
  v_tre int; v_goc numeric; v_applied numeric; v_want numeric; v_lines jsonb; v_meta text;
  v_total bigint; v_status text; v_should text; v_conno numeric;
  v_level text; v_key text; v_title text; v_body text; v_ins int;
  v_nfee int; v_sfee numeric; v_nnote int; v_nstat int; v_parts text[]; v_note text;
  t_b int := 0; t_nfee int := 0; t_sfee numeric := 0; t_nnote int := 0; t_nstat int := 0;
begin
  delete from public.tenant_notices where created_at < now() - interval '120 days' and (p_owner is null or owner_id = p_owner);

  for b in
    select * from public.buildings bb
    where (p_owner is null or bb.owner_id = p_owner) and (p_building is null or bb.id = p_building)
      and (coalesce(bb.late_fee_auto, false) or coalesce(bb.auto_remind, false))
    order by bb.owner_id, bb.id
  loop
    t_b := t_b + 1;
    v_moi := greatest(coalesce(b.late_fee_per_day, 0), 0);
    v_mien := case when b.late_grace_days is null or b.late_grace_days < 0 then 3 else b.late_grace_days end;
    v_fee_on := coalesce(b.late_fee_auto, false) and v_moi > 0;
    v_remind := coalesce(b.auto_remind, false);
    v_nfee := 0; v_sfee := 0; v_nnote := 0; v_nstat := 0;

    for i in
      select * from public.invoices x
      where x.owner_id = b.owner_id and x.building_id = b.id
        and x.status in ('issued', 'partial', 'overdue')
        and x.due_date is not null and coalesce(x.total, 0) - coalesce(x.paid, 0) > 0
      order by x.period, x.id
    loop
      v_tre := v_today - i.due_date;
      v_total := i.total; v_status := i.status;

      -- 1. phí trễ hạn: chỉ tăng, bỏ qua hóa đơn chủ trọ đã tự chỉnh
      if v_fee_on and not coalesce(i.late_fee_locked, false) and v_tre > v_mien then
        v_lines := case when jsonb_typeof(i.lines) = 'array' then i.lines else '[]'::jsonb end;
        if jsonb_array_length(v_lines) = 0 then
          v_goc := i.total; v_applied := 0;
        else
          select coalesce(sum(coalesce((e.l ->> 'amount')::numeric, 0)) filter (where coalesce(e.l ->> 'type', '') <> 'latefee'), 0),
                 coalesce(sum(coalesce((e.l ->> 'amount')::numeric, 0)) filter (where e.l ->> 'type' = 'latefee'), 0)
            into v_goc, v_applied from jsonb_array_elements(v_lines) as e(l);
        end if;
        v_want := public._late_fee(v_goc, v_tre, v_moi, v_mien);
        if v_want > v_applied then
          v_meta := (v_tre - v_mien)::text || ' ngày × ' || public._fmt_vnd(v_moi)
            || case when (v_tre - v_mien) * v_moi > floor(v_goc * 0.10) then ', chạm trần 10%' else '' end
            || ' · tự động tính đến ' || to_char(v_today, 'DD/MM/YYYY');
          v_lines := coalesce((select jsonb_agg(e.l order by e.n) from jsonb_array_elements(v_lines) with ordinality as e(l, n)
                               where coalesce(e.l ->> 'type', '') <> 'latefee'), '[]'::jsonb)
                     || jsonb_build_array(jsonb_build_object('label', 'Phí trễ hạn', 'amount', v_want, 'type', 'latefee', 'meta', v_meta));
          v_total := (i.total - v_applied + v_want)::bigint;
          update public.invoices
             set lines = v_lines, total = v_total, status = 'overdue', edited = true,
                 edited_at = to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                 edited_by = 'Tự động (ban đêm)', updated_at = now()
           where owner_id = i.owner_id and id = i.id;
          v_status := 'overdue';
          v_nfee := v_nfee + 1; v_sfee := v_sfee + (v_want - v_applied);
        end if;
      end if;

      -- 2. trạng thái theo ngày (giống refreshInvoiceStatus ở trình duyệt)
      v_should := case when v_tre > 0 then 'overdue' when coalesce(i.paid, 0) > 0 then 'partial' else 'issued' end;
      if v_should <> v_status then
        update public.invoices set status = v_should, updated_at = now() where owner_id = i.owner_id and id = i.id;
        v_status := v_should; v_nstat := v_nstat + 1;
      end if;

      -- 3. thông báo vào app khách: mỗi hóa đơn một thông báo cho mỗi mức (mức khẩn nhắc lại mỗi tuần)
      v_level := public._remind_level(v_tre);
      if v_remind and v_level is not null and coalesce(i.room_code, '') <> '' then
        v_conno := v_total - coalesce(i.paid, 0);
        v_key := i.id || '|' || v_level || case when v_level = 'khan' then '|' || ((v_tre - 8) / 7)::text else '' end;
        if v_level = 'sap-han' then
          v_title := 'Sắp đến hạn đóng tiền';
          v_body := 'Hóa đơn ' || public._nhan_ky(i.period) || ' còn ' || public._fmt_vnd(v_conno) || ' sẽ đến hạn ngày '
            || to_char(i.due_date, 'DD/MM/YYYY') || case when v_tre = 0 then ' (hôm nay).' else ' (còn ' || (-v_tre)::text || ' ngày).' end;
        elsif v_level = 'nhac-nhe' then
          v_title := 'Hóa đơn đã quá hạn';
          v_body := 'Hóa đơn ' || public._nhan_ky(i.period) || ' còn ' || public._fmt_vnd(v_conno) || ', đã quá hạn ' || v_tre::text
            || ' ngày (hạn ' || to_char(i.due_date, 'DD/MM/YYYY') || '). Bạn vui lòng thanh toán sớm giúp chủ nhà.';
        elsif v_level = 'nhac-phi' then
          v_title := 'Quá hạn thanh toán';
          v_body := 'Hóa đơn ' || public._nhan_ky(i.period) || ' đã quá hạn ' || v_tre::text || ' ngày, tổng cần thanh toán '
            || public._fmt_vnd(v_conno) || case when v_total <> i.total or exists (
                 select 1 from jsonb_array_elements(case when jsonb_typeof(i.lines) = 'array' then i.lines else '[]'::jsonb end) e(l) where e.l ->> 'type' = 'latefee')
               then ' (đã gồm phí trễ hạn)' else '' end
            || '. Vui lòng thanh toán trong hôm nay để không phát sinh thêm.';
        else
          v_title := 'Quá hạn nhiều ngày';
          v_body := 'Hóa đơn ' || public._nhan_ky(i.period) || ' đã quá hạn ' || v_tre::text || ' ngày, tổng cần thanh toán '
            || public._fmt_vnd(v_conno) || '. Vui lòng thanh toán ngay hoặc liên hệ chủ nhà để thống nhất lịch trả.';
        end if;
        insert into public.tenant_notices(owner_id, id, building_id, room_code, invoice_id, kind, dedupe_key, title, body)
        values (i.owner_id, 'tb-' || substr(md5(random()::text || clock_timestamp()::text || v_key), 1, 10),
                i.building_id, i.room_code, i.id, v_level, v_key, v_title, v_body)
        on conflict (owner_id, dedupe_key) do nothing;
        get diagnostics v_ins = row_count;
        v_nnote := v_nnote + v_ins;
      end if;
    end loop;

    v_parts := '{}';
    if v_fee_on then v_parts := v_parts || ('ghi phí trễ hạn cho ' || v_nfee::text || ' hóa đơn' || case when v_nfee > 0 then ' (+' || public._fmt_vnd(v_sfee) || ')' else '' end); end if;
    if v_remind then v_parts := v_parts || ('gửi ' || v_nnote::text || ' thông báo vào app khách'); end if;
    if v_nstat > 0 then v_parts := v_parts || ('đổi ' || v_nstat::text || ' hóa đơn sang trạng thái theo ngày'); end if;
    v_note := to_char(v_today, 'DD/MM/YYYY') || ': ' || case when v_nfee + v_nnote + v_nstat = 0 then 'không có gì cần xử lý' else array_to_string(v_parts, '; ') end;
    update public.buildings set nightly_last_run = now(), nightly_last_note = v_note where owner_id = b.owner_id and id = b.id;

    if v_nfee + v_nnote + v_nstat > 0 then
      insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
      values (b.owner_id, 'lg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), now(), 'Hệ thống', 'nightly.run',
              'Chạy ban đêm (' || coalesce(b.name, b.id) || '): ' || array_to_string(v_parts, '; '), null);
    end if;
    t_nfee := t_nfee + v_nfee; t_sfee := t_sfee + v_sfee; t_nnote := t_nnote + v_nnote; t_nstat := t_nstat + v_nstat;
  end loop;

  return jsonb_build_object('ok', true, 'date', v_today, 'buildings', t_b,
    'fees', t_nfee, 'feeAmount', t_sfee, 'notices', t_nnote, 'statuses', t_nstat);
end $$;
revoke execute on function public.hh_nightly(uuid, date, text) from public, anon, authenticated;

-- Chủ trọ bấm "Chạy ngay": chỉ chạy cho dữ liệu của chính mình, đúng như lần chạy đêm
create or replace function public.owner_run_nightly(p_building_id text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then return jsonb_build_object('error', 'auth'); end if;
  return public.hh_nightly(v_owner, null, p_building_id);
end $$;
revoke execute on function public.owner_run_nightly(text) from public, anon;
grant execute on function public.owner_run_nightly(text) to authenticated;

-- Khách xem thông báo của phòng mình (bằng token đăng nhập app, như các hàm tenant_* khác)
create or replace function public.tenant_get_notices(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare v_t public.tenants;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body,
                     'invoiceId', n.invoice_id, 'createdAt', n.created_at) order by n.created_at desc)
                   from (select * from public.tenant_notices x
                         where x.owner_id = v_t.owner_id and x.building_id = v_t.building_id and x.room_code = v_t.room_code
                         order by x.created_at desc limit 10) n), '[]'::jsonb);
end $$;
revoke execute on function public.tenant_get_notices(text) from public;
grant execute on function public.tenant_get_notices(text) to anon, authenticated;

-- ---------- Lịch chạy 0 giờ 05 giờ Việt Nam (= 17:05 UTC) ----------
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'Chưa bật được pg_cron (%). Bật ở Supabase → Database → Extensions → pg_cron rồi chạy lại tệp này. Trong lúc chờ, dùng nút "Chạy ngay" ở trang Nhắc nợ.', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'hh-nightly';
    perform cron.schedule('hh-nightly', '5 17 * * *', 'select public.hh_nightly(null)');
    raise notice 'Đã đặt lịch chạy mỗi đêm lúc 0 giờ 05 (giờ Việt Nam).';
  end if;
end $$;
