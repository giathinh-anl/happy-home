"""Kiểm thử supabase/migration-public-rooms.sql trên Postgres thật chạy tại máy.

Cách chạy (cùng môi trường với tests/db/tenant-auth.test.py):
    .venv-db/Scripts/python tests/db/public-room.test.py

Trọng tâm: người lạ (vai anon) chỉ lấy được đúng những trường chủ trọ đã nhập để đăng tin, KHÔNG lộ tên khách, công nợ, hợp đồng;
phòng không bật công khai thì không khác gì phòng không tồn tại; bảng rooms vẫn khóa kín.
"""
import json, os, pathlib, sys, tempfile, uuid
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
for f in (ROOT / "tests/db/stubs.sql", ROOT / "supabase/schema.sql", ROOT / "supabase/migration-room-photos.sql"):
    conn.execute(f.read_text(encoding="utf-8"))
MIG_PATH = pathlib.Path(os.environ.get("HH_PUBLIC_SQL") or ROOT / "supabase/migration-public-rooms.sql")   # biến môi trường: dùng khi thử phá
MIG = MIG_PATH.read_text(encoding="utf-8")
conn.execute(MIG)

O = str(uuid.uuid4()); O2 = str(uuid.uuid4())
conn.execute("insert into auth.users(id, email) values (%s, 'a@x.vn'), (%s, 'b@x.vn')", (O, O2))
# tòa của chủ trọ khác, CÙNG mã b1, tạo TRƯỚC: truy vấn thiếu điều kiện chủ sở hữu sẽ lấy nhầm tòa này
conn.execute("insert into public.buildings(owner_id,id,name,address,contact_name,contact_phone) values (%s,'b1','TÒA CỦA NGƯỜI KHÁC','Địa chỉ khác','Người khác','0999999999')", (O2,))
conn.execute("insert into public.buildings(owner_id,id,name,address,contact_name,contact_phone) values (%s,'b1','Nhà trọ Hoa Hồng','25 Lê Văn Việt, Thủ Đức','Chị Hoa','0901234567')", (O,))
SL = "abcdefghij0123456789"
PHOTO = "data:image/jpeg;base64," + "A" * 50
def phong(id, code, status="vacant", slug=None, on=True, photos=None, **kw):
    c = dict(price=3500000, area=22.5, floor=3, type_label="Phòng thường", max_occupants=2, description="Thoáng, có ban công\ngần chợ", amenities=["Máy lạnh", "Giường"])
    c.update(kw)
    conn.execute("insert into public.rooms(owner_id,id,building_id,code,status,price,area,floor,type_label,max_occupants,description,amenities,photos,public_on,public_slug,tenant_name,debt,holding_deposit) "
                 "values (%s,%s,'b1',%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s,'KHACH BI MAT',9990000,777000)",
                 (O, id, code, status, c["price"], c["area"], c["floor"], c["type_label"], c["max_occupants"], c["description"], json.dumps(c["amenities"]),
                  json.dumps(photos if photos is not None else [PHOTO]), on, slug))
def goi(slug, vai=None):
    if vai: conn.execute(f"set role {vai}")
    try:
        r = conn.execute("select public.public_room(%s)", (slug,)).fetchone()[0]
    finally:
        if vai: conn.execute("reset role")
    return r

phong("r1", "301", slug=SL)
conn.execute("insert into public.tenants(owner_id,id,building_id,room_code,full_name,phone,id_number) values (%s,'t1','b1','301','KHACH BI MAT','0911222333','079012345678')", (O,))
conn.execute("insert into public.contracts(owner_id,id,building_id,room_code,tenant_name,rent,deposit) values (%s,'c1','b1','301','KHACH BI MAT',3500000,7000000)", (O,))

