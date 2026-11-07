"""Kiểm thử tài khoản nhận tiền của tòa nhà (supabase/migration-bank-info.sql) trên Postgres thật chạy tại máy.

Cách chạy: .venv-db/Scripts/python tests/db/bank-info.test.py   (xem tenant-code-self.test.py để biết cách dựng .venv-db)
Cần node (đối chiếu danh sách ngân hàng trong js/bank-info.js với quy tắc của DB).
Biến HH_BANKINFO_SQL trỏ tới một bản sửa của migration (thử phá). Thoát mã khác 0 nếu có ca hỏng.
"""
import json, os, pathlib, re, subprocess, sys, tempfile, uuid
import pgserver, psycopg

ROOT = pathlib.Path(__file__).resolve().parents[2]
SQL = ROOT / "supabase"
ok = hong = 0
def test(ten, fn):
    global ok, hong
    try: fn(); ok += 1; print("  ok   " + ten)
    except Exception as e: hong += 1; print(" HONG  " + ten + "\n         " + str(e).splitlines()[0][:220])
def expect(c, m="sai"):
    if not c: raise AssertionError(m)

srv = pgserver.get_server(tempfile.mkdtemp(prefix="hhpg"), cleanup_mode="delete")
conn = psycopg.connect(srv.get_uri(), autocommit=True)
def one(sql, params=None):
    r = conn.execute(sql, params).fetchone(); return r[0] if r else None
def role(r, sub=None, email=None):
    conn.execute("reset role")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (sub or "",))
    conn.execute("select set_config('request.jwt.claim.email', %s, false)", (email or "",))
    if r != "postgres": conn.execute(f"set role {r}")
def load(name, strip_ext=False):
    if name == "migration-bank-info.sql" and os.environ.get("HH_BANKINFO_SQL"):
        t = pathlib.Path(os.environ["HH_BANKINFO_SQL"]).read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8") if name != "stubs.sql" else (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    if strip_ext: t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ)", t)
    try: conn.execute(t)
    except Exception as e: print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)
def loi(fn, ma):
    """fn phải ném lỗi chứa chuỗi ma"""
    try: fn()
    except psycopg.Error as e:
        expect(ma in str(e), f"lỗi khác mong đợi ({ma}): {str(e).splitlines()[0][:120]}"); return
    raise AssertionError("đáng lẽ phải báo lỗi " + ma)

print("Nạp lược đồ và các migration")
for f in ["stubs.sql", "schema.sql", "migration-tenant-app.sql", "migration-tenant-app-v2.sql", "migration-claims-photos.sql",
          "migration-reading-photos.sql", "migration-support-chat.sql", "migration-staff-vehicles.sql", "migration-renewal.sql",
          "migration-late-fee.sql", "migration-invoice-batches.sql", "migration-incident-tracking.sql"]:
    load(f)
load("migration-tenant-auth.sql", strip_ext=True)
load("migration-bank-info.sql")
print("  ok   toàn bộ tệp nạp không lỗi")
load("migration-bank-info.sql")
print("  ok   chạy lần hai không lỗi")

A, B, S, X = (str(uuid.uuid4()) for _ in range(4))
for u, e in ((A, "a@x.vn"), (B, "b@x.vn"), (S, "nv@x.vn"), (X, "lạ@x.vn")): conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
conn.execute("insert into public.staff(owner_id, id, email, status) values (%s, 'st1', 'nv@x.vn', 'active')", (A,))
for o, t in ((A, "a"), (B, "b")):
    conn.execute("insert into public.buildings(owner_id, id, name) values (%s, 'b1', 'Nhà ' || %s), (%s, 'b2', 'Nhà phụ ' || %s)", (o, t, o, t))
    conn.execute("insert into public.rooms(owner_id, id, building_id, code, price) values (%s, 'r1', 'b1', 'P101', 1)", (o,))
    conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) values (%s, %s, 'b1', 'P101', 'Khách ' || %s, %s, true)",
                 (o, "tn-" + t, t, "0921111700" if t == "a" else "0922222800"))

