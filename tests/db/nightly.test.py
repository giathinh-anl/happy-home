"""Kiểm thử supabase/migration-nightly.sql (phí trễ hạn + nhắc nợ chạy ban đêm) trên Postgres thật chạy tại máy.

Cách chạy (cùng môi trường với tests/db/tenant-auth.test.py):
    .venv-db/Scripts/python tests/db/nightly.test.py

Ngày giả 20/10/2026 truyền vào hh_nightly(p_today) nên kết quả không phụ thuộc ngày chạy thật. Các ca phí lấy lại
đúng những ca trong tests/reminders.test.js để chắc luật bên SQL khớp luật bên JS.
Biến HH_NIGHTLY_SQL trỏ tới một bản migration khác (dùng khi thử phá luật).
"""
import os, pathlib, re, sys, tempfile, uuid, datetime
import pgserver, psycopg

ROOT = pathlib.Path(__file__).resolve().parents[2]
SQL = ROOT / "supabase"

ok = hong = 0
def test(ten, fn):
    global ok, hong
    try:
        fn(); ok += 1; print("  ok   " + ten)
    except Exception as e:                       # noqa
        hong += 1; print(" HONG  " + ten + "\n         " + str(e).splitlines()[0][:240])
def expect(cond, msg="sai"):
    if not cond: raise AssertionError(msg)

srv = pgserver.get_server(tempfile.mkdtemp(prefix="hhpg"), cleanup_mode="delete")
conn = psycopg.connect(srv.get_uri(), autocommit=True)
def run(sql): conn.execute(sql)
def one(sql, params=None):
    r = conn.execute(sql, params).fetchone()
    return r[0] if r else None
def role(r, sub=None):
    conn.execute("reset role")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (sub or "",))
    if r != "postgres": conn.execute(f"set role {r}")
def denied(fn):
    try: fn()
    except psycopg.errors.InsufficientPrivilege: return True
    except psycopg.errors.Error as e: raise AssertionError("lỗi khác quyền: " + str(e).splitlines()[0])
    raise AssertionError("đáng lẽ bị từ chối nhưng chạy được")

def load(name, strip_ext=False):
    if name == "migration-nightly.sql" and os.environ.get("HH_NIGHTLY_SQL"):
        t = pathlib.Path(os.environ["HH_NIGHTLY_SQL"]).read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8") if name != "stubs.sql" else (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    if strip_ext:
        t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ) pgcrypto: dùng bản giả", t)
    try: run(t)
    except Exception as e:
        print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)

print("Nạp lược đồ và các migration")
for f in ["stubs.sql", "schema.sql", "migration-tenant-app.sql", "migration-tenant-app-v2.sql", "migration-claims-photos.sql",
          "migration-reading-photos.sql", "migration-support-chat.sql", "migration-staff-vehicles.sql",
          "migration-renewal.sql", "migration-late-fee.sql", "migration-invoice-batches.sql"]:
    load(f)
load("migration-tenant-auth.sql", strip_ext=True)
load("migration-nightly.sql")
print("  ok   toàn bộ tệp nạp không lỗi")
load("migration-nightly.sql")
print("  ok   chạy migration-nightly.sql lần hai không lỗi")

HN = datetime.date(2026, 10, 20)
def ngay(tre): return HN - datetime.timedelta(days=tre)         # hạn cách hôm nay `tre` ngày (tre > 0: đã quá hạn)

A, B = str(uuid.uuid4()), str(uuid.uuid4())
for u, e in ((A, "a@x.vn"), (B, "b@x.vn")):
    conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
    conn.execute("insert into public.buildings(owner_id, id, name, late_fee_per_day, late_grace_days, late_fee_auto, auto_remind) "
                 "values (%s, 'b1', 'Tòa 1', 20000, 3, %s, %s)", (u, u == A, u == A))
# tòa 2 của A: không bật gì; tòa 3 của A: chỉ bật nhắc, không phí
conn.execute("insert into public.buildings(owner_id, id, name, late_fee_per_day, late_grace_days, late_fee_auto, auto_remind) "
             "values (%s, 'b2', 'Tòa 2', 20000, 3, false, false), (%s, 'b3', 'Tòa 3', 20000, 3, false, true)", (A, A))

