"""Kiểm thử supabase/migration-chat-fix.sql: tin nhân viên trả lời không bị mất ở app khách.

Lỗi thật 27/11: tin trả lời có created_at (do máy người trả lời ghi) SỚM hơn mốc lần hỏi trước của app khách (dòng tới máy chủ trễ vài giây
hoặc đồng hồ máy chậm) thì hàm cũ không trả tin đó nhưng vẫn đánh dấu "khách đã đọc": tin mất hẳn.
Cách chạy: .venv-db/Scripts/python tests/db/chat-fix.test.py     Biến HH_CHAT_FIX_SQL trỏ tới bản sửa (thử phá).
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
    if name == "migration-chat-fix.sql" and os.environ.get("HH_CHAT_FIX_SQL"):
        t = pathlib.Path(os.environ["HH_CHAT_FIX_SQL"]).read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8") if name != "stubs.sql" else (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    if strip_ext: t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ)", t)
    role("postgres")
    try: conn.execute(t)
    except Exception as e: print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)

print("Nạp lược đồ và các migration")
for f in ["stubs.sql", "schema.sql", "migration-tenant-app.sql", "migration-tenant-app-v2.sql", "migration-claims-photos.sql",
          "migration-reading-photos.sql", "migration-support-chat.sql", "migration-staff-vehicles.sql", "migration-renewal.sql",
          "migration-late-fee.sql", "migration-invoice-batches.sql", "migration-incident-tracking.sql"]:
    load(f)
load("migration-tenant-auth.sql", strip_ext=True)
load("migration-chat-photos.sql")

A = str(uuid.uuid4())
conn.execute("insert into auth.users(id, email) values (%s, 'a@x.vn')", (A,))
conn.execute("insert into public.buildings(owner_id, id, name) values (%s, 'b2', 'Nhà')", (A,))
conn.execute("insert into public.rooms(owner_id, id, building_id, code, price) values (%s, 'r1', 'b2', 'P104', 1)", (A,))
conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) values (%s, 'tn1', 'b2', 'P104', 'Khách Thử', '0926000848', true)", (A,))
role("authenticated", A); code = one("select public.owner_issue_tenant_code('tn1')")["code"]
role("anon"); tok = one("select public.tenant_login('0926000848', %s)", (code,))["token"]

def gui_khach(body):
    role("anon"); return one("select public.tenant_send_message(%s, %s)", (tok, body))
def hoi(p_after):
    role("anon"); return one("select public.tenant_messages(%s, %s)", (tok, p_after))
def tra_loi(mid, body, lui_giay):
    """Nhân viên trả lời: created_at do MÁY người trả lời ghi, ở đây cũ hơn giờ máy chủ lui_giay giây (dòng tới trễ / đồng hồ chậm)"""
    role("postgres")
    conn.execute("insert into public.support_messages(owner_id, id, building_id, room_code, tenant_phone, tenant_name, sender, staff_name, body, created_at, read_by_staff, read_by_tenant) "
                 "values (%s, %s, 'b2', 'P104', '0926000848', 'Khách Thử', 'staff', 'Thùy Dung', %s, now() - make_interval(secs => %s), true, false)", (A, mid, body, lui_giay))
def ids(r): return [m["id"] for m in r["messages"] if m["sender"] == "staff"]

gui_khach("tôi cần nhân viên trả lời")
moc = hoi(None)["now"]                        # app khách hỏi lần đầu, nhớ mốc
tra_loi("ms-cu", "dạ chị cần gì ạ", 5)         # tin trả lời tới trễ: giờ ghi trên tin SỚM hơn mốc
test("TRƯỚC khi sửa: tin trả lời tới trễ bị bỏ qua mà vẫn bị đánh dấu đã đọc (mất hẳn — đúng lỗi thật)", lambda: (
    expect(ids(hoi(moc)) == [], "hàm cũ đã trả tin này?"),
    role("postgres"), expect(one("select read_by_tenant from public.support_messages where id = 'ms-cu'") is True)))

load("migration-chat-fix.sql")
print("  ok   chạy migration-chat-fix.sql không lỗi")
load("migration-chat-fix.sql")
print("  ok   chạy lần hai không lỗi")

def tre():
    m1 = hoi(None)["now"]
    tra_loi("ms-tre", "alo chị ơi", 5)
    expect(ids(hoi(m1)) == ["ms-tre"], "khách không nhận được tin tới trễ")
def lech_gio():
    m1 = hoi(None)["now"]
    tra_loi("ms-lech", "đồng hồ máy chậm 10 phút", 600)
    expect(ids(hoi(m1)) == ["ms-lech"])
def khong_lap():
    m1 = hoi(None)["now"]
    tra_loi("ms-1lan", "chỉ một lần", 3)
    r1 = hoi(m1); m2 = r1["now"]
    expect(ids(r1) == ["ms-1lan"])
    expect(ids(hoi(m2)) == [], "tin đã đọc lại được trả lần nữa")
def binh_thuong():
    m1 = hoi(None)["now"]
    role("postgres"); conn.execute("select pg_sleep(0.05)")
    tra_loi("ms-moi", "tin bình thường", -1)    # giờ ghi SAU mốc như bình thường
    expect(ids(hoi(m1)) == ["ms-moi"])
def lich_su():
    r = hoi(None)
    expect(any(m["sender"] == "tenant" for m in r["messages"]) and "ms-cu" in ids(r), "hỏi lần đầu phải trả cả lịch sử")
test("SAU khi sửa: tin trả lời tới trễ vài giây vẫn tới khách", tre)
test("SAU khi sửa: máy người trả lời chậm đồng hồ 10 phút vẫn tới khách", lech_gio)
test("không lặp: tin đã trả một lần thì lần hỏi sau không trả lại", khong_lap)
test("tin bình thường (giờ sau mốc) vẫn tới như cũ", binh_thuong)
test("hỏi lần đầu (không mốc) vẫn trả cả lịch sử", lich_su)
test("khách khác / token sai không nhận gì", lambda: (role("anon"), expect(one("select public.tenant_messages('token-sai', null)") is None)))

print("\n%d đạt, %d hỏng" % (ok, hong))
conn.close()
sys.exit(1 if hong else 0)
