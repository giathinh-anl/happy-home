"""Kiểm thử khách tự đổi mã vào app + xin cấp lại mã (supabase/migration-tenant-code-self.sql) trên Postgres thật chạy tại máy.

Cách chạy (cần Python 3.10+ và hai gói, chỉ để thử, không dùng cho web):
    python -m venv .venv-db && .venv-db/Scripts/pip install pgserver "psycopg[binary]"
    .venv-db/Scripts/python tests/db/tenant-code-self.test.py

Nạp schema và mọi migration theo thứ tự, rồi thử bằng các vai anon / authenticated như PostgREST làm.
Biến HH_CODE_SQL trỏ tới một bản sửa của migration (dùng cho thử phá). Thoát mã khác 0 nếu có ca hỏng.
"""
import os, pathlib, re, sys, tempfile, uuid
import pgserver, psycopg

ROOT = pathlib.Path(__file__).resolve().parents[2]
SQL = ROOT / "supabase"

ok = hong = 0
def test(ten, fn):
    global ok, hong
    try:
        fn(); ok += 1; print("  ok   " + ten)
    except Exception as e:                       # noqa
        hong += 1; print(" HONG  " + ten + "\n         " + str(e).splitlines()[0][:220])

def expect(cond, msg="sai"):
    if not cond: raise AssertionError(msg)

tmp = tempfile.mkdtemp(prefix="hhpg")
srv = pgserver.get_server(tmp, cleanup_mode="delete")
conn = psycopg.connect(srv.get_uri(), autocommit=True)

def run(sql): conn.execute(sql)
def one(sql, params=None):
    row = conn.execute(sql, params).fetchone()
    return row[0] if row else None

def role(r, sub=None):
    conn.execute("reset role")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (sub or "",))
    if r != "postgres": conn.execute(f"set role {r}")

def denied(fn):
    try: fn()
    except psycopg.errors.InsufficientPrivilege: return True
    except psycopg.errors.Error as e: raise AssertionError("lỗi khác quyền: " + str(e).splitlines()[0])
    raise AssertionError("đáng lẽ bị từ chối nhưng chạy được")

def load(name, strip_ext=False):
    if name == "migration-tenant-code-self.sql" and os.environ.get("HH_CODE_SQL"):
        t = pathlib.Path(os.environ["HH_CODE_SQL"]).read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8") if name != "stubs.sql" else (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    if strip_ext:
        t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ) create extension pgcrypto: dùng bản giả", t)
    try: run(t)
    except Exception as e:
        print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)

print("Nạp lược đồ và các migration")
for f in ["stubs.sql", "schema.sql", "migration-tenant-app.sql", "migration-tenant-app-v2.sql", "migration-claims-photos.sql",
          "migration-reading-photos.sql", "migration-support-chat.sql", "migration-staff-vehicles.sql",
          "migration-renewal.sql", "migration-late-fee.sql", "migration-invoice-batches.sql"]:
    load(f)
load("migration-tenant-auth.sql", strip_ext=True)
load("migration-tenant-code-self.sql")
print("  ok   toàn bộ tệp nạp không lỗi")
load("migration-tenant-code-self.sql")
print("  ok   chạy migration-tenant-code-self.sql lần hai không lỗi")

# ---------- dữ liệu mẫu: hai chủ trọ, mỗi chủ một khách (khách của B trùng số điện thoại với A) ----------
A, B = str(uuid.uuid4()), str(uuid.uuid4())
for u, e in ((A, "a@x.vn"), (B, "b@x.vn")):
    conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
for o, tag, nm in ((A, "a", "Khách A"), (B, "b", "Khách B")):
    conn.execute("insert into public.buildings(owner_id, id, name) values (%s, 'b1', 'Nhà ' || %s)", (o, tag))
    conn.execute("insert into public.rooms(owner_id, id, building_id, code, price) values (%s, 'r1', 'b1', 'P101', 3000000)", (o,))
    conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) "
                 "values (%s, 'tn-' || %s, 'b1', 'P101', %s, '0921111700', true)", (o, tag, nm))
conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) "
             "values (%s, 'tn-a2', 'b1', 'P101', 'Bạn cùng phòng', '0933333300', false)", (A,))

anon = lambda: role("anon")
owner = lambda o: role("authenticated", o)

def issue(o, tid):
    owner(o); return one("select public.owner_issue_tenant_code(%s)", (tid,))["code"]
def login(phone, code):
    anon(); return one("select public.tenant_login(%s, %s)", (phone, code))
def change(tok, old, new):
    anon(); return one("select public.tenant_change_code(%s, %s, %s)", (tok, old, new))

code_a = issue(A, "tn-a")
code_b = issue(B, "tn-b")
code_a2 = issue(A, "tn-a2")
# hai chủ trọ có thể trùng số: hai mã khác nhau quyết định đúng người
while code_b == code_a: code_b = issue(B, "tn-b")
sess = login("0921111700", code_a)
tok = sess["token"]
tok2 = login("0921111700", code_a)["token"]          # một máy khác của cùng khách

print("\nĐổi mã: đường vào")
test("token sai thì trả null (app hiểu là hết phiên)", lambda: expect(change("x" * 40, code_a, "482915") is None))
test("không có token thì trả null", lambda: expect(change(None, code_a, "482915") is None))
test("mã mới 5 số, 7 số, có chữ, rỗng: báo invalid_new", lambda: [expect(change(tok, code_a, n) == {"error": "invalid_new"}, n) for n in ("12345", "1234567", "12a456", "")])
test("mã mới 6 số giống nhau: báo weak", lambda: [expect(change(tok, code_a, n) == {"error": "weak"}, n) for n in ("000000", "777777")])
test("mã mới là dãy liên tiếp tăng hoặc giảm: báo weak", lambda: [expect(change(tok, code_a, n) == {"error": "weak"}, n) for n in ("123456", "654321", "012345", "987654", "345678")])
test("gần giống dãy nhưng không phải thì không bị chặn ở bước này", lambda: expect(change(tok, "000001", "123457") == {"error": "wrong_old"}))
test("mã mới trùng mã cũ: báo same", lambda: expect(change(tok, code_a, code_a) == {"error": "same"}))
def t_no_fail_cost():
    role("postgres"); expect(one("select count(*) from public.tenant_login_fail where phone = '0921111700'") == 1, "hàng đếm lỗi")
test("kiểm mã mới sai thì KHÔNG tốn lượt thử mã cũ (chỉ ca 'wrong_old' ở trên đếm một lần)", t_no_fail_cost)
role("postgres"); conn.execute("delete from public.tenant_login_fail")

print("\nĐổi mã: sai mã cũ và khóa")
def t_wrong_old():
    r = change(tok, "000001" if code_a != "000001" else "000002", "482915")
    expect(r == {"error": "wrong_old"}, r)
test("sai mã cũ: báo wrong_old", t_wrong_old)
test("mã cũ sai dạng (chữ) cũng là wrong_old", lambda: expect(change(tok, "abcdef", "482915") == {"error": "wrong_old"}))
def t_lock():
    wrong = "000001" if code_a != "000001" else "000002"
    res = [change(tok, wrong, "482915") for _ in range(3)]
    expect(res[-1] == {"error": "locked", "retryAfterSec": 900}, res)
test("sai 5 lần liên tiếp thì khóa 15 phút", t_lock)
test("đang khóa thì mã cũ ĐÚNG cũng bị từ chối", lambda: expect(change(tok, code_a, "482915")["error"] == "locked"))
test("khóa chặn luôn cả đăng nhập bằng số đó", lambda: expect(login("0921111700", code_a)["error"] == "locked"))
def t_unlock_by_owner():
    global code_a
    code_a = issue(A, "tn-a")
    expect(login("0921111700", code_a).get("token"), "đăng nhập lại được")
test("chủ trọ cấp lại mã thì mở khóa", t_unlock_by_owner)
sess = login("0921111700", code_a); tok = sess["token"]; tok2 = login("0921111700", code_a)["token"]