OK_INFO = {"name": "MB Bank", "bin": "970422", "account": "0123456789", "holder": "NGUYEN VAN A"}
def J(o): return json.dumps(o, ensure_ascii=False)
def set_bank(sub, bid, info, email=None, role_="authenticated"):
    role(role_, sub, email)
    return conn.execute("update public.buildings set bank_info = %s::jsonb where owner_id = %s and id = %s", (J(info) if info is not None else None, A if sub != B else B, bid)).rowcount
def get_bank(o, bid):
    role("postgres"); r = conn.execute("select bank_info from public.buildings where owner_id = %s and id = %s", (o, bid)).fetchone(); return r[0]

print("\nCột và quyền")
test("có cột bank_info kiểu jsonb", lambda: expect(one("select data_type from information_schema.columns where table_schema='public' and table_name='buildings' and column_name='bank_info'") == "jsonb"))
test("tòa mới tạo chưa có tài khoản (null), dữ liệu cũ không bị đụng", lambda: expect(get_bank(A, "b1") is None and one("select count(*) from public.buildings") == 4))
test("anon gọi được tenant_bank; không gọi được hàm nội bộ", lambda: (
    role("anon"), expect(one("select has_function_privilege('anon', 'public.tenant_bank(text)', 'execute')")),
    expect(not one("select has_function_privilege('anon', 'public._bank_info_hop_le(jsonb)', 'execute')")),
    expect(not one("select has_function_privilege('anon', 'public._hh_chi_chu_doi_bank()', 'execute')")),
    expect(not one("select has_function_privilege('authenticated', 'public._hh_chi_chu_doi_bank()', 'execute')"))))
test("anon không đọc được bảng tòa nhà (RLS), nên không thấy số tài khoản", lambda: (role("anon"), expect(one("select count(*) from public.buildings") == 0)))

print("\nChủ trọ đặt tài khoản")
test("chủ đặt tài khoản hợp lệ cho tòa của mình", lambda: (expect(set_bank(A, "b1", OK_INFO) == 1), expect(get_bank(A, "b1") == OK_INFO, str(get_bank(A, "b1")))))
test("mỗi tòa một tài khoản riêng: tòa b2 vẫn trống", lambda: expect(get_bank(A, "b2") is None))
test("chủ sửa sang ngân hàng khác được", lambda: (set_bank(A, "b2", dict(OK_INFO, name="Vietcombank", bin="970436")), expect(get_bank(A, "b2")["bin"] == "970436")))
test("JSON null được hiểu là xóa (về SQL null)", lambda: (set_bank(A, "b2", None), expect(get_bank(A, "b2") is None),
    conn.execute("update public.buildings set bank_info = 'null'::jsonb where owner_id=%s and id='b1'", (A,)), expect(get_bank(A, "b1") is None, "b1 phải về null")))
test("đặt lại sau khi xóa", lambda: (set_bank(A, "b1", OK_INFO), expect(get_bank(A, "b1") == OK_INFO)))