import json
def hd(owner, id, room, tre, total=1000000, paid=0, status="issued", bid="b1", lines=None, locked=False, period="2026-10"):
    ls = lines if lines is not None else [{"label": "Tiền phòng", "amount": total, "type": "rent"}]
    conn.execute("insert into public.invoices(owner_id, id, building_id, room_code, tenant_name, period, due_date, total, paid, status, lines, late_fee_locked) "
                 "values (%s, %s, %s, %s, 'Khách', %s, %s, %s, %s, %s, %s::jsonb, %s)",
                 (owner, id, bid, room, period, ngay(tre), total, paid, status, json.dumps(ls), locked))

hd(A, "sap", "P1", -2)
hd(A, "tre2", "P2", 2)
hd(A, "tre3", "P3", 3)
hd(A, "tre4", "P4", 4)
hd(A, "tre7", "P5", 7)
hd(A, "tre60", "P6", 60)
hd(A, "xa", "P7", -10)
hd(A, "datra", "P8", 20, paid=1000000, status="paid")
hd(A, "huy", "P9", 20, status="cancelled")
hd(A, "nhap", "P10", 20, status="draft")
hd(A, "khoa", "P11", 20, locked=True)
hd(A, "cuphi", "P12", 10, total=1050000, lines=[{"label": "Tiền phòng", "amount": 1000000, "type": "rent"}, {"label": "Phí trễ hạn", "amount": 50000, "type": "latefee"}], status="overdue")
hd(A, "phicao", "P13", 5, total=1100000, lines=[{"label": "Tiền phòng", "amount": 1000000, "type": "rent"}, {"label": "Phí trễ hạn", "amount": 100000, "type": "latefee"}], status="overdue")
hd(A, "mot-phan", "P14", 5, paid=500000, status="partial")
hd(A, "sai-trang-thai", "P15", -2, status="overdue")
hd(A, "khong-dong", "P16", 5, lines=[])                                 # hóa đơn không có dòng chi tiết: tiền gốc = tổng
hd(A, "xa4", "P17", -4)                                                 # còn 4 ngày: chưa nhắc
hd(A, "tre8", "P18", 8)
hd(A, "da-du-tt", "P19", 20, paid=1000000, status="partial")           # đã trả đủ nhưng trạng thái còn cũ: không còn nợ, không đụng
conn.execute("insert into public.buildings(owner_id, id, name, late_fee_per_day, late_grace_days, late_fee_auto, auto_remind) values (%s, 'b4', 'Tòa 4', 20000, 3, true, false)", (A,))
hd(A, "b4-tre", "S1", 5, bid="b4")                                      # tòa chỉ bật phí, tắt nhắc
hd(A, "b2-tre", "Q1", 30, bid="b2")
hd(A, "b3-tre", "R1", 30, bid="b3")
hd(B, "b-tre", "P4", 30)                                                  # chủ khác, tòa tắt cả hai: không ảnh hưởng
hd(B, "b-tre2", "P2", 2)                                                  # chủ khác (bật cờ nhưng sau đây ta tắt) – xem bên dưới
conn.execute("update public.buildings set late_fee_auto = false, auto_remind = false where owner_id = %s", (B,))

def inv(id):
    r = conn.execute("select total, paid, status, lines, edited_by from public.invoices where id = %s", (id,)).fetchone()
    return {"total": r[0], "paid": r[1], "status": r[2], "lines": r[3], "by": r[4]}
def fee(id):
    return sum(l["amount"] for l in inv(id)["lines"] if l.get("type") == "latefee")
def notices(id=None, owner=A):
    q = "select kind, title, body from public.tenant_notices where owner_id = %s" + (" and invoice_id = %s" if id else "") + " order by created_at, id"
    return conn.execute(q, (owner, id) if id else (owner,)).fetchall()

