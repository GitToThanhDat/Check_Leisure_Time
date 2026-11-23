# Rảnh Chưa? — Hướng dẫn cài đặt (miễn phí 100%, không cần thẻ)

Web này là các file tĩnh (HTML/CSS/JS), dữ liệu đồng bộ qua **Firebase Realtime Database (gói Spark)**, đặt trên **GitHub Pages**. Cả hai đều miễn phí và không đòi thẻ tín dụng.

## 0. Các file trong thư mục

| File | Việc của nó |
|---|---|
| `index.html` | Trang chính |
| `css/style.css` | Giao diện, màu, font |
| `js/config.js` | **Chỗ duy nhất bạn phải sửa:** dán cấu hình Firebase |
| `js/schedule.js` | Logic lịch rảnh/bận, tìm giờ chung, đọc file import |
| `js/store.js` | Kết nối Firebase (đăng nhập + dữ liệu), hoặc chế độ thử lưu trong trình duyệt |
| `js/app.js`, `view-*.js`, `import.js`, `bg.js`, `util.js` | Các màn hình và tính năng |
| `database.rules.json` | Luật bảo mật dán vào Firebase (**bản mới, dùng tài khoản**) |
| `tools/seed-demo.html` | Trang tạo dữ liệu mẫu (phòng "Ổ Rắn Độc A1" + 3 tài khoản AI Test) |
| `tests/` | Test tự động (không bắt buộc): `schedule.test.js`, `e2e*.py` |

## 1. Thử ngay trên máy (chưa cần Firebase)

Để nguyên `js/config.js` (`window.FIREBASE_CONFIG = null`). Mở `index.html` bằng cách nhấp đúp, hoặc tốt hơn là chạy một web server nhỏ trong thư mục này:

```
python -m http.server 8000
```

rồi vào `http://localhost:8000`. Ở chế độ này tài khoản và dữ liệu đều lưu trong trình duyệt của bạn (có dải cảnh báo màu vàng), dùng để xem thử giao diện. Muốn bạn bè thấy lịch của nhau thì làm tiếp bước 2 và 3.

## 2. Tạo Firebase (khoảng 5 phút)

Giao diện Firebase đôi khi đổi tên nút một chút, nhưng các bước vẫn tương tự.

1. Vào https://console.firebase.google.com, đăng nhập Google, bấm **Create a project** (Thêm dự án). Đặt tên, ví dụ `ranh-chua`. Có thể **tắt Google Analytics** cho gọn. Bấm tạo.
2. Ở menu trái chọn **Build → Realtime Database → Create Database**.
   - Location: chọn **Singapore (asia-southeast1)** cho gần Việt Nam.
   - Security rules: chọn **Start in locked mode** (sẽ dán luật ở bước sau).
   - Không có bước nào đòi thẻ. Nếu thấy yêu cầu nâng cấp gói Blaze thì bạn đang bấm nhầm sang Firestore/Functions/Storage; Realtime Database dùng gói Spark là đủ.
3. Vào tab **Rules** của Realtime Database, xoá nội dung cũ, **dán toàn bộ nội dung file `database.rules.json`**, bấm **Publish**. (Nếu trước đây bạn đã dán luật cũ, kể cả bản tài khoản đầu tiên, **hãy dán lại bản mới**: bản này thêm mục `names` để giữ tên duy nhất cho cả đăng nhập Google.)
4. **Bật đăng nhập bằng tài khoản (bắt buộc):** menu trái **Build → Authentication → Get started → Sign-in method**.
   - Bật **Email/Password** (chỉ mục đầu tiên, không cần "Email link") → Save. Web không gửi email thật: tên đăng nhập được đổi thành email giả dạng `ten@ranhchua.app`, nên **không có quên mật khẩu qua email**.
   - Bật **Google** (khuyên dùng, để người dùng khỏi lo quên mật khẩu) → chọn email hỗ trợ dự án → Save.
   - Vào **Authentication → Settings → Authorized domains → Add domain**, thêm domain GitHub Pages của bạn (ví dụ `gittothanhdat.github.io`, chỉ phần tên miền, không có `https://` hay đường dẫn). Thiếu bước này nút Google báo `auth/unauthorized-domain` trên web thật (`localhost` có sẵn).
