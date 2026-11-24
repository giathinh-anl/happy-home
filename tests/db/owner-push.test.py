"""Kiểm thử thông báo đẩy cho CHỦ TRỌ (supabase/migration-owner-push.sql) trên Postgres thật chạy tại máy.

pg_net không có trong bản Postgres nhúng, nên dựng net.http_post GIẢ ghi lời gọi vào bảng __net_calls để xem
trigger báo đúng chủ trọ, đúng nội dung, chỉ khi việc đến từ app khách, và im lặng khi thiếu cấu hình.
Cách chạy: .venv-db/Scripts/python tests/db/owner-push.test.py     Biến HH_OWNER_PUSH_SQL trỏ tới bản sửa (thử phá).
"""
import os, pathlib, re, sys, tempfile, uuid
import pgserver, psycopg

ROOT = pathlib.Path(__file__).resolve().parents[2]
SQL = ROOT / "supabase"
ok = hong = 0
def test(ten, fn):
    global ok, hong
    try: fn(); ok += 1; print("  ok   " + ten)
    except Exception as e: hong += 1; print(" HONG  " + ten + "\n         " + str(e).splitlines()[0][:230])
def expect(c, m="sai"):
    if not c: raise AssertionError(m)

srv = pgserver.get_server(tempfile.mkdtemp(prefix="hhpg"), cleanup_mode="delete")
conn = psycopg.connect(srv.get_uri(), autocommit=True)
def one(sql, params=None):
    r = conn.execute(sql, params).fetchone(); return r[0] if r else None
def role(r, sub=None):
    conn.execute("reset role"); conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (sub or "",))
    if r != "postgres": conn.execute(f"set role {r}")
def load(name, strip_ext=False):
    if name == "migration-owner-push.sql" and os.environ.get("HH_OWNER_PUSH_SQL"):
        t = pathlib.Path(os.environ["HH_OWNER_PUSH_SQL"]).read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8") if name != "stubs.sql" else (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    if strip_ext: t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ)", t)
    try: conn.execute(t)
    except Exception as e: print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)

print("Nạp lược đồ và các migration (đúng thứ tự trên máy chủ thật)")
for f in ["stubs.sql", "schema.sql", "migration-tenant-app.sql", "migration-tenant-app-v2.sql", "migration-claims-photos.sql",
          "migration-reading-photos.sql", "migration-support-chat.sql", "migration-staff-vehicles.sql", "migration-renewal.sql",
          "migration-late-fee.sql", "migration-invoice-batches.sql", "migration-incident-tracking.sql"]:
    load(f)
load("migration-tenant-auth.sql", strip_ext=True)
load("migration-nightly.sql")
load("migration-push.sql")
load("migration-chat-photos.sql")
load("migration-owner-push.sql")
print("  ok   toàn bộ tệp nạp không lỗi")
load("migration-owner-push.sql")
print("  ok   chạy migration-owner-push.sql lần hai không lỗi")

A, B, NV = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
for u, e in ((A, "a@x.vn"), (B, "b@x.vn"), (NV, "nv@x.vn")): conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
for o in (A, B):
    conn.execute("insert into public.buildings(owner_id, id, name) values (%s, 'b1', 'Nhà')", (o,))
    conn.execute("insert into public.rooms(owner_id, id, building_id, code, price) values (%s, 'r1', 'b1', 'P101', 1)", (o,))
conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) values "
             "(%s, 'tn-a1', 'b1', 'P101', 'An', '0921111700', true), (%s, 'tn-b1', 'b1', 'P101', 'Dũng', '0921111700', true)", (A, B))
conn.execute("insert into public.contracts(owner_id, id, building_id, room_code, tenant_name, rent, deposit, start_date, end_date, status) values "
             "(%s, 'hd-a1', 'b1', 'P101', 'An', 3500000, 3500000, current_date - 300, current_date + 30, 'active')", (A,))
def issue(o, tid):
    role("authenticated", o); return one("select public.owner_issue_tenant_code(%s)", (tid,))["code"]
def login(phone, code):
    role("anon"); return one("select public.tenant_login(%s, %s)", (phone, code))["token"]
tokA = login("0921111700", issue(A, "tn-a1"))
tokB = login("0921111700", issue(B, "tn-b1"))

FCM = "https://fcm.googleapis.com/fcm/send/chu-a"
K256 = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM"
KAUTH = "tBHItJI5svbpez7KI4CCXg"
def sub(uid, ep=FCM, p=K256, a=KAUTH, r="authenticated"):
    role(r, uid); return one("select public.owner_push_subscribe(%s, %s, %s, 'UA')", (ep, p, a))