print("\nĐổi mã: thành công")
NEW = "482915"
test("đổi đúng: ok", lambda: expect(change(tok, code_a, NEW) == {"ok": True}))
test("đăng nhập bằng mã mới được", lambda: expect(login("0921111700", NEW).get("token")))
test("mã cũ không còn dùng được", lambda: expect(login("0921111700", code_a) == {"error": "invalid"}))
def t_current_session_kept():
    anon(); expect(one("select public.tenant_data(%s)", (tok,)) is not None, "phiên đang dùng bị đăng xuất")
test("máy vừa đổi vẫn đang đăng nhập", t_current_session_kept)
def t_other_session_out():
    anon(); expect(one("select public.tenant_data(%s)", (tok2,)) is None, "máy khác vẫn còn phiên")
test("máy khác bị đăng xuất (phải nhập mã mới)", t_other_session_out)
def t_hash():
    role("postgres"); h = one("select code_hash from public.tenant_access where tenant_id = 'tn-a' and owner_id = %s", (A,))
    expect(NEW not in h, "mã thật nằm trong bản băm")
test("vẫn chỉ lưu bản băm", t_hash)
def t_audit():
    role("postgres"); m = one("select message from public.audit_log where owner_id = %s and actor = 'Khách thuê' order by at desc limit 1", (A,))
    expect(m and "Khách A" in m and "P101" in m, m)
test("ghi nhật ký cho chủ trọ biết khách tự đổi mã", t_audit)
def t_other_tenant_untouched():
    expect(login("0933333300", code_a2).get("token"), "bạn cùng phòng bị ảnh hưởng")
    expect(login("0921111700", NEW).get("token"), "khách vừa đổi")
test("đổi mã của khách này không động tới khách khác (kể cả cùng phòng)", t_other_tenant_untouched)
def t_cross_owner():
    # khách của chủ B cùng số điện thoại vẫn dùng mã của B
    sb = login("0921111700", code_b)
    expect(sb.get("token"), sb)
    expect(change(sb["token"], code_b, "135792") == {"ok": True}, "đổi mã B")
    expect(login("0921111700", NEW).get("token"), "mã của A không bị đổi theo")
test("hai chủ trọ trùng số điện thoại: đổi mã bên này không đụng bên kia", t_cross_owner)
def t_clear_fail():
    role("postgres"); expect(one("select count(*) from public.tenant_login_fail where phone = '0921111700'") == 0)
test("đổi thành công thì xóa bộ đếm sai", t_clear_fail)
def t_clear_fail_direct():
    global NEW
    tk = login("0921111700", NEW)["token"]
    expect(change(tk, "000009" if NEW != "000009" else "000008", "246810") == {"error": "wrong_old"})
    role("postgres"); expect(one("select fails from public.tenant_login_fail where phone = '0921111700'") == 1, "đếm sai phải là 1")
    expect(change(tk, NEW, "246810") == {"ok": True})
    role("postgres"); expect(one("select count(*) from public.tenant_login_fail where phone = '0921111700'") == 0, "bộ đếm sai còn sót sau khi đổi thành công")
    NEW = "246810"
test("đổi thành công ngay sau một lần sai thì bộ đếm sai bị xóa (không đăng nhập xen giữa)", t_clear_fail_direct)
def t_flag():
    role("postgres"); expect(one("select app_code_set_at is not null from public.tenants where owner_id = %s and id = 'tn-a'", (A,)) is True)
test("cờ app_code_set_at được cập nhật", t_flag)

print("\nQuên mã: yêu cầu gửi chủ trọ")
def reqs(o): owner(o); return one("select public.owner_code_requests()")
def ask(phone): anon(); return one("select public.tenant_request_code(%s)", (phone,))
test("số có trong hệ thống và số lạ trả y hệt nhau", lambda: expect(ask("0933333300") == ask("0999999999") == {"ok": True}))
test("số sai dạng cũng trả y hệt, không ném lỗi", lambda: expect(ask("abc") == {"ok": True} and ask("") == {"ok": True}))
def t_listed():
    r = reqs(A); expect(len(r) == 1 and r[0]["tenantId"] == "tn-a2" and r[0]["name"] == "Bạn cùng phòng" and r[0]["n"] == 1, r)