5. Lấy cấu hình: bấm bánh răng cạnh "Project Overview" → **Project settings** → cuộn xuống **Your apps** → bấm biểu tượng web **`</>`** → đặt nickname (không cần tích Firebase Hosting) → **Register app**. Bạn sẽ thấy đoạn `const firebaseConfig = { ... }`.
6. Mở `js/config.js`, thay `null` bằng đoạn đó, ví dụ:

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "ranh-chua.firebaseapp.com",
  databaseURL: "https://ranh-chua-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ranh-chua",
  appId: "1:1234567890:web:abcdef"
};
```

**Lưu ý quan trọng:** phải có dòng `databaseURL`. Nếu đoạn Firebase cho bạn không có dòng này, vào **Realtime Database → tab Data**, đường link màu xanh ở đầu trang (dạng `https://....firebasedatabase.app`) chính là `databaseURL`; hãy thêm vào.

Việc để `apiKey` công khai trong code là bình thường với Firebase: an toàn dựa vào luật ở bước 3, không dựa vào việc giấu key.

## 3. Đưa lên GitHub Pages

1. Tạo tài khoản https://github.com (miễn phí) → **New repository** → đặt tên (ví dụ `ranh-chua`), chọn **Public** → Create.
2. Bấm **uploading an existing file**, kéo thả **toàn bộ nội dung thư mục** (gồm `index.html`, thư mục `css`, `js`, ...). Nhớ là đã sửa `js/config.js`. Bấm **Commit changes**.
3. Vào **Settings → Pages** → mục *Build and deployment*: Source chọn **Deploy from a branch**, Branch chọn **main** và thư mục **/(root)** → **Save**.
4. Đợi 1–2 phút, GitHub hiện link dạng `https://<tên-bạn>.github.io/ranh-chua/`. Đó là link web của bạn (có HTTPS).

Cách khác: kéo thả thư mục lên https://app.netlify.com/drop hoặc Vercel cũng cho link công khai miễn phí.

Khi cần sửa web sau này: sửa file rồi upload lại lên repo, đợi 1–2 phút.

## 4. Dùng với bạn bè

1. Mở link web, có hai cách vào:
   - **Tiếp tục với Google**: lần đầu bạn chỉ cần đặt một **tên hiển thị** (+ biểu tượng, màu). Bạn bè chỉ thấy tên này, không thấy email Google.
   - **Tạo tài khoản** bằng **tên** + **mật khẩu (từ 6 ký tự)**. Lần sau **Đăng nhập** bằng đúng tên + mật khẩu.
   
   Tên luôn là duy nhất cho cả hai cách: không phân biệt hoa/thường, dấu, khoảng trắng (`Nguyễn An` và `nguyen an` là một), nên không ai trùng tên ai.
   - **Ghi nhớ đăng nhập:** ô "Ghi nhớ đăng nhập trên máy này" mặc định bật; lần sau mở lại web bằng cùng trình duyệt trên cùng máy sẽ tự vào, không phải đăng nhập lại. Bỏ tích ô này trên máy dùng chung: đóng tab là phải đăng nhập lại. Bấm **Đăng xuất** (avatar → Tài khoản) để xoá phiên đăng nhập.
2. Sau khi đăng nhập bạn thấy **danh sách phòng riêng của bạn** (chỉ bạn thấy). Phòng bạn tạo hoặc đã tham gia luôn nằm ở đây, nên **không bao giờ "mất" phòng** dù quên link. Phòng mở gần đây nhất nằm trên cùng.
3. **Tạo phòng mới** → đặt tên phòng → bạn là **chủ phòng**. Link mời lấy ở tên phòng (góc trên trái) hoặc ở Cài đặt → Mời bạn; có thể copy lại bất cứ lúc nào.
4. Bạn bè mở link (dạng `.../#r=mã-phòng`) → đăng nhập hoặc tạo tài khoản → tự vào phòng. Cũng có thể dán link hoặc mã phòng vào ô "Dán link mời hoặc mã phòng" ở màn hình danh sách phòng.
5. **Quyền chủ phòng:** xoá (mời ra) bất kỳ thành viên nào, đổi tên phòng, **khoá phòng** (không cho người mới vào), chuyển quyền chủ cho thành viên khác, xoá phòng. **Thành viên** có nút **Rời phòng** (Cài đặt → Quản lý phòng); phòng biến mất khỏi danh sách của họ.
6. **Tài khoản của tôi** (bấm vào avatar): đổi biểu tượng, màu, **cách đăng nhập**:
   - Người đã có tài khoản tên + mật khẩu bấm **Liên kết Google** để sau này đăng nhập bằng Google cũng vào **đúng tài khoản cũ** (giữ nguyên phòng, lịch, tin nhắn). Muốn bỏ thì **Huỷ liên kết** (cần còn một cách đăng nhập khác).
   - Người vào bằng Google bấm **Đặt mật khẩu** để cũng đăng nhập được bằng tên + mật khẩu.
   - Một email Google chỉ gắn được với một tài khoản. Nếu bạn đã đăng nhập Google và tạo một tài khoản riêng trước đó, hai tài khoản này là hai người khác nhau trên web (không tự gộp).

