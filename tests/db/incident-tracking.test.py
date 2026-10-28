"""Kiểm thử supabase/migration-incident-tracking.sql (tiến độ sự cố, khách chỉ thấy phần công khai) trên Postgres thật chạy tại máy.

Cách chạy (cùng môi trường với tests/db/tenant-auth.test.py):
    .venv-db/Scripts/python tests/db/incident-tracking.test.py
Biến HH_INCIDENT_SQL trỏ tới một bản migration khác (dùng khi thử phá luật).
"""
import json, os, pathlib, re, sys, tempfile, uuid
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
def role(r, sub=None):
    conn.execute("reset role")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (sub or "",))
    if r != "postgres": conn.execute(f"set role {r}")
def load(name, strip_ext=False):
    if name == "migration-incident-tracking.sql" and os.environ.get("HH_INCIDENT_SQL"):
        t = pathlib.Path(os.environ["HH_INCIDENT_SQL"]).read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8") if name != "stubs.sql" else (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    if strip_ext:
        t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ) pgcrypto: dùng bản giả", t)
    try: conn.execute(t)
    except Exception as e:
        print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)

print("Nạp lược đồ và các migration")
for f in ["stubs.sql", "schema.sql", "migration-tenant-app.sql", "migration-tenant-app-v2.sql", "migration-claims-photos.sql",
          "migration-reading-photos.sql", "migration-support-chat.sql", "migration-staff-vehicles.sql",
          "migration-renewal.sql", "migration-late-fee.sql", "migration-invoice-batches.sql"]:
    load(f)
load("migration-tenant-auth.sql", strip_ext=True)
load("migration-incident-tracking.sql")
print("  ok   toàn bộ tệp nạp không lỗi")
load("migration-incident-tracking.sql")
print("  ok   chạy migration-incident-tracking.sql lần hai không lỗi")

A, B = str(uuid.uuid4()), str(uuid.uuid4())
for u, e in ((A, "a@x.vn"), (B, "b@x.vn")):
    conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
    conn.execute("insert into public.buildings(owner_id, id, name) values (%s, 'b1', 'Tòa 1')", (u,))
conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) values "
             "(%s, 'tn1', 'b1', 'P1', 'Khách P1', '0911000001', true), (%s, 'tn2', 'b1', 'P2', 'Khách P2', '0911000002', true), "
             "(%s, 'tnb', 'b1', 'P1', 'Khách B', '0911000099', true)", (A, A, B))

def ev(at, loai, congKhai, **kw):
    d = {"at": at, "loai": loai, "by": "Nguyễn Văn Chủ", "congKhai": congKhai}; d.update(kw); return d
def sc(owner, id, room, history, created, **kw):
    conn.execute("insert into public.incidents(owner_id, id, building_id, room_code, category, title, status, history, created_at, cost, cost_payer, assignee, assignee_phone) "
                 "values (%s, %s, 'b1', %s, 'Nước', 'Rò nước', 'processing', %s::jsonb, %s, %s, %s, %s, %s)",
                 (owner, id, room, json.dumps(history), created, kw.get("cost"), kw.get("payer"), kw.get("assignee"), kw.get("phone")))

sc(A, "s1", "P1", [
    ev("2026-10-10T09:00:00Z", "tiep-nhan", True),
    ev("2026-10-11T09:00:00Z", "ghi-chu", False, ghiChu="NỘI BỘ: thợ này hay làm ẩu"),
    ev("2026-10-12T09:00:00Z", "hen-tho", True, ngayHen="2026-10-22", tho="Anh Hùng", thoSdt="0911222333", ghiChu="Thợ đến chiều"),
    ev("2026-10-13T09:00:00Z", "ghi-chu", True, ghiChu="Chờ vật tư, dự kiến 2 ngày"),
    ev("2026-10-14T09:00:00Z", "hoan-tat", True, chiPhi=350000),
], "2026-10-10T09:00:00Z", cost=350000, payer="chu", assignee="Anh Hùng", phone="0911222333")
sc(A, "s2", "P2", [ev("2026-10-10T09:00:00Z", "ghi-chu", True, ghiChu="CHỈ PHÒNG P2 THẤY")], "2026-10-09T09:00:00Z")
sc(B, "sb", "P1", [ev("2026-10-10T09:00:00Z", "ghi-chu", True, ghiChu="CỦA CHỦ KHÁC")], "2026-10-09T09:00:00Z")
sc(A, "hong", "P1", [], "2026-10-08T09:00:00Z")                       # history rỗng
conn.execute("update public.incidents set history = '\"rác\"'::jsonb where id = 'hong'")   # history không phải mảng
sc(A, "lan", "P1", [ev("2026-10-15T09:00:00Z", "bat-dau", True), "không phải đối tượng", ev("2026-10-16T09:00:00Z", "ghi-chu", "true")], "2026-10-07T09:00:00Z")