def unsub(uid, ep=FCM):
    role("authenticated", uid); return one("select public.owner_push_unsubscribe(%s)", (ep,))
def n_subs(uid=None):
    role("postgres"); return one("select count(*) from public.owner_push_subs") if uid is None else one("select count(*) from public.owner_push_subs where user_id = %s", (uid,))

def denied(fn):
    try: fn()
    except psycopg.errors.InsufficientPrivilege: return
    raise AssertionError("đáng lẽ bị từ chối")

print("\nĐăng ký máy của chủ trọ")
test("chưa đăng nhập (anon) thì không gọi được hàm đăng ký", lambda: (role("anon"), denied(lambda: one("select public.owner_push_subscribe(%s, %s, %s, null)", (FCM, K256, KAUTH)))))
test("đăng nhập nhưng phiên không có tài khoản: trả lỗi auth, không ghi", lambda: (role("authenticated", None),
    expect(one("select public.owner_push_subscribe(%s, %s, %s, null)", (FCM, K256, KAUTH)) == {"error": "auth"}), expect(n_subs() == 0)))
test("địa chỉ Google, Mozilla, Apple, Microsoft đều được nhận", lambda: [expect(sub(A, ep) == {"ok": True}, ep) for ep in (
    "https://fcm.googleapis.com/fcm/send/g1", "https://updates.push.services.mozilla.com/wpush/v2/m1",
    "https://web.push.apple.com/Qabc", "https://wns2-par02p.notify.windows.com/w/?token=abc")])
role("postgres"); conn.execute("delete from public.owner_push_subs")
test("địa chỉ nội bộ, http thường, chỉ giống tên đều bị từ chối (chặn SSRF)", lambda: [expect(sub(A, ep) == {"error": "bad_endpoint"}, ep) for ep in (
    "http://fcm.googleapis.com/x", "https://localhost/x", "https://169.254.169.254/latest", "https://fcm.googleapis.com.evil.com/x",
    "https://evil.com/fcm.googleapis.com/", "https://evilpush.apple.com/x", "", None, "https://fcm.googleapis.com/" + "a" * 1100)])
test("khóa sai dạng bị từ chối", lambda: [expect(sub(A, FCM, p, a) == {"error": "bad_keys"}, (p, a)) for p, a in (("ngan", KAUTH), (K256, "x"), (None, None))])
test("chưa ghi gì sau các lần bị từ chối", lambda: expect(n_subs() == 0))
test("đăng ký đúng: ok, đăng ký lại cùng máy không nhân đôi", lambda: (expect(sub(A) == {"ok": True}), expect(sub(A) == {"ok": True}), expect(n_subs() == 1)))
def t_cap():
    for i in range(8): sub(A, f"https://fcm.googleapis.com/fcm/send/may{i}")
    expect(n_subs(A) == 5, f"giữ {n_subs(A)} máy, đáng lẽ 5")
    role("postgres"); expect(one("select count(*) from public.owner_push_subs where endpoint = 'https://fcm.googleapis.com/fcm/send/may7'") == 1, "máy mới nhất phải còn")
test("mỗi tài khoản giữ tối đa 5 máy, máy mới nhất luôn còn", t_cap)
test("tắt trên máy của người khác: không xóa được", lambda: (sub(A, FCM), expect(unsub(B, FCM) == {"ok": True}), expect(n_subs(A) == 5)))
test("tắt đúng máy của mình thì mất", lambda: (expect(unsub(A, FCM) == {"ok": True}), (lambda: (role("postgres"), expect(one("select count(*) from public.owner_push_subs where endpoint = %s", (FCM,)) == 0)))()))
test("cùng một máy đăng nhập tài khoản khác thì chuyển chủ, không nhân đôi", lambda: (sub(A, FCM), sub(B, FCM),
    (lambda: (role("postgres"), expect(one("select user_id::text from public.owner_push_subs where endpoint = %s", (FCM,)) == B)))()))

print("\nThiếu cấu hình / thiếu pg_net")
role("postgres"); conn.execute("delete from public.owner_push_subs")
sub(A, "https://fcm.googleapis.com/fcm/send/a-dt"); sub(A, "https://web.push.apple.com/a-ip"); sub(B, "https://fcm.googleapis.com/fcm/send/b-dt")
def tin(tok, body="Anh ơi vòi nước rỉ"):
    role("anon"); return one("select public.tenant_send_message(%s, %s)", (tok, body))