### Xem thử bằng dữ liệu mẫu

Mở `tools/seed-demo.html` (qua link web hoặc server local, cùng nơi chạy web đã nối Firebase), nhập **một mật khẩu bạn tự chọn**, bấm tạo. Trang sẽ tạo tài khoản `Demo`, `AI Test 1`, `AI Test 2`, `AI Test 3`, phòng **Ổ Rắn Độc A1** (mã `orandoca1`, chủ phòng là `Demo`), lịch rảnh/bận của **tuần hiện tại** và vài tin nhắn + một kèo hẹn. Bạn đăng nhập `Demo` với mật khẩu vừa chọn, rồi gửi link `.../#r=orandoca1` cho người muốn xem ví dụ (họ tự tạo tài khoản của họ). Lịch mẫu theo đúng tuần lúc chạy, nên sang tuần khác hãy chạy lại trang để làm mới. Mật khẩu demo **không** nằm trong code/repo.

### Các màn hình

- **Lịch của tôi**: bấm ngày ở đầu trang để **nhảy nhanh tới ngày bất kỳ** (chọn tháng/năm, ví dụ tháng 1 năm sau); kéo trên lịch để tô **Rảnh / Bận / Có thể** (chọn màu cọ ở trên). Chạm một lần để sửa chi tiết, đặt tên, hoặc cho lặp lại. Trên điện thoại: **giữ ngón tay một chút rồi kéo** (vuốt nhanh thì chỉ cuộn trang). Phần **Thói quen lặp lại** có mẫu sẵn (ngủ, đi học, đi làm, ăn trưa, tối rảnh...). Việc cụ thể từng ngày luôn đè lên thói quen.
- **Nhóm**: xem lịch mọi người (cả **0–24h**, có chip "Đêm khuya" để thu gọn/mở rộng, nút nhảy ngày, lọc người bằng danh sách có tìm kiếm) theo **Ngày** (mỗi người một hàng) hoặc **Tuần** (ô càng xanh càng nhiều người đi được). Nút **Lọc**: chọn người, khung giờ (sáng/chiều/tối), các thứ trong tuần, cách tính (chỉ Rảnh / Rảnh+Có thể / Không bận), thời lượng tối thiểu, số người cần có mặt. Phần **Giờ chung gợi ý** tự liệt kê các khung giờ hợp; bấm **Rủ** để lập kèo.
- **Chat**: phòng chung và các nhóm nhỏ. Gõ `@` để tag một người hoặc `@all` (chữ tag hiện màu xanh); người bị tag nhận chuông, chấm đỏ và popup. Trong **Thông tin nhóm** (biểu tượng bút ở đầu khung chat) có thể đặt **biệt danh** cho từng người như Messenger (chỉ áp dụng trong cuộc trò chuyện đó). **Kèo hẹn** có ngày giờ, địa điểm, nút Tham gia / Chưa chắc / Không đi, và nút đánh dấu Bận vào lịch của mình.
- **Cài đặt**: hồ sơ, sáng/tối, **nền động** (cực quang, sao đêm, cánh hoa, sóng biển, êm dịu) hoặc **ảnh của bạn**, mời bạn, quản lý phòng.

## 5. Nhập lịch từ ảnh bằng AI

Web miễn phí không có sẵn AI đọc ảnh, nên cách làm là:

1. Bấm **Nhập từ ảnh lịch (AI)** → **Copy câu lệnh**.
2. Mở ChatGPT, Gemini hoặc Claude, dán câu lệnh và **đính kèm ảnh chụp lịch**.
3. Copy kết quả JSON AI trả về, dán vào ô số 2 (hoặc lưu thành file `.json` rồi chọn file). Web kiểm tra và hiển thị trước những gì đọc được.
4. Bấm **Nhập vào lịch của tôi**. Nhập lại lần sau có thể **thay thế** đợt nhập cũ.