SAI = {
    "số tài khoản có chữ": dict(OK_INFO, account="01234abcde"),
    "số tài khoản 5 số": dict(OK_INFO, account="12345"),
    "số tài khoản 20 số": dict(OK_INFO, account="1" * 20),
    "mã ngân hàng 5 số": dict(OK_INFO, bin="97042"),
    "mã ngân hàng có chữ": dict(OK_INFO, bin="97042x"),
    "tên chủ viết thường": dict(OK_INFO, holder="nguyen van a"),
    "tên chủ có dấu": dict(OK_INFO, holder="NGUYỄN VĂN A"),
    "tên chủ có thẻ html": dict(OK_INFO, holder="<B>HACK</B>"),
    "tên chủ quá ngắn": dict(OK_INFO, holder="AB"),
    "tên chủ quá dài": dict(OK_INFO, holder="A" * 51),
    "tên ngân hàng có thẻ script": dict(OK_INFO, name="<script>alert(1)</script>"),
    "tên ngân hàng dấu nháy": dict(OK_INFO, name='MB"Bank'),
    "tên ngân hàng rỗng": dict(OK_INFO, name=""),
    "thiếu số tài khoản": {k: v for k, v in OK_INFO.items() if k != "account"},
    "thiếu tên chủ": {k: v for k, v in OK_INFO.items() if k != "holder"},
    "là mảng": [OK_INFO],
    "là chuỗi": "970422-0123456789",
    "là số": 123,
    "là object rỗng": {},
}
for ten, v in SAI.items():
    test("từ chối: " + ten, lambda v=v: (loi(lambda: set_bank(A, "b1", v), "BAD_BANK_INFO"), expect(get_bank(A, "b1") == OK_INFO, "dữ liệu cũ bị đổi")))
test("từ chối cả khi thêm tòa mới có tài khoản sai", lambda: (role("authenticated", A), loi(lambda: conn.execute(
    "insert into public.buildings(owner_id, id, name, bank_info) values (%s, 'b9', 'X', %s::jsonb)", (A, J(dict(OK_INFO, account="abc")))), "BAD_BANK_INFO")))
test("thêm tòa mới có tài khoản đúng thì được", lambda: (role("authenticated", A), conn.execute(
    "insert into public.buildings(owner_id, id, name, bank_info) values (%s, 'b8', 'Y', %s::jsonb)", (A, J(OK_INFO))), expect(get_bank(A, "b8") == OK_INFO)))
test("số tài khoản đúng 6 và đúng 19 số được", lambda: [(set_bank(A, "b1", dict(OK_INFO, account=a)), expect(get_bank(A, "b1")["account"] == a)) for a in ("123456", "1" * 19)])
test("tên chủ đúng 3 và đúng 50 ký tự (có khoảng trắng) được", lambda: [(set_bank(A, "b1", dict(OK_INFO, holder=h)), expect(get_bank(A, "b1")["holder"] == h)) for h in ("ABC", "A " * 25)])
test("khôi phục tài khoản đúng để các ca sau dùng", lambda: set_bank(A, "b1", OK_INFO))

print("\nNhân viên KHÔNG đổi được tài khoản nhận tiền")
test("nhân viên vẫn sửa được cột khác của tòa nhà (chính sách staff_access còn nguyên)", lambda: (
    role("authenticated", S, "nv@x.vn"),
    expect(conn.execute("update public.buildings set name = 'Nhà A (NV sửa)' where owner_id=%s and id='b1'", (A,)).rowcount == 1),
    expect(get_bank(A, "b1") == OK_INFO, "tài khoản bị đổi khi nhân viên sửa tên")))
test("nhân viên đổi bank_info: báo ONLY_OWNER_BANK, giữ nguyên số cũ", lambda: (
    role("authenticated", S, "nv@x.vn"),
    loi(lambda: conn.execute("update public.buildings set bank_info = %s::jsonb where owner_id=%s and id='b1'", (J(dict(OK_INFO, account="999999999")), A)), "ONLY_OWNER_BANK"),
    expect(get_bank(A, "b1") == OK_INFO)))
test("nhân viên xóa tài khoản (đặt null): cũng bị chặn", lambda: (
    role("authenticated", S, "nv@x.vn"),
    loi(lambda: conn.execute("update public.buildings set bank_info = null where owner_id=%s and id='b1'", (A,)), "ONLY_OWNER_BANK"),
    expect(get_bank(A, "b1") == OK_INFO)))
