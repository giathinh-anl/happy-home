"""Kiểm thử supabase/migration-constraints.sql và supabase/audit-du-lieu.sql trên Postgres thật chạy tại máy.

Cách chạy (cùng môi trường với tests/db/tenant-auth.test.py):
    .venv-db/Scripts/python tests/db/constraints.test.py

Điểm cốt lõi cần giữ: dữ liệu CŨ đã bẩn không bị đụng, vẫn sửa được những thứ khác; chỉ dữ liệu mới / cột vừa được sửa mới bị kiểm.
Nên dữ liệu bẩn được chèn TRƯỚC khi cài migration (đúng như trên Supabase thật).
"""
import os, pathlib, sys, tempfile, uuid
import pgserver, psycopg
from psycopg import errors

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
MIG = pathlib.Path(os.environ.get("HH_CONSTRAINTS_SQL") or ROOT / "supabase/migration-constraints.sql").read_text(encoding="utf-8")   # biến môi trường: dùng khi thử phá
AUDIT = (ROOT / "supabase/audit-du-lieu.sql").read_text(encoding="utf-8")

O = str(uuid.uuid4())
conn.execute("insert into auth.users(id, email) values (%s, 'a@x.vn')", (O,))

def sql(q, *a):
    return conn.execute(q, a)
def bi_chan(q, *a, loi=None):
    """Câu lệnh phải bị từ chối bằng check_violation, kèm lời nhắn có chứa `loi` (nếu cho)."""
    try:
        conn.execute(q, a)
    except errors.CheckViolation as e:
        if loi: expect(loi in str(e), f"lời nhắn không có '{loi}': {e}")
        return
    raise AssertionError("đáng ra phải bị chặn mà vẫn qua")
def qua(q, *a):
    conn.execute(q, a)

# ---- Dữ liệu cũ đã bẩn, có TRƯỚC khi cài migration ----
sql("insert into public.rooms(owner_id,id,building_id,code,price,holding_deposit,area,status) values (%s,'r-cu','b1','101',-5,-1,-2,'vacant')", O)
sql("insert into public.tenants(owner_id,id,building_id,full_name,id_number,phone,occupants) values (%s,'t-cu','b1','Khach Cu','12345','abc',-1)", O)
sql("insert into public.contracts(owner_id,id,building_id,rent,deposit,start_date,end_date,billing_day) values (%s,'c-cu','b1',-1,-2,'2026-05-10','2026-05-01',0)", O)
sql("insert into public.services(owner_id,id,building_id,name,unit) values (%s,'s-cu','b1','Dien',-3)", O)
sql("insert into public.readings(owner_id,id,building_id,room_code,period,elec_prev,elec_curr) values (%s,'rd-cu','b1','101','2026-13',-1,-2)", O)
sql("insert into public.invoices(owner_id,id,building_id,period,period_start,period_end,paid,total) values (%s,'i-cu','b1','26-10','2026-10-31','2026-10-01',-9,100)", O)
sql("insert into public.payments(owner_id,id,amount) values (%s,'p-cu',-7)", O)

print("Kiểm tra dữ liệu hiện có (audit) chạy trước khi cài, chỉ đọc")
def audit():
    return {(r[0], r[1]): r[2] for r in conn.execute(AUDIT).fetchall()}
a = audit()
test("đếm đúng tổng số dòng", lambda: expect(a[("tổng số dòng", "rooms")] == 1 and a[("tổng số dòng", "payments")] == 1, str(a)))
for ten, bang in [("phòng: giá thuê âm", "rooms"), ("phòng: tiền giữ chỗ âm", "rooms"), ("phòng: diện tích âm", "rooms"),
                  ("khách: CCCD/CMND sai (không phải 9 hoặc 12 số)", "tenants"), ("khách: số điện thoại sai", "tenants"), ("khách: số người ở âm", "tenants"),
                  ("hợp đồng: giá thuê âm", "contracts"), ("hợp đồng: tiền cọc âm", "contracts"), ("hợp đồng: kết thúc trước bắt đầu", "contracts"),
                  ("hợp đồng: ngày chốt hóa đơn ngoài 1..31", "contracts"), ("dịch vụ: đơn giá âm", "services"),
                  ("chỉ số: điện kỳ trước âm", "readings"), ("chỉ số: điện âm", "readings"), ("chỉ số: kỳ sai dạng năm-tháng", "readings"),
                  ("hóa đơn: đã thu âm", "invoices"), ("hóa đơn: cuối kỳ trước đầu kỳ", "invoices"), ("hóa đơn: kỳ sai dạng năm-tháng", "invoices"),
                  ("thanh toán: số tiền âm", "payments")]:
    test("bắt dòng cũ bẩn: " + ten, lambda ten=ten, bang=bang: expect(a[(ten, bang)] == 1, f"{ten}={a.get((ten, bang))}"))
