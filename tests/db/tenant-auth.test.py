"""Kiểm thử đăng nhập khách thuê (supabase/migration-tenant-auth.sql) trên Postgres thật chạy tại máy.

Cách chạy (cần Python 3.10+ và hai gói, chỉ để thử, không dùng cho web):
    python -m venv .venv-db && .venv-db/Scripts/pip install pgserver "psycopg[binary]"
    .venv-db/Scripts/python tests/db/tenant-auth.test.py

Nạp lần lượt: khung giả Supabase (stubs.sql) → schema.sql → các migration theo thứ tự đã chạy ngoài đời →
migration-tenant-auth.sql, rồi thử tấn công và đăng nhập bằng các vai anon / authenticated như PostgREST làm.
Thoát với mã khác 0 nếu có ca hỏng.
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

def run(sql):
    conn.execute(sql)

def one(sql, params=None):
    cur = conn.execute(sql, params)
    row = cur.fetchone()
    return row[0] if row else None

def role(r, sub=None):
    """Đổi vai như PostgREST: anon (không đăng nhập) hoặc authenticated với auth.uid() = sub."""
    conn.execute("reset role")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (sub or "",))
    if r != "postgres": conn.execute(f"set role {r}")

def denied(fn):
    """Câu lệnh phải bị từ chối quyền (permission denied / RLS)."""
    try:
        fn()
    except psycopg.errors.InsufficientPrivilege:
        return True
    except psycopg.errors.Error as e:
        raise AssertionError("lỗi khác quyền: " + str(e).splitlines()[0])
    raise AssertionError("đáng lẽ bị từ chối nhưng chạy được")

# ---------- nạp SQL ----------
def load(name, strip_ext=False):
    if name == "migration-tenant-auth.sql" and os.environ.get("HH_AUTH_SQL"):     # dùng cho thử phá (mutation)
        t = pathlib.Path(os.environ["HH_AUTH_SQL"]).read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8") if name != "stubs.sql" else (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    if strip_ext:
        t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ) create extension pgcrypto: dùng bản giả", t)
    try:
        run(t)
    except Exception as e:
        print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)

print("Nạp lược đồ và các migration")
for f in ["stubs.sql", "schema.sql", "migration-tenant-app.sql", "migration-tenant-app-v2.sql", "migration-claims-photos.sql",
          "migration-reading-photos.sql", "migration-support-chat.sql", "migration-staff-vehicles.sql",
          "migration-renewal.sql", "migration-late-fee.sql", "migration-invoice-batches.sql"]:
    load(f)
load("migration-tenant-auth.sql", strip_ext=True)
print("  ok   toàn bộ tệp nạp không lỗi")
load("migration-tenant-auth.sql", strip_ext=True)          # chạy lại phải an toàn
print("  ok   chạy migration-tenant-auth.sql lần hai không lỗi")

# ---------- dữ liệu mẫu: hai chủ trọ, CÙNG số điện thoại ----------
A, B = str(uuid.uuid4()), str(uuid.uuid4())
for u, e in ((A, "a@x.vn"), (B, "b@x.vn")):
    conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
for o, tag, nm in ((A, "a", "Rep A"), (B, "b", "Rep B")):
    conn.execute("insert into public.buildings(owner_id, id, name) values (%s, 'b1', 'Nhà ' || %s)", (o, tag))
    conn.execute("insert into public.rooms(owner_id, id, building_id, code, price) values (%s, 'r1', 'b1', 'P101', 3000000)", (o,))
    conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep, id_number) "
                 "values (%s, 'tn-' || %s || '1', 'b1', 'P101', %s, '0921111700', true, 'CCCD-' || %s)", (o, tag, nm, tag))
    conn.execute("insert into public.contracts(owner_id, id, building_id, room_code, tenant_name, status, rent, start_date, end_date) "
                 "values (%s, 'hd-' || %s, 'b1', 'P101', %s, 'active', 3000000, current_date - 300, current_date + 40)", (o, tag, nm))
    conn.execute("insert into public.invoices(owner_id, id, building_id, room_code, period, total, paid, status, lines) "
                 "values (%s, 'INV-' || %s, 'b1', 'P101', '2026-10', 3000000, 0, 'issued', '[]'::jsonb)", (o, tag))
conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) "
             "values (%s, 'tn-a2', 'b1', 'P101', 'Bạn cùng phòng A', '0921222817', false)", (A,))
# hóa đơn NHÁP của A (chủ trọ chưa duyệt) và hóa đơn đã hủy: khách không được thấy
conn.execute("insert into public.invoices(owner_id, id, building_id, room_code, period, total, paid, status, lines) "
             "values (%s, 'INV-a-draft', 'b1', 'P101', '2026-11', 3100000, 0, 'draft', '[]'::jsonb), "
             "(%s, 'INV-a-huy', 'b1', 'P101', '2026-09', 3000000, 0, 'cancelled', '[]'::jsonb)", (A, A))

anon = lambda: role("anon")
owner = lambda o: role("authenticated", o)

def login(phone, code):
    anon(); return one("select public.tenant_login(%s, %s)", (phone, code))

print("\nTrước khi có mã: hệ thống không cho vào")
test("số điện thoại chưa có mã thì đăng nhập trả 'invalid'", lambda: expect(login("0921111700", "123456") == {"error": "invalid"}))
test("số lạ cũng trả y hệt (không lộ số nào có trong hệ thống)", lambda: expect(login("0999999999", "123456") == {"error": "invalid"}))
test("LỖ HỔNG CŨ ĐÃ ĐÓNG: đưa số điện thoại vào làm token chỉ nhận về null", lambda: (anon(), expect(one("select public.tenant_data('0921111700')") is None))[1])
test("số điện thoại sai dạng bị từ chối", lambda: expect(login("12345", "123456") == {"error": "invalid"}))
test("mã sai dạng (chữ, 5 số) bị từ chối", lambda: (expect(login("0921111700", "abcdef") == {"error": "invalid"}), expect(login("0921111700", "12345") == {"error": "invalid"})))

print("\nQuyền truy cập của trình duyệt")
def t_tables():
    anon()
    for t in ("tenant_access", "tenant_sessions", "tenant_login_fail"):
        denied(lambda t=t: conn.execute(f"select * from public.{t}"))
    owner(A)
    for t in ("tenant_access", "tenant_sessions", "tenant_login_fail"):
        denied(lambda t=t: conn.execute(f"select * from public.{t}"))
test("anon và cả chủ trọ đều KHÔNG đọc được bảng mã, phiên, đếm sai", t_tables)
test("anon không gọi được hàm nội bộ _tenant_from_token", lambda: (anon(), denied(lambda: conn.execute("select public._tenant_from_token('x')"))))
test("anon không gọi được hàm cấp mã của chủ trọ", lambda: (anon(), denied(lambda: conn.execute("select public.owner_issue_tenant_code('tn-a1')"))))
test("anon không gọi được _issue_code", lambda: (anon(), denied(lambda: conn.execute("select public._issue_code(%s::uuid, null::public.tenants)", (A,)))))
def t_no_old():
    role("postgres")
    n = one("select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname like 'tenant\\_%%' "
            "and p.proname <> 'tenant_login' and pg_get_function_arguments(p.oid) like '%%p_phone%%'")
    expect(n == 0, f"còn {n} hàm tenant_* nhận p_phone")
test("không còn hàm tenant_* nào nhận p_phone (trừ tenant_login, hàm đăng nhập)", t_no_old)
def t_rls():
    owner(A); n = one("select count(*) from public.tenants")
    expect(n == 2, f"chủ A thấy {n} khách, đáng lẽ 2")
test("chủ trọ chỉ thấy khách của mình (RLS)", t_rls)

print("\nChủ trọ cấp mã")
codes = {}
def t_issue():
    owner(A); r = one("select public.owner_issue_tenant_code('tn-a1')")
    expect(re.fullmatch(r"\d{6}", r["code"]), r); codes["a1"] = r["code"]
    expect(r["name"] == "Rep A" and r["roomCode"] == "P101", r)
test("cấp mã cho một khách: ra 6 chữ số", t_issue)
def t_hash():
    role("postgres"); h = one("select code_hash from public.tenant_access where tenant_id = 'tn-a1'")
    expect(codes["a1"] not in h, "mã thật nằm trong bản băm")
    expect(one("select app_code_set_at is not null from public.tenants where id = 'tn-a1' and owner_id = %s", (A,)) is True)
test("máy chủ chỉ lưu bản băm, cờ app_code_set_at được bật", t_hash)
test("chủ A cấp mã cho khách của chủ B thì không tìm thấy", lambda: (owner(A), expect(one("select public.owner_issue_tenant_code('tn-b1')") == {"error": "not_found"})))
def t_nophone():
    role("postgres"); conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone) values (%s, 'tn-nop', 'b1', 'P101', 'Không SĐT', '')", (A,))
    owner(A); expect(one("select public.owner_issue_tenant_code('tn-nop')") == {"error": "no_phone"})
test("khách không có số điện thoại thì không cấp được", t_nophone)
def t_bulk():
    owner(A); r = one("select public.owner_issue_tenant_codes('b1', true)")
    expect(r["count"] == 1 and r["codes"][0]["tenantId"] == "tn-a2", r)   # tn-a1 đã có mã, tn-nop không có số
    codes["a2"] = r["codes"][0]["code"]
test("cấp hàng loạt chỉ cấp cho khách chưa có mã và có số điện thoại", t_bulk)
def t_bulk_all():
    owner(A); r = one("select public.owner_issue_tenant_codes('b1', false)")
    expect(r["count"] == 2, r)
    for c in r["codes"]:
        codes["a1" if c["tenantId"] == "tn-a1" else "a2"] = c["code"]
test("cấp lại toàn bộ (only_missing = false)", t_bulk_all)
def t_audit():
    role("postgres"); n = one("select count(*) from public.audit_log where action = 'tenant.code' and owner_id = %s", (A,))
    expect(n >= 3, n)
    expect(one("select count(*) from public.audit_log where message like %s", (f"%{codes['a1']}%",)) == 0, "mã lọt vào nhật ký")
test("việc cấp mã được ghi nhật ký, mã thật không nằm trong nhật ký", t_audit)

print("\nĐăng nhập")
tok = {}
def t_login():
    r = login("0921111700", codes["a1"])
    expect(len(r.get("token", "")) == 48, r); tok["a1"] = r["token"]
test("đúng số + đúng mã: nhận token 48 ký tự", t_login)
def t_collision():
    anon(); d = one("select public.tenant_data(%s)", (tok["a1"],))
    expect(d["tenant"]["fullName"] == "Rep A", "lấy nhầm chủ trọ")
    expect([i["id"] for i in d["invoices"]] == ["INV-a"], f"khách thấy hóa đơn nháp/đã hủy: {[i['id'] for i in d['invoices']]}")
    expect("renewal" in d and "roommates" in d and d["roommates"][0]["fullName"] == "Bạn cùng phòng A", "thiếu khóa")
test("trùng số điện thoại giữa hai chủ trọ: mã quyết định đúng người, chỉ thấy hóa đơn của mình, không thấy nháp / đã hủy", t_collision)
test("số có +84 và khoảng trắng cũng đăng nhập được", lambda: expect("token" in login("+84 921 111 700", codes["a1"])))
def t_login2():
    r = login("0921222817", codes["a2"]); expect("token" in r, r); tok["a2"] = r["token"]
test("khách thứ hai trong phòng có mã riêng của mình", t_login2)
test("mã của người này không mở được tài khoản người kia", lambda: expect(login("0921222817", codes["a1"]) == {"error": "invalid"}))
test("token ngẫu nhiên sai thì tenant_data trả null", lambda: (anon(), expect(one("select public.tenant_data(%s)", ("x" * 48,)) is None))[1])
test("token rỗng và null đều trả null", lambda: (anon(), expect(one("select public.tenant_data('')") is None), expect(one("select public.tenant_data(null)") is None)))

print("\nKhóa khi đoán mã")
def t_lock():
    role("postgres"); conn.execute("delete from public.tenant_login_fail")
    res = [login("0921111700", "000000") for _ in range(4)]
    expect(all(r == {"error": "invalid"} for r in res), res)
    r5 = login("0921111700", "000000"); expect(r5.get("error") == "locked" and r5["retryAfterSec"] > 0, r5)
test("sai 5 lần liên tiếp thì khóa số đó", t_lock)
test("đang bị khóa thì ngay cả mã ĐÚNG cũng không vào được", lambda: expect(login("0921111700", codes["a1"]).get("error") == "locked"))
def t_unlock_expiry():
    role("postgres"); conn.execute("update public.tenant_login_fail set locked_until = now() - interval '1 minute' where phone = '0921111700'")
    expect("token" in login("0921111700", codes["a1"]))
test("hết 15 phút thì vào lại được", t_unlock_expiry)
def t_unlock_reissue():
    role("postgres"); conn.execute("delete from public.tenant_login_fail")
    for _ in range(5): login("0921111700", "000000")
    expect(login("0921111700", codes["a1"]).get("error") == "locked")
    owner(A); r = one("select public.owner_issue_tenant_code('tn-a1')"); codes["a1"] = r["code"]
    expect("token" in login("0921111700", codes["a1"]), "cấp lại mã không mở khóa")
test("chủ trọ cấp lại mã thì mở khóa ngay", t_unlock_reissue)
def t_success_resets():
    role("postgres"); conn.execute("delete from public.tenant_login_fail")
    for _ in range(3): login("0921111700", "000000")
    login("0921111700", codes["a1"])
    role("postgres"); expect(one("select count(*) from public.tenant_login_fail where phone = '0921111700'") == 0)
test("đăng nhập đúng thì xóa bộ đếm sai", t_success_resets)

print("\nPhiên và thu hồi")
def t_reissue_kills():
    r = login("0921111700", codes["a1"]); t = r["token"]; anon()
    expect(one("select public.tenant_data(%s)", (t,)) is not None)
    owner(A); one("select public.owner_issue_tenant_code('tn-a1')")
    anon(); expect(one("select public.tenant_data(%s)", (t,)) is None, "token cũ còn sống sau khi cấp lại mã")
test("cấp mã mới thì đăng xuất mọi thiết bị cũ", t_reissue_kills)
def t_logout():
    owner(A); codes["a1"] = one("select public.owner_issue_tenant_code('tn-a1')")["code"]
    t = login("0921111700", codes["a1"])["token"]; anon()
    expect(one("select public.tenant_logout(%s)", (t,)) == {"ok": True})
    expect(one("select public.tenant_data(%s)", (t,)) is None)
test("đăng xuất xóa phiên", t_logout)
def t_expire():
    t = login("0921111700", codes["a1"])["token"]
    role("postgres"); conn.execute("update public.tenant_sessions set expires_at = now() - interval '1 second'")
    anon(); expect(one("select public.tenant_data(%s)", (t,)) is None)
test("phiên hết hạn thì không dùng được", t_expire)
def t_revoke():
    owner(A); codes["a1"] = one("select public.owner_issue_tenant_code('tn-a1')")["code"]
    t = login("0921111700", codes["a1"])["token"]
    owner(A); expect(one("select public.owner_revoke_tenant_access('tn-a1')") == {"ok": True})
    anon(); expect(one("select public.tenant_data(%s)", (t,)) is None, "phiên còn sau thu hồi")
    expect(login("0921111700", codes["a1"]) == {"error": "invalid"}, "mã còn dùng được sau thu hồi")
    role("postgres"); expect(one("select app_code_set_at is null from public.tenants where id = 'tn-a1' and owner_id = %s", (A,)) is True)
test("chủ trọ thu hồi quyền vào app: phiên và mã đều hết hiệu lực", t_revoke)
def t_revoke_other():
    owner(A); one("select public.owner_revoke_tenant_access('tn-b1')")        # tenant của chủ B
    role("postgres"); expect(one("select count(*) from public.tenant_access where owner_id = %s", (B,)) == 0)   # B chưa có mã, nên chỉ kiểm không lỗi
test("thu hồi bằng mã khách của chủ khác không làm gì", t_revoke_other)

print("\nCác hàm nghiệp vụ dùng token")
B_code = {}
def setup_tokens():
    owner(A); codes["a1"] = one("select public.owner_issue_tenant_code('tn-a1')")["code"]; codes["a2"] = one("select public.owner_issue_tenant_code('tn-a2')")["code"]
    owner(B); B_code["b1"] = one("select public.owner_issue_tenant_code('tn-b1')")["code"]
    tok["a1"] = login("0921111700", codes["a1"])["token"]; tok["a2"] = login("0921222817", codes["a2"])["token"]
    tok["b1"] = login("0921111700", B_code["b1"])["token"]
test("chuẩn bị: lấy token cho A1, A2 (bạn cùng phòng) và B1", setup_tokens)
def t_isolation():
    anon(); d = one("select public.tenant_data(%s)", (tok["b1"],))
    expect(d["tenant"]["fullName"] == "Rep B" and [i["id"] for i in d["invoices"]] == ["INV-b"], d)
test("token của B chỉ thấy dữ liệu của B", t_isolation)
def t_message():
    anon()
    expect(one("select public.tenant_send_message(%s, 'Chào chủ nhà')", (tok["a1"],))["ok"] is True)
    expect(one("select public.tenant_send_message(%s, '   ')", (tok["a1"],)) is None, "tin rỗng phải bị bỏ")
    m = one("select public.tenant_messages(%s)", (tok["a1"],))["messages"]
    expect(len(m) == 1 and m[0]["body"] == "Chào chủ nhà", m)
    expect(one("select public.tenant_messages(%s)", (tok["b1"],))["messages"] == [], "B đọc được tin của A")
    expect(one("select public.tenant_messages(%s)", ("bad" * 20,)) is None)
test("nhắn tin: gửi, đọc lại, và B không thấy tin của A", t_message)
def t_staff_thread():
    role("postgres"); phone = one("select tenant_phone from public.support_messages where owner_id = %s limit 1", (A,))
    expect(phone == "0921111700", phone)
    conn.execute("insert into public.support_messages(owner_id, id, tenant_phone, sender, staff_name, body, read_by_tenant) values (%s, 'ms-staff', %s, 'staff', 'Nhân viên', 'Dạ chào anh', false)", (A, "0921111700"))
    anon(); m = one("select public.tenant_messages(%s)", (tok["a1"],))["messages"]
    expect([x["sender"] for x in m] == ["tenant", "staff"], m)
test("nhân viên trả lời theo số điện thoại thì khách thấy đúng cuộc trò chuyện", t_staff_thread)
def t_incident():
    anon(); r = one("select public.tenant_create_incident(%s, 'Điện', 'Hỏng bóng đèn', '[]'::jsonb)", (tok["a1"],))
    role("postgres"); row = conn.execute("select owner_id, room_code, status from public.incidents where id = %s", (r["id"],)).fetchone()
    expect(str(row[0]) == A and row[1] == "P101" and row[2] == "open", row)
    anon(); expect(one("select public.tenant_create_incident(%s, 'x', 'y')", ("z" * 40,)) is None)
test("báo hỏng: ghi vào đúng chủ trọ và phòng, token sai thì không ghi", t_incident)
def t_reading():
    anon(); expect(one("select public.tenant_submit_reading(%s, '2026-10', 1234, null, '[]'::jsonb)", (tok["a1"],))["ok"] is True)
    role("postgres"); expect(float(one("select elec_curr from public.readings where owner_id = %s and period = '2026-10'", (A,))) == 1234)
    expect(one("select count(*) from public.readings where owner_id = %s", (B,)) == 0, "chỉ số lọt sang chủ khác")
test("gửi chỉ số điện: vào đúng chủ trọ", t_reading)
def t_claim():
    anon(); r = one("select public.tenant_submit_payment_claim(%s, 'INV-a', 3000000, 'ck', null)", (tok["a1"],))
    expect(r["status"] == "pending", r)
    role("postgres"); expect(one("select count(*) from public.payment_claims where owner_id = %s", (A,)) == 1)
    anon(); expect(one("select public.tenant_notify_paid(%s, 'INV-a')", (tok["a1"],))["ok"] is True)
test("báo đã chuyển khoản và phiếu chứng từ", t_claim)
def t_renew():
    anon()
    r = one("select public.tenant_request_renewal(%s, 6, 'ở tiếp')", (tok["a1"],)); expect(r["status"] == "pending" and "duplicate" not in r, r)
    r2 = one("select public.tenant_request_renewal(%s, 6, null)", (tok["a1"],)); expect(r2.get("duplicate") is True and r2["id"] == r["id"], r2)
    expect(one("select public.tenant_request_renewal(%s, 5, null)", (tok["a1"],)) == {"error": "bad_months"})
    expect(one("select public.tenant_request_renewal(%s, 6, null)", (tok["a2"],)) == {"error": "not_rep"})
    role("postgres"); expect(one("select count(*) from public.renewal_requests where owner_id = %s", (A,)) == 1)
    anon(); d = one("select public.tenant_data(%s)", (tok["a1"],)); expect(d["renewal"]["status"] == "pending", d["renewal"])
test("xin gia hạn: tạo, chống trùng, sai số tháng, người không đại diện bị chặn, hiện trong tenant_data", t_renew)
def t_too_early():
    role("postgres"); conn.execute("update public.contracts set end_date = current_date + 200 where owner_id = %s", (A,))
    conn.execute("delete from public.renewal_requests")
    anon(); expect(one("select public.tenant_request_renewal(%s, 6, null)", (tok["a1"],)) == {"error": "too_early"})
test("hợp đồng còn hơn 90 ngày thì chưa xin được", t_too_early)

print(f"\n{ok} đạt, {hong} hỏng")
conn.close()
sys.exit(1 if hong else 0)