print("Thông tin trả về cho người lạ")
test("phòng đang bật công khai: có đủ số phòng, giá, diện tích, tầng, loại, số người, mô tả", lambda: (lambda r: expect(
    r["room"]["code"] == "301" and r["room"]["price"] == 3500000 and float(r["room"]["area"]) == 22.5 and r["room"]["floor"] == 3 and r["room"]["typeLabel"] == "Phòng thường"
    and r["room"]["maxOccupants"] == 2 and r["room"]["description"] == "Thoáng, có ban công\ngần chợ", str(r["room"])))(goi(SL)))
test("tiện nghi và ảnh", lambda: (lambda r: expect(r["room"]["amenities"] == ["Máy lạnh", "Giường"] and r["room"]["photos"] == [PHOTO], str(r["room"])))(goi(SL)))
test("tòa nhà và liên hệ", lambda: (lambda r: expect(r["building"] == {"name": "Nhà trọ Hoa Hồng", "address": "25 Lê Văn Việt, Thủ Đức"} and r["contact"] == {"name": "Chị Hoa", "phone": "0901234567"}, str(r)))(goi(SL)))
test("chỉ có đúng ba khối: room, building, contact", lambda: expect(set(goi(SL).keys()) == {"room", "building", "contact"}, str(goi(SL).keys())))
test("khối room chỉ có đúng các trường cho phép (danh sách trắng)", lambda: expect(
    set(goi(SL)["room"].keys()) == {"code", "floor", "area", "price", "typeLabel", "maxOccupants", "description", "amenities", "photos", "status"}, str(goi(SL)["room"].keys())))
test("KHÔNG lộ tên khách, số điện thoại khách, CCCD, công nợ, tiền cọc, hợp đồng", lambda: (lambda t: [expect(x not in t, "lộ: " + x) for x in
    ["KHACH BI MAT", "0911222333", "079012345678", "9990000", "777000", "7000000", "tenant", "contract", "debt", "owner_id", "holding"]])(json.dumps(goi(SL), ensure_ascii=False)))
test("không lộ mã chủ sở hữu", lambda: expect(O not in json.dumps(goi(SL))))
test("tòa nhà không có liên hệ thì liên hệ là rỗng (null), hàm không văng", lambda: (
    conn.execute("update public.buildings set contact_name=null, contact_phone=null where id='b1'"),
    expect(goi(SL)["contact"] == {"name": None, "phone": None}), conn.execute("update public.buildings set contact_name='Chị Hoa', contact_phone='0901234567' where id='b1'")))

print("Phòng không công khai thì như không tồn tại")
KHONG = {"error": "not_found"}
phong("r2", "302", slug="tatcongkhai1234", on=False)
test("phòng có mã nhưng chưa bật công khai: not_found", lambda: expect(goi("tatcongkhai1234") == KHONG))
test("mã không có thật: not_found", lambda: expect(goi("khongcothat123456") == KHONG))
test("hai trường hợp trả y hệt nhau (không dò được mã nào tồn tại)", lambda: expect(goi("tatcongkhai1234") == goi("khongcothat123456")))
for ten, s in [("null", None), ("rỗng", ""), ("quá ngắn", "abc123"), ("11 ký tự", "a" * 11), ("41 ký tự", "a" * 41), ("chữ hoa", SL.upper()), ("có gạch", "abcde-fghij-01234"),
               ("có khoảng trắng", "abcdefghij 0123456"), ("xuống dòng cuối", SL + "\n"), ("chèn SQL", "x'; drop table public.rooms;--"), ("ký tự lạ", "abcdefghijkl%%%%")]:
    test("mã sai dạng bị từ chối: " + ten, lambda s=s: expect(goi(s) == KHONG))
test("tắt công khai rồi thì not_found; bật lại cùng mã thì lại xem được (link không đổi)", lambda: (
    conn.execute("update public.rooms set public_on=false where id='r1'"), expect(goi(SL) == KHONG),
    conn.execute("update public.rooms set public_on=true where id='r1'"), expect(goi(SL)["room"]["code"] == "301")))
test("public_on để trống (null) coi như tắt", lambda: (conn.execute("update public.rooms set public_on=null where id='r2'"), expect(goi("tatcongkhai1234") == KHONG)))