test("audit không sửa gì", lambda: expect(conn.execute("select price from public.rooms where id='r-cu'").fetchone()[0] == -5))

conn.execute(MIG)

print("Dữ liệu CŨ không bị đụng, vẫn sửa được thứ khác")
test("đổi trạng thái phòng có giá âm cũ: được", lambda: qua("update public.rooms set status='occupied' where id='r-cu'"))
test("đổi ghi chú khách có CCCD/điện thoại sai cũ: được", lambda: qua("update public.tenants set hometown='Ben Tre' where id='t-cu'"))
test("đổi trạng thái hợp đồng có ngày ngược cũ: được", lambda: qua("update public.contracts set status='active' where id='c-cu'"))
test("đổi chỉ số điện khác trên dòng có kỳ sai cũ: được", lambda: qua("update public.readings set source='tenant' where id='rd-cu'"))
test("đổi trạng thái hóa đơn có đã thu âm cũ: được", lambda: qua("update public.invoices set status='issued' where id='i-cu'"))
test("ghi lại đúng giá trị cũ (upsert cùng số) không bị chặn", lambda: qua(
    "insert into public.rooms(owner_id,id,building_id,code,price) values (%s,'r-cu','b1','101',-5) on conflict (owner_id,id) do update set price=excluded.price", O))
test("nhưng sửa cột bẩn sang giá trị bẩn KHÁC thì bị chặn", lambda: bi_chan("update public.rooms set price=-6 where id='r-cu'", loi="Giá thuê"))
test("dữ liệu cũ nguyên vẹn sau khi cài (không dòng nào bị sửa hộ)", lambda: expect(
    conn.execute("select count(*) from public.tenants where id_number='12345' and phone='abc' and occupants=-1").fetchone()[0] == 1))

print("Đường lưu thật của app: upsert (INSERT ... ON CONFLICT DO UPDATE) đè lên dòng cũ bẩn")
# (bảng, cột khóa, câu upsert giữ NGUYÊN giá trị bẩn cũ, chỉ đổi một cột khác)
UPSERT_CU = {
  "rooms": "insert into public.rooms(owner_id,id,building_id,code,price,holding_deposit,area,status) values (%s,'r-cu','b1','101',-5,-1,-2,'cleaning') on conflict (owner_id,id) do update set status=excluded.status, price=excluded.price, holding_deposit=excluded.holding_deposit, area=excluded.area",
  "tenants": "insert into public.tenants(owner_id,id,building_id,full_name,id_number,phone,occupants,hometown) values (%s,'t-cu','b1','Khach Cu','12345','abc',-1,'Hue') on conflict (owner_id,id) do update set hometown=excluded.hometown, id_number=excluded.id_number, phone=excluded.phone, occupants=excluded.occupants",
  "contracts": "insert into public.contracts(owner_id,id,building_id,rent,deposit,start_date,end_date,billing_day,status) values (%s,'c-cu','b1',-1,-2,'2026-05-10','2026-05-01',0,'terminated') on conflict (owner_id,id) do update set status=excluded.status, rent=excluded.rent, deposit=excluded.deposit, start_date=excluded.start_date, end_date=excluded.end_date, billing_day=excluded.billing_day",
  "services": "insert into public.services(owner_id,id,building_id,name,unit) values (%s,'s-cu','b1','Dien moi ten',-3) on conflict (owner_id,id) do update set name=excluded.name, unit=excluded.unit",
  "readings": "insert into public.readings(owner_id,id,building_id,room_code,period,elec_prev,elec_curr,approved) values (%s,'rd-cu','b1','101','2026-13',-1,-2,true) on conflict (owner_id,id) do update set approved=excluded.approved, period=excluded.period, elec_prev=excluded.elec_prev, elec_curr=excluded.elec_curr",
  "invoices": "insert into public.invoices(owner_id,id,building_id,period,period_start,period_end,paid,total,status) values (%s,'i-cu','b1','26-10','2026-10-31','2026-10-01',-9,100,'overdue') on conflict (owner_id,id) do update set status=excluded.status, period=excluded.period, period_start=excluded.period_start, period_end=excluded.period_end, paid=excluded.paid",
  "payments": "insert into public.payments(owner_id,id,amount,note) values (%s,'p-cu',-7,'ghi chu') on conflict (owner_id,id) do update set note=excluded.note, amount=excluded.amount",
}
for bang, q in UPSERT_CU.items():
    test(f"{bang}: lưu lại dòng cũ bẩn, chỉ đổi cột khác: được", lambda q=q: qua(q, O))
