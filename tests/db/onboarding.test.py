"""Kiểm thử supabase/migration-onboarding.sql (khách tự khai thông tin qua link / QR) trên Postgres thật chạy tại máy.

Cách chạy (cùng môi trường với tests/db/tenant-auth.test.py):
    .venv-db/Scripts/python tests/db/onboarding.test.py
Biến HH_ONBOARD_SQL trỏ tới một bản migration khác (dùng khi thử phá luật).
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
def one(sql, params=None):
    r = conn.execute(sql, params).fetchone(); return r[0] if r else None
def denied(fn):
    try: fn()
    except psycopg.errors.InsufficientPrivilege: return True
    except psycopg.errors.Error as e: raise AssertionError("lỗi khác quyền: " + str(e).splitlines()[0])
    raise AssertionError("đáng lẽ bị từ chối nhưng chạy được")
def load(name, strip_ext=False):
    if name == "migration-onboarding.sql" and os.environ.get("HH_ONBOARD_SQL"):
        t = pathlib.Path(os.environ["HH_ONBOARD_SQL"]).read_text(encoding="utf-8")
    else:
        t = (SQL / name).read_text(encoding="utf-8") if name != "stubs.sql" else (ROOT / "tests/db/stubs.sql").read_text(encoding="utf-8")
    if strip_ext:
        t = re.sub(r"(?im)^create extension if not exists pgcrypto.*$", "-- (bỏ) pgcrypto: dùng bản giả", t)
    try: conn.execute(t)
    except Exception as e:
        print(f"LỖI khi nạp {name}: {e}"); sys.exit(2)

print("Nạp lược đồ và các migration")
for f in ["stubs.sql", "schema.sql"]:
    load(f)
load("migration-onboarding.sql", strip_ext=True)
print("  ok   toàn bộ tệp nạp không lỗi")
load("migration-onboarding.sql", strip_ext=True)
print("  ok   chạy migration-onboarding.sql lần hai không lỗi")

A, B = str(uuid.uuid4()), str(uuid.uuid4())
for u, e in ((A, "a@x.vn"), (B, "b@x.vn")):
    conn.execute("insert into auth.users(id, email) values (%s, %s)", (u, e))
    conn.execute("insert into public.buildings(owner_id, id, name, address) values (%s, 'b1', 'Tòa 1 của ' || %s, '12 Nguyễn Văn Linh')", (u, e))
    conn.execute("insert into public.rooms(owner_id, id, building_id, code, price) values (%s, 'r1', 'b1', 'P101', 3000000), (%s, 'r2', 'b1', 'P102', 3000000)", (u, u))

PHOTO = "data:image/jpeg;base64," + "A" * 200
GOOD = {"fullName": "  Nguyễn   Văn An ", "phone": "+84 911 222 333", "idNumber": "079.201.012.345", "dob": "05/03/1998", "gender": "nu",
        "hometown": "Bình Định", "address": "12/3 Lê Lợi, Quận 1, TP.HCM", "cccdIssueDate": "20/04/2021", "occupation": "Kỹ sư",
        "vehiclePlate": "59x1-123.45", "consent": "true"}

def create(owner=A, room="P101", hours=72, note=None, bid="b1"):
    role("authenticated", owner)
    r = conn.execute("select public.owner_create_invite(%s, %s, %s, %s)", (bid, room, hours, note)).fetchone()[0]
    role("postgres"); return r
def submit(token, data=None, front=PHOTO, back=PHOTO, as_role="anon"):
    role(as_role)
    r = conn.execute("select public.invite_submit(%s, %s::jsonb, %s, %s)", (token, json.dumps(data if data is not None else GOOD), front, back)).fetchone()[0]
    role("postgres"); return r
def info(token):
    role("anon"); r = conn.execute("select public.invite_info(%s)", (token,)).fetchone()[0]; role("postgres"); return r
def status(id): return one("select status from public.onboarding_invites where id = %s", (id,))

print("Chủ trọ tạo lời mời")
inv = create(note="Anh Nam hẹn xem phòng")
role("anon")
test("chưa đăng nhập không tạo được lời mời", lambda: denied(lambda: conn.execute("select public.owner_create_invite('b1', 'P101', 72, null)")))
role("postgres")
test("tạo được: có mã, token 24 ký tự an toàn cho đường link, hạn khoảng 72 giờ", lambda: expect(
    inv["id"].startswith("oi-") and len(inv["token"]) == 24 and re.fullmatch(r"[A-Za-z0-9_\-]{24}", inv["token"]) and inv["roomCode"] == "P101", str(inv)))
test("máy chủ chỉ lưu băm token, không lưu token", lambda: expect(
    one("select count(*) from public.onboarding_invites where token_hash = %s or token_hash like %s", (inv["token"], "%" + inv["token"] + "%")) == 0
    and one("select token_hash from public.onboarding_invites where id = %s", (inv["id"],)) != inv["token"]))
test("hai lời mời có token khác nhau", lambda: expect(create()["token"] != inv["token"]))
test("tòa không tồn tại hoặc của chủ khác bị từ chối", lambda: expect(create(bid="b9").get("error") == "not_found" and create(owner=B, bid="b9").get("error") == "not_found"))
test("phòng không có trong tòa bị từ chối", lambda: expect(create(room="P999").get("error") == "room_not_found"))
test("không gắn phòng cũng được (chủ trọ chọn lúc duyệt)", lambda: expect(create(room=None).get("roomCode") is None))
def han(h):
    r = create(hours=h); return one("select extract(epoch from (expires_at - now())) / 3600 from public.onboarding_invites where id = %s", (r["id"],))
test("số giờ bị kẹp trong khoảng 1 đến 336", lambda: expect(0.9 < float(han(0)) < 1.1 and 335.9 < float(han(99999)) < 336.1 and 71.9 < float(han(72)) < 72.1))
test("ghi chú nội bộ bị cắt 200 ký tự", lambda: expect(len(one("select note from public.onboarding_invites where id = %s", (create(note="x" * 500)["id"],))) == 200))
test("tối đa 50 lời mời đang chờ, vượt thì từ chối", lambda: (
    [create(owner=B) for _ in range(50)], expect(create(owner=B).get("error") == "too_many")))

print("Quyền đọc ghi")
role("authenticated", A)
test("chủ trọ không đọc được cột băm token", lambda: denied(lambda: conn.execute("select token_hash from public.onboarding_invites")))
role("authenticated", A)
test("select * cũng bị từ chối (phải liệt kê cột), không lộ băm token", lambda: denied(lambda: conn.execute("select * from public.onboarding_invites")))
role("authenticated", A)
test("đọc các cột được phép: chỉ thấy lời mời của mình", lambda: expect(
    all(True for _ in conn.execute("select id, status, room_code from public.onboarding_invites").fetchall())
    and one("select count(*) from public.onboarding_invites where id = %s", (inv["id"],)) == 1))
role("authenticated", B)
test("chủ khác không thấy lời mời của A", lambda: expect(one("select count(*) from public.onboarding_invites where id = %s", (inv["id"],)) == 0))
role("authenticated", A)
test("chủ trọ không tự thêm / sửa lời mời bằng lệnh trực tiếp", lambda: (
    denied(lambda: conn.execute("insert into public.onboarding_invites(owner_id, id, token_hash, building_id, expires_at) values (%s, 'x', 'h', 'b1', now())", (A,))),
    role("authenticated", A),
    denied(lambda: conn.execute("update public.onboarding_invites set status = 'approved' where id = %s", (inv["id"],)))))
role("anon")
test("khách (anon) không đọc được bảng nào", lambda: (denied(lambda: conn.execute("select id from public.onboarding_invites")), role("anon"),
    denied(lambda: conn.execute("select * from public.onboarding_docs"))))
role("postgres")

print("Khách mở link")
tk = create()
exp_info = info(tk["token"])
test("link hợp lệ cho biết phòng và tòa, không lộ dữ liệu cá nhân", lambda: expect(
    exp_info.get("ok") is True and exp_info["roomCode"] == "P101" and exp_info["buildingName"].startswith("Tòa 1")
    and exp_info["address"] == "12 Nguyễn Văn Linh" and "note" not in exp_info and "owner_id" not in json.dumps(exp_info) and "token" not in json.dumps(exp_info), str(exp_info)))
def lamhong(sql):
    t = create(); conn.execute(sql, (t["id"],)); return info(t["token"])
bad = {"sai": info("khong-co-link-nay"), "rong": info(""), "null": None}
test("link sai và link rỗng trả cùng một câu 'không hợp lệ'", lambda: expect(bad["sai"] == {"error": "invalid"} and bad["rong"] == {"error": "invalid"}, str(bad)))
test("link hết hạn trả đúng câu đó", lambda: expect(lamhong("update public.onboarding_invites set expires_at = now() - interval '1 minute' where id = %s") == {"error": "invalid"}))
test("link đã thu hồi trả đúng câu đó", lambda: expect(lamhong("update public.onboarding_invites set status = 'revoked' where id = %s") == {"error": "invalid"}))
test("link đã gửi hồ sơ trả đúng câu đó (không dò được link nào đã dùng)", lambda: expect(lamhong("update public.onboarding_invites set status = 'submitted' where id = %s") == {"error": "invalid"}))

print("Khách gửi hồ sơ")
good = create()
r = submit(good["token"])
test("gửi hợp lệ thành công", lambda: expect(r == {"ok": True}, str(r)))
sd = one("select submitted_data from public.onboarding_invites where id = %s", (good["id"],))
test("dữ liệu được chuẩn hóa ở máy chủ: tên gọn, số điện thoại 0xxxxxxxxx, CCCD chỉ chữ số", lambda: expect(
    sd["fullName"] == "Nguyễn Văn An" and sd["phone"] == "0911222333" and sd["idNumber"] == "079201012345", str(sd)))
test("giới tính, biển số, ngày về dạng chuẩn", lambda: expect(sd["gender"] == "Nữ" and sd["vehiclePlate"] == "59X112345" and sd["dob"] == "05/03/1998" and sd["cccdIssueDate"] == "20/04/2021", str(sd)))
test("trạng thái chuyển sang đã gửi, có giờ gửi", lambda: expect(status(good["id"]) == "submitted" and one("select submitted_at from public.onboarding_invites where id = %s", (good["id"],)) is not None))
test("ảnh hai mặt được lưu ở bảng riêng", lambda: expect(one("select front from public.onboarding_docs where invite_id = %s", (good["id"],)) == PHOTO))
test("dữ liệu khai không chứa ảnh", lambda: expect("data:image" not in json.dumps(sd)))
test("MỘT LẦN DUY NHẤT: gửi lại bằng cùng link bị chặn", lambda: expect(submit(good["token"]) == {"error": "invalid"}))
test("sau khi gửi, link không còn mở được", lambda: expect(info(good["token"]) == {"error": "invalid"}))
test("gửi bằng link sai bị chặn, không tạo gì", lambda: expect(submit("khong-co") == {"error": "invalid"}))
exp = create(); conn.execute("update public.onboarding_invites set expires_at = now() - interval '1 second' where id = %s", (exp["id"],))
test("link hết hạn không gửi được", lambda: expect(submit(exp["token"]) == {"error": "invalid"} and status(exp["id"]) == "pending"))
rev = create(); conn.execute("update public.onboarding_invites set status = 'revoked' where id = %s", (rev["id"],))
test("link đã thu hồi không gửi được", lambda: expect(submit(rev["token"]) == {"error": "invalid"}))

print("Kiểm tra lại từng trường ở máy chủ (không tin trình duyệt)")
def sai(truong, gia_tri=None, bo=False, **kw):
    t = create(); d = dict(GOOD)
    if bo: d.pop(truong, None)
    elif truong in d: d[truong] = gia_tri
    r = submit(t["token"], d, **kw)
    return r, t
def loi(truong, gia_tri=None, bo=False):
    r, t = sai(truong, gia_tri, bo)
    expect(r.get("error") == "validation" and truong in r["fields"], f"{truong}={gia_tri!r} -> {r}")
    expect(status(t["id"]) == "pending", "gửi sai mà vẫn tiêu mất link")
for ten, args in [("tên chỉ một từ", ("fullName", "An")), ("tên có chữ số", ("fullName", "An 2 Nguyen")), ("tên rỗng", ("fullName", "")),
                  ("tên chứa dấu < >", ("fullName", "Nguyen <script> An")), ("tên quá dài", ("fullName", "An " * 40)),
                  ("số điện thoại thiếu số", ("phone", "091122233")), ("số điện thoại không bắt đầu bằng 0", ("phone", "5911222333")),
                  ("số điện thoại có chữ", ("phone", "09112223ab")), ("CCCD 11 số", ("idNumber", "07920101234")),
                  ("CCCD có chữ", ("idNumber", "07920101234a")), ("ngày sinh tương lai", ("dob", "01/01/2999")),
                  ("ngày sinh 31/02", ("dob", "31/02/1998")), ("ngày sinh sai dạng", ("dob", "1998-03-05")), ("ngày sinh năm 1800", ("dob", "01/01/1800")),
                  ("giới tính lạ", ("gender", "khac")), ("quê quán rỗng", ("hometown", "")), ("địa chỉ rỗng", ("address", " ")),
                  ("địa chỉ chứa <", ("address", "<img src=x onerror=alert(1)>")), ("ngày cấp tương lai", ("cccdIssueDate", "01/01/2999")),
                  ("ngày cấp 30/02", ("cccdIssueDate", "30/02/2020")), ("biển số sai", ("vehiclePlate", "abc")),
                  ("nghề nghiệp quá dài", ("occupation", "x" * 81)), ("không đồng ý", ("consent", "false")), ("thiếu đồng ý", ("consent", None, True)),
                  ("thiếu họ tên", ("fullName", None, True)), ("thiếu CCCD", ("idNumber", None, True))]:
    test("từ chối: " + ten, lambda a=args: loi(*a))
def anh_sai(ten, **kw):
    r, t = sai("fullName", GOOD["fullName"], **kw)
    expect(r.get("error") == "validation" and ten in r["fields"], str(r)); expect(status(t["id"]) == "pending")
test("thiếu ảnh mặt trước", lambda: anh_sai("front", front=None))
test("thiếu ảnh mặt sau", lambda: anh_sai("back", back=None))
test("ảnh không phải data URL", lambda: anh_sai("front", front="http://evil.example/x.jpg"))
test("ảnh sai loại (svg có thể chứa script)", lambda: anh_sai("front", front="data:image/svg+xml;base64,PHN2Zz4="))
test("ảnh là html", lambda: anh_sai("back", back="data:text/html;base64,PHNjcmlwdD4="))
test("ảnh chứa ký tự lạ sau base64", lambda: anh_sai("back", back="data:image/jpeg;base64,AAAA\"onerror=\"x"))
test("ảnh quá lớn (trên 700.000 ký tự)", lambda: anh_sai("front", front="data:image/jpeg;base64," + "A" * 700001))
test("nhiều lỗi cùng lúc thì báo hết một lượt", lambda: expect(len(submit(create()["token"], {"fullName": "An", "phone": "1"})["fields"]) >= 6))
test("dữ liệu gửi lên không phải đối tượng cũng không làm hỏng, báo thiếu", lambda: expect(submit(create()["token"], [1, 2])["error"] == "validation"))
ex = create(); r2 = submit(ex["token"], dict(GOOD, status="approved", tenant_id="x", ownerId=B, note="hack", extra="1"))
sd2 = one("select submitted_data from public.onboarding_invites where id = %s", (ex["id"],))
test("trường lạ bị bỏ, không cho khách tự duyệt hay tự gắn hồ sơ", lambda: expect(r2 == {"ok": True} and status(ex["id"]) == "submitted"
    and set(sd2) <= {"fullName", "phone", "idNumber", "dob", "gender", "hometown", "address", "cccdIssueDate", "occupation", "vehiclePlate"}
    and one("select tenant_id from public.onboarding_invites where id = %s", (ex["id"],)) is None, str(sd2)))
opt = create(); r3 = submit(opt["token"], {k: v for k, v in GOOD.items() if k not in ("cccdIssueDate", "occupation", "vehiclePlate")})
test("ngày cấp, nghề nghiệp, biển số là không bắt buộc", lambda: expect(r3 == {"ok": True}, str(r3)))
test("tên có dấu tiếng Việt viết hoa toàn bộ và 'NỮ' được nhận", lambda: expect(submit(create()["token"], dict(GOOD, fullName="NGUYỄN THỊ HOA", gender="NỮ")) == {"ok": True}))

print("Chủ trọ duyệt")
s1 = create(); submit(s1["token"])
def decide(owner, id, dec, note=None, tid=None):
    role("authenticated", owner)
    r = conn.execute("select public.owner_decide_invite(%s, %s, %s, %s)", (id, dec, note, tid)).fetchone()[0]; role("postgres"); return r
test("chủ khác không duyệt được hồ sơ của A", lambda: expect(decide(B, s1["id"], "approved").get("error") == "not_found" and status(s1["id"]) == "submitted"))
test("không duyệt được hồ sơ chưa gửi", lambda: expect(decide(A, create()["id"], "approved").get("error") == "not_found"))
test("quyết định lạ bị từ chối", lambda: expect(decide(A, s1["id"], "delete").get("error") == "bad_decision"))
role("anon")
test("chưa đăng nhập không duyệt được", lambda: denied(lambda: conn.execute("select public.owner_decide_invite(%s, 'approved', null, null)", (s1["id"],))))
role("postgres")
test("duyệt: ghi mã hồ sơ khách và giờ duyệt", lambda: (decide(A, s1["id"], "approved", None, "tn-123"),
    expect(status(s1["id"]) == "approved" and one("select tenant_id from public.onboarding_invites where id = %s", (s1["id"],)) == "tn-123" and one("select decided_at from public.onboarding_invites where id = %s", (s1["id"],)) is not None)))
test("đã duyệt thì không duyệt hay từ chối lại được", lambda: expect(decide(A, s1["id"], "rejected").get("error") == "not_found" and status(s1["id"]) == "approved"))
s2 = create(); submit(s2["token"])
test("từ chối: ghi lý do, không gắn hồ sơ khách", lambda: (decide(A, s2["id"], "rejected", "Ảnh mờ, nhờ chụp lại", "tn-999"),
    expect(status(s2["id"]) == "rejected" and one("select decision_note from public.onboarding_invites where id = %s", (s2["id"],)) == "Ảnh mờ, nhờ chụp lại"
           and one("select tenant_id from public.onboarding_invites where id = %s", (s2["id"],)) is None)))
test("duyệt và từ chối đều ghi vào nhật ký", lambda: expect(one("select count(*) from public.audit_log where owner_id = %s and action in ('onboarding.approved', 'onboarding.rejected')", (A,)) == 2))

print("Thu hồi và xóa ảnh")
def revoke(owner, id):
    role("authenticated", owner); r = conn.execute("select public.owner_revoke_invite(%s)", (id,)).fetchone()[0]; role("postgres"); return r
rv = create()
test("chủ khác không thu hồi được", lambda: expect(revoke(B, rv["id"]).get("error") == "not_found" and status(rv["id"]) == "pending"))
test("chủ trọ thu hồi link chưa dùng: link chết ngay", lambda: expect(revoke(A, rv["id"]) == {"ok": True} and info(rv["token"]) == {"error": "invalid"} and status(rv["id"]) == "revoked"))
test("hồ sơ đã gửi không thu hồi được (chỉ duyệt hoặc từ chối)", lambda: expect(revoke(A, s1["id"]).get("error") == "not_found"))
def docs_count(owner):
    role("authenticated", owner); n = one("select count(*) from public.onboarding_docs"); role("postgres"); return n
test("chủ A đọc được ảnh hồ sơ của mình, chủ B không thấy ảnh nào", lambda: expect(docs_count(A) >= 1 and docs_count(B) == 0))
def xoa_anh(owner, id):
    role("authenticated", owner); r = conn.execute("select public.owner_delete_invite_docs(%s)", (id,)).fetchone()[0]; role("postgres"); return r
test("chủ khác không xóa được ảnh của A", lambda: expect(xoa_anh(B, s1["id"]).get("error") == "not_found" and one("select count(*) from public.onboarding_docs where invite_id = %s", (s1["id"],)) == 1))
test("chủ trọ xóa ảnh của hồ sơ mình: ảnh biến mất, hồ sơ còn", lambda: expect(xoa_anh(A, s1["id"]) == {"ok": True}
    and one("select count(*) from public.onboarding_docs where invite_id = %s", (s1["id"],)) == 0 and status(s1["id"]) == "approved"))

print("Dọn dữ liệu nhạy cảm")
def cu(status_, ngay, id=None):
    t = create(); submit(t["token"])
    conn.execute("update public.onboarding_invites set status = %s, decided_at = now() - make_interval(days => %s), submitted_data = coalesce(submitted_data, '{}'::jsonb) where id = %s", (status_, ngay, t["id"]))
    return t["id"]
d_rej_old, d_rej_new, d_app_old, d_app_new = cu("rejected", 31), cu("rejected", 10), cu("approved", 31), cu("approved", 5)
purge = one("select public.hh_purge_onboarding()")
has_docs = lambda id: one("select count(*) from public.onboarding_docs where invite_id = %s", (id,)) == 1
test("ảnh hồ sơ bị từ chối quá 30 ngày bị xóa, mới hơn thì giữ", lambda: expect(not has_docs(d_rej_old) and has_docs(d_rej_new), str(purge)))
test("hồ sơ đã duyệt: giữ ảnh cho chủ trọ, nhưng dữ liệu khai quá 30 ngày được xóa khỏi bảng lời mời", lambda: expect(
    has_docs(d_app_old) and one("select submitted_data from public.onboarding_invites where id = %s", (d_app_old,)) is None
    and one("select submitted_data from public.onboarding_invites where id = %s", (d_app_new,)) is not None))
role("authenticated", A)
test("chủ trọ không chạy được hàm dọn dẹp", lambda: denied(lambda: conn.execute("select public.hh_purge_onboarding()")))
role("postgres")

print(f"\n{ok} đạt, {hong} hỏng")
sys.exit(1 if hong else 0)