test("nhân viên thêm tòa mới kèm tài khoản: bị chặn", lambda: (
    role("authenticated", S, "nv@x.vn"),
    loi(lambda: conn.execute("insert into public.buildings(owner_id, id, name, bank_info) values (%s, 'b7', 'Z', %s::jsonb)", (A, J(OK_INFO))), "ONLY_OWNER_BANK")))
test("nhân viên thêm tòa mới không có tài khoản: được", lambda: (
    role("authenticated", S, "nv@x.vn"),
    conn.execute("insert into public.buildings(owner_id, id, name) values (%s, 'b6', 'Tòa NV thêm')", (A,)), expect(get_bank(A, "b6") is None)))
test("nhân viên ghi lại ĐÚNG giá trị cũ (app lưu cả dòng) thì không vướng", lambda: (
    role("authenticated", S, "nv@x.vn"),
    expect(conn.execute("update public.buildings set bank_info = %s::jsonb, name = 'Nhà A2' where owner_id=%s and id='b1'", (J(OK_INFO), A)).rowcount == 1)))
test("nhân viên bị vô hiệu (disabled) thì không sửa được tòa nào", lambda: (
    role("postgres"), conn.execute("update public.staff set status = 'disabled' where owner_id = %s", (A,)),
    expect(one("select status from public.staff where owner_id = %s", (A,)) == "disabled", "chưa vô hiệu được nhân viên"),
    role("authenticated", S, "nv@x.vn"),
    expect(conn.execute("update public.buildings set name = 'X' where owner_id=%s and id='b1'", (A,)).rowcount == 0)))
role("postgres"); conn.execute("update public.staff set status = 'active' where owner_id = %s", (A,))   # trả lại cho các ca sau
test("người lạ (không phải chủ, không phải nhân viên) không đổi được: RLS cho 0 dòng", lambda: (
    role("authenticated", X, "lạ@x.vn"),
    expect(conn.execute("update public.buildings set bank_info = %s::jsonb where owner_id=%s and id='b1'", (J(dict(OK_INFO, account="888888")), A)).rowcount == 0),
    expect(get_bank(A, "b1") == OK_INFO)))
test("chủ B không đổi được tòa của chủ A", lambda: (
    role("authenticated", B),
    expect(conn.execute("update public.buildings set bank_info = %s::jsonb where owner_id=%s and id='b1'", (J(dict(OK_INFO, account="777777")), A)).rowcount == 0),
    expect(get_bank(A, "b1") == OK_INFO)))
test("chạy từ SQL Editor (không có người đăng nhập) vẫn đặt được, kể cả trên tòa của chủ", lambda: (
    role("postgres"), conn.execute("update public.buildings set bank_info = %s::jsonb where owner_id=%s and id='b2'", (J(OK_INFO), A)),
    expect(get_bank(A, "b2") == OK_INFO),
    conn.execute("update public.buildings set bank_info = null where owner_id=%s and id='b2'", (A,))))
test("kể cả SQL Editor cũng không đặt được dữ liệu sai dạng", lambda: (
    role("postgres"), loi(lambda: conn.execute("update public.buildings set bank_info = %s::jsonb where owner_id=%s and id='b2'", (J(dict(OK_INFO, account="x")), A)), "BAD_BANK_INFO")))

print("\nKhách lấy tài khoản (tenant_bank)")
def issue(o, tid):
    role("authenticated", o); return one("select public.owner_issue_tenant_code(%s)", (tid,))["code"]
def login(phone, code):
    role("anon"); return one("select public.tenant_login(%s, %s)", (phone, code))["token"]