test("upsert dòng mới hoàn toàn mà có giá trị bẩn: vẫn bị chặn", lambda: bi_chan(
    "insert into public.rooms(owner_id,id,building_id,code,price) values (%s,'r-moi-bay','b1','900',-1) on conflict (owner_id,id) do update set price=excluded.price", O, loi="Giá thuê"))
test("upsert đè dòng cũ nhưng đổi cột bẩn sang giá trị bẩn khác: bị chặn", lambda: bi_chan(
    "insert into public.contracts(owner_id,id,building_id,rent,start_date,end_date) values (%s,'c-cu','b1',-1,'2026-05-10','2026-04-01') on conflict (owner_id,id) do update set end_date=excluded.end_date", O, loi="Ngày kết thúc"))
test("upsert lô nhiều dòng gồm cả dòng cũ bẩn (không đổi) lẫn dòng mới đúng: được", lambda: qua(
    "insert into public.rooms(owner_id,id,building_id,code,price,status) values (%s,'r-cu','b1','101',-5,'occupied'),(%s,'r-lo-moi','b1','910',2000000,'vacant') "
    "on conflict (owner_id,id) do update set price=excluded.price, status=excluded.status", O, O))
test("upsert sửa dòng cũ bẩn sang giá trị ĐÚNG: được", lambda: qua(
    "insert into public.rooms(owner_id,id,building_id,code,price) values (%s,'r-cu','b1','101',2500000) on conflict (owner_id,id) do update set price=excluded.price", O))
test("…và từ đó dòng này được kiểm như dòng bình thường", lambda: bi_chan(
    "insert into public.rooms(owner_id,id,building_id,code,price) values (%s,'r-cu','b1','101',-1) on conflict (owner_id,id) do update set price=excluded.price", O, loi="Giá thuê"))

print("Phòng")
test("thêm phòng hợp lệ", lambda: qua("insert into public.rooms(owner_id,id,building_id,code,price,holding_deposit,area) values (%s,'r1','b1','102',3000000,500000,20.5)", O))
test("thêm phòng giá 0 hợp lệ (phòng chưa niêm yết)", lambda: qua("insert into public.rooms(owner_id,id,building_id,code,price) values (%s,'r0','b1','103',0)", O))
test("thêm phòng không có giá (null) hợp lệ", lambda: qua("insert into public.rooms(owner_id,id,building_id,code,price) values (%s,'rn','b1','104',null)", O))
test("giá thuê âm bị chặn", lambda: bi_chan("insert into public.rooms(owner_id,id,building_id,code,price) values (%s,'rx','b1','105',-1)", O, loi="Giá thuê phòng không được âm"))
test("tiền giữ chỗ âm bị chặn", lambda: bi_chan("insert into public.rooms(owner_id,id,building_id,code,holding_deposit) values (%s,'rx','b1','105',-1)", O, loi="Tiền giữ chỗ"))
test("diện tích âm bị chặn", lambda: bi_chan("insert into public.rooms(owner_id,id,building_id,code,area) values (%s,'rx','b1','105',-0.5)", O, loi="Diện tích"))
test("sửa giá phòng thành số âm bị chặn", lambda: bi_chan("update public.rooms set price=-100 where id='r1'", loi="Giá thuê"))
test("sửa giá phòng thành số dương được", lambda: qua("update public.rooms set price=3500000 where id='r1'"))