Câu lệnh mặc định lấy ngày hôm nay từ đồng hồ máy bạn để AI hiểu "thứ 3 tuần này", nhưng bạn có thể **sửa ngày tham chiếu** (ví dụ khi chụp lịch của tuần khác), chọn loại lịch, chọn có/không ghi đè phần Rảnh, và **thêm yêu cầu riêng của bạn** vào câu lệnh; các lựa chọn được nhớ cho lần sau. Nếu lịch của bạn ghi theo **Slot/tiết**, mở mục "Thêm bảng giờ" trong cửa sổ và dán bảng giờ của trường (ví dụ `Slot 1: 07:00–09:15`). Nút **Tải lịch của tôi (JSON)** dùng để sao lưu hoặc chép lịch sang phòng khác.

## 6. Giới hạn cần biết

- **Thông báo chỉ hoạt động khi web đang mở** (kể cả tab nền, màn hình khoá thì tuỳ điện thoại). Push thật khi đã đóng hẳn web cần một máy chủ nhỏ gửi push; có cách miễn phí (Cloudflare Workers + Web Push) nhưng phức tạp hơn nhiều.
- **Quên mật khẩu là không khôi phục được qua email** (vì dùng email giả). Cách xử lý: tạo tài khoản mới với tên khác, hoặc bạn (chủ dự án) xoá tài khoản đó trong Firebase Console → Authentication rồi người đó đăng ký lại cùng tên.
- **Bảo mật vẫn ở mức "nhóm bạn thân"**: phòng không hiện công khai, nhưng ai biết mã phòng thì vào được. Nhóm chat nhỏ bị hạn chế đọc bởi luật, song đừng ghi thông tin nhạy cảm (mật khẩu, số thẻ...) vào chat hay tên sự kiện. Người bị chủ phòng mời ra vẫn có thể vào lại bằng link, trừ khi phòng đã **khoá**.
- Hạn mức Spark: 1 GB lưu trữ, 10 GB tải/tháng, 100 kết nối cùng lúc. Một nhóm vài chục người dùng thoải mái.
- Dữ liệu nền/ảnh nền chỉ lưu trên máy mỗi người, không đồng bộ.
- **Đăng nhập Google trên điện thoại:** web dùng cửa sổ popup; nếu trình duyệt chặn thì tự chuyển sang kiểu chuyển trang, nhưng kiểu này đôi khi hỏng trên Safari/iPhone do trình duyệt chặn lưu trữ bên thứ ba. Gặp vậy hãy cho phép popup, hoặc dùng tên + mật khẩu.
- Chế độ thử (chưa nối Firebase) **không có Google thật**: nút Google hỏi một email bất kỳ để giả lập.
- Phòng tạo bằng bản PIN cũ **không dùng được** với bản tài khoản (cấu trúc dữ liệu khác); hãy tạo phòng mới. Có thể xoá dữ liệu cũ trong Realtime Database → Data.

## 7. Gặp lỗi?

| Hiện tượng | Cách xử lý |
|---|---|
| Dải vàng "chế độ thử" vẫn hiện | `js/config.js` chưa dán cấu hình, hoặc thiếu `databaseURL` |
| "Permission denied" trong Console (F12) | Chưa Publish luật ở bước 2.3 (phải là bản mới), hoặc dán thiếu |
| Đăng ký/đăng nhập báo lỗi `operation-not-allowed` hoặc `configuration-not-found` | Chưa bật Email/Password hoặc Google ở bước 2.4 |
| Nút Google báo `unauthorized-domain` | Chưa thêm domain web vào Authorized domains (bước 2.4) |
| Google báo "Chưa cập nhật Rules" / Permission denied khi đặt tên | Rules chưa là bản mới có mục `names` (bước 2.3) |
| Đăng nhập báo sai mật khẩu dù chắc chắn đúng | Tên bị trùng sau khi bỏ dấu/hoa thường với tài khoản khác; thử đúng tên đã đăng ký |
| Không tìm thấy phòng | Phòng tạo ở chế độ thử không tồn tại trên Firebase; tạo lại sau khi nối Firebase |
| Sửa code rồi web không đổi | Đợi 1–2 phút rồi tải lại bằng Ctrl+F5 |
| Chấm kết nối đỏ | Mất mạng hoặc `databaseURL` sai vùng |
