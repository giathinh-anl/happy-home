"""Kiểm thử: giao dịch ngân hàng (bank_transactions) CHỈ chủ trọ xem được (supabase/migration-bank-owner-only.sql).

Dựng đúng trạng thái máy chủ thật trước 26/11/2026 (có quy tắc "bank_tx_staff" cho mọi nhân viên), thấy được lỗ hổng,
chạy tệp sửa rồi thử lại bằng vai nhân viên / chủ khác / khách vô danh. Webhook SePay (bank_ingest) vẫn phải ghi được.
Cách chạy: .venv-db/Scripts/python tests/db/bank-owner-only.test.py     Biến HH_BANK_OWNER_SQL trỏ tới bản sửa (thử phá).
"""
import os, pathlib, sys, tempfile, uuid
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
def load(name):
    if name == "migration-bank-owner-only.sql" and os.environ.get("HH_BANK_OWNER_SQL"):
        t = pathlib.Path(os.environ["HH_BANK_OWNER_SQL"]).read_text(encoding="utf-8")
    elif name == "stubs.sql":
        t = (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8")
    role("postgres")
    try: conn.execute(t)
    except Exception as e: print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)

print("Nạp lược đồ và các migration")
for f in ["stubs.sql", "schema.sql", "migration-staff-vehicles.sql", "migration-bank-reconcile.sql"]:
    load(f)

# Trạng thái máy chủ thật trước 26/11: quy tắc cũ cho MỌI nhân viên đang làm việc đọc/sửa giao dịch ngân hàng của chủ
role("postgres")
conn.execute("""create policy "bank_tx_staff" on public.bank_transactions
  for all using (exists (select 1 from public.staff s where s.owner_id = bank_transactions.owner_id
      and lower(s.email) = lower(auth.jwt() ->> 'email') and s.status = 'active'))
  with check (exists (select 1 from public.staff s where s.owner_id = bank_transactions.owner_id
      and lower(s.email) = lower(auth.jwt() ->> 'email') and s.status = 'active'))""")

A, B, NV, NV2 = (str(uuid.uuid4()) for _ in range(4))
for u, e in ((A, "a@x.vn"), (B, "b@x.vn"), (NV, "nv@x.vn"), (NV2, "nv2@x.vn")):
    conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
# NV: nhân viên đang làm, có cả quyền Thanh toán; NV2: nhân viên đã nghỉ
conn.execute("insert into public.staff(owner_id, id, email, full_name, permissions, status) values "
             "(%s, 'st1', 'nv@x.vn', 'Nhân viên', '[\"payments\",\"invoices\"]', 'active'), (%s, 'st2', 'nv2@x.vn', 'Đã nghỉ', '[]', 'disabled')", (A, A))
SEC_A, SEC_B = "a" * 64, "b" * 64
conn.execute("insert into public.bank_hooks(owner_id, secret) values (%s, %s), (%s, %s)", (A, SEC_A, B, SEC_B))
def ingest(secret, ref, amount, content):
    role("anon"); return one("select public.bank_ingest(%s, %s, %s, %s)", (secret, ref, amount, content))
ingest(SEC_A, "FT001", 3500000, "HD2611001 P101")                 # tiền phòng của khách
ingest(SEC_A, "FT002", 15000000, "ME CHUYEN TIEN AN TET")           # tiền riêng của chủ trọ
ingest(SEC_B, "FT900", 2000000, "HD2611900")                       # của chủ khác
def dem(r, sub=None, email=None):
    role(r, sub, email); return one("select count(*) from public.bank_transactions")

test("TRƯỚC khi sửa (giống máy chủ thật): nhân viên đọc được cả tiền riêng của chủ (lỗ hổng có thật)", lambda: (
    expect(dem("authenticated", NV, "nv@x.vn") == 2, "nhân viên thấy %s dòng" % dem("authenticated", NV, "nv@x.vn")),
    expect(one("select string_agg(content, ' | ' order by ref) from public.bank_transactions") .find("ME CHUYEN TIEN") >= 0)))

load("migration-bank-owner-only.sql")
print("  ok   chạy migration-bank-owner-only.sql không lỗi")

def pols():
    role("postgres"); return [r[0] for r in conn.execute("select policyname from pg_policies where schemaname='public' and tablename='bank_transactions' order by 1").fetchall()]
test("SAU khi sửa: chỉ còn quy tắc bank_tx_own", lambda: expect(pols() == ["bank_tx_own"], str(pols())))
test("chủ trọ vẫn thấy đủ giao dịch của mình (2), không thấy của chủ khác", lambda: expect(dem("authenticated", A, "a@x.vn") == 2))
test("nhân viên đang làm (kể cả có quyền Thanh toán) không thấy dòng nào", lambda: expect(dem("authenticated", NV, "nv@x.vn") == 0))
test("nhân viên đã nghỉ không thấy dòng nào", lambda: expect(dem("authenticated", NV2, "nv2@x.vn") == 0))
test("khách vô danh (anon) không đọc được", lambda: expect(dem("anon") == 0))
def nv_sua():
    role("authenticated", NV, "nv@x.vn")
    n = conn.execute("update public.bank_transactions set handled = true").rowcount
    expect(n == 0, "nhân viên sửa được %s dòng" % n)
    n = conn.execute("delete from public.bank_transactions").rowcount
    expect(n == 0, "nhân viên xóa được %s dòng" % n)
    try:
        conn.execute("insert into public.bank_transactions(owner_id, id, amount, content) values (%s, 'gia', 1, 'giả')", (A,))
    except psycopg.Error: return
    raise AssertionError("nhân viên chèn được giao dịch giả vào tài khoản chủ")
test("nhân viên không sửa, không xóa, không chèn được giao dịch của chủ", nv_sua)
def chu_sua():
    role("authenticated", A, "a@x.vn")
    expect(conn.execute("update public.bank_transactions set handled = true where ref = 'FT001'").rowcount == 1)
    role("postgres"); expect(one("select handled from public.bank_transactions where ref = 'FT001'") is True)
test("chủ trọ vẫn đánh dấu đã ghi thu được (việc tự khớp hóa đơn chạy trên máy chủ trọ)", chu_sua)
def webhook():
    ingest(SEC_A, "FT003", 3600000, "HD2611002")
    expect(dem("authenticated", A, "a@x.vn") == 3); expect(dem("authenticated", NV, "nv@x.vn") == 0)
test("webhook SePay (bank_ingest) vẫn ghi được; tiền mới về chủ thấy, nhân viên không", webhook)
def chay_lai():
    load("migration-bank-reconcile.sql"); load("migration-bank-owner-only.sql")
    expect(pols() == ["bank_tx_own"], "chạy lại tệp cũ đã mở lại quyền: " + str(pols()))
    expect(dem("authenticated", NV, "nv@x.vn") == 0)
test("chạy lại migration-bank-reconcile.sql (và tệp sửa) không mở lại quyền cho nhân viên", chay_lai)
role("postgres")
test("không mất dữ liệu: tổng số giao dịch vẫn 4", lambda: expect(one("select count(*) from public.bank_transactions") == 4))

print("\n%d đạt, %d hỏng" % (ok, hong))
conn.close(); srv.cleanup() if hasattr(srv, "cleanup") else None
sys.exit(1 if hong else 0)