print("Luật phí (khớp tests/reminders.test.js)")
fl = lambda goc, tre, moi=20000, mien=3: one("select public._late_fee(%s, %s, %s, %s)", (goc, tre, moi, mien))
test("mặc định tắt: không phí dù trễ lâu", lambda: expect(fl(1000000, 30, 0) == 0))
test("trong 3 ngày miễn phí thì chưa tính", lambda: expect(fl(1000000, 3) == 0))
test("trễ 4 ngày: tính 1 ngày = 20.000", lambda: expect(fl(1000000, 4) == 20000))
test("trễ 7 ngày: tính 4 ngày = 80.000", lambda: expect(fl(1000000, 7) == 80000))
test("chưa quá hạn thì không phí", lambda: expect(fl(1000000, -2) == 0))
test("phí không vượt 10% tiền gốc", lambda: expect(fl(1000000, 60) == 100000))
test("đúng bằng trần: 2 ngày × 50.000 = 100.000", lambda: expect(fl(1000000, 5, 50000, 3) == 100000))
test("số ngày miễn phí 0 thì tính từ ngày đầu", lambda: expect(fl(1000000, 2, 10000, 0) == 20000))
test("trong ngày miễn phí không bao giờ ra số âm (trễ 1 và 2 ngày)", lambda: expect(fl(1000000, 1) == 0 and fl(1000000, 2) == 0))
test("trần làm tròn xuống: 3.333.333 → 333.333", lambda: expect(fl(3333333, 400) == 333333))

print("Mức nhắc và ngày Việt Nam")
lv = lambda n: one("select public._remind_level(%s)", (n,))
test("còn 4 ngày chưa nhắc, còn 3 ngày là sắp hạn, đúng hạn vẫn sắp hạn", lambda: expect((lv(-4), lv(-3), lv(0)) == (None, "sap-han", "sap-han")))
test("quá 1-3 ngày nhắc nhẹ, 4-7 có phí, từ 8 khẩn", lambda: expect([lv(n) for n in (1, 3, 4, 7, 8, 400)] == ["nhac-nhe", "nhac-nhe", "nhac-phi", "nhac-phi", "khan", "khan"]))
vt = lambda ts: str(one("select public._vn_today(%s::timestamptz)", (ts,)))
test("16:59 UTC vẫn là hôm nay ở Việt Nam, 17:00 UTC đã sang ngày mai", lambda: expect((vt("2026-10-20 16:59:59+00"), vt("2026-10-20 17:00:00+00")) == ("2026-10-20", "2026-10-21")))
test("0 giờ 30 sáng giờ Việt Nam (17:30 UTC hôm trước) tính là ngày mới", lambda: expect(vt("2026-12-31 17:30:00+00") == "2027-01-01"))

print("Quyền")
role("anon")
test("anon không gọi được hh_nightly", lambda: denied(lambda: conn.execute("select public.hh_nightly(null)")))
test("anon không gọi được owner_run_nightly", lambda: denied(lambda: conn.execute("select public.owner_run_nightly()")))
test("anon không đọc được tenant_notices", lambda: denied(lambda: conn.execute("select * from public.tenant_notices")))
role("authenticated", A)
test("chủ trọ không gọi trực tiếp hh_nightly (tránh chọn ngày giả hoặc chạy cho người khác)", lambda: denied(lambda: conn.execute("select public.hh_nightly(null)")))
test("chủ trọ không ghi được thông báo giả", lambda: denied(lambda: conn.execute(
    "insert into public.tenant_notices(owner_id, id, building_id, room_code, kind, dedupe_key, title, body) values (%s,'x','b1','P1','khan','k','t','b')", (A,))))
role("postgres")