role("authenticated", A)
code = conn.execute("select public.owner_issue_tenant_code('tn1')").fetchone()[0]["code"]
role("anon")
tok = conn.execute("select public.tenant_login('0911000001', %s)", (code,)).fetchone()[0]["token"]
ups = conn.execute("select public.tenant_incident_updates(%s)", (tok,)).fetchone()[0]
role("postgres")
by = {u["id"]: u for u in ups}

print("Khách chỉ thấy phần công khai của phòng mình")
test("thấy các sự cố của phòng mình, bỏ phòng khác và chủ khác", lambda: expect(set(by) == {"s1", "hong", "lan"}, str(sorted(by))))
test("sự cố báo gần nhất đứng đầu", lambda: expect([u["id"] for u in ups] == ["s1", "hong", "lan"], str([u["id"] for u in ups])))
test("ghi chú nội bộ không lộ", lambda: expect("NỘI BỘ" not in json.dumps(ups, ensure_ascii=False)))
test("chi phí không lộ, thợ và số điện thoại chỉ có trong sự kiện hẹn thợ công khai", lambda: expect("350000" not in json.dumps(ups) and "chiPhi" not in json.dumps(ups)))
test("tên người thao tác không lộ", lambda: expect("Nguyễn Văn Chủ" not in json.dumps(ups, ensure_ascii=False) and '"by"' not in json.dumps(ups)))
test("cờ công khai không gửi đi", lambda: expect("congKhai" not in json.dumps(ups)))
test("sự kiện công khai đủ và đúng thứ tự (tiếp nhận, hẹn thợ, ghi chú công khai, xong)", lambda: expect([e["loai"] for e in by["s1"]["history"]] == ["tiep-nhan", "hen-tho", "ghi-chu", "hoan-tat"], str(by["s1"]["history"])))
test("sự kiện hẹn thợ mang ngày hẹn, tên thợ, số điện thoại, ghi chú", lambda: expect(
    by["s1"]["history"][1]["ngayHen"] == "2026-10-22" and by["s1"]["history"][1]["tho"] == "Anh Hùng"
    and by["s1"]["history"][1]["thoSdt"] == "0911222333" and by["s1"]["history"][1]["ghiChu"] == "Thợ đến chiều"))
test("không lộ nội dung phòng khác hay chủ khác", lambda: expect("CHỈ PHÒNG P2" not in json.dumps(ups, ensure_ascii=False) and "CỦA CHỦ KHÁC" not in json.dumps(ups, ensure_ascii=False)))
test("history rác (không phải mảng) không làm hỏng hàm, trả mảng rỗng", lambda: expect(by["hong"]["history"] == []))
test("phần tử không phải đối tượng bị bỏ; congKhai là chuỗi 'true' không coi là công khai", lambda: expect([e["loai"] for e in by["lan"]["history"]] == ["bat-dau"], str(by["lan"]["history"])))
role("anon")
test("token sai: trả null (app hiểu là phiên hết hạn)", lambda: expect(conn.execute("select public.tenant_incident_updates('khong-co')").fetchone()[0] is None))
role("postgres")

print("Cột mới lưu được")
test("ngày hẹn là cột date, lưu 'YYYY-MM-DD'", lambda: (conn.execute("update public.incidents set scheduled_for = '2026-10-22' where id = 's1'"),
    expect(str(conn.execute("select scheduled_for from public.incidents where id='s1'").fetchone()[0]) == "2026-10-22")))
def rls():
    role("authenticated", A)
    conn.execute("update public.incidents set cost = 1 where id = 'sb'")
    conn.execute("update public.incidents set cost = 777 where id = 's2'")
    role("postgres")
    expect(conn.execute("select cost from public.incidents where id = 'sb'").fetchone()[0] is None, "chủ A đã sửa được sự cố của chủ B")
    expect(conn.execute("select cost from public.incidents where id = 's2'").fetchone()[0] == 777, "chủ A không sửa được sự cố của chính mình")
test("chủ trọ ghi được tiến độ cho sự cố của mình, không sửa được sự cố chủ khác (RLS)", rls)

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