print("Khách thuê")
def khach(id, cccd=None, phone=None, occ=1):
    return ("insert into public.tenants(owner_id,id,building_id,full_name,id_number,phone,occupants) values (%s,%s,'b1','Nguyen Van A',%s,%s,%s)", O, id, cccd, phone, occ)
for ten, cccd in [("CCCD 12 số", "079012345678"), ("CMND 9 số", "123456789"), ("CCCD có khoảng trắng", "079 012 345 678"), ("CCCD có dấu chấm", "079.012.345.678"),
                  ("CCCD bỏ trống (null)", None), ("CCCD rỗng", ""), ("CCCD toàn khoảng trắng", "   ")]:
    test("nhận: " + ten, lambda cccd=cccd, ten=ten: qua(*khach("k-" + ten, cccd=cccd)))
for ten, cccd in [("11 số", "07901234567"), ("10 số", "0790123456"), ("13 số", "0790123456789"), ("có chữ", "07901234567A"), ("8 số", "12345678")]:
    test("chặn CCCD " + ten, lambda cccd=cccd, ten=ten: bi_chan(*khach("kx-" + ten, cccd=cccd), loi="CCCD"))
for ten, p in [("0901234567", "0901234567"), ("+84901234567", "+84901234567"), ("84901234567", "84901234567"), ("có khoảng trắng", "090 123 4567"),
               ("có ngoặc và gạch", "(090) 123-4567"), ("có dấu chấm", "090.123.4567"), ("null", None), ("rỗng", "")]:
    test("nhận số điện thoại " + ten, lambda p=p, ten=ten: qua(*khach("p-" + ten, phone=p)))
for ten, p in [("thiếu 0 đầu (9 số)", "901234567"), ("11 số", "09012345678"), ("9 số bắt đầu 0", "090123456"), ("có chữ", "090123456a"), ("+84 thiếu số", "+8490123456"), ("+84 dư số", "+849012345678")]:
    test("chặn số điện thoại " + ten, lambda p=p, ten=ten: bi_chan(*khach("px-" + ten, phone=p), loi="di động"))
test("số người ở âm bị chặn", lambda: bi_chan(*khach("ox", occ=-1), loi="Số người"))
test("số người ở 0 được", lambda: qua(*khach("o0", occ=0)))
test("sửa CCCD khách sang số sai bị chặn", lambda: bi_chan("update public.tenants set id_number='123' where id='k-CCCD 12 số'", loi="CCCD"))
test("sửa khách mà không đụng CCCD/điện thoại: được kể cả khi CCCD cũ lạ dạng", lambda: qua("update public.tenants set occupation='Sinh vien' where id='k-CCCD có khoảng trắng'"))
test("sửa điện thoại sang số đúng được", lambda: qua("update public.tenants set phone='0912345678' where id='p-0901234567'"))

print("Hợp đồng")
def hd(id, **kw):
    c = dict(rent=3000000, deposit=3000000, start_date="2026-01-01", end_date="2026-12-31", billing_day=1); c.update(kw)
    return ("insert into public.contracts(owner_id,id,building_id,rent,deposit,start_date,end_date,billing_day) values (%s,%s,'b1',%s,%s,%s,%s,%s)",
            O, id, c["rent"], c["deposit"], c["start_date"], c["end_date"], c["billing_day"])
test("hợp đồng hợp lệ", lambda: qua(*hd("h1")))
test("kết thúc đúng ngày bắt đầu được (thanh lý trong ngày)", lambda: qua(*hd("h2", end_date="2026-01-01")))
test("thiếu ngày kết thúc (vô thời hạn) được", lambda: qua(*hd("h3", end_date=None)))
test("kết thúc trước bắt đầu bị chặn", lambda: bi_chan(*hd("hx", end_date="2025-12-31"), loi="Ngày kết thúc"))
test("giá thuê âm bị chặn", lambda: bi_chan(*hd("hx", rent=-1), loi="Giá thuê"))
test("tiền cọc âm bị chặn", lambda: bi_chan(*hd("hx", deposit=-1), loi="Tiền cọc"))
test("ngày chốt 0 bị chặn", lambda: bi_chan(*hd("hx", billing_day=0), loi="Ngày chốt"))
test("ngày chốt 32 bị chặn", lambda: bi_chan(*hd("hx", billing_day=32), loi="Ngày chốt"))
test("ngày chốt 31 được", lambda: qua(*hd("h31", billing_day=31)))
test("gia hạn (đẩy ngày kết thúc ra sau) được", lambda: qua("update public.contracts set end_date='2027-06-30' where id='h1'"))
test("rút ngày kết thúc trước ngày bắt đầu bị chặn", lambda: bi_chan("update public.contracts set end_date='2025-01-01' where id='h1'", loi="Ngày kết thúc"))
test("dời ngày bắt đầu ra sau ngày kết thúc bị chặn", lambda: bi_chan("update public.contracts set start_date='2030-01-01' where id='h1'", loi="Ngày kết thúc"))