print("Chạy đêm 20/10/2026")
kq = conn.execute("select public.hh_nightly(null, %s)", (HN,)).fetchone()[0]
test("tóm tắt trả về số tòa đã xử lý (b1, b3, b4 của A)", lambda: expect(kq["buildings"] == 3, str(kq)))
test("trễ 4 ngày: ghi phí 20.000, tổng 1.020.000, trạng thái quá hạn", lambda: expect(fee("tre4") == 20000 and inv("tre4")["total"] == 1020000 and inv("tre4")["status"] == "overdue", str(inv("tre4"))))
test("trễ 7 ngày: phí 80.000", lambda: expect(fee("tre7") == 80000 and inv("tre7")["total"] == 1080000))
test("trễ 60 ngày: chạm trần 100.000", lambda: expect(fee("tre60") == 100000 and inv("tre60")["total"] == 1100000))
test("dòng phí có ghi chú rõ cách tính", lambda: expect("tự động" in [l for l in inv("tre60")["lines"] if l["type"] == "latefee"][0]["meta"] and "chạm trần" in [l for l in inv("tre60")["lines"] if l["type"] == "latefee"][0]["meta"]))
test("trong 3 ngày miễn phí: không có dòng phí", lambda: expect(fee("tre3") == 0 and inv("tre3")["total"] == 1000000))
test("chưa tới hạn: không phí", lambda: expect(fee("sap") == 0 and fee("xa") == 0))
test("hóa đơn đã trả đủ không bị đụng", lambda: expect(inv("datra")["total"] == 1000000 and fee("datra") == 0 and inv("datra")["by"] is None))
test("hóa đơn đã hủy / nháp không bị đụng", lambda: expect(fee("huy") == 0 and fee("nhap") == 0 and inv("nhap")["status"] == "draft" and inv("huy")["status"] == "cancelled"))
test("hóa đơn chủ trọ đã tự chỉnh (khóa) không bị ghi phí", lambda: expect(fee("khoa") == 0 and inv("khoa")["total"] == 1000000))
test("phí cũ thấp hơn được nâng lên mức mới, không cộng dồn: 50.000 → 100.000", lambda: expect(fee("cuphi") == 100000 and inv("cuphi")["total"] == 1100000 and len([l for l in inv("cuphi")["lines"] if l["type"] == "latefee"]) == 1, str(inv("cuphi"))))
test("phí đã ghi CAO hơn mức tính lại thì không bao giờ tự giảm", lambda: expect(fee("phicao") == 100000 and inv("phicao")["total"] == 1100000))
test("trả một phần: phí tính trên tiền gốc, số đã trả giữ nguyên", lambda: expect(fee("mot-phan") == 40000 and inv("mot-phan")["paid"] == 500000 and inv("mot-phan")["total"] == 1040000 and inv("mot-phan")["status"] == "overdue", str(inv("mot-phan"))))
test("hóa đơn không có dòng chi tiết: tiền gốc là tổng, vẫn ghi phí", lambda: expect(fee("khong-dong") == 40000 and inv("khong-dong")["total"] == 1040000, str(inv("khong-dong"))))
test("tiền gốc giữ nguyên dòng cũ khi thêm phí (thứ tự dòng không đổi)", lambda: expect([l["type"] for l in inv("tre4")["lines"]] == ["rent", "latefee"]))
test("ghi nhận người sửa là hệ thống ban đêm", lambda: expect(inv("tre4")["by"] == "Tự động (ban đêm)"))
test("tòa chưa bật phí tự động (b3 chỉ bật nhắc): không ghi phí", lambda: expect(fee("b3-tre") == 0 and inv("b3-tre")["total"] == 1000000))
test("hóa đơn đã trả đủ nhưng còn mang trạng thái cũ: không ghi phí, không đổi", lambda: expect(fee("da-du-tt") == 0 and inv("da-du-tt")["total"] == 1000000 and inv("da-du-tt")["status"] == "partial"))
test("tòa chỉ bật phí (b4): vẫn ghi phí 40.000 (trễ 5 ngày, 2 ngày tính)", lambda: expect(fee("b4-tre") == 40000, str(inv("b4-tre"))))
test("tòa tắt hẳn (b2) và chủ khác (B) không bị đụng", lambda: expect(fee("b2-tre") == 0 and fee("b-tre") == 0 and inv("b-tre")["status"] == "issued"))

print("Trạng thái theo ngày")
test("quá hạn mà chưa đổi trạng thái thì đổi sang overdue", lambda: expect(inv("tre2")["status"] == "overdue"))
test("trạng thái 'quá hạn' nhưng hạn còn 2 ngày thì về lại 'đã phát hành'", lambda: expect(inv("sai-trang-thai")["status"] == "issued"))
test("hóa đơn chưa tới hạn giữ nguyên", lambda: expect(inv("sap")["status"] == "issued"))
test("hóa đơn nhắc nhưng chưa tính phí (tre3) vẫn được đánh dấu quá hạn", lambda: expect(inv("tre3")["status"] == "overdue"))

