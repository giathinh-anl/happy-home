"""Kiểm thử khách chấm sao sau khi sửa xong (supabase/migration-incident-rating.sql) trên Postgres thật chạy tại máy.

Cách chạy: .venv-db/Scripts/python tests/db/incident-rating.test.py   (xem tenant-code-self.test.py để biết cách dựng .venv-db)
Biến HH_RATING_SQL trỏ tới một bản sửa của migration (thử phá). Thoát mã khác 0 nếu có ca hỏng.
"""
import os, pathlib, re, sys, tempfile, uuid
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
def role(r, sub=None):
    conn.execute("reset role"); conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (sub or "",))
    if r != "postgres": conn.execute(f"set role {r}")
def load(name, strip_ext=False):
    if name == "migration-incident-rating.sql" and os.environ.get("HH_RATING_SQL"):
        t = pathlib.Path(os.environ["HH_RATING_SQL"]).read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8") if name != "stubs.sql" else (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    if strip_ext: t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ)", t)
    try: conn.execute(t)
    except Exception as e: print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)

print("Nạp lược đồ và các migration")
for f in ["stubs.sql", "schema.sql", "migration-tenant-app.sql", "migration-tenant-app-v2.sql", "migration-claims-photos.sql",
          "migration-reading-photos.sql", "migration-support-chat.sql", "migration-staff-vehicles.sql", "migration-renewal.sql",
          "migration-late-fee.sql", "migration-invoice-batches.sql", "migration-incident-tracking.sql"]:
    load(f)
load("migration-tenant-auth.sql", strip_ext=True)
load("migration-incident-rating.sql")
print("  ok   toàn bộ tệp nạp không lỗi")
load("migration-incident-rating.sql")
print("  ok   chạy lần hai không lỗi")

A, B = str(uuid.uuid4()), str(uuid.uuid4())
for u, e in ((A, "a@x.vn"), (B, "b@x.vn")): conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
for o, t in ((A, "a"), (B, "b")):
    conn.execute("insert into public.buildings(owner_id, id, name) values (%s, 'b1', 'Nhà')", (o,))
    conn.execute("insert into public.rooms(owner_id, id, building_id, code, price) values (%s, 'r1', 'b1', 'P101', 1), (%s, 'r2', 'b1', 'P102', 1)", (o, o))
    conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) values (%s, %s, 'b1', 'P101', 'Khách ' || %s, %s, true)",
                 (o, "tn-" + t, t, "0921111700" if t == "a" else "0922222800"))
    conn.execute("insert into public.incidents(owner_id, id, building_id, room_code, title, status) values "
                 "(%s, 'i-done', 'b1', 'P101', 'Vòi nước', 'done'), (%s, 'i-open', 'b1', 'P101', 'Ổ cắm', 'open'), (%s, 'i-other', 'b1', 'P102', 'Cửa', 'done')", (o, o, o))
def issue(o, tid):
    role("authenticated", o); return one("select public.owner_issue_tenant_code(%s)", (tid,))["code"]
def login(phone, code):
    role("anon"); return one("select public.tenant_login(%s, %s)", (phone, code))["token"]
tok = login("0921111700", issue(A, "tn-a")); tokB = login("0922222800", issue(B, "tn-b"))
def rate(t, iid, stars, note=None):
    role("anon"); return one("select public.tenant_rate_incident(%s, %s, %s, %s)", (t, iid, stars, note))
def row(iid, o=A):
    role("postgres"); return conn.execute("select rating, rating_note, rated_at is not null from public.incidents where owner_id = %s and id = %s", (o, iid)).fetchone()

print("\nChấm sao")
test("token sai trả null (app hiểu là hết phiên)", lambda: expect(rate("x" * 40, "i-done", 5) is None))
test("sự cố đã hoàn tất của phòng mình: chấm được", lambda: expect(rate(tok, "i-done", 4, "Thợ nhanh, gọn") == {"ok": True}))
test("sao và nhận xét được ghi đúng, có giờ chấm", lambda: expect(row("i-done") == (4, "Thợ nhanh, gọn", True), row("i-done")))
test("chấm lại thì ghi đè", lambda: (rate(tok, "i-done", 2, "Lần sau còn rò"), expect(row("i-done")[:2] == (2, "Lần sau còn rò"))))
test("không nhận xét thì để trống (không lưu chuỗi rỗng)", lambda: (rate(tok, "i-done", 5, "   "), expect(row("i-done")[:2] == (5, None), row("i-done"))))
test("nhận xét cắt còn 300 ký tự", lambda: (rate(tok, "i-done", 5, "x" * 500), expect(len(row("i-done")[1]) == 300)))
test("sự cố chưa hoàn tất: báo not_done, không ghi", lambda: (expect(rate(tok, "i-open", 5) == {"error": "not_done"}), expect(row("i-open")[0] is None)))
test("sự cố của PHÒNG KHÁC: báo not_found", lambda: expect(rate(tok, "i-other", 1) == {"error": "not_found"}))
test("sự cố không tồn tại: báo not_found", lambda: expect(rate(tok, "i-khong-co", 3) == {"error": "not_found"}))
test("khách chủ B không chấm được sự cố của chủ A (trùng mã sự cố)", lambda: (expect(rate(tokB, "i-done", 1) == {"ok": True}), expect(row("i-done", A)[0] == 5, "sao của A bị đổi"), expect(row("i-done", B)[0] == 1)))
test("số sao ngoài 1 đến 5, rỗng: báo invalid", lambda: [expect(rate(tok, "i-done", s) == {"error": "invalid"}, str(s)) for s in (0, 6, -1, None)])
test("sao sai không làm đổi điểm đã chấm", lambda: expect(row("i-done")[0] == 5))

print("\nXem lại sao đã chấm")
def ratings(t): role("anon"); return one("select public.tenant_incident_ratings(%s)", (t,))
test("token sai trả null", lambda: expect(ratings("x" * 40) is None))
role("postgres"); conn.execute("update public.incidents set rating = 3, status = 'done' where owner_id = %s and id = 'i-other'", (A,))   # phòng khác cũng đã có sao
test("chỉ trả sự cố của phòng mình và đã có sao", lambda: (lambda r: expect(len(r) == 1 and r[0]["id"] == "i-done" and r[0]["rating"] == 5, r))(ratings(tok)))
test("khách chủ B chỉ thấy của mình", lambda: (lambda r: expect(len(r) == 1 and r[0]["rating"] == 1, r))(ratings(tokB)))

print("\nQuyền truy cập")
def t_check():
    role("postgres")
    try: conn.execute("update public.incidents set rating = 9 where id = 'i-done'"); raise AssertionError("cột cho phép 9 sao")
    except psycopg.errors.CheckViolation: pass
test("DB chặn số sao ngoài 1 đến 5 ngay ở bảng", t_check)
def t_anon_direct():
    role("anon")
    try: n = conn.execute("update public.incidents set rating = 5").rowcount
    except psycopg.errors.InsufficientPrivilege: n = 0
    expect(n == 0, f"anon sửa được {n} dòng")
test("anon không sửa trực tiếp bảng sự cố", t_anon_direct)

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