print("Dịch vụ")
test("đơn giá hợp lệ", lambda: qua("insert into public.services(owner_id,id,building_id,name,unit) values (%s,'sv1','b1','Dien',3500)", O))
test("đơn giá âm bị chặn", lambda: bi_chan("insert into public.services(owner_id,id,building_id,name,unit) values (%s,'sv2','b1','Dien',-1)", O, loi="Đơn giá"))
test("sửa đơn giá âm bị chặn", lambda: bi_chan("update public.services set unit=-5 where id='sv1'", loi="Đơn giá"))

print("Chỉ số điện")
def cs(id, period="2026-10", prev=100, curr=200):
    return ("insert into public.readings(owner_id,id,building_id,room_code,period,elec_prev,elec_curr) values (%s,%s,'b1','101',%s,%s,%s)", O, id, period, prev, curr)
test("chỉ số hợp lệ", lambda: qua(*cs("c1")))
test("chỉ số 0 được (đồng hồ mới)", lambda: qua(*cs("c0", prev=0, curr=0)))
test("chỉ số chưa ghi (null) được", lambda: qua(*cs("cn", curr=None)))
test("chỉ số nhỏ hơn kỳ trước vẫn được (quay vòng / thay đồng hồ do app xử lý)", lambda: qua(*cs("cq", prev=9990, curr=10)))
test("chỉ số âm bị chặn", lambda: bi_chan(*cs("cx", curr=-1), loi="Chỉ số điện không được âm"))
test("chỉ số kỳ trước âm bị chặn", lambda: bi_chan(*cs("cx", prev=-1), loi="kỳ trước"))
for p in ["2026-13", "2026-00", "2026-1", "26-10", "2026/10", "2026-10-01", "abc"]:
    test("kỳ sai dạng bị chặn: " + p, lambda p=p: bi_chan(*cs("cx", period=p), loi="Kỳ chỉ số"))
for p in ["2026-01", "2026-12", "1999-06"]:
    test("kỳ đúng dạng được: " + p, lambda p=p: qua(*cs("cp" + p, period=p)))
test("kỳ để trống được", lambda: qua(*cs("cnp", period=None)))
test("khách tự gửi chỉ số (sửa curr hợp lệ) được", lambda: qua("update public.readings set elec_curr=250 where id='c1'"))
test("sửa chỉ số thành số âm bị chặn", lambda: bi_chan("update public.readings set elec_curr=-5 where id='c1'", loi="không được âm"))

print("Hóa đơn")
def hdon(id, **kw):
    c = dict(period="2026-10", ps="2026-10-01", pe="2026-10-31", paid=0, total=100); c.update(kw)
    return ("insert into public.invoices(owner_id,id,building_id,period,period_start,period_end,paid,total) values (%s,%s,'b1',%s,%s,%s,%s,%s)",
            O, id, c["period"], c["ps"], c["pe"], c["paid"], c["total"])
