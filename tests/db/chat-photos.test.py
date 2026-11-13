"""Kiểm thử ảnh trong chat khách <-> nhân viên (supabase/migration-chat-photos.sql) trên Postgres thật chạy tại máy.

Cách chạy: .venv-db/Scripts/python tests/db/chat-photos.test.py   (xem tenant-code-self.test.py để biết cách dựng .venv-db)
Biến HH_CHATPHOTOS_SQL trỏ tới một bản sửa của migration (thử phá). Thoát mã khác 0 nếu có ca hỏng.
"""
import json, os, pathlib, re, sys, tempfile, uuid
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
    if name == "migration-chat-photos.sql" and os.environ.get("HH_CHATPHOTOS_SQL"):
        t = pathlib.Path(os.environ["HH_CHATPHOTOS_SQL"]).read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8") if name != "stubs.sql" else (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    if strip_ext: t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ)", t)
    try: conn.execute(t)
    except Exception as e: print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)
def loi(fn, ma):
    try: fn()
    except psycopg.Error as e:
        expect(ma in str(e), f"lỗi khác mong đợi ({ma}): {str(e).splitlines()[0][:140]}"); return
    raise AssertionError("đáng lẽ phải báo lỗi " + ma)

print("Nạp lược đồ và các migration")
for f in ["stubs.sql", "schema.sql", "migration-tenant-app.sql", "migration-tenant-app-v2.sql", "migration-claims-photos.sql",
          "migration-reading-photos.sql", "migration-support-chat.sql", "migration-staff-vehicles.sql", "migration-renewal.sql",
          "migration-late-fee.sql", "migration-invoice-batches.sql", "migration-incident-tracking.sql"]:
    load(f)
load("migration-tenant-auth.sql", strip_ext=True)

A, B = str(uuid.uuid4()), str(uuid.uuid4())
for u, e in ((A, "a@x.vn"), (B, "b@x.vn")): conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
for o in (A, B):
    conn.execute("insert into public.buildings(owner_id, id, name) values (%s, 'b1', 'Nhà')", (o,))
    conn.execute("insert into public.rooms(owner_id, id, building_id, code, price) values (%s, 'r1', 'b1', 'P101', 1), (%s, 'r2', 'b1', 'P102', 1)", (o, o))
TEN = [(A, "tn-a1", "P101", "0921111700"), (A, "tn-a2", "P102", "0923333900"), (B, "tn-b1", "P101", "0922222800")]
for o, t, room, ph in TEN:
    conn.execute("insert into public.tenants(owner_id, id, building_id, room_code, full_name, phone, is_rep) values (%s, %s, 'b1', %s, %s, %s, true)", (o, t, room, "Khách " + t, ph))
# Một tin có từ TRƯỚC khi chạy migration: phải còn nguyên sau khi chạy
conn.execute("insert into public.support_messages(owner_id, id, building_id, room_code, tenant_phone, tenant_name, sender, body, read_by_staff, read_by_tenant) "
             "values (%s, 'ms-cu', 'b1', 'P101', '0921111700', 'Khách cũ', 'tenant', 'Tin cũ trước khi có ảnh', false, true)", (A,))

load("migration-chat-photos.sql")
print("  ok   toàn bộ tệp nạp không lỗi")
load("migration-chat-photos.sql")
print("  ok   chạy lần hai không lỗi")

def issue(o, tid):
    role("authenticated", o); return one("select public.owner_issue_tenant_code(%s)", (tid,))["code"]
def login(phone, code):
    role("anon"); return one("select public.tenant_login(%s, %s)", (phone, code))["token"]
tokA1 = login("0921111700", issue(A, "tn-a1")); tokA2 = login("0923333900", issue(A, "tn-a2")); tokB = login("0922222800", issue(B, "tn-b1"))