print("Thông báo vào app khách")
test("sắp hạn: có thông báo, ghi rõ còn 2 ngày", lambda: expect(len(notices("sap")) == 1 and notices("sap")[0][0] == "sap-han" and "còn 2 ngày" in notices("sap")[0][2], str(notices("sap"))))
test("hạn hôm nay: ghi 'hôm nay'", lambda: (hd(A, "homnay", "P20", 0), conn.execute("select public.hh_nightly(null, %s)", (HN,)), expect("hôm nay" in notices("homnay")[0][2], str(notices("homnay")))))
test("quá hạn 2 ngày: nhắc nhẹ", lambda: expect(notices("tre2")[0][0] == "nhac-nhe"))
test("quá hạn 4 ngày: có phí, thông báo nói đã gồm phí và đúng tổng tiền", lambda: expect(notices("tre4")[0][0] == "nhac-phi" and "đã gồm phí" in notices("tre4")[0][2] and "1.020.000 ₫" in notices("tre4")[0][2], str(notices("tre4"))))
test("quá hạn 60 ngày: khẩn", lambda: expect(notices("tre60")[0][0] == "khan"))
test("còn xa hạn: không thông báo", lambda: expect(not notices("xa")))
test("đã trả đủ / hủy / nháp: không thông báo", lambda: expect(not notices("datra") and not notices("huy") and not notices("nhap")))
test("hóa đơn bị khóa phí vẫn được nhắc (khóa chỉ về phí)", lambda: expect(len(notices("khoa")) == 1))
test("tòa chỉ bật nhắc (b3) vẫn gửi thông báo", lambda: expect(len(notices("b3-tre")) == 1))
test("còn 4 ngày tới hạn: chưa nhắc", lambda: expect(not notices("xa4")))
test("quá hạn đúng 7 ngày là mức có phí, đúng 8 ngày mới là khẩn", lambda: expect(notices("tre7")[0][0] == "nhac-phi" and notices("tre8")[0][0] == "khan", str((notices("tre7"), notices("tre8")))))
test("hóa đơn đã trả đủ nhưng trạng thái cũ: không thông báo", lambda: expect(not notices("da-du-tt")))
test("tòa chỉ bật phí, tắt nhắc (b4): không gửi thông báo", lambda: expect(not notices("b4-tre")))
test("tòa tắt và chủ khác: không thông báo", lambda: expect(not notices("b2-tre") and not notices("b-tre", B) and not notices("b-tre2", B)))

print("Chạy lại và các đêm sau")
dem = lambda: one("select count(*) from public.tenant_notices")
truoc_tn, truoc_tong = dem(), inv("tre4")["total"]
kq2 = conn.execute("select public.hh_nightly(null, %s)", (HN,)).fetchone()[0]
test("chạy lại cùng ngày: không thêm thông báo", lambda: expect(dem() == truoc_tn and kq2["notices"] == 0, str(kq2)))
test("chạy lại cùng ngày: không đổi phí, không ghi thêm", lambda: expect(inv("tre4")["total"] == truoc_tong and kq2["fees"] == 0 and kq2["statuses"] == 0, str(kq2)))
conn.execute("select public.hh_nightly(null, %s)", (HN + datetime.timedelta(days=1),))
test("đêm sau: phí tăng thêm 1 ngày (trễ 5 ngày = 40.000)", lambda: expect(fee("tre4") == 40000 and inv("tre4")["total"] == 1040000, str(inv("tre4"))))
test("đêm sau: vẫn cùng mức nhắc thì không gửi thêm (tre2 thành 3 ngày)", lambda: expect(len(notices("tre2")) == 1))
test("đêm sau: hóa đơn tre3 lên 4 ngày, sang mức có phí nên có thông báo mới", lambda: expect([n[0] for n in notices("tre3")] == ["nhac-nhe", "nhac-phi"], str(notices("tre3"))))
for d in (8, 9, 14):
    conn.execute("select public.hh_nightly(null, %s)", (HN + datetime.timedelta(days=d),))