n0 = None
test("chưa có pg_net, chưa điền cấu hình: khách nhắn tin vẫn thành công", lambda: expect(tin(tokA)["ok"] is True))
role("postgres"); conn.execute("create schema if not exists net")
conn.execute("create table if not exists public.__net_calls(id serial, url text, body jsonb, headers jsonb)")
conn.execute("create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language plpgsql as "
             "$$ begin insert into public.__net_calls(url, body, headers) values (url, body, headers); return 1; end $$")
def calls(): role("postgres"); return conn.execute("select url, body, headers from public.__net_calls order by id").fetchall()
def reset():
    role("postgres"); conn.execute("truncate public.__net_calls")
    conn.execute("update public.support_messages set read_by_staff = true")          # coi như chủ đã đọc hết (bỏ việc gom 2 phút)
test("có pg_net nhưng chưa điền cấu hình: không gọi", lambda: (reset(), tin(tokA), expect(calls() == [])))
role("postgres"); conn.execute("update public.push_config set url = 'https://x.supabase.co/functions/v1/push-send', secret = 'bi-mat-chung', anon_key = 'anon.cong.khai' where id = 1")

print("\nKhách nhắn tin")
def t_msg():
    reset(); tin(tokA, "Anh ơi\n  vòi nước   rỉ"); c = calls()
    expect(len(c) == 1, f"{len(c)} lời gọi"); url, b, h = c[0]
    expect(url == "https://x.supabase.co/functions/v1/push-send", url)
    expect(h["x-push-secret"] == "bi-mat-chung" and h["Authorization"] == "Bearer anon.cong.khai" and h["apikey"] == "anon.cong.khai", h)
    eps = sorted(s["endpoint"] for s in b["subs"])
    expect(eps == ["https://fcm.googleapis.com/fcm/send/a-dt", "https://web.push.apple.com/a-ip"], eps)
    expect(b["title"] == "Tin nhắn mới · P101" and b["body"] == "An: Anh ơi vòi nước rỉ" and b["url"] == "#/b/b1/support", b)
    expect(all(s["p256dh"] == K256 and s["auth"] == KAUTH for s in b["subs"]))
test("báo mọi máy của đúng chủ trọ, tiêu đề có phòng, nội dung có tên khách, mở trang Hỏi đáp", t_msg)
test("chủ trọ khác (khách cùng số điện thoại) KHÔNG bị báo", lambda: expect(all("b-dt" not in s["endpoint"] for s in calls()[0][1]["subs"])))
test("khách của chủ trọ B nhắn: chỉ máy của B được báo", lambda: (reset(), tin(tokB), expect([s["endpoint"] for s in calls()[0][1]["subs"]] == ["https://fcm.googleapis.com/fcm/send/b-dt"])))
def t_gom():
    reset(); tin(tokA, "câu 1"); tin(tokA, "câu 2"); tin(tokA, "câu 3")
    expect(len(calls()) == 1, f"{len(calls())} lời gọi cho 3 câu liền")
test("khách nhắn liền 3 câu trong 2 phút: chỉ báo 1 lần", t_gom)
def t_doc_roi():
    reset(); tin(tokA, "câu 1"); role("postgres"); conn.execute("update public.support_messages set read_by_staff = true")
    tin(tokA, "câu 2"); expect(len(calls()) == 2, f"{len(calls())}")
test("chủ đã đọc câu trước rồi thì câu sau lại được báo", t_doc_roi)
def t_cu():
    reset(); role("postgres")
    conn.execute("update public.support_messages set read_by_staff = false, created_at = now() - interval '5 minutes'")
    tin(tokA, "câu mới sau 5 phút"); expect(len(calls()) == 1)
test("câu chưa đọc nhưng đã quá 2 phút thì câu mới vẫn được báo", t_cu)
def ghi_tin(uid, sender, r="authenticated"):
    role(r, uid); conn.execute("insert into public.support_messages(owner_id, id, building_id, room_code, tenant_phone, sender, body) values (%s, %s, 'b1', 'P101', '0921111700', %s, 'x')",
                               (A, "m" + uuid.uuid4().hex[:6], sender))
