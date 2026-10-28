"""Kiểm thử supabase/migration-renewal-history.sql trên Postgres thật chạy tại máy.

Cách chạy (cùng môi trường với tests/db/tenant-auth.test.py):
    .venv-db/Scripts/python tests/db/renewal-history.test.py
"""
import json, pathlib, sys, tempfile, uuid
import pgserver, psycopg

ROOT = pathlib.Path(__file__).resolve().parents[2]
ok = hong = 0
def test(ten, fn):
    global ok, hong
    try:
        fn(); ok += 1; print("  ok   " + ten)
    except Exception as e:                       # noqa
        hong += 1; print(" HONG  " + ten + "\n         " + str(e).splitlines()[0][:220])
def expect(cond, msg="sai"):
    if not cond: raise AssertionError(msg)

srv = pgserver.get_server(tempfile.mkdtemp(prefix="hhpg"), cleanup_mode="delete")
conn = psycopg.connect(srv.get_uri(), autocommit=True)
for f in (ROOT / "tests/db/stubs.sql", ROOT / "supabase/schema.sql"):
    conn.execute(f.read_text(encoding="utf-8"))
MIG = (ROOT / "supabase/migration-renewal-history.sql").read_text(encoding="utf-8")

O = str(uuid.uuid4())
conn.execute("insert into auth.users(id, email) values (%s, 'a@x.vn')", (O,))
conn.execute("insert into public.contracts(owner_id,id,building_id,rent,start_date,end_date) values (%s,'c-cu','b1',3000000,'2025-12-01','2026-11-30')", (O,))

conn.execute(MIG)
cot = lambda: conn.execute("select data_type, column_default from information_schema.columns where table_schema='public' and table_name='contracts' and column_name='renewal_history'").fetchone()

print("Cột lịch sử gia hạn")
test("có cột renewal_history kiểu jsonb", lambda: expect(cot() and cot()[0] == "jsonb", str(cot())))
test("hợp đồng có sẵn không bị đụng: ngày, giá vẫn nguyên", lambda: expect(
    conn.execute("select rent, end_date::text from public.contracts where id='c-cu'").fetchone() == (3000000, "2026-11-30")))
test("hợp đồng cũ có lịch sử mặc định là mảng rỗng", lambda: expect(conn.execute("select renewal_history::text from public.contracts where id='c-cu'").fetchone()[0] == "[]"))
test("chạy lại hai lần không lỗi", lambda: (conn.execute(MIG), conn.execute(MIG), expect(cot()[0] == "jsonb")))

print("Ghi và đọc đúng như app làm (upsert cả dòng)")
BAN = [{"id": "gh1", "at": "2026-10-28T03:00:00.000Z", "tuNgay": "2026-11-30", "denNgay": "2027-11-30", "soThang": 12, "giaCu": 3000000, "giaMoi": 3300000, "by": "Hoa"}]
def luu():
    conn.execute("insert into public.contracts(owner_id,id,building_id,rent,start_date,end_date,renewal_history) values (%s,'c-cu','b1',3300000,'2025-12-01','2027-11-30',%s::jsonb) "
                 "on conflict (owner_id,id) do update set rent=excluded.rent, end_date=excluded.end_date, renewal_history=excluded.renewal_history", (O, json.dumps(BAN)))
test("upsert gia hạn ghi lịch sử", luu)
test("đọc lại đúng từng trường", lambda: expect(conn.execute("select renewal_history from public.contracts where id='c-cu'").fetchone()[0] == BAN))
test("tiếng Việt trong tên người ghi giữ nguyên", lambda: (conn.execute("update public.contracts set renewal_history = jsonb_set(renewal_history, '{0,by}', '\"Nguyễn Thị Hòa\"') where id='c-cu'"),
    expect(conn.execute("select renewal_history->0->>'by' from public.contracts where id='c-cu'").fetchone()[0] == "Nguyễn Thị Hòa")))
test("gia hạn lần hai nối thêm dòng", lambda: (conn.execute("update public.contracts set renewal_history = renewal_history || %s::jsonb where id='c-cu'", (json.dumps([dict(BAN[0], id="gh2")]),)),
    expect(conn.execute("select jsonb_array_length(renewal_history) from public.contracts where id='c-cu'").fetchone()[0] == 2)))

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