test("hóa đơn hợp lệ", lambda: qua(*hdon("v1")))
test("cuối kỳ trùng đầu kỳ được", lambda: qua(*hdon("v2", pe="2026-10-01")))
test("thiếu ngày (hóa đơn nháp cũ) được", lambda: qua(*hdon("v3", ps=None, pe=None)))
test("cuối kỳ trước đầu kỳ bị chặn", lambda: bi_chan(*hdon("vx", pe="2026-09-30"), loi="Cuối kỳ"))
test("đã thu âm bị chặn", lambda: bi_chan(*hdon("vx", paid=-1), loi="đã thu"))
test("kỳ sai dạng bị chặn", lambda: bi_chan(*hdon("vx", period="2026-14"), loi="Kỳ hóa đơn"))
test("thu tiền (paid tăng) được", lambda: qua("update public.invoices set paid=100, status='paid' where id='v1'"))
test("hoàn tác thu tiền về 0 được", lambda: qua("update public.invoices set paid=0 where id='v1'"))
test("sửa đã thu thành số âm bị chặn", lambda: bi_chan("update public.invoices set paid=-1 where id='v1'", loi="đã thu"))
test("job ban đêm cộng phí trễ hạn (sửa lines/total) không bị ảnh hưởng", lambda: qua("update public.invoices set total=105, lines='[{\"label\":\"phi\"}]'::jsonb where id='v1'"))
test("dời đầu kỳ ra sau cuối kỳ bị chặn", lambda: bi_chan("update public.invoices set period_start='2026-12-01' where id='v1'", loi="Cuối kỳ"))

print("Thanh toán")
test("thanh toán hợp lệ", lambda: qua("insert into public.payments(owner_id,id,amount) values (%s,'pm1',500000)", O))
test("thanh toán 0 đồng được", lambda: qua("insert into public.payments(owner_id,id,amount) values (%s,'pm0',0)", O))
test("thanh toán âm bị chặn", lambda: bi_chan("insert into public.payments(owner_id,id,amount) values (%s,'pmx',-1)", O, loi="Số tiền thanh toán"))
test("sửa thanh toán thành số âm bị chặn", lambda: bi_chan("update public.payments set amount=-10 where id='pm1'", loi="không được âm"))

print("Thêm nhiều dòng một lần: một dòng sai thì cả lô bị từ chối (app lưu theo lô, nên phải báo lỗi chứ không nuốt)")
def lo():
    try:
        conn.execute("insert into public.rooms(owner_id,id,building_id,code,price) values (%s,'b-ok','b1','201',1),(%s,'b-sai','b1','202',-1)", (O, O))
    except errors.CheckViolation:
        return
    raise AssertionError("lô có dòng sai mà vẫn qua")
test("lô có một dòng sai bị từ chối", lo)
test("và không dòng nào của lô đó được ghi", lambda: expect(conn.execute("select count(*) from public.rooms where id in ('b-ok','b-sai')").fetchone()[0] == 0))

print("Chạy lại an toàn + quyền")
trg = lambda: conn.execute("select count(*) from pg_trigger where tgname like 'hh_kiem_%' and not tgisinternal").fetchone()[0]
test("có đúng 7 trigger", lambda: expect(trg() == 7, str(trg())))
test("chạy lại migration hai lần không lỗi, vẫn đúng 7 trigger", lambda: (conn.execute(MIG), conn.execute(MIG), expect(trg() == 7, str(trg()))))
test("chạy lại không làm mất dữ liệu cũ", lambda: expect(conn.execute("select count(*) from public.tenants where id='t-cu' and id_number='12345'").fetchone()[0] == 1))
def hai_ham():
    n = conn.execute("select count(*) from information_schema.routine_privileges where routine_schema='public' and routine_name like 'hh_kiem_%' and grantee in ('anon','authenticated','PUBLIC')").fetchone()[0]
    expect(n == 0, f"còn {n} quyền gọi hàm kiểm cho anon/authenticated")
test("hàm trigger không cho anon/authenticated gọi trực tiếp", hai_ham)

def nhu_nguoi_dung():
    """Người dùng thật chạy bằng vai authenticated: trigger vẫn phải chạy dù đã thu hồi quyền gọi hàm."""
    conn.execute("set role authenticated")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (O,))
    try:
        conn.execute("insert into public.rooms(owner_id,id,building_id,code,price) values (%s,'u1','b1','301',1000000)", (O,))
        try:
            conn.execute("insert into public.rooms(owner_id,id,building_id,code,price) values (%s,'u2','b1','302',-1)", (O,))
        except errors.CheckViolation:
            return
        raise AssertionError("authenticated ghi giá âm mà vẫn qua")
    finally:
        conn.execute("reset role")
test("vai authenticated: ghi đúng được, ghi sai vẫn bị chặn (trigger chạy dù hàm đã thu hồi quyền)", nhu_nguoi_dung)

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