def img(n=40, kind="jpeg"):
    """data URL hợp lệ có đúng n ký tự phần dữ liệu (nhóm 4 ký tự base64)"""
    return f"data:image/{kind};base64," + ("QUJD" * (n // 4 + 1))[:n]
def send(tok, body, photos=None, named=True):
    role("anon")
    if photos is None: return one("select public.tenant_send_message(%s, %s)", (tok, body))
    return one("select public.tenant_send_message(%s, %s, %s::jsonb)", (tok, body, json.dumps(photos)))
def rows(o=A, mid=None):
    role("postgres")
    q = "select message_id, idx, length(data) from public.support_message_photos where owner_id = %s" + (" and message_id = %s" if mid else "") + " order by message_id, idx"
    return conn.execute(q, (o, mid) if mid else (o,)).fetchall()
def msg(o, mid):
    role("postgres"); return conn.execute("select body, photo_count, sender from public.support_messages where owner_id = %s and id = %s", (o, mid)).fetchone()
def tong(o=A):
    role("postgres"); return one("select count(*) from public.support_messages where owner_id = %s", (o,))
def photos_of(tok, ids):
    role("anon"); return one("select public.tenant_message_photos(%s, %s::jsonb)", (tok, json.dumps(ids)))

print("\nCột, bảng, quyền")
test("tin cũ còn nguyên, photo_count mặc định 0", lambda: expect(msg(A, "ms-cu") == ("Tin cũ trước khi có ảnh", 0, "tenant"), str(msg(A, "ms-cu"))))
test("chỉ còn MỘT hàm tenant_send_message (không còn hàm 2 tham số gây trùng tên)", lambda: expect(one("select count(*) from pg_proc where proname = 'tenant_send_message'") == 1))
test("bảng ảnh có bật RLS; khách ẩn danh không đọc, không ghi trực tiếp được", lambda: (
    role("postgres"), expect(one("select relrowsecurity from pg_class where relname = 'support_message_photos'")),
    role("anon"), loi(lambda: conn.execute("select count(*) from public.support_message_photos"), "permission denied"),
    loi(lambda: conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, 'x', 0, %s)", (A, img())), "permission denied")))
test("khách gọi được hai hàm mới; không gọi được hàm kiểm tra nội bộ", lambda: (
    role("anon"),
    expect(one("select has_function_privilege('anon', 'public.tenant_send_message(text,text,jsonb)', 'execute')")),
    expect(one("select has_function_privilege('anon', 'public.tenant_message_photos(text,jsonb)', 'execute')")),
    expect(not one("select has_function_privilege('anon', 'public._chat_photos_hop_le(jsonb)', 'execute')")),
    expect(not one("select has_function_privilege('authenticated', 'public._chat_photos_hop_le(jsonb)', 'execute')"))))

print("\nKhách gửi tin")
test("gọi kiểu cũ (chỉ chữ) vẫn chạy, photo_count 0", lambda: (
    (lambda r: (expect(r and r["ok"] is True, str(r)), expect(msg(A, r["id"]) == ("Xin chào", 0, "tenant")), expect(rows(A, r["id"]) == [])))(send(tokA1, "  Xin chào  "))))
test("kèm 1 ảnh: lưu tin (photo_count 1) và ảnh (đúng thứ tự, nguyên vẹn)", lambda: (
    (lambda p, r: (expect(r["ok"] is True), expect(msg(A, r["id"]) == ("Có ảnh", 1, "tenant")), expect(rows(A, r["id"]) == [(r["id"], 0, len(p[0]))]),
                   expect(one("select data from public.support_message_photos where message_id = %s", (r["id"],)) == p[0])))(
        [img(100)], send(tokA1, "Có ảnh", [img(100)]))))
test("3 ảnh: đủ 3 dòng ảnh theo thứ tự 0, 1, 2", lambda: (
    (lambda r: expect([x[1] for x in rows(A, r["id"])] == [0, 1, 2] and msg(A, r["id"])[1] == 3, str(rows(A, r["id"]))))(send(tokA1, "Ba ảnh", [img(40), img(80, "png"), img(120, "webp")]))))
test("4 ảnh: báo invalid, không lưu gì", lambda: (
    (lambda truoc: (expect(send(tokA1, "Bốn ảnh", [img()] * 4) == {"error": "invalid"}), expect(tong() == truoc, "đã lưu tin dù ảnh sai")))(tong())))
test("chỉ ảnh, không chữ: được (body rỗng)", lambda: (
    (lambda r: expect(r["ok"] is True and msg(A, r["id"]) == ("", 1, "tenant"), str(msg(A, r["id"]))))(send(tokA1, "", [img()]))))
test("không chữ và không ảnh (rỗng, toàn khoảng trắng, mảng rỗng): null, không lưu", lambda: (
    (lambda truoc: ([expect(send(tokA1, b, p) is None, repr((b, p))) for b, p in (("", None), ("   ", None), ("", []), (" \n ", []))], expect(tong() == truoc)))(tong())))
SAI = {"SVG": [ "data:image/svg+xml;base64,PHN2Zz4=" ], "html": ["data:text/html;base64,PGgxPg=="], "javascript": ["javascript:alert(1)"], "http": ["https://x.vn/a.jpg"],
       "ký tự lạ": ["data:image/jpeg;base64,abc\"onerror=\"alert(1)"], "có khoảng trắng": ["data:image/jpeg;base64,QUJD QUJD"], "rỗng": [""], "chỉ tiền tố": ["data:image/jpeg;base64,"],
       "phần tử là số": [123], "phần tử là object": [{"a": 1}], "phần tử null": [None], "gif": ["data:image/gif;base64,R0lGODlh"]}
for ten, ds in SAI.items():
    test("từ chối ảnh sai: " + ten, lambda ds=ds: (
        (lambda truoc: (expect(send(tokA1, "x", ds) == {"error": "invalid"}, "không bị chặn"), expect(tong() == truoc)))(tong())))
test("p_photos không phải mảng (object, chuỗi, số): invalid; null thì coi như không ảnh", lambda: (
    [expect(send(tokA1, "x", v) == {"error": "invalid"}, repr(v)) for v in ({"a": 1}, "chuoi", 5)],
    expect((lambda r: r and r["ok"] is True)(( role("anon"), one("select public.tenant_send_message(%s, %s, null)", (tokA1, "không ảnh")))[1]))))
test("giới hạn cỡ: 1 ảnh 300.000 ký tự được, 300.001 bị từ chối", lambda: (
    expect(send(tokA1, "to", [img(300000 - len("data:image/jpeg;base64,"))])["ok"] is True),
    expect(send(tokA1, "quá to", [img(300001 - len("data:image/jpeg;base64,"))]) == {"error": "invalid"})))
test("tổng cỡ: 2 ảnh 300.000 (600.000) được, 3 ảnh 250.000 (750.000) bị từ chối", lambda: (
    expect(send(tokA1, "hai", [img(300000 - 23)] * 2)["ok"] is True),
    expect(send(tokA1, "ba", [img(250000 - 23)] * 3) == {"error": "invalid"})))
test("token sai, rỗng, ngắn, null: trả null, không lưu", lambda: (
    (lambda truoc: ([expect(send(t, "x", [img()]) is None, repr(t)) for t in ("x" * 40, "", "ngan")], expect(tong() == truoc)))(tong())))
test("chữ dài hơn 2000 ký tự bị cắt còn 2000", lambda: (
    (lambda r: expect(len(msg(A, r["id"])[0]) == 2000))(send(tokA1, "a" * 5000))))

print("\nChống gửi dồn dập")
test("khách gửi tối đa 20 tin có ảnh trong một giờ; tin thứ 21 báo too_many; tin chữ vẫn gửi được", lambda: (
    role("postgres"), conn.execute("delete from public.support_message_photos where owner_id = %s", (A,)),
    conn.execute("delete from public.support_messages where owner_id = %s and tenant_phone = '0923333900'", (A,)),
    [expect(send(tokA2, "ảnh " + str(i), [img()])["ok"] is True, str(i)) for i in range(20)],
    expect(send(tokA2, "ảnh 21", [img()]) == {"error": "too_many"}),
    expect(send(tokA2, "chỉ chữ")["ok"] is True),
    expect(send(tokB, "khách khác chủ khác vẫn gửi được", [img()])["ok"] is True),
    expect(send(tokA1, "khách khác cùng chủ vẫn gửi được", [img()])["ok"] is True)))
test("quá một giờ thì được gửi lại", lambda: (
    role("postgres"), conn.execute("update public.support_messages set created_at = now() - interval '2 hours' where owner_id = %s and tenant_phone = '0923333900'", (A,)),
    expect(send(tokA2, "sau một giờ", [img()])["ok"] is True)))

print("\nKhách đọc tin và ảnh")
def msgs(tok, after=None):
    role("anon"); return one("select public.tenant_messages(%s, %s)", (tok, after))
test("tenant_messages trả photoCount cho từng tin; tin cũ là 0", lambda: (
    (lambda r: (expect(any(m["id"] == "ms-cu" and m["photoCount"] == 0 for m in r["messages"]), "thiếu tin cũ"),
                expect(any(m["photoCount"] == 1 for m in r["messages"]), "không có tin 1 ảnh"), expect(any(m["photoCount"] == 3 for m in r["messages"]), "không có tin 3 ảnh")))(msgs(tokA1))))
test("tenant_messages với token sai trả null", lambda: expect(msgs("x" * 40) is None))
test("tenant_message_photos: trả đúng ảnh của tin mình, theo thứ tự", lambda: (
    (lambda r: (lambda ph: (expect(len(ph[r["id"]]) == 3, str(ph.keys())), expect([len(x) for x in ph[r["id"]]] == [len(img(40)), len(img(80, "png")), len(img(120, "webp"))])))(photos_of(tokA1, [r["id"]])))(send(tokA1, "đọc lại", [img(40), img(80, "png"), img(120, "webp")]))))
test("tin không có ảnh hoặc mã không tồn tại: không có trong kết quả", lambda: expect(photos_of(tokA1, ["ms-cu", "ms-khong-co"]) == {}))
test("khách khác (cùng chủ) KHÔNG lấy được ảnh của tin người khác dù biết mã", lambda: (
    (lambda r: expect(photos_of(tokA2, [r["id"]]) == {}, "lộ ảnh sang khách khác"))(send(tokA1, "riêng tư", [img(60)]))))
test("khách của chủ KHÁC không lấy được ảnh, kể cả khi hai chủ trùng mã tin", lambda: (
    (lambda: (
        role("postgres"),
        conn.execute("insert into public.support_messages(owner_id, id, building_id, room_code, tenant_phone, tenant_name, sender, body, photo_count) values (%s, 'ms-trung', 'b1', 'P101', '0921111700', 'A1', 'tenant', 'a', 1)", (A,)),
        conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, 'ms-trung', 0, %s)", (A, img(48))),
        conn.execute("insert into public.support_messages(owner_id, id, building_id, room_code, tenant_phone, tenant_name, sender, body, photo_count) values (%s, 'ms-trung', 'b1', 'P101', '0922222800', 'B1', 'tenant', 'b', 1)", (B,)),
        conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, 'ms-trung', 0, %s)", (B, img(52))),
        expect(photos_of(tokA1, ["ms-trung"])["ms-trung"] == [img(48)], "A1 không thấy đúng ảnh của A"),
        expect(photos_of(tokB, ["ms-trung"])["ms-trung"] == [img(52)], "B1 không thấy đúng ảnh của B"),
        expect(photos_of(tokA2, ["ms-trung"]) == {}, "A2 thấy ảnh không phải của mình")))()))
test("một người thuê của HAI chủ trọ (cùng số điện thoại): chỉ lấy được ảnh tin của chủ mà token này thuộc về", lambda: (
    role("postgres"),
    conn.execute("insert into public.support_messages(owner_id, id, building_id, room_code, tenant_phone, tenant_name, sender, body, photo_count) values (%s, 'ms-haichu', 'b1', 'P101', '0921111700', 'Cùng số', 'staff', '', 1)", (B,)),
    conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, 'ms-haichu', 0, %s)", (B, img(64))),
    expect(photos_of(tokA1, ["ms-haichu"]) == {}, "ảnh của chủ B lộ sang token thuộc chủ A dù trùng số điện thoại")))
test("tối đa 10 tin mỗi lần gọi (có 12 tin có ảnh, xin cả 12, chỉ nhận đúng 10)", lambda: (
    role("postgres"),
    [(conn.execute("insert into public.support_messages(owner_id, id, building_id, room_code, tenant_phone, tenant_name, sender, body, photo_count) values (%s, %s, 'b1', 'P101', '0921111700', 'K', 'staff', '', 1)", (A, f"ms-gh{i:02d}")),
      conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, %s, 0, %s)", (A, f"ms-gh{i:02d}", img(40 + i)))) for i in range(12)],
    (lambda ph: expect(len(ph) == 10, "nhận " + str(len(ph)) + " tin, đáng lẽ đúng 10"))(photos_of(tokA1, [f"ms-gh{i:02d}" for i in range(12)]))))
test("token sai: null; p_ids không phải mảng hoặc null: rỗng", lambda: (
    expect(photos_of("x" * 40, ["ms-cu"]) is None),
    [expect((role("anon"), one("select public.tenant_message_photos(%s, %s::jsonb)", (tokA1, v)))[1] == {}, repr(v)) for v in ('{"a":1}', '"chuoi"', '5', 'null')]))

print("\nNhân viên (chủ trọ) trả lời kèm ảnh")
def owner_insert_msg(o, mid, phone, photos):
    role("authenticated", o)
    conn.execute("insert into public.support_messages(owner_id, id, building_id, room_code, tenant_phone, tenant_name, sender, staff_name, body, photo_count, read_by_staff, read_by_tenant) "
                 "values (%s, %s, 'b1', 'P101', %s, 'K', 'staff', 'Chủ', '', %s, true, false)", (o, mid, phone, len(photos)))
    for i, d in enumerate(photos):
        conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, %s, %s, %s)", (o, mid, i, d))
test("chủ trọ gửi tin có ảnh: khách xem được qua tenant_messages và tenant_message_photos", lambda: (
    owner_insert_msg(A, "ms-nv1", "0921111700", [img(44), img(56)]),
    expect(any(m["id"] == "ms-nv1" and m["photoCount"] == 2 and m["sender"] == "staff" for m in msgs(tokA1)["messages"])),
    expect(photos_of(tokA1, ["ms-nv1"])["ms-nv1"] == [img(44), img(56)])))
test("chủ trọ đọc được ảnh của mình, nhưng không đọc được ảnh của chủ khác (RLS)", lambda: (
    role("authenticated", A), expect(one("select count(*) from public.support_message_photos") >= 2),
    expect(one("select count(*) from public.support_message_photos where owner_id = %s", (B,)) == 0),
    role("authenticated", B), expect(one("select count(*) from public.support_message_photos where owner_id = %s", (A,)) == 0)))
test("chủ B không ghi được ảnh dưới tên chủ A", lambda: (
    role("authenticated", B), loi(lambda: conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, 'x', 0, %s)", (A, img())), "row-level security")))
test("chủ trọ không ghi được ảnh sai dạng, quá cỡ, hoặc vị trí ngoài 0 đến 2", lambda: (
    role("authenticated", A),
    loi(lambda: conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, 'x1', 0, 'data:image/svg+xml;base64,PHN2Zz4=')", (A,)), "support_photos_data_chk"),
    loi(lambda: conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, 'x2', 0, %s)", (A, img(300001))), "support_photos_data_chk"),
    loi(lambda: conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values (%s, 'x3', 3, %s)", (A, img())), "support_photos_idx_chk")))
test("photo_count ngoài 0 đến 3 bị từ chối", lambda: (
    role("authenticated", A), loi(lambda: conn.execute("insert into public.support_messages(owner_id, id, tenant_phone, sender, body, photo_count) values (%s, 'ms-bad', '0921111700', 'staff', 'x', 4)", (A,)), "support_messages_photo_count_chk"),
    loi(lambda: conn.execute("insert into public.support_messages(owner_id, id, tenant_phone, sender, body, photo_count) values (%s, 'ms-bad2', '0921111700', 'staff', 'x', -1)", (A,)), "support_messages_photo_count_chk")))
test("xóa tài khoản chủ thì ảnh xóa theo (on delete cascade)", lambda: (
    role("postgres"), conn.execute("insert into auth.users(id, email) values (%s, 'tam@x.vn')", ("00000000-0000-0000-0000-000000000009",)),
    conn.execute("insert into public.support_message_photos(owner_id, message_id, idx, data) values ('00000000-0000-0000-0000-000000000009', 'm', 0, %s)", (img(),)),
    conn.execute("delete from auth.users where id = '00000000-0000-0000-0000-000000000009'"),
    expect(one("select count(*) from public.support_message_photos where owner_id = '00000000-0000-0000-0000-000000000009'") == 0)))

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
