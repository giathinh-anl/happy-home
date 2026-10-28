"""Kiểm thử supabase/repair-invoice-dates.sql trên Postgres thật chạy tại máy.

Cách chạy (cùng môi trường với tests/db/tenant-auth.test.py):
    .venv-db/Scripts/python tests/db/repair-dates.test.py

Dữ liệu mẫu là đúng thứ bản web cũ đã ghi: nửa đêm giờ Việt Nam bị cắt thành ngày UTC, tức đầu kỳ lùi về ngày cuối
tháng trước, cuối kỳ và hạn đóng tiền sớm một ngày.
"""
import pathlib, re, sys, tempfile, uuid
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
SQL = (ROOT / "supabase/repair-invoice-dates.sql").read_text(encoding="utf-8")

O = str(uuid.uuid4())
conn.execute("insert into auth.users(id, email) values (%s, 'a@x.vn')", (O,))
def inv(id, period, ps, pe, dd):
    conn.execute("insert into public.invoices(owner_id, id, building_id, period, period_start, period_end, due_date, total, paid, status, lines) "
                 "values (%s, %s, 'b1', %s, %s, %s, %s, 1, 0, 'issued', '[]'::jsonb)", (O, id, period, ps, pe, dd))
def get(id):
    r = conn.execute("select period_start::text, period_end::text, due_date::text from public.invoices where id = %s", (id,)).fetchone()
    return r

# lệch (bản cũ)
inv("lech-thang10", "2026-10", "2026-09-30", "2026-10-30", "2026-11-04")
inv("lech-thang11", "2026-11", "2026-10-31", "2026-11-29", "2026-12-04")
inv("lech-thang3-thuong", "2027-03", "2027-02-28", "2027-03-30", "2027-04-04")
inv("lech-thang3-nhuan", "2028-03", "2028-02-29", "2028-03-30", "2028-04-04")
inv("lech-thang1-qua-nam", "2027-01", "2026-12-31", "2027-01-30", "2027-02-04")
inv("lech-thang2", "2027-02", "2027-01-31", "2027-02-27", "2027-03-04")
inv("lech-han-rieng", "2026-12", "2026-11-30", "2026-12-30", "2027-01-09")       # hợp đồng hạn 10 → 9
# đúng (bản mới hoặc nhập tay)
inv("dung-thang10", "2026-10", "2026-10-01", "2026-10-31", "2026-11-05")
inv("dung-thang2", "2027-02", "2027-02-01", "2027-02-28", "2027-03-05")
# thiếu ngày
inv("khong-ngay", "2026-10", None, None, None)
inv("chi-co-han", "2026-10", None, None, "2026-11-04")

def chay():
    conn.execute(SQL)

chay()
print("Hóa đơn bị lệch được dịch đúng một ngày")
test("kỳ 10/2026: 1/10 → 31/10, hạn 5/11", lambda: expect(get("lech-thang10") == ("2026-10-01", "2026-10-31", "2026-11-05"), str(get("lech-thang10"))))
test("kỳ 11/2026 (tháng trước có 31 ngày)", lambda: expect(get("lech-thang11") == ("2026-11-01", "2026-11-30", "2026-12-05"), str(get("lech-thang11"))))
test("kỳ 3/2027 (tháng 2 không nhuận)", lambda: expect(get("lech-thang3-thuong") == ("2027-03-01", "2027-03-31", "2027-04-05"), str(get("lech-thang3-thuong"))))
test("kỳ 3/2028 (tháng 2 nhuận, 29 ngày)", lambda: expect(get("lech-thang3-nhuan") == ("2028-03-01", "2028-03-31", "2028-04-05"), str(get("lech-thang3-nhuan"))))
test("kỳ 1/2027 (qua năm)", lambda: expect(get("lech-thang1-qua-nam") == ("2027-01-01", "2027-01-31", "2027-02-05"), str(get("lech-thang1-qua-nam"))))
test("kỳ 2/2027 (cuối kỳ 28)", lambda: expect(get("lech-thang2") == ("2027-02-01", "2027-02-28", "2027-03-05"), str(get("lech-thang2"))))
test("hạn riêng của hợp đồng (ngày 10) cũng dịch đúng một ngày", lambda: expect(get("lech-han-rieng") == ("2026-12-01", "2026-12-31", "2027-01-10"), str(get("lech-han-rieng"))))

print("Hóa đơn đúng hoặc thiếu ngày thì không bị đụng")
test("hóa đơn đã đúng giữ nguyên", lambda: expect(get("dung-thang10") == ("2026-10-01", "2026-10-31", "2026-11-05"), str(get("dung-thang10"))))
test("hóa đơn đã đúng (tháng 2) giữ nguyên", lambda: expect(get("dung-thang2") == ("2027-02-01", "2027-02-28", "2027-03-05"), str(get("dung-thang2"))))
test("thiếu cả ba ngày: giữ nguyên", lambda: expect(get("khong-ngay") == (None, None, None)))
test("chỉ có hạn, thiếu kỳ: không đoán, giữ nguyên", lambda: expect(get("chi-co-han") == (None, None, "2026-11-04"), str(get("chi-co-han"))))

print("Chạy lại an toàn")
truoc = conn.execute("select id, period_start, period_end, due_date from public.invoices order by id").fetchall()
chay(); chay()
sau = conn.execute("select id, period_start, period_end, due_date from public.invoices order by id").fetchall()
test("chạy thêm hai lần không dịch thêm ngày nào", lambda: expect(truoc == sau, "dữ liệu đổi sau lần chạy lại"))
test("sau khi sửa, số hóa đơn còn lệch bằng 0", lambda: expect(
    conn.execute("select count(*) from public.invoices where period_start is not null and period_end is not null "
                 "and period_start + 1 = date_trunc('month', period_start + 1)::date "
                 "and period_end + 1 = (date_trunc('month', period_end + 1) + interval '1 month - 1 day')::date").fetchone()[0] == 0))

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