test("mức khẩn nhắc lại mỗi tuần, không mỗi ngày (tre4 trễ từ 4 đến 18 ngày)", lambda: expect(len([n for n in notices("tre4") if n[0] == "khan"]) == 2, str(notices("tre4"))))

print("Ngày mặc định")
vn = lambda: (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=7)).date().isoformat()
v1 = vn(); kd = conn.execute("select public.hh_nightly(null)").fetchone()[0]; v2 = vn()
test("không truyền ngày thì dùng ngày Việt Nam (UTC+7), không phải ngày UTC (chỉ bắt được lỗi này khi chạy từ 0 đến 7 giờ sáng giờ VN)", lambda: expect(kd["date"] in (v1, v2), f"{kd['date']} khác {v1}"))

print("Chủ trọ bấm Chạy ngay")
conn.execute("update public.invoices set status = 'issued' where id = 'tre7'")
role("authenticated", B)
rb = conn.execute("select public.owner_run_nightly()").fetchone()[0]
role("postgres")
test("chủ B (tắt hết) bấm: không đụng dữ liệu của chủ A", lambda: expect(rb["buildings"] == 0 and inv("tre7")["status"] == "issued", str(rb)))
role("authenticated", A)
ra = conn.execute("select public.owner_run_nightly('b1')").fetchone()[0]
role("postgres")
test("chủ A bấm cho tòa 1: chạy được và chỉ một tòa", lambda: expect(ra["ok"] is True and ra["buildings"] == 1, str(ra)))
test("tòa đã chạy có ghi giờ và tóm tắt lần chạy gần nhất", lambda: expect(one("select nightly_last_note from public.buildings where owner_id=%s and id='b1'", (A,)) is not None
                                                                         and one("select nightly_last_run from public.buildings where owner_id=%s and id='b1'", (A,)) is not None))
test("tóm tắt lần chạy gần nhất nói không có gì khi đã xong hết", lambda: expect("không có gì" in one("select nightly_last_note from public.buildings where owner_id=%s and id='b1'", (A,)) or "ghi phí" in one("select nightly_last_note from public.buildings where owner_id=%s and id='b1'", (A,))))
test("có ghi vào nhật ký hoạt động", lambda: expect(one("select count(*) from public.audit_log where owner_id=%s and action='nightly.run'", (A,)) >= 1))
role("anon")
test("chưa đăng nhập bấm Chạy ngay bị từ chối", lambda: denied(lambda: conn.execute("select public.owner_run_nightly()")))
role("postgres")

print("Chủ trọ đọc thông báo của mình")
role("authenticated", A); na = one("select count(*) from public.tenant_notices")
role("authenticated", B); nb = one("select count(*) from public.tenant_notices")
role("postgres")
test("chủ A đọc được thông báo của mình", lambda: expect(na > 0, str(na)))
test("chủ B không đọc được thông báo của chủ A (RLS)", lambda: expect(nb == 0, str(nb)))

print("Khách xem thông báo qua app")
conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) values (%s, 'tn4', 'b1', 'P4', 'Khách P4', '0911000004', true), (%s, 'tn5', 'b1', 'P5', 'Khách P5', '0911000005', true)", (A, A))
role("authenticated", A)
code4 = conn.execute("select public.owner_issue_tenant_code('tn4')").fetchone()[0]["code"]
role("anon")
tok = conn.execute("select public.tenant_login('0911000004', %s)", (code4,)).fetchone()[0]["token"]
nt = conn.execute("select public.tenant_get_notices(%s)", (tok,)).fetchone()[0]
test("khách phòng P4 thấy thông báo phòng mình, mới nhất trước", lambda: expect(len(nt) >= 2 and nt[0]["createdAt"] >= nt[-1]["createdAt"], str(nt)[:200]))
test("chỉ thấy phòng mình: không lẫn thông báo phòng khác", lambda: expect(all(n["invoiceId"] == "tre4" for n in nt), str([n["invoiceId"] for n in nt])))
test("token sai: trả null (app hiểu là phiên hết hạn)", lambda: expect(conn.execute("select public.tenant_get_notices('khong-co')").fetchone()[0] is None))
role("postgres")

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
