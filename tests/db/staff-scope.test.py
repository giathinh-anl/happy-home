"""Kiểm thử supabase/migration-staff-scope.sql trên Postgres thật chạy tại máy.

Nhân viên chỉ vào được các tòa được giao (đọc, ghi, upsert như web làm), không xóa được tòa nhà, đọc và trả lời được tin nhắn của
khách (cần quyền "Khách thuê", theo tòa), nhật ký chỉ ghi thêm; hàm nv_ma_da_dung trả mã đã dùng để đánh số không trùng; phiếu thu
có đủ cột. Dựng đúng trạng thái máy chủ thật trước khi sửa (quy tắc staff_access cũ) để thấy lỗ hổng trước.
Cách chạy: .venv-db/Scripts/python tests/db/staff-scope.test.py     Biến HH_STAFF_SCOPE_SQL trỏ tới bản sửa (thử phá).
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
    if name == "migration-staff-scope.sql" and os.environ.get("HH_STAFF_SCOPE_SQL"):
        t = pathlib.Path(os.environ["HH_STAFF_SCOPE_SQL"]).read_text(encoding="utf-8")
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

A, B, S1, S2, S3, S4 = (str(uuid.uuid4()) for _ in range(6))
for u, e in ((A, "a@x.vn"), (B, "b@x.vn"), (S1, "nv1@x.vn"), (S2, "nv2@x.vn"), (S3, "nv3@x.vn"), (S4, "nv4@x.vn")):
    conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
# S1: chỉ tòa b1, có quyền Khách thuê; S2: mọi tòa, KHÔNG có quyền Khách thuê; S3: đã khóa; S4: nhân viên của chủ B
conn.execute("""insert into public.staff(owner_id, id, email, permissions, building_ids, status) values
  (%s, 'st1', 'nv1@x.vn', '["tenants","invoices","payments"]', '["b1"]', 'active'),
  (%s, 'st2', 'nv2@x.vn', '["rooms","invoices"]', '[]', 'active'),
  (%s, 'st3', 'nv3@x.vn', '["tenants"]', '["b1"]', 'disabled'),
  (%s, 'st4', 'nv4@x.vn', '["tenants"]', '[]', 'active')""", (A, A, A, B))
for o in (A, B):
    for b in ("b1", "b2"):
        conn.execute("insert into public.buildings(owner_id, id, name) values (%s, %s, %s)", (o, b, "Nhà " + b))
        conn.execute("insert into public.rooms(owner_id, id, building_id, code, price) values (%s, %s, %s, 'P101', 1)", (o, "r-" + b, b))
        conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) values (%s, %s, %s, 'P101', 'Khách', '0921111700', true)", (o, "tn-" + b, b))
        conn.execute("insert into public.invoices(owner_id, id, building_id, total) values (%s, %s, %s, 100)", (o, "HD-2611-00" + ("1" if b == "b1" else "7"), b))
        conn.execute("insert into public.payments(owner_id, id, building_id, amount) values (%s, %s, %s, 50)", (o, "pm-" + b, b))
        conn.execute("insert into public.transactions(owner_id, id, building_id, kind, amount) values (%s, %s, %s, 'chi', 10)", (o, "tx-" + b, b))
    for mid, b in (("ms-b1", "b1"), ("ms-b2", "b2"), ("ms-null", None)):
        conn.execute("insert into public.support_messages(owner_id, id, building_id, tenant_phone, sender, body) values (%s, %s, %s, '0921111700', 'tenant', 'Cho em hỏi')", (o, mid, b))
    for mid in ("ms-b1", "ms-b2"):
        conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, %s, 0, 'data:image/jpeg;base64,AAAA')", (o, mid))
    conn.execute("insert into public.audit_log(owner_id, id, action, message) values (%s, 'lg1', 'x', 'việc ở tòa b2')", (o,))

def dem(bang, sub, email, where=""):
    role("authenticated", sub, email); return one(f"select count(*) from public.{bang} {where}")
NV1 = (S1, "nv1@x.vn"); NV2 = (S2, "nv2@x.vn"); NV3 = (S3, "nv3@x.vn"); NV4 = (S4, "nv4@x.vn"); CHU = (A, "a@x.vn")

# ---- TRƯỚC khi sửa: đúng như máy chủ thật ----
test("TRƯỚC: nhân viên chỉ giao tòa b1 vẫn đọc được phòng của cả tòa b2 (lỗ hổng)", lambda: expect(dem("rooms", *NV1) == 2, str(dem("rooms", *NV1))))
test("TRƯỚC: nhân viên xóa được tòa nhà của chủ (lỗ hổng)", lambda: (role("authenticated", *NV2), conn.execute("begin"),
    expect(conn.execute("delete from public.buildings where id = 'b2'").rowcount == 1), conn.execute("rollback")))
test("TRƯỚC: nhân viên có quyền Khách thuê không đọc được tin nhắn nào của khách (trang Hỏi đáp trống)", lambda: expect(dem("support_messages", *NV1) == 0))
test("TRƯỚC: phiếu thu không có cột số phiếu (receipt_no)", lambda: (role("postgres"),
    expect(one("select count(*) from information_schema.columns where table_name = 'payments' and column_name = 'receipt_no'") == 0)))

role("postgres"); truoc = {t: one(f"select count(*) from public.{t}") for t in ("buildings", "rooms", "tenants", "invoices", "payments", "support_messages", "audit_log")}
load("migration-staff-scope.sql")
print("  ok   chạy migration-staff-scope.sql không lỗi")
load("migration-staff-scope.sql")
print("  ok   chạy lần hai không lỗi")
role("postgres")
test("không mất dòng dữ liệu nào", lambda: expect({t: one(f"select count(*) from public.{t}") for t in truoc} == truoc))
test("phiếu thu có đủ cột: số phiếu, phòng, tên khách, người thu, giờ thu", lambda: expect(one(
    "select count(*) from information_schema.columns where table_name = 'payments' and column_name in ('receipt_no','room_code','tenant_name','created_by','created_at')") == 5))

# ---- phạm vi tòa ----
def chi_b1():
    for bang in ("rooms", "tenants", "invoices", "payments", "transactions"):
        expect(dem(bang, *NV1) == 1, f"{bang}: thấy {dem(bang, *NV1)} dòng")
        expect(dem(bang, *NV1, "where building_id = 'b2'") == 0, f"{bang}: thấy tòa b2")
    expect(dem("buildings", *NV1) == 1 and dem("buildings", *NV1, "where id = 'b1'") == 1)
test("nhân viên giao tòa b1: chỉ thấy dữ liệu tòa b1 (tòa, phòng, khách, hóa đơn, phiếu thu, thu chi)", chi_b1)
test("nhân viên không giới hạn tòa: thấy cả hai tòa của chủ mình, không thấy của chủ khác", lambda: (
    expect(dem("rooms", *NV2) == 2), expect(dem("buildings", *NV2) == 2)))
test("nhân viên đã khóa: không thấy gì", lambda: (expect(dem("rooms", *NV3) == 0), expect(dem("support_messages", *NV3) == 0)))
test("nhân viên của chủ khác: không thấy gì của chủ này", lambda: expect(dem("rooms", *NV4, f"where owner_id = '{A}'") == 0))
test("chủ trọ: vẫn thấy đủ (quyền chủ không đổi)", lambda: (expect(dem("rooms", *CHU) == 2), expect(dem("support_messages", *CHU) == 3), expect(dem("audit_log", *CHU) == 1)))

def ghi_b1():
    role("authenticated", *NV1)
    expect(conn.execute("update public.rooms set price = 2 where id = 'r-b1'").rowcount == 1, "sửa phòng tòa b1")
    expect(conn.execute("update public.rooms set price = 2 where id = 'r-b2'").rowcount == 0, "sửa được phòng tòa b2")
    # web lưu bằng upsert (insert ... on conflict do update)
    conn.execute("insert into public.invoices(owner_id, id, building_id, total) values (%s, 'HD-2611-001', 'b1', 120) on conflict (owner_id, id) do update set total = excluded.total", (A,))
    conn.execute("insert into public.invoices(owner_id, id, building_id, total) values (%s, 'HD-2611-008', 'b1', 90) on conflict (owner_id, id) do update set total = excluded.total", (A,))
    conn.execute("insert into public.buildings(owner_id, id, name) values (%s, 'b1', 'Nhà b1 mới') on conflict (owner_id, id) do update set name = excluded.name", (A,))
    role("postgres"); expect(one("select total from public.invoices where owner_id = %s and id = 'HD-2611-001'", (A,)) == 120)
    expect(one("select name from public.buildings where owner_id = %s and id = 'b1'", (A,)) == 'Nhà b1 mới')
test("nhân viên tòa b1: sửa, thêm, upsert (như web) được ở tòa b1, sửa tòa b2 thì 0 dòng", ghi_b1)
test("nhân viên tòa b1: thêm dòng vào tòa b2 bị chặn", lambda: (role("authenticated", *NV1), bi_chan(lambda: conn.execute(
    "insert into public.rooms(owner_id, id, building_id, code, price) values (%s, 'r-x', 'b2', 'P999', 1)", (A,)))))
test("nhân viên tòa b1: upsert trùng mã hóa đơn của tòa b2 bị chặn (không ghi đè hóa đơn tòa khác)", lambda: (
    role("authenticated", *NV1), bi_chan(lambda: conn.execute(
    "insert into public.invoices(owner_id, id, building_id, total) values (%s, 'HD-2611-007', 'b1', 1) on conflict (owner_id, id) do update set total = excluded.total", (A,))),
    role("postgres"), expect(one("select total from public.invoices where owner_id = %s and id = 'HD-2611-007'", (A,)) == 100)))
test("nhân viên tòa b1: ghi dữ liệu dưới tên chủ trọ khác bị chặn", lambda: (role("authenticated", *NV1), bi_chan(lambda: conn.execute(
    "insert into public.rooms(owner_id, id, building_id, code, price) values (%s, 'r-y', 'b1', 'P998', 1)", (B,)))))
def khong_xoa_toa():
    for nv in (NV1, NV2):
        role("authenticated", *nv); expect(conn.execute("delete from public.buildings").rowcount == 0, "nhân viên xóa được tòa")
    role("postgres"); expect(one("select count(*) from public.buildings where owner_id = %s", (A,)) == 2)
test("không nhân viên nào xóa được tòa nhà (kể cả không giới hạn tòa)", khong_xoa_toa)
test("nhân viên tòa b1: thêm tòa nhà mới bị chặn", lambda: (role("authenticated", *NV1), bi_chan(lambda: conn.execute(
    "insert into public.buildings(owner_id, id, name) values (%s, 'b9', 'Tòa lạ')", (A,)))))

# ---- tin nhắn của khách ----
def chat_b1():
    expect(dem("support_messages", *NV1) == 1, "thấy %s tin" % dem("support_messages", *NV1))
    expect(dem("support_messages", *NV1, "where id = 'ms-b1'") == 1)
    role("authenticated", *NV1)
    conn.execute("insert into public.support_messages(owner_id, id, building_id, tenant_phone, sender, staff_name, body, read_by_staff) values (%s, 'ms-tl', 'b1', '0921111700', 'staff', 'Nhân viên 1', 'Dạ em kiểm tra ạ', true) on conflict (owner_id, id) do update set body = excluded.body", (A,))
    expect(conn.execute("update public.support_messages set read_by_staff = true where id = 'ms-b1'").rowcount == 1)
    bi_chan(lambda: conn.execute("insert into public.support_messages(owner_id, id, building_id, tenant_phone, sender, body) values (%s, 'ms-x', 'b2', '0', 'staff', 'x')", (A,)))
test("tin nhắn: nhân viên có quyền Khách thuê đọc, trả lời, đánh dấu đã xem tin của tòa mình; tòa khác bị chặn", chat_b1)
test("tin nhắn: nhân viên không giới hạn tòa nhưng KHÔNG có quyền Khách thuê thì không đọc được", lambda: expect(dem("support_messages", *NV2) == 0))
def anh_chat():
    expect(dem("support_message_photos", *NV1) == 1, "thấy %s ảnh" % dem("support_message_photos", *NV1))
    role("authenticated", *NV1)
    conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, 'ms-moi-chua-luu', 0, 'data:image/jpeg;base64,AAAA')", (A,))
    role("authenticated", *NV2)
    bi_chan(lambda: conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, 'ms-z', 0, 'data:image/jpeg;base64,AAAA')", (A,)))
test("ảnh trong tin nhắn: xem ảnh tin tòa mình; gửi ảnh trước khi dòng tin kịp lưu vẫn được; không có quyền thì bị chặn", anh_chat)

# ---- nhật ký (với nhân viên, web lưu nhật ký và ảnh chat bằng INSERT thuần (trùng thì coi như xong): mọi INSERT ... ON CONFLICT (cột) đều đòi quyền XEM dòng đó) ----
def nhat_ky():
    role("authenticated", *NV1)
    conn.execute("insert into public.audit_log(owner_id, id, actor, action, message) values (%s, 'lg-nv1', 'Nhân viên 1', 'support.reply', 'Trả lời khách')", (A,))
    expect(one("select count(*) from public.audit_log") == 0, "nhân viên giới hạn tòa đọc được nhật ký")
    expect(conn.execute("delete from public.audit_log").rowcount == 0)
    expect(dem("audit_log", *NV2) == 2, "nhân viên không giới hạn tòa phải đọc được")
    role("authenticated", *NV2); expect(conn.execute("update public.audit_log set message = 'sửa'").rowcount == 0, "nhân viên sửa được nhật ký")
test("nhật ký: nhân viên ghi thêm được; giới hạn tòa thì không đọc; không ai sửa / xóa", nhat_ky)

# ---- đánh số không trùng ----
def ma():
    role("postgres"); conn.execute("update public.payments set receipt_no = 'PT-2611-009' where owner_id = %s and id = 'pm-b2'", (A,))
    role("authenticated", *NV1); r = one("select public.nv_ma_da_dung(%s)", (A,))
    expect("HD-2611-007" in r["hd"] and "PT-2611-009" in r["pt"], str(r))
    role("authenticated", *CHU); expect(one("select public.nv_ma_da_dung(%s)", (A,)) is not None)
    role("authenticated", *NV4); expect(one("select public.nv_ma_da_dung(%s)", (A,)) is None, "nhân viên chủ khác lấy được mã")
    role("authenticated", *NV3); expect(one("select public.nv_ma_da_dung(%s)", (A,)) is None, "nhân viên đã khóa lấy được mã")
    role("anon"); bi_chan(lambda: one("select public.nv_ma_da_dung(%s)", (A,)))
test("nv_ma_da_dung: nhân viên tòa b1 nhận cả mã của tòa b2 (chỉ mã); chủ khác, đã khóa, vô danh thì không", ma)
test("hàm kiểm quyền không cho vô danh gọi", lambda: (role("anon"), bi_chan(lambda: one("select public.nv_duoc_vao(%s, 'b1')", (A,)))))

print("\n%d đạt, %d hỏng" % (ok, hong))
conn.close()
sys.exit(1 if hong else 0)