test("chủ trọ thấy đúng yêu cầu của khách mình", t_listed)
test("chủ trọ khác không thấy yêu cầu này", lambda: expect(reqs(B) == []))
def t_ratelimit():
    ask("0933333300"); ask("0933333300"); r = reqs(A); expect(r[0]["n"] == 1, r)
test("gửi liên tục trong 1 giờ chỉ tính một yêu cầu", t_ratelimit)
def t_after_hour():
    role("postgres"); conn.execute("update public.tenant_code_requests set requested_at = now() - interval '2 hours'")
    conn.execute("update public.tenants set app_code_set_at = now() - interval '3 hours' where id = 'tn-a2'")     # lần cấp mã cuối là trước cả hai yêu cầu
    ask("0933333300"); r = reqs(A); expect(r[0]["n"] == 2, r)
test("quá 1 giờ thì gửi thêm được (n tăng lên 2)", t_after_hour)
def t_shared_phone():
    role("postgres"); conn.execute("delete from public.tenant_code_requests"); ask("0921111700")
    expect(len(reqs(A)) == 1 and len(reqs(B)) == 1, "cả hai chủ trọ cùng số phải đều thấy")
test("số điện thoại có ở hai chủ trọ: cả hai đều nhận yêu cầu", t_shared_phone)
def t_resolved_by_issue():
    issue(A, "tn-a"); expect(reqs(A) == [], reqs(A)); expect(len(reqs(B)) == 1, "B không bị ảnh hưởng")
test("chủ trọ cấp lại mã thì yêu cầu tự hết", t_resolved_by_issue)
def t_new_after_issue():
    role("postgres"); conn.execute("update public.tenant_code_requests set requested_at = now() - interval '2 hours'")
    ask("0921111700"); expect(len(reqs(A)) == 1, "yêu cầu mới sau lần cấp phải hiện")
test("yêu cầu gửi SAU lần cấp mã gần nhất thì hiện lại", t_new_after_issue)
def t_dismiss():
    owner(A); expect(one("select public.owner_dismiss_code_requests('tn-a')") == {"ok": True}); expect(reqs(A) == [])
    expect(len(reqs(B)) == 1, "bỏ qua bên A không xóa bên B")
test("chủ trọ bấm bỏ qua: hết yêu cầu, chủ khác không bị xóa theo", t_dismiss)
def t_cant_dismiss_other():
    owner(A); one("select public.owner_dismiss_code_requests('tn-b')"); expect(len(reqs(B)) == 1, "A xóa được yêu cầu của B")
test("chủ trọ A không xóa được yêu cầu của khách chủ B", t_cant_dismiss_other)

print("\nQuyền truy cập")
def t_table():
    anon(); denied(lambda: conn.execute("select * from public.tenant_code_requests"))
    owner(A); denied(lambda: conn.execute("select * from public.tenant_code_requests"))
    anon(); denied(lambda: conn.execute("insert into public.tenant_code_requests(owner_id, tenant_id) values (gen_random_uuid(), 'x')"))
test("bảng yêu cầu: anon và cả chủ trọ đều không đọc/ghi trực tiếp", t_table)
test("anon không gọi được hàm của chủ trọ (xem, bỏ qua)", lambda: (anon(), denied(lambda: conn.execute("select public.owner_code_requests()")), denied(lambda: conn.execute("select public.owner_dismiss_code_requests('tn-a')"))))
def t_anon_can():
    anon(); one("select public.tenant_request_code('0933333300')"); one("select public.tenant_change_code('x', 'a', 'b')")
test("anon gọi được hai hàm của khách (không cần đăng nhập tài khoản chủ)", t_anon_can)
def t_nobody_reads_other():
    anon(); r = one("select public.tenant_change_code(%s, %s, %s)", (login("0933333300", code_a2)["token"], code_a, "482916"))
    expect(r == {"error": "wrong_old"}, r)
test("khách này không đổi được bằng mã của khách khác", t_nobody_reads_other)

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