tokA = login("0921111700", issue(A, "tn-a")); tokB = login("0922222800", issue(B, "tn-b"))
def bank(tok): role("anon"); return one("select public.tenant_bank(%s)", (tok,))
test("khách chủ A thấy tài khoản của tòa mình (đúng bốn trường, không lộ gì thêm)", lambda: expect(bank(tokA) == {"bank": OK_INFO}, str(bank(tokA))))
test("tòa chưa nhập tài khoản thì trả {bank: null} (app khách rơi về js/config.js)", lambda: expect(bank(tokB) == {"bank": None}, str(bank(tokB))))
test("token sai, rỗng, quá ngắn: trả null (app hiểu là phải đăng nhập lại)", lambda: [expect(bank(t) is None, repr(t)) for t in ("x" * 40, "", "ngan", None)])
test("hai chủ trùng mã tòa 'b1': mỗi khách chỉ thấy tài khoản của chủ mình", lambda: (
    set_bank(B, "b1", dict(OK_INFO, account="5555555555", holder="TRAN THI B")),
    expect(bank(tokB)["bank"]["account"] == "5555555555" and bank(tokA)["bank"]["account"] == "0123456789", str((bank(tokA), bank(tokB))))))
test("đổi tài khoản thì khách thấy ngay lần gọi sau", lambda: (
    set_bank(A, "b1", dict(OK_INFO, name="Vietcombank", bin="970436", account="1029384756")),
    expect(bank(tokA)["bank"] == {"name": "Vietcombank", "bin": "970436", "account": "1029384756", "holder": "NGUYEN VAN A"}, str(bank(tokA)))))
test("dữ liệu hỏng có sẵn trong DB (ví dụ lọt từ trước) thì khách thấy như CHƯA NHẬP, không thấy chữ lạ", lambda: (
    role("postgres"), conn.execute("alter table public.buildings disable trigger hh_chi_chu_doi_bank"),
    conn.execute("update public.buildings set bank_info = %s::jsonb where owner_id=%s and id='b1'", (J(dict(OK_INFO, holder="<img src=x onerror=1>")), A)),
    conn.execute("alter table public.buildings enable trigger hh_chi_chu_doi_bank"),
    expect(bank(tokA) == {"bank": None}, str(bank(tokA)))))
test("sửa lại tên tòa khi bank_info hỏng có sẵn vẫn được (trigger chỉ kiểm khi bank_info đổi)", lambda: (
    role("authenticated", A), expect(conn.execute("update public.buildings set name = 'Nhà A3' where owner_id=%s and id='b1'", (A,)).rowcount == 1)))
test("chủ sửa lại bank_info hỏng sang dữ liệu đúng thì khách thấy lại", lambda: (set_bank(A, "b1", OK_INFO), expect(bank(tokA) == {"bank": OK_INFO})))
test("khách đã đăng xuất thì tenant_bank trả null", lambda: (
    role("anon"), one("select public.tenant_logout(%s)", (tokA,)), expect(bank(tokA) is None)))

print("\nDanh sách ngân hàng của app khớp quy tắc của DB")
try:
    nodejs = subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./js/bank-info.js').NGAN_HANG))"], cwd=str(ROOT), capture_output=True, text=True, check=True)
    NH = json.loads(nodejs.stdout)
except Exception as e:
    print("LỖI chạy node:", e); sys.exit(2)
def moi_ngan_hang():
    for b in NH:
        r = set_bank(A, "b1", {"name": b["ten"], "bin": b["bin"], "account": "0123456789", "holder": "NGUYEN VAN A"})
        expect(r == 1 and get_bank(A, "b1")["name"] == b["ten"], b["ten"])
test(f"cả {len(NH)} ngân hàng trong danh sách đều được DB nhận", moi_ngan_hang)
test("đầu ra của chuanHoa() (có dấu, khoảng trắng trong ô nhập) được DB nhận", lambda: (
    set_bank(A, "b1", json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./js/bank-info.js').chuanHoa({bin:'970422',account:'0123 456-789',holder:'  Đỗ  Thị Hồng '})))"],
        cwd=str(ROOT), capture_output=True, text=True, check=True).stdout)),
    expect(get_bank(A, "b1") == {"name": "MB Bank", "bin": "970422", "account": "0123456789", "holder": "DO THI HONG"}, str(get_bank(A, "b1")))))

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