test("chủ trọ trả lời từ web (đã đăng nhập): không tự báo cho mình", lambda: (reset(), ghi_tin(A, "staff"), expect(calls() == [])))
test("chủ trọ tự ghi một tin 'tenant' từ web (nhập hộ): vẫn không báo vì lệnh mang tài khoản đăng nhập", lambda: (reset(), ghi_tin(A, "tenant"), expect(calls() == [])))
test("tin của nhân viên ghi không qua web (không có tài khoản, ví dụ máy chủ): không báo chủ", lambda: (reset(), ghi_tin(None, "staff", "postgres"), expect(calls() == [])))
test("nội dung dài bị cắt (tiêu đề tối đa 80, nội dung tối đa 160)", lambda: (reset(), tin(tokA, "x" * 2000), (lambda b: expect(len(b["body"]) <= 160 and len(b["title"]) <= 80, b))(calls()[0][1])))

print("\nBáo chuyển khoản, báo hỏng, xin gia hạn, gửi chỉ số")
def t_claim():
    reset(); role("anon"); one("select public.tenant_submit_payment_claim(%s, 'HD-2611-001', 3500000, 'ck', null)", (tokA,))
    b = calls()[0][1]
    expect(b["title"] == "Khách báo đã chuyển khoản · P101" and b["body"] == "An · 3.500.000 ₫ · HD-2611-001. Mở để đối soát." and b["url"] == "#/transfers", b)
test("báo chuyển khoản: số tiền kiểu Việt Nam, mã hóa đơn, mở trang đối soát", t_claim)
def t_inc():
    reset(); role("anon"); one("select public.tenant_create_incident(%s, 'nuoc', 'Vòi nước rỉ', '[]'::jsonb)", (tokA,))
    b = calls()[0][1]; expect(b["title"] == "Báo hỏng mới · P101" and b["body"] == "Vòi nước rỉ" and b["url"] == "#/b/b1/incidents", b)
test("báo hỏng: tiêu đề có phòng, nội dung là việc cần sửa, mở trang Sự cố", t_inc)
def t_ren():
    reset(); role("anon"); r = one("select public.tenant_request_renewal(%s, 6, null)", (tokA,))
    expect(r.get("status") == "pending", r)
    b = calls()[0][1]; expect(b["title"] == "Khách xin gia hạn hợp đồng · P101" and b["body"] == "An xin gia hạn thêm 6 tháng." and b["url"] == "#/b/b1/contracts", b)
test("xin gia hạn: số tháng, mở trang Hợp đồng", t_ren)
def t_read():
    reset(); role("anon"); one("select public.tenant_submit_reading(%s, '2026-11', 8297, null, '[]'::jsonb)", (tokA,))
    b = calls()[0][1]; expect(b["title"] == "Khách gửi chỉ số điện · P101" and b["body"] == "Kỳ 2026-11: 8.297. Chờ anh/chị duyệt." and b["url"] == "#/b/b1/readings", b)
    reset(); role("anon"); one("select public.tenant_submit_reading(%s, '2026-11', 8297, null, '[]'::jsonb)", (tokA,))
    expect(calls() == [], "gửi lại đúng số cũ không được báo lần nữa")
    reset(); role("anon"); one("select public.tenant_submit_reading(%s, '2026-11', 8310.5, null, '[]'::jsonb)", (tokA,))
    b = calls()[0][1]; expect(b["body"] == "Kỳ 2026-11: 8310.5. Chờ anh/chị duyệt.", b)
test("gửi chỉ số: báo lần đầu, gửi lại đúng số cũ thì thôi, sửa số thì báo lại", t_read)
def t_owner_writes():
    reset(); role("authenticated", A)
    conn.execute("insert into public.payment_claims(owner_id, id, building_id, room_code, amount, status) values (%s, 'cl-tay', 'b1', 'P101', 1, 'pending')", (A,))
    conn.execute("insert into public.incidents(owner_id, id, building_id, room_code, title, status) values (%s, 'sc-tay', 'b1', 'P101', 'Chủ tự ghi', 'open')", (A,))
    conn.execute("insert into public.readings(owner_id, id, building_id, room_code, period, elec_curr, source, approved) values (%s, 'rd-tay', 'b1', 'P101', '2026-10', 1, 'tenant', false)", (A,))
    conn.execute("update public.readings set elec_curr = elec_curr + 1, approved = true where owner_id = %s", (A,))
    expect(calls() == [], calls())
test("chủ trọ / nhân viên tự ghi từ web (upsert cả bảng như app làm): không báo gì", t_owner_writes)
def t_approve():
    reset(); role("anon"); one("select public.tenant_submit_reading(%s, '2026-12', 9000, null, '[]'::jsonb)", (tokA,)); reset()
    role("postgres"); conn.execute("select set_config('request.jwt.claim.sub', '', false)")
    conn.execute("update public.readings set approved = true where owner_id = %s and period = '2026-12'", (A,))
    expect(calls() == [], "duyệt số không phải việc mới")
