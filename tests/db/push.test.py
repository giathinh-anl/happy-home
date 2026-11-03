"""Kiểm thử thông báo đẩy (supabase/migration-push.sql) trên Postgres thật chạy tại máy.

pg_net không có trong bản Postgres nhúng, nên dựng một net.http_post GIẢ chỉ ghi lại lời gọi vào bảng __net_calls để xem
trigger gửi đúng người, đúng nội dung, đúng chuỗi bí mật, và biết im lặng khi thiếu cấu hình.
Cách chạy: .venv-db/Scripts/python tests/db/push.test.py     Biến HH_PUSH_SQL trỏ tới bản sửa của migration (thử phá).
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
    if name == "migration-push.sql" and os.environ.get("HH_PUSH_SQL"):
        t = pathlib.Path(os.environ["HH_PUSH_SQL"]).read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8") if name != "stubs.sql" else (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    if strip_ext: t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ)", t)
    try: conn.execute(t)
    except Exception as e: print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)

print("Nạp lược đồ và các migration")
for f in ["stubs.sql", "schema.sql", "migration-tenant-app.sql", "migration-tenant-app-v2.sql", "migration-claims-photos.sql",
          "migration-reading-photos.sql", "migration-support-chat.sql", "migration-staff-vehicles.sql", "migration-renewal.sql",
          "migration-late-fee.sql", "migration-invoice-batches.sql"]:
    load(f)
load("migration-tenant-auth.sql", strip_ext=True)
load("migration-nightly.sql")
load("migration-push.sql")
print("  ok   toàn bộ tệp nạp không lỗi")
load("migration-push.sql")
print("  ok   chạy migration-push.sql lần hai không lỗi")

# pg_net giả: ghi lại lời gọi. Tạo SAU khi nạp migration để thử luôn trường hợp "chưa có pg_net".
A, B = str(uuid.uuid4()), str(uuid.uuid4())
for u, e in ((A, "a@x.vn"), (B, "b@x.vn")): conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
for o, t in ((A, "a"), (B, "b")):
    conn.execute("insert into public.buildings(owner_id, id, name) values (%s, 'b1', 'Nhà')", (o,))
    conn.execute("insert into public.rooms(owner_id, id, building_id, code, price) values (%s, 'r1', 'b1', 'P101', 1), (%s, 'r2', 'b1', 'P102', 1)", (o, o))
conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) values "
             "(%s, 'tn-a1', 'b1', 'P101', 'An', '0921111700', true), (%s, 'tn-a2', 'b1', 'P101', 'Bình', '0933333300', false), "
             "(%s, 'tn-a3', 'b1', 'P102', 'Cường', '0944444400', true), (%s, 'tn-b1', 'b1', 'P101', 'Dũng', '0921111700', true)", (A, A, A, B))
def issue(o, tid):
    role("authenticated", o); return one("select public.owner_issue_tenant_code(%s)", (tid,))["code"]
def login(phone, code):
    role("anon"); return one("select public.tenant_login(%s, %s)", (phone, code))["token"]
tokA1 = login("0921111700", issue(A, "tn-a1"))
tokA2 = login("0933333300", issue(A, "tn-a2"))
tokA3 = login("0944444400", issue(A, "tn-a3"))
tokB1 = login("0921111700", issue(B, "tn-b1"))

FCM = "https://fcm.googleapis.com/fcm/send/abc123"
K256 = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM"
KAUTH = "tBHItJI5svbpez7KI4CCXg"
def sub(tok, ep=FCM, p=K256, a=KAUTH):
    role("anon"); return one("select public.tenant_push_subscribe(%s, %s, %s, %s, 'UA')", (tok, ep, p, a))
def unsub(tok, ep=FCM):
    role("anon"); return one("select public.tenant_push_unsubscribe(%s, %s)", (tok, ep))
def n_subs(owner=None):
    role("postgres"); return one("select count(*) from public.tenant_push_subs") if owner is None else one("select count(*) from public.tenant_push_subs where owner_id = %s", (owner,))

print("\nĐăng ký máy")
test("token sai: trả null (app hiểu là hết phiên)", lambda: expect(sub("x" * 40) is None))
test("địa chỉ Google, Mozilla, Apple, Microsoft đều được nhận", lambda: [expect(sub(tokA1, ep) == {"ok": True}, ep) for ep in (
    "https://fcm.googleapis.com/fcm/send/g1", "https://updates.push.services.mozilla.com/wpush/v2/m1",
    "https://web.push.apple.com/Qabc", "https://wns2-par02p.notify.windows.com/w/?token=abc")])
role("postgres"); conn.execute("delete from public.tenant_push_subs")
test("địa chỉ nội bộ, http thường, chỉ giống tên đều bị từ chối (chặn SSRF)", lambda: [expect(sub(tokA1, ep) == {"error": "bad_endpoint"}, ep) for ep in (
    "http://fcm.googleapis.com/x", "https://localhost/x", "https://169.254.169.254/latest", "https://fcm.googleapis.com.evil.com/x",
    "https://evil.com/fcm.googleapis.com/", "https://10.0.0.5/x", "https://evilpush.apple.com/x", "", None, "ftp://web.push.apple.com/x")])
test("khóa sai dạng bị từ chối", lambda: [expect(sub(tokA1, FCM, p, a) == {"error": "bad_keys"}, (p, a)) for p, a in (("ngan", KAUTH), (K256, "x"), ("a b c d e f g h i j k l m n o", KAUTH), (None, None))])
test("địa chỉ quá dài bị từ chối", lambda: expect(sub(tokA1, "https://fcm.googleapis.com/" + "a" * 1100) == {"error": "bad_endpoint"}))
test("chưa ghi gì sau các lần bị từ chối", lambda: expect(n_subs() == 0))
test("đăng ký đúng: ok, và đăng ký lại cùng máy không nhân đôi", lambda: (expect(sub(tokA1) == {"ok": True}), expect(sub(tokA1) == {"ok": True}), expect(n_subs() == 1)))
def t_move():
    expect(sub(tokA2) == {"ok": True}); role("postgres")
    expect(one("select tenant_id from public.tenant_push_subs where endpoint = %s", (FCM,)) == "tn-a2", "chưa chuyển chủ")
    expect(n_subs() == 1)
test("cùng một máy đăng nhập sang khách khác thì chuyển chủ, không nhân đôi", t_move)
def t_cap():
    for i in range(14): sub(tokA1, f"https://fcm.googleapis.com/fcm/send/dev{i}")
    role("postgres"); n = one("select count(*) from public.tenant_push_subs where tenant_id = 'tn-a1'")
    expect(n == 10, f"khách giữ {n} máy, đáng lẽ 10")
test("mỗi khách giữ tối đa 10 máy", t_cap)
def has_ep(ep): role("postgres"); return one("select count(*) from public.tenant_push_subs where endpoint = %s", (ep,))
test("hủy đăng ký: máy của khách khác không bị xóa", lambda: (expect(unsub(tokA1, FCM) == {"ok": True}), expect(has_ep(FCM) == 1)))
test("hủy đúng máy của mình thì mất", lambda: (expect(unsub(tokA2, FCM) == {"ok": True}), expect(has_ep(FCM) == 0)))
test("hủy với token sai: null", lambda: expect(unsub("x" * 40) is None))

print("\nGửi khi thiếu cấu hình hoặc thiếu pg_net")
role("postgres"); conn.execute("delete from public.tenant_push_subs")
sub(tokA1, "https://fcm.googleapis.com/fcm/send/a1"); sub(tokA2, "https://fcm.googleapis.com/fcm/send/a2"); sub(tokA3, "https://fcm.googleapis.com/fcm/send/a3"); sub(tokB1, "https://fcm.googleapis.com/fcm/send/b1")
def notice(owner, room, title="Sắp đến hạn đóng tiền"):
    role("postgres"); conn.execute("insert into public.tenant_notices(owner_id, id, building_id, room_code, kind, dedupe_key, title, body) values (%s, %s, 'b1', %s, 'due', %s, %s, 'Hạn 5/11')",
                                   (owner, "n" + uuid.uuid4().hex[:6], room, uuid.uuid4().hex, title))
def msg(owner, phone, sender, body="Dạ em đã nhận"):
    role("postgres"); conn.execute("insert into public.support_messages(owner_id, id, building_id, room_code, tenant_phone, sender, body) values (%s, %s, 'b1', 'P101', %s, %s, %s)",
                                   (owner, "m" + uuid.uuid4().hex[:6], phone, sender, body))
test("chưa có pg_net, chưa điền cấu hình: ghi thông báo và tin nhắn vẫn thành công", lambda: (notice(A, "P101"), msg(A, "0921111700", "staff")))
role("postgres"); conn.execute("create schema if not exists net")
conn.execute("create table if not exists public.__net_calls(id serial, url text, body jsonb, headers jsonb)")
conn.execute("create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language plpgsql as "
             "$$ begin insert into public.__net_calls(url, body, headers) values (url, body, headers); return 1; end $$")
def calls(): role("postgres"); return conn.execute("select url, body, headers from public.__net_calls order by id").fetchall()
def reset(): role("postgres"); conn.execute("truncate public.__net_calls")
test("có pg_net giả nhưng chưa điền cấu hình: không gọi", lambda: (reset(), notice(A, "P101"), expect(calls() == [])))
role("postgres"); conn.execute("update public.push_config set url = 'https://x.supabase.co/functions/v1/push-send' where id = 1")
test("mới điền địa chỉ, chưa có bí mật: vẫn không gọi", lambda: (reset(), notice(A, "P101"), expect(calls() == [])))
role("postgres"); conn.execute("update public.push_config set secret = 'bi-mat-chung' where id = 1")

# khách của chủ trọ B có CÙNG mã khách 'tn-a1' với khách của A (khóa chính là cặp chủ trọ + mã): không được lẫn sang nhau
role("postgres"); conn.execute("insert into public.tenant_push_subs(endpoint, owner_id, tenant_id, p256dh, auth) values ('https://fcm.googleapis.com/fcm/send/b-cung-ma', %s, 'tn-a1', %s, %s)", (B, K256, KAUTH))
print("\nNhắc hạn đóng tiền (theo phòng)")
def t_room():
    reset(); notice(A, "P101", "Hóa đơn T10 sắp đến hạn"); c = calls()
    expect(len(c) == 1, f"{len(c)} lời gọi")
    url, body, headers = c[0]
    expect(url == "https://x.supabase.co/functions/v1/push-send", url)
    expect(headers["x-push-secret"] == "bi-mat-chung" and headers["Content-Type"] == "application/json", headers)
    eps = sorted(s["endpoint"] for s in body["subs"])
    expect(eps == ["https://fcm.googleapis.com/fcm/send/a1", "https://fcm.googleapis.com/fcm/send/a2"], eps)
    expect(body["title"] == "Hóa đơn T10 sắp đến hạn" and body["url"] == "#/invoices" and body["body"] == "Hạn 5/11", body)
test("báo cho mọi khách của phòng đó, đúng tiêu đề và đường dẫn", t_room)
test("kèm đủ khóa của từng máy (để hàm Edge mã hóa)", lambda: (lambda b: expect(all(s["p256dh"] == K256 and s["auth"] == KAUTH for s in b["subs"]), b))(calls()[0][1]))
test("khách phòng khác và khách của chủ trọ khác KHÔNG bị báo", lambda: expect(all("a3" not in s["endpoint"] and "b1" not in s["endpoint"] for s in calls()[0][1]["subs"])))
test("phòng không ai đăng ký: không gọi", lambda: (reset(), notice(A, "P999"), expect(calls() == [])))
test("tiêu đề dài bị cắt 80 ký tự, nội dung cắt 160", lambda: (reset(), notice(A, "P101", "T" * 200), (lambda b: expect(len(b["title"]) == 80, len(b["title"])))(calls()[0][1])))

print("\nNhân viên trả lời")
def t_staff():
    reset(); msg(A, "0921111700", "staff", "Dạ chiều nay thợ đến nhé"); c = calls()
    expect(len(c) == 1, f"{len(c)} lời gọi"); b = c[0][1]
    expect([s["endpoint"] for s in b["subs"]] == ["https://fcm.googleapis.com/fcm/send/a1"], b["subs"])
    expect(b["title"] == "Nhân viên vừa trả lời anh/chị" and b["body"] == "Dạ chiều nay thợ đến nhé" and b["url"] == "#/chat", b)
test("báo đúng khách có số điện thoại đó, mở thẳng khung chat", t_staff)
test("số điện thoại trùng ở chủ trọ khác: khách bên kia KHÔNG bị báo", lambda: expect(all("b1" not in s["endpoint"] for s in calls()[0][1]["subs"])))
test("tin của chính khách gửi lên: không báo ai", lambda: (reset(), msg(A, "0921111700", "tenant", "Em hỏi chút"), expect(calls() == [])))
test("số điện thoại viết kiểu +84 vẫn khớp", lambda: (reset(), msg(A, "+84921111700", "staff"), expect(len(calls()) == 1)))
test("số không có ai đăng ký: không gọi", lambda: (reset(), msg(A, "0900000000", "staff"), expect(calls() == [])))

print("\nTrigger không làm hỏng việc ghi")
def t_broken_net():
    role("postgres"); conn.execute("create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language plpgsql as $$ begin raise exception 'mạng hỏng'; end $$")
    n0 = one("select count(*) from public.support_messages"); msg(A, "0921111700", "staff"); notice(A, "P101")
    expect(one("select count(*) from public.support_messages") == n0 + 1, "tin nhắn không được ghi")
test("pg_net báo lỗi: tin nhắn và thông báo vẫn được ghi", t_broken_net)

print("\nQuyền truy cập")
def denied(fn):
    try: fn()
    except psycopg.errors.InsufficientPrivilege: return
    raise AssertionError("đáng lẽ bị từ chối")
def t_tables():
    for r in ("anon", "authenticated"):
        role(r, A if r == "authenticated" else None)
        for t in ("tenant_push_subs", "push_config"): denied(lambda t=t: conn.execute(f"select * from public.{t}"))
test("anon và cả chủ trọ đều không đọc được bảng máy đăng ký và bảng cấu hình (có chuỗi bí mật)", t_tables)
test("không ai gọi trực tiếp được _push_send", lambda: (role("anon"), denied(lambda: conn.execute("select public._push_send(%s, array['x'], 't', 'b', 'u')", (A,)))))
test("chủ trọ cũng không gọi được _push_send", lambda: (role("authenticated", A), denied(lambda: conn.execute("select public._push_send(%s, array['x'], 't', 'b', 'u')", (A,)))))

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
