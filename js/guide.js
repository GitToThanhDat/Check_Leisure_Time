/* guide.js - Hướng dẫn sử dụng (mở từ Cài đặt). Nội dung viết cho người mới, theo thứ tự từ đầu đến cuối. */
(function (root) {
  'use strict';
  var h = U.h, Guide = {};

  /* Cú pháp nội dung: chuỗi thường = đoạn văn; {ul:[...]} danh sách; {ol:[...]} các bước; {tip:'...'} mẹo; {warn:'...'} lưu ý.
     Trong văn bản, **chữ đậm** dùng để chỉ tên nút / mục trên màn hình. */
  var SECTIONS = [
    { id: 'tong-quan', t: 'Rảnh Chưa? là gì?', c: [
      '**Rảnh Chưa?** giúp nhóm bạn tìm ra giờ cả nhóm cùng rảnh mà không phải hỏi từng người. Mỗi người đánh dấu lịch của mình một lần, ứng dụng tự tìm các khung giờ trùng nhau và gợi ý cho cả nhóm.',
      { ul: [
        '**Phòng**: một nhóm bạn. Bạn có thể ở nhiều phòng cùng lúc (lớp, nhóm học, hội bạn thân…).',
        '**Lịch của tôi**: nơi bạn tô giờ **Rảnh**, **Bận** hoặc **Có thể**. Chỉ cần làm một lần, mọi phòng của bạn đều dùng chung lịch này.',
        '**Nhóm**: xem lịch của cả phòng chồng lên nhau và các giờ chung được gợi ý.',
        '**Chat**: nhắn tin cả phòng hoặc nhóm nhỏ, rủ đi chơi và chốt ai tham gia.',
        '**Cài đặt**: hồ sơ, giao diện, thông báo và quản lý phòng.'] },
      { tip: 'Ứng dụng chạy ngay trên trình duyệt (điện thoại hoặc máy tính), không cần cài đặt gì thêm.' } ] },

    { id: 'bat-dau', t: 'Bắt đầu nhanh trong 5 bước', c: [
      { ol: [
        'Mở trang web, chọn **Tạo tài khoản**, nhập tên hiển thị và mật khẩu (hoặc bấm **Tiếp tục với Google**).',
        'Tạo phòng bằng **Tạo phòng mới**, hoặc dán link mời của bạn bè vào ô **Vào phòng bằng link mời**.',
        'Mở tab **Lịch của tôi**, chọn một màu (**Rảnh**, **Bận**, **Có thể**) rồi kéo trên lịch để tô.',
        'Gửi link mời cho bạn bè (nút link ở danh sách phòng, hoặc trong Cài đặt → Phòng).',
        'Mở tab **Nhóm** để xem **Giờ chung gợi ý**, bấm **Rủ** để chốt giờ đi chơi.'] },
      { tip: 'Không cần tô kín cả tuần. Chỉ cần đánh dấu giờ Bận (học, làm thêm, ngủ) là phần còn lại tự được tính là rảnh khi bạn cũng đánh dấu Rảnh.' } ] },

    { id: 'tai-khoan', t: 'Tài khoản và đăng nhập', c: [
      { ul: [
        '**Tên hiển thị là duy nhất**: không ai khác dùng được tên đã có người đặt, nên bạn bè nhận ra nhau dễ hơn.',
        '**Hai cách đăng nhập**: tên + mật khẩu, hoặc tài khoản Google. Bạn có thể dùng cả hai cho cùng một tài khoản.',
        '**Ghi nhớ đăng nhập**: tick ô này ở màn hình đăng nhập (mặc định bật) thì lần sau mở lại trên cùng trình duyệt và cùng máy sẽ vào thẳng, không cần đăng nhập lại. Bỏ tick nếu đang dùng máy chung.',
        '**Không đổi được tên hiển thị** sau khi tạo (để bạn bè không bị nhầm người). Muốn được gọi khác đi, hãy đặt **biệt danh** trong từng phòng (xem mục Cài đặt cá nhân).',
        '**Liên kết Google / đặt mật khẩu**: bấm vào ảnh đại diện góc trên bên phải (hoặc **Chỉnh sửa tài khoản** trong Cài đặt) → mục **Cách đăng nhập**. Tại đó bạn có thể liên kết Google vào tài khoản hiện có, huỷ liên kết, đặt hoặc đổi mật khẩu.',
        '**Đổi biểu tượng và màu ảnh đại diện**, cũng như **đăng xuất**: đều nằm trong cửa sổ tài khoản này.'] },
      { warn: 'Ứng dụng không dùng email thật nên không có tính năng "quên mật khẩu" qua thư. Hãy nhớ mật khẩu, hoặc liên kết thêm Google để có đường đăng nhập dự phòng.' } ] },

    { id: 'phong', t: 'Phòng: tạo, tham gia, chuyển phòng', c: [
      { ul: [
        '**Tạo phòng**: ở màn hình danh sách phòng bấm **Tạo phòng mới**, đặt tên. Bạn sẽ là chủ phòng.',
        '**Tham gia phòng**: dán link mời vào ô **Vào phòng bằng link mời**, hoặc bấm thẳng vào link bạn bè gửi. Xem tên phòng rồi bấm tham gia.',
        '**Gửi link mời**: bấm biểu tượng link cạnh tên phòng (danh sách phòng) hoặc nút **Copy** trong Cài đặt → Phòng.',
        '**Chuyển phòng**: bấm biểu tượng ngôi nhà ở góc trên bên trái để quay về danh sách phòng của bạn rồi chọn phòng khác.',
        '**Phòng mặc định**: trong Cài đặt → Phòng, tick **Đặt làm phòng mặc định**. Phòng mặc định có ngôi sao ở danh sách. Nếu không đặt, mỗi lần đăng nhập bạn sẽ thấy danh sách phòng để tự chọn.',
        '**Rời phòng**: trong Cài đặt → Phòng. Lịch của bạn trong phòng đó sẽ bị gỡ.'] },
      { tip: 'Bạn có thể ở nhiều phòng cùng lúc mà chỉ phải tô lịch một lần.' } ] },

    { id: 'lich-cua-toi', t: 'Lịch của tôi: đánh dấu giờ rảnh / bận', c: [
      'Đây là phần quan trọng nhất. Càng đánh dấu đầy đủ, gợi ý của nhóm càng chính xác.',
      { ol: [
        'Chọn "cọ" ở thanh phía trên lịch: **Rảnh** (xanh lá), **Bận** (hồng), **Có thể** (vàng, nghĩa là có thể sắp xếp được) hoặc **Xoá**.',
        'Đặt tay (hoặc chuột) lên ô giờ rồi **kéo** để tô. Mỗi ô là 30 phút.',
        'Bấm vào một ô hoặc khối đã tô để chỉnh sửa chi tiết, thêm ghi chú hoặc xoá.'] },
      'Các nút điều hướng:',
      { ul: [
        '**Mũi tên trái/phải**: lùi hoặc tiến theo tuần/ngày. Nút **Hôm nay** đưa bạn về hiện tại.',
        '**3 ngày / 7 ngày**: đổi số ngày hiển thị. Màn hình điện thoại nên dùng 3 ngày cho dễ tô.',
        '**Ô ngày tháng** (có biểu tượng lịch): nhảy tới ngày bất kỳ.'] },
      { h: 'Tô nhiều ngày trong một lần kéo' },
      'Bạn có thể kéo ngang sang các ngày khác trong cùng một lần. Có hai kiểu, chọn ở nút bên phải thanh cọ:',
      { ul: [
        '**Cùng giờ**: mỗi ngày được tô cùng một khung giờ. Ví dụ kéo từ 8h–11h thứ 2 sang thứ 6 sẽ tô 8h–11h cho cả 5 ngày.',
        '**Liền mạch**: tô liên tục từ giờ bắt đầu đến giờ kết thúc, xuyên qua các ngày. Hợp với trường hợp đi du lịch hoặc bận kéo dài nhiều ngày.'] },
      { tip: 'Trong lúc kéo bạn sẽ thấy vùng sẽ được tô hiện mờ trước, thả tay mới lưu.' },
      { h: 'Thói quen lặp lại hàng tuần' },
      'Những thứ lặp lại mỗi tuần (giờ ngủ, giờ học trên lớp, ca làm thêm) không cần tô lại mỗi tuần. Kéo xuống phần **Thói quen lặp lại**:',
      { ul: [
        'Bấm một mẫu có sẵn (ví dụ **Giờ ngủ**) rồi chỉnh giờ và các ngày trong tuần, hoặc bấm **Thêm** để tự tạo.',
        'Có thể giới hạn thói quen từ ngày nào đến ngày nào (ví dụ chỉ trong học kỳ này).',
        'Nếu một ngày cụ thể khác thường, cứ tô trực tiếp lên lịch. Việc cụ thể từng ngày sẽ đè lên thói quen.'] } ] },

    { id: 'nhap-anh', t: 'Nhập lịch từ ảnh bằng AI', c: [
      'Có sẵn thời khoá biểu dạng ảnh? Bạn không cần gõ lại từng ô. Bấm **Nhập từ ảnh lịch (AI)** (trong Cài đặt hoặc ở phần Thói quen lặp lại).',
      { ol: [
        'Chọn **Loại ảnh** (thời khoá biểu, lịch làm việc…), cho biết ảnh thể hiện lúc bạn **Bận** hay **Rảnh**, kiểm tra ô **Hôm nay là** (để AI hiểu "tuần này", "mai"), và điền **Yêu cầu riêng** nếu có (ví dụ "bỏ môn Thể dục").',
        'Bấm **Copy câu lệnh**.',
        'Mở một ứng dụng AI có hiểu ảnh (như Claude hoặc ChatGPT), gửi kèm ảnh thời khoá biểu và dán câu lệnh vừa copy.',
        'AI trả về một đoạn dữ liệu. Copy toàn bộ đoạn đó, dán vào ô trong Rảnh Chưa? và kiểm tra bản xem trước.',
        'Bấm **Nhập vào lịch của tôi**.'] },
      { tip: 'Hãy xem lại bản xem trước trước khi nhập. AI đôi khi đọc sai giờ. Bạn luôn chỉnh lại được trên lịch sau đó.' } ] },

    { id: 'nhom', t: 'Tab Nhóm: tìm giờ chung', c: [
      'Tab **Nhóm** gộp lịch của mọi người trong phòng. Màu càng xanh nghĩa là càng nhiều người rảnh.',
      { ul: [
        '**Ngày / Tuần**: chuyển giữa xem từng ngày chi tiết hoặc cả tuần.',
        '**Giờ chung gợi ý**: danh sách các khung giờ nhiều người rảnh nhất, xếp từ tốt nhất.',
        '**Lọc**: chọn những **người** muốn xét (hoặc **Chỉ mình tôi**), **khung giờ trong ngày** (sáng, trưa, chiều, tối, khuya… hoặc tự chọn giờ bắt đầu và kết thúc) và **các thứ** trong tuần. Mặc định xem cả 0–24h để không bỏ sót giờ khuya.',
        '**Giờ chung gợi ý**: chọn tìm trong **7, 14 hoặc 30 ngày tới**.',
        'Bấm vào một ô để xem **ai rảnh, ai bận, ai chưa chắc**.',
        '**Rủ**: từ một khung giờ gợi ý, bấm **Rủ** để tạo lời mời đi chơi, gửi vào chat của phòng hoặc một nhóm nhỏ.'] },
      { tip: 'Nếu hộp gợi ý trống, thường là chưa đủ người đánh dấu lịch. Nhắc bạn bè vào tab Lịch của tôi nhé.' } ] },

    { id: 'chat', t: 'Chat và kèo hẹn', c: [
      { ul: [
        '**Cả phòng**: kênh chung, ai trong phòng cũng thấy.',
        '**Nhóm nhỏ**: bấm nút **+** ở đầu tab Chat → **Tạo nhóm chat**, đặt tên và chọn thành viên. Mọi thành viên trong nhóm đều có thể đổi tên nhóm (trừ khi phòng đã giới hạn quyền đổi tên).',
        '**Gọi tên**: gõ **@** rồi chọn tên để nhắc một người, hoặc **@all** để nhắc cả nhóm. Tên được gọi hiện màu xanh và người đó nhận thông báo.',
        '**Biệt danh**: nếu ai đó đã đặt biệt danh trong phòng, bạn sẽ thấy biệt danh đó thay cho tên thật trong mọi đoạn chat.'] },
      { h: 'Kèo hẹn (rủ đi chơi)' },
      { ul: [
        'Kèo được tạo từ nút **Rủ** ở tab Nhóm, hoặc **Rủ đi chơi** trong Chat.',
        'Mỗi người trả lời **Tham gia**, **Chưa chắc** hoặc **Không đi**. Số người hiện ngay trên thẻ kèo.',
        'Khi bạn chọn Tham gia, có thể bấm **Đánh dấu Bận trong lịch của tôi** để giữ chỗ trong lịch, tránh bị rủ trùng.'] } ] },

    { id: 'thong-bao', t: 'Thông báo', c: [
      { ul: [
        'Biểu tượng chuông ở góc trên bên phải: chấm đỏ nghĩa là có thông báo mới (ai đó nhắc tên bạn, gọi **@all** hoặc rủ bạn đi chơi). Bấm vào để xem danh sách.',
        'Cài đặt → **Thông báo**: cho phép trình duyệt hiện thông báo nổi. Có thể bật hoặc tắt **âm báo** ở mục Giao diện.',
        'Thông báo nổi chỉ hoạt động **khi trang web đang mở** (kể cả đang ở tab nền). Khi đóng hẳn trang, bạn sẽ thấy các thông báo đó khi mở lại.'] } ] },

    { id: 'cai-dat', t: 'Cài đặt cá nhân', c: [
      { ul: [
        '**Tài khoản của tôi**: bấm **Chỉnh sửa tài khoản** để đổi biểu tượng và màu ảnh đại diện, đổi cách đăng nhập hoặc đăng xuất. Dòng bên dưới tên cho biết vai trò của bạn trong phòng hiện tại.',
        '**Biệt danh trong phòng này**: tên thật của bạn không đổi, nhưng trong phòng hiện tại mọi người sẽ thấy biệt danh bạn đặt. Để trống để dùng lại tên thật. Mỗi phòng đặt một biệt danh riêng.',
        '**Quyền riêng tư**: tick **Cho bạn bè trong phòng này xem tên việc/thói quen của tôi** thì mọi người thấy bạn bận vì việc gì. Bỏ tick thì họ chỉ thấy Rảnh/Bận. Mỗi phòng đặt riêng.',
        '**Giao diện & hình nền**: chọn sáng, tối hoặc theo nền; đổi nền màu, đặt ảnh riêng, chỉnh độ tối và độ mờ. Cài đặt này chỉ áp dụng trên máy của bạn.'] } ] },

    { id: 'quan-ly', t: 'Quản lý phòng và phân quyền', c: [
      'Mỗi phòng có ba vai trò:',
      { ul: [
        '**Chủ phòng**: toàn quyền. Là người duy nhất xoá phòng, chuyển quyền chủ phòng và chỉ định phó phòng.',
        '**Phó phòng**: hỗ trợ quản lý. Được đổi tên phòng, đổi link mời, khoá phòng và xoá thành viên thường. Không thể xoá chủ phòng hay phó phòng khác, và không thể xoá phòng.',
        '**Thành viên**: dùng bình thường, xem được danh sách thành viên, đổi tên phòng/nhóm chat nếu phòng cho phép.'] },
      'Công cụ nằm ở Cài đặt → **Phòng** (chỉ chủ phòng và phó phòng thấy):',
      { ul: [
        '**Đổi link mời**: tạo link mới và **vô hiệu hoá link cũ ngay lập tức**. Người đã ở trong phòng không bị ảnh hưởng. Dùng khi lỡ để lộ link.',
        '**Khoá phòng**: không cho người mới vào, kể cả khi có link.',
        '**Đổi tên phòng**: đổi tên cho tất cả mọi người.',
        'Tick **Chỉ chủ phòng và phó phòng được đổi tên phòng và nhóm chat** nếu bạn muốn hạn chế quyền đổi tên.',
        'Danh sách thành viên bên phải: chỉ định hoặc gỡ **Phó phòng**, chuyển quyền chủ phòng (biểu tượng vương miện), hoặc **Xoá** thành viên khỏi phòng.'] },
      { warn: 'Xoá phòng sẽ mất toàn bộ lịch, chat và kèo của phòng đó, không khôi phục được. Hãy cân nhắc trước khi xác nhận.' } ] },

    { id: 'meo', t: 'Mẹo và hỏi đáp nhanh', c: [
      { ul: [
        '**Tôi tô nhầm?** Chọn cọ **Xoá** rồi kéo qua ô đó, hoặc bấm vào khối để xoá.',
        '**Bạn bè không thấy giờ gợi ý?** Kiểm tra họ đã đánh dấu lịch chưa, và bộ lọc ở tab Nhóm có đang quá hẹp không.',
        '**Link mời báo "đã bị vô hiệu hoá"?** Phòng đã đổi link. Hãy xin link mới từ chủ phòng hoặc phó phòng.',
        '**Không vào được phòng?** Có thể phòng đang khoá hoặc bạn đã bị xoá khỏi phòng.',
        '**Dùng máy chung?** Bỏ tick **Ghi nhớ đăng nhập** và nhớ **Đăng xuất** khi dùng xong.',
        '**Có tốn tiền không?** Không. Toàn bộ ứng dụng miễn phí.',
        '**Dữ liệu của tôi ở đâu?** Lịch, chat và danh sách phòng được lưu trên máy chủ để bạn bè cùng thấy. Ảnh nền và các tuỳ chọn giao diện chỉ lưu trên máy bạn.'] },
      { tip: 'Thói quen tốt nhất: mỗi tuần dành 1 phút mở Lịch của tôi, chỉnh những ngày có lịch khác thường. Nhóm của bạn sẽ chốt giờ nhanh hơn rất nhiều.' } ] }
  ];

  /* **đậm** -> <b> */
  function rich(s) {
    var parts = String(s).split('**'), out = [];
    parts.forEach(function (p, i) { if (!p) return; out.push(i % 2 ? h('b', p) : p); });
    return out;
  }
  function block(x) {
    if (typeof x === 'string') return h('p', rich(x));
    if (x.ul) return h('ul.gd-list', x.ul.map(function (t) { return h('li', rich(t)); }));
    if (x.ol) return h('ol.gd-steps', x.ol.map(function (t) { return h('li', rich(t)); }));
    if (x.tip) return h('div.gd-note.tip', h('b', 'Mẹo'), h('span', rich(x.tip)));
    if (x.warn) return h('div.gd-note.warn', h('b', 'Lưu ý'), h('span', rich(x.warn)));
    if (x.h) return h('h5.gd-sub', x.h);
    return null;
  }

  /** Mở hướng dẫn. start = id mục muốn cuộn tới (tuỳ chọn). */
  Guide.open = function (start) {
    var body = h('div.guide'), toc = h('nav.gd-toc'), content = h('div.gd-body');
    var tocBtns = {};
    SECTIONS.forEach(function (s, i) {
      var b = h('button.gd-tocb', { onclick: function () { go(s.id); } }, h('span.n', String(i + 1)), s.t);
      tocBtns[s.id] = b; toc.appendChild(b);
      content.appendChild(h('section.gd-sec#gd-' + s.id, h('h4', h('span.n', String(i + 1)), s.t), s.c.map(block)));
    });
    content.appendChild(h('p.hint.center', 'Còn thắc mắc? Hỏi chủ phòng hoặc bạn bè trong phòng, hoặc mở lại hướng dẫn này bất cứ lúc nào từ Cài đặt.'));
    body.appendChild(h('p.muted.sm', 'Bấm vào một mục để nhảy tới phần đó, hoặc cuộn xuống đọc từ đầu đến cuối.'));
    body.appendChild(toc); body.appendChild(content);
    var m = U.modal({ title: 'Hướng dẫn sử dụng', wide: true, body: body });
    var scroller = m.el.querySelector('.modal-body');
    function go(id) {
      var t = content.querySelector('#gd-' + id); if (!t) return;
      scroller.scrollTo({ top: Math.max(0, t.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 8), behavior: 'smooth' });
    }
    if (start) setTimeout(function () { go(start); }, 260);
    return m;
  };
  Guide.sections = SECTIONS;
  root.Guide = Guide;
})(window);
