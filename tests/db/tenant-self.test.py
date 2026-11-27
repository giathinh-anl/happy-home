"""Kiểm thử supabase/migration-tenant-self.sql: khách tự gửi ảnh CCCD từ app.

Bạn chủ trọ báo 27/11: app khách không có chỗ úp CCCD. Khách gửi từng mặt; chủ trọ và nhân viên có quyền "Khách thuê" của đúng tòa
xem được ảnh; khách khác, người lạ, nhân viên tòa khác không xem được; dữ liệu không phải ảnh bị từ chối.
Cách chạy: .venv-db/Scripts/python tests/db/tenant-self.test.py     Biến HH_TENANT_SELF_SQL trỏ tới bản sửa (thử phá).
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
def role(r, sub=None, email=None):
    conn.execute("reset role")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (sub or "",))
    conn.execute("select set_config('request.jwt.claim.email', %s, false)", (email or "",))
    if r != "postgres": conn.execute(f"set role {r}")
def load(name, strip_ext=False):
    if name == "migration-tenant-self.sql" and os.environ.get("HH_TENANT_SELF_SQL"):
        t = pathlib.Path(os.environ["HH_TENANT_SELF_SQL"]).read_text(encoding="utf-8")
    elif name == "stubs.sql":
        t = (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8")
    if strip_ext: t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ)", t)
    role("postgres")
    try: conn.execute(t)
    except Exception as e: print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)
def bi_chan(fn, m="đáng lẽ bị chặn"):
    try: fn()
    except psycopg.Error: return
    raise AssertionError(m)

print("Nạp lược đồ và các migration (đúng thứ tự trên máy chủ thật)")
for f in ["stubs.sql", "schema.sql", "migration-tenant-app.sql", "migration-tenant-app-v2.sql", "migration-claims-photos.sql",
          "migration-reading-photos.sql", "migration-support-chat.sql", "migration-transactions.sql", "migration-staff-vehicles.sql",
          "migration-renewal.sql", "migration-late-fee.sql", "migration-invoice-batches.sql", "migration-incident-tracking.sql"]:
    load(f)
load("migration-tenant-auth.sql", strip_ext=True)
load("migration-chat-photos.sql")
load("migration-staff-scope.sql")
load("migration-tenant-self.sql")
print("  ok   chạy migration-tenant-self.sql không lỗi")
load("migration-tenant-self.sql")
print("  ok   chạy lần hai không lỗi")

A, B, S1, S2, S3 = (str(uuid.uuid4()) for _ in range(5))
for u, e in ((A, "a@x.vn"), (B, "b@x.vn"), (S1, "nv1@x.vn"), (S2, "nv2@x.vn"), (S3, "nv3@x.vn")):
    conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
# S1: tòa b1, có quyền Khách thuê; S2: tòa b2, có quyền Khách thuê; S3: tòa b1 nhưng KHÔNG có quyền Khách thuê
conn.execute("""insert into public.staff(owner_id, id, email, permissions, building_ids, status) values
  (%s, 'st1', 'nv1@x.vn', '["tenants"]', '["b1"]', 'active'),
  (%s, 'st2', 'nv2@x.vn', '["tenants"]', '["b2"]', 'active'),
  (%s, 'st3', 'nv3@x.vn', '["invoices"]', '["b1"]', 'active')""", (A, A, A))
for o in (A, B):
    for b in ("b1", "b2"):
        conn.execute("insert into public.buildings(owner_id, id, name) values (%s, %s, %s)", (o, b, "Nhà " + b))
        conn.execute("insert into public.rooms(owner_id, id, building_id, code, price) values (%s, %s, %s, 'P101', 1)", (o, "r-" + b, b))
conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) values (%s, 'tn1', 'b1', 'P101', 'Khách Một', '0921111701', true)", (A,))
conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) values (%s, 'tn2', 'b1', 'P101', 'Khách Hai', '0921111702', false)", (A,))

def token(sub, tid, phone):
    role("authenticated", sub); code = one("select public.owner_issue_tenant_code(%s)", (tid,))["code"]
    role("anon"); return one("select public.tenant_login(%s, %s)", (phone, code))["token"]
TOK1 = token(A, "tn1", "0921111701"); TOK2 = token(A, "tn2", "0921111702")
ANH = "data:image/jpeg;base64," + "A" * 4000
ANH2 = "data:image/png;base64,iVBORw0KGgo="

def up(tok, kind, data):
    role("anon"); return one("select public.tenant_upload_cccd(%s, %s, %s)", (tok, kind, data))
def trang_thai(tok):
    role("anon"); return one("select public.tenant_cccd_status(%s)", (tok,))
def co(tid):
    role("postgres"); return conn.execute("select cccd_front, cccd_back from public.tenants where owner_id = %s and id = %s", (A, tid)).fetchone()
def dem(sub, email, where=""):
    role("authenticated", sub, email); return one(f"select count(*) from public.tenant_docs {where}")

test("mới vào: chưa nộp mặt nào", lambda: expect(trang_thai(TOK1) == {"front": False, "back": False}, str(trang_thai(TOK1))))
def gui_truoc():
    expect(up(TOK1, "cccd_front", ANH) == {"ok": True})
    expect(co("tn1") == (True, False), "cờ mặt trước trên hồ sơ chưa bật")
    expect(trang_thai(TOK1) == {"front": True, "back": False})
test("gửi mặt trước: lưu ảnh, bật cờ đã nộp mặt trước trên hồ sơ (chủ trọ thấy ngay ở danh sách)", gui_truoc)
def gui_sau():
    expect(up(TOK1, "cccd_back", ANH2) == {"ok": True})
    expect(co("tn1") == (True, True)); expect(trang_thai(TOK1) == {"front": True, "back": True})
test("gửi mặt sau: đủ hai mặt", gui_sau)
def gui_lai():
    expect(up(TOK1, "cccd_front", ANH2) == {"ok": True})
    role("postgres")
    expect(one("select count(*) from public.tenant_docs where tenant_id = 'tn1' and kind = 'cccd_front'") == 1, "gửi lại phải thay, không thêm dòng")
    expect(one("select data from public.tenant_docs where tenant_id = 'tn1' and kind = 'cccd_front'") == ANH2, "ảnh cũ chưa được thay")
test("gửi lại thì thay ảnh cũ (không chồng thêm)", gui_lai)
def sai():
    expect(up(TOK1, "selfie", ANH) == {"error": "bad_kind"})
    expect(up(TOK1, "cccd_front", "data:text/html;base64,PHNjcmlwdD4=") == {"error": "bad_image"})
    expect(up(TOK1, "cccd_front", "data:image/jpeg;base64,AA'); drop table x;--") == {"error": "bad_image"})
    expect(up(TOK1, "cccd_front", "data:image/jpeg;base64," + "A" * 700000) == {"error": "too_big"})
    expect(up(TOK1, "cccd_front", None) == {"error": "too_big"})
    expect(up(TOK2, "cccd_front", "khong phai anh") == {"error": "bad_image"})
    expect(co("tn2") == (False, False), "gửi sai mà cờ vẫn bật")
test("không phải ảnh / quá lớn / loại lạ: từ chối, không bật cờ", sai)
test("token sai hoặc hết hạn: không làm gì", lambda: (expect(up("token-sai", "cccd_front", ANH) is None), expect(trang_thai("token-sai") is None)))
def tach_khach():
    expect(up(TOK2, "cccd_front", ANH) == {"ok": True})
    expect(co("tn2") == (True, False)); expect(co("tn1") == (True, True))
    role("postgres"); expect(one("select count(*) from public.tenant_docs where tenant_id = 'tn2'") == 1)
test("mỗi khách chỉ ghi vào hồ sơ của chính mình", tach_khach)
test("chủ trọ xem được ảnh khách của mình", lambda: expect(dem(A, "a@x.vn") == 3))
test("chủ trọ khác không xem được", lambda: expect(dem(B, "b@x.vn") == 0))
test("nhân viên có quyền Khách thuê của tòa b1 xem được", lambda: expect(dem(S1, "nv1@x.vn") == 3))
test("nhân viên tòa khác (b2) không xem được", lambda: expect(dem(S2, "nv2@x.vn") == 0))
test("nhân viên không có quyền Khách thuê không xem được", lambda: expect(dem(S3, "nv3@x.vn") == 0))
def an_danh():
    role("anon"); bi_chan(lambda: one("select count(*) from public.tenant_docs"), "người lạ đọc được bảng ảnh")
test("người lạ (anon) không đọc trực tiếp được bảng ảnh", an_danh)
def nv_khong_ghi():
    role("authenticated", S1, "nv1@x.vn")
    bi_chan(lambda: conn.execute("insert into public.tenant_docs(owner_id, tenant_id, building_id, kind, data) values (%s, 'tn1', 'b1', 'cccd_back', %s)", (A, ANH)), "nhân viên ghi được ảnh")
    role("authenticated", S1, "nv1@x.vn"); n = conn.execute("delete from public.tenant_docs").rowcount
    expect(n == 0, "nhân viên xóa được ảnh")
test("nhân viên chỉ xem, không ghi / xóa được", nv_khong_ghi)
def chu_xoa():
    role("authenticated", A, "a@x.vn"); n = conn.execute("delete from public.tenant_docs where tenant_id = 'tn2'").rowcount
    expect(n == 1)
test("chủ trọ xóa được ảnh khách của mình", chu_xoa)
def bang_rang_buoc():
    role("authenticated", A, "a@x.vn")
    bi_chan(lambda: conn.execute("insert into public.tenant_docs(owner_id, tenant_id, building_id, kind, data) values (%s, 'tn9', 'b1', 'cccd_front', 'abc')", (A,)), "bảng nhận dữ liệu không phải ảnh")
test("bảng tự chặn dữ liệu không phải ảnh (kể cả ghi thẳng)", bang_rang_buoc)

print("\n%d đạt, %d hỏng" % (ok, hong))
conn.close()
sys.exit(1 if hong else 0)