print("Mã yếu do chủ trọ tự đặt qua API không dùng được (hàm chỉ nhận mã đủ dài, đúng dạng)")
for i, (ten, sl) in enumerate([("quá ngắn", "abc123"), ("chữ hoa", "ABCDEFGHIJ0123456789"), ("có ký tự lạ ở cuối", "abcdefghij0123456789!"), ("có khoảng trắng", "abcdefghij 0123456789")]):
    phong(f"w{i}", f"6{i:02d}", slug=sl, on=True)
    test(f"phòng bật công khai nhưng mã {ten}: vẫn not_found", lambda sl=sl: expect(goi(sl) == KHONG, str(goi(sl))))

print("Hai chủ trọ cùng đặt mã tòa nhà b1: trang phải lấy đúng tòa của chủ phòng (tòa kia đã tạo trước)")
test("tòa nhà và liên hệ đúng của chủ phòng, không lẫn sang chủ khác", lambda: (lambda r: expect(
    r["building"]["name"] == "Nhà trọ Hoa Hồng" and r["contact"]["phone"] == "0901234567" and "NGƯỜI KHÁC" not in json.dumps(r, ensure_ascii=False).upper(), str(r)))(goi(SL)))

print("Trạng thái chỉ có ba loại")
for i, (st, mong) in enumerate([("vacant", "vacant"), ("reserved", "reserved"), ("occupied", "occupied"), ("notice", "occupied"), ("cleaning", "occupied"), ("inactive", "occupied"), (None, "occupied"), ("bat-ky", "occupied")]):
    sl = f"trangthai{i:08d}"
    phong(f"s{i}", f"4{i:02d}", status=st, slug=sl)
    test(f"trạng thái {st!r} ra {mong!r}", lambda sl=sl, mong=mong: expect(goi(sl)["room"]["status"] == mong, goi(sl)["room"]["status"]))

print("Ảnh")
def anh(slug_i, photos):
    sl = f"anh{slug_i:016d}"; phong(f"a{slug_i}", f"5{slug_i:02d}", slug=sl, photos=photos); return goi(sl)["room"]["photos"]
test("chỉ nhận ảnh nhúng jpeg, png, webp", lambda: expect(anh(1, ["data:image/jpeg;base64,AAAA", "data:image/png;base64,BBBB", "data:image/webp;base64,CCCC"]) == ["data:image/jpeg;base64,AAAA", "data:image/png;base64,BBBB", "data:image/webp;base64,CCCC"]))
test("bỏ đường dẫn ngoài, svg, gif, thiếu base64, chuỗi lạ, chuỗi chèn thuộc tính", lambda: expect(anh(2, [
    "http://x.vn/a.jpg", "https://x.vn/a.jpg", "javascript:alert(1)", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/gif;base64,AAAA", "data:image/jpeg;base64,", "data:image/jpeg,AAAA",
    'data:image/jpeg;base64,AAA" onerror="x', "xx data:image/jpeg;base64,AAAA", "data:image/jpeg;base64,AAAA\nBBBB"]) == []))
test("tối đa 5 ảnh, giữ thứ tự", lambda: expect(anh(3, [f"data:image/jpeg;base64,{c}" for c in "ABCDEFGH"]) == [f"data:image/jpeg;base64,{c}" for c in "ABCDE"]))
test("ảnh quá 700.000 ký tự bị bỏ, đúng 700.000 còn", lambda: (lambda d: expect(anh(4, [d + "A" * (700001 - len(d)), d + "B" * (700000 - len(d))]) == [d + "B" * (700000 - len(d))]))("data:image/jpeg;base64,"))
test("ảnh xấu xen giữa ảnh tốt: bỏ ảnh xấu, giữ thứ tự ảnh tốt", lambda: expect(anh(5, ["data:image/png;base64,AAAA", "http://x", "data:image/jpeg;base64,BBBB"]) == ["data:image/png;base64,AAAA", "data:image/jpeg;base64,BBBB"]))
test("không có ảnh: mảng rỗng", lambda: expect(anh(6, []) == []))
test("cột ảnh không phải mảng (hỏng): mảng rỗng, không văng", lambda: (conn.execute("update public.rooms set photos='{\"a\":1}'::jsonb where id='a6'"), expect(goi("anh0000000000000006")["room"]["photos"] == [])))
test("tiện nghi không phải mảng: mảng rỗng", lambda: (conn.execute("update public.rooms set amenities='\"x\"'::jsonb where id='a6'"), expect(goi("anh0000000000000006")["room"]["amenities"] == [])))