test("chỉ số đã được duyệt (approved = true) thì không báo", t_approve)
def t_nhap_duyet_san():
    reset(); role("postgres"); conn.execute("select set_config('request.jwt.claim.sub', '', false)")
    conn.execute("insert into public.readings(owner_id, id, building_id, room_code, period, elec_curr, source, approved) values (%s, 'rd-nhap', 'b1', 'P101', '2025-01', 5, 'tenant', true)", (A,))
    expect(calls() == [], "chỉ số nhập sẵn đã duyệt không phải việc chờ duyệt")
test("chỉ số của khách nhưng đã duyệt sẵn (nhập từ sổ cũ): không báo", t_nhap_duyet_san)
test("đường dẫn tới tòa: mã tòa lạ thì về Tổng quan", lambda: (role("postgres"), expect(one("select public._owner_push_url('b 1/../x', 'support')") == "#/dashboard"),
    expect(one("select public._owner_push_url('b-1_A', 'support')") == "#/b/b-1_A/support"), expect(one("select public._owner_push_url(null, 'x')") == "#/dashboard")))

print("\nGửi thử, đường dẫn lạ, trigger không làm hỏng việc ghi")
def t_test():
    reset(); role("authenticated", A); r = one("select public.owner_push_test()")
    expect(r == {"ok": True, "devices": 2}, r); b = calls()[0][1]
    expect(b["title"] == "Happy Home: thông báo thử" and b["url"] == "#/config" and len(b["subs"]) == 2, b)
test("gửi thử: tới đúng các máy của chính mình, trả số máy", t_test)
test("gửi thử khi chưa bật máy nào: 0 máy, không gọi", lambda: (reset(), (lambda: (role("authenticated", NV), expect(one("select public.owner_push_test()") == {"ok": True, "devices": 0})))(), expect(calls() == [])))
test("anon không gọi được gửi thử", lambda: (role("anon"), denied(lambda: one("select public.owner_push_test()"))))
def t_bad_bid():
    reset(); role("postgres")
    conn.execute("update public.tenants set building_id = 'b 1/../x' where owner_id = %s and id = 'tn-a1'", (A,))
    role("anon"); one("select public.tenant_create_incident(%s, 'x', 'Hỏng', '[]'::jsonb)", (tokA,))
    b = calls()[0][1]; expect(b["url"] == "#/dashboard", b["url"])
    role("postgres"); conn.execute("update public.tenants set building_id = 'b1' where owner_id = %s and id = 'tn-a1'", (A,))
test("mã tòa lạ (có / hay khoảng trắng): đường dẫn về Tổng quan, không ghép bậy", t_bad_bid)
def t_broken():
    role("postgres"); conn.execute("create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language plpgsql as $$ begin raise exception 'mạng hỏng'; end $$")
    n0 = one("select count(*) from public.incidents")
    role("anon"); expect(one("select public.tenant_create_incident(%s, 'x', 'Hỏng 2', '[]'::jsonb)", (tokA,))["status"] == "open")
    expect(tin(tokA, "vẫn gửi được")["ok"] is True)
    role("postgres"); expect(one("select count(*) from public.incidents") == n0 + 1)
test("pg_net báo lỗi: khách vẫn báo hỏng, nhắn tin bình thường", t_broken)

print("\nQuyền truy cập")
def t_tables():
    for r in ("anon", "authenticated"):
        role(r, A if r == "authenticated" else None)
        denied(lambda: conn.execute("select * from public.owner_push_subs"))
test("anon và cả chủ trọ đều không đọc thẳng được bảng máy đăng ký", t_tables)
def t_fns():
    for r, sub_ in (("anon", None), ("authenticated", A)):
        role(r, sub_)
        denied(lambda: conn.execute("select public._owner_push_send(%s, 't', 'b', '#/x')", (A,)))
        denied(lambda: conn.execute("select public._owner_push_url('b1', 'x')"))
test("không ai gọi trực tiếp được hàm gửi nội bộ (kể cả chủ trọ: không tự gửi cho chủ khác)", t_fns)
test("anon không gọi được đăng ký / hủy", lambda: (role("anon"), denied(lambda: one("select public.owner_push_subscribe(%s, %s, %s, null)", (FCM, K256, KAUTH))),
                                                   denied(lambda: one("select public.owner_push_unsubscribe(%s)", (FCM,)))))
test("bảng tenant_push_subs của app khách không bị đụng", lambda: (role("postgres"), expect(one("select count(*) from public.tenant_push_subs") == 0)))

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