print("Quyền: người lạ chỉ gọi được đúng một hàm, không đọc được bảng")
def expect_loi_quyen():
    conn.execute("set role anon")
    try:
        conn.execute("select public.public_room(%s)", (SL,))
    except errors.InsufficientPrivilege:
        return
    finally:
        conn.execute("reset role")
    raise AssertionError("anon gọi được hàm dù đã bị thu hồi quyền")
def vai(v, q, *a):
    conn.execute(f"set role {v}")
    try:
        return conn.execute(q, a).fetchall()
    finally:
        conn.execute("reset role")
test("quyền gọi của anon do migration cấp (thu hồi rồi chạy lại migration thì có lại, và khi chưa có thì không gọi được)", lambda: (
    conn.execute("revoke execute on function public.public_room(text) from anon"), expect_loi_quyen(), conn.execute(MIG), expect(goi(SL, "anon")["room"]["code"] == "301")))
test("anon gọi được public_room", lambda: expect(goi(SL, "anon")["room"]["code"] == "301"))
test("authenticated gọi được public_room", lambda: expect(goi(SL, "authenticated")["room"]["code"] == "301"))
test("anon KHÔNG đọc được bảng rooms (0 dòng)", lambda: expect(vai("anon", "select count(*) from public.rooms")[0][0] == 0))
def anon_ghi():
    conn.execute("set role anon")
    try:
        conn.execute("update public.rooms set public_on = false where id = 'r1'")
    finally:
        conn.execute("reset role")
test("anon không sửa được phòng (0 dòng bị đổi)", lambda: (anon_ghi(), expect(goi(SL)["room"]["code"] == "301")))
test("chủ trọ khác (authenticated nhưng không phải chủ) không đọc được phòng của người khác qua bảng", lambda: (
    conn.execute("set role authenticated"), conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (O2,)),
    expect(conn.execute("select count(*) from public.rooms").fetchone()[0] == 0), conn.execute("reset role")))
test("hàm public_room không dùng được bởi PUBLIC ngoài anon/authenticated (đã thu hồi)", lambda: expect(
    conn.execute("select count(*) from information_schema.routine_privileges where routine_name='public_room' and grantee not in ('anon','authenticated','postgres')").fetchone()[0] == 0))

print("Mã công khai duy nhất, chạy lại an toàn")
def trung():
    try:
        conn.execute("insert into public.rooms(owner_id,id,building_id,code,public_slug) values (%s,'dup','b1','999',%s)", (O, SL))
    except errors.UniqueViolation:
        return
    raise AssertionError("hai phòng cùng mã mà vẫn qua")
test("hai phòng không thể cùng một mã", trung)
test("nhiều phòng không có mã (null) thì được", lambda: (conn.execute("insert into public.rooms(owner_id,id,building_id,code) values (%s,'n1','b1','801'),(%s,'n2','b1','802')", (O, O)), None))
test("phòng mới tạo mặc định không công khai", lambda: expect(conn.execute("select public_on from public.rooms where id='n1'").fetchone()[0] in (False, None)))
test("chạy lại migration hai lần không lỗi, không mất mã đã có", lambda: (conn.execute(MIG), conn.execute(MIG), expect(goi(SL)["room"]["code"] == "301")))
test("dữ liệu phòng có sẵn không bị đổi bởi migration (giá, trạng thái)", lambda: expect(conn.execute("select price, status from public.rooms where id='r1'").fetchone() == (3500000, "vacant")))

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
