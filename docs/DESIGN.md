# Traffic Hates You v2: tài liệu thiết kế

## 1. Vấn đề của bản v1 (phản hồi người chơi)

| # | Phản hồi | Nguyên nhân gốc |
|---|---|---|
| 1 | "Bấm 1 nút tự vút lên 75 km/h rồi không cứu được" | Bàn phím là bật/tắt, xe đạt tốc độ tối đa (4.4 px/khung ≈ 75 km/h) chỉ sau ~6 khung hình. Không có cách chạy ở tốc độ trung bình. Trời mưa thì phanh chỉ còn 0.07/khung nên gần như không dừng được. |
| 2 | "Camera tốc độ không thể qua được" | Giới hạn 2.4 px/khung (~41 km/h) nhưng bàn phím chỉ có 0 hoặc 75 km/h. Muốn qua chỉ còn cách nhấp phím liên tục. |
| 3 | "Game chưa đủ mất dạy" | Bẫy chỉ có một kiểu: đi tới thì bẫy bật. Thiếu các kiểu troll đặc trưng của Trees Hate You: môi trường **chủ động tấn công**, **trừng phạt đúng lúc bạn vừa tưởng đã qua**, và **phản đòn lại lời giải bạn vừa học được**. |

## 2. Tham khảo: Trees Hate You

Rage game kiểu "Unfair Mario": cây cối đấm, bắn đại bác, thả đồ rơi vào người chơi. Cái hài nằm ở việc game **cố ý lừa**:

- Bạn có tiến bộ thì nó hành bạn ngay đúng chỗ đó.
- Bạn tìm ra lời giải thì nó đổi đề.
- Thứ trông an toàn nhất lại là bẫy.

Bản v2 áp dụng ba nguyên tắc này vào bối cảnh giao thông Sài Gòn, kèm một ràng buộc: **mỗi cái chết phải học được**. Bẫy đều tất định, có tín hiệu báo trước (tiếng kẽo kẹt, vòng đỏ dưới đất, chữ "xào xạc...", biển báo) và màn nào cũng có bot chứng minh qua được.

## 3. Điều khiển và cảm giác lái (sửa #1, #2)

- **Tay ga có quán tính.** Bấm phím là lên ~34 km/h gần như ngay. Muốn vượt mức đó phải giữ thêm khoảng 1 giây mới lên tối đa ~68 km/h. Nhả phím là phanh: trời khô dừng trong ~0.25 giây, trời mưa trong ~0.6 giây (trơn nhưng vẫn cứu được).
- **Đánh lái tách khỏi tăng tốc.** Bẻ lái ở tốc độ cao vẫn nhạy, không bị kẹt tốc độ như bản cũ.
- **Nút chạy chậm.** Giữ Shift / X / L, nút 🐢 trên điện thoại hoặc B/LB/RB trên tay cầm thì xe chạy đều ~34 km/h. Cần analog thì kéo nhẹ là chạy chậm.
- **Cú nhảy có lực đẩy.** Nhảy tại chỗ cũng được đẩy tới ~48 km/h theo hướng cần gạt, nên đứng yên vẫn nhảy qua được hố 1 ô. Lấy đà thì bay xa ~2 ô.
- **Đồng hồ tốc độ hiện giới hạn** của camera hoặc gờ giảm tốc gần nhất (`39 km/h · ≤40`), chuyển đỏ khi vi phạm. Camera cho ~5 khung hình ân hạn để lỡ chạm vạch không bị phạt oan.

## 4. Bộ troll mới

| Cơ chế | Cách troll | Cách qua |
|---|---|---|
| **Bẫy theo lượt** (`first` / `retry`) | Chết một lần là bẫy đổi chỗ: ổ gà dời đúng chỗ bạn đáp, đèn đỏ chớp xanh giả, cột điện đổ hướng khác, thúng chìm nhanh gấp đôi, giàn giáo "an toàn" sập, cây đổ đúng chỗ bạn đứng chờ lần trước | Nhìn kỹ lại màn sau mỗi lần chết |
| **Đích giả** (`fakewin`) | Hiện thẻ "QUA MÀN!" kèm nhạc thắng, rồi thả cục nóng máy lạnh xuống chỗ bạn đứng. Đích thật xuất hiện ở chỗ khác (màn 1: ngay chỗ xuất phát) | Đừng đứng ăn mừng, chạy tiếp |
| **Cành cây đấm** (`branch`) | Cây vươn cành ra đấm ngang đường theo chu kỳ | Canh nhịp. Có vạch đỏ dưới đất và chữ "xào xạc..." báo trước |
| **Bà tầng 2 ném dép / tạt nước** (`thrower`) | Ném vào chỗ bạn **sắp tới**, không phải chỗ bạn đang đứng. Chạy thẳng đều là dính | Đổi tốc độ hoặc hướng khi thấy vòng đỏ |
| **Cửa ô tô** (`door`) | Bật ra đúng lúc bạn chạy ngang | Chạy chậm lại, đợi cửa mở rồi nhảy qua |
| **Gờ giảm tốc** (`bump`) | Chạy quá tốc độ là bị hất lên mớ dây điện | Giữ Shift, hoặc nhảy qua |
| **Vũng nhớt** (`oil`) | Mất lái, không phanh được, cứ thế trượt (màn 5: trượt thẳng vào ổ gà) | Vào nhớt với tốc độ cao rồi nhảy từ trên vũng nhớt |
| **Camera tốc độ tối thiểu** | Vừa bắt chạy chậm xong lại bắt chạy nhanh | Đọc biển xanh "TỐI THIỂU 25" |
| **Cuộc gọi troll** (`call`) | Sếp, mẹ, người yêu cũ, ngân hàng, app xe ôm gọi tới, che nửa màn hình đúng lúc gay cấn. Không chặn thao tác | Bình tĩnh |
| **Đứng yên bị khịa** | Đứng yên quá 5 giây thì game nói: "Sợ hả? 🐔" | |
| **Thẻ chết** | Thêm "chết y chang N lần rồi" và câu khịa tăng dần theo số lần chết | |
| **Nút "Gọi xe ôm"** (trước đây là "Gọi Grab", đã đổi tên chung để không dùng thương hiệu thật) | Hiện sau 6 lần chết. Lần bấm đầu tài xế luôn hủy (+1 phút), bấm lần hai mới bỏ qua màn (+15 phút, lượt chơi không tính kỷ lục) | Van cầu cứu, có tính phí |
| **Nút CHƠI** | Lần đầu đưa chuột vào thì nút né đi chỗ khác | |

Chó đã bỏ cuộc ("...thôi mệt") nằm yên và không cắn nữa. Bẫy troll thì phải biết đường đỡ được, không để kẻ thù vô hình giết người chơi.

## 5. Danh sách màn (v2)

| Màn | Troll chính | Đổi sau khi chết |
|---|---|---|
| 1 Hẻm 42 | Hướng dẫn nói dối, gờ giảm tốc, **đích giả**, đích thật ở chỗ xuất phát | Ổ gà tàng hình dời tới đúng chỗ bạn đáp |
| 2 Chó Nhà Ai | Bầy chó, nắp cống phun, sếp gọi, đích bỏ chạy | |
| 3 Đèn Đỏ Đầu Hẻm | Gờ giảm tốc trước đèn đỏ, ninja tạt đầu | Đèn chớp xanh giả rồi đỏ lại |
| 4 Chợ Sáng | Bà cụ, xe bánh mì, **bà tầng 2 ném dép**, mẹ gọi | |
| 5 Ngược Chiều | Xe ngược chiều, **vũng nhớt trượt vào ổ gà** | Cột điện đổ hướng ngược lại, đợi bạn tới mới đổ |
| 6 Ngã Tư Bảy Hiền | Camera 40 km/h rồi **camera tối thiểu 25 km/h** ngay trước đèn đỏ | |
| 7 Trạm Xe Buýt | Đi nhờ nóc xe buýt qua triều cường, ngân hàng báo phạt nguội | |
| 8 Ô Tô Đỗ Bậy | Nhảy nóc xe, băng rôn thấp, người yêu cũ nhắn | |
| 9 Mưa Rào | Mưa trơn, vũng nước là hố | Vũng nước đầu tiên cũng thành hố |
| 10 Triều Cường | Nhảy thúng, người yêu cũ gọi giữa sông | Thúng thứ 4 chìm nhanh gấp đôi |
| 11 Kẹt Xe | Đi trên nóc xe, xe ôm công nghệ hủy chuyến | |
| 12 Cây Ghét Bạn | **Cây đấm**, cây đổ, chó | Cây đổ sang hướng khác |
| 13 Công Trình | Giàn giáo, thép rơi, sếp gọi | Giàn giáo cuối "an toàn" cũng sập |
| 14 Bãi Giữ Xe | **Cửa ô tô bật ra**, cổng tự đóng, **đích giả** | |
| 15 8:00 Sáng | Mọi thứ cùng lúc, gờ giảm tốc, bà tạt nước ở đích | |

## 6. Kiểm thử

- `scripts/mechanics.mjs`: kiểm tra cảm giác lái (lên cruise trong 10 khung, tối đa sau ~1 giây, nhả là dừng, Shift khóa tốc độ, bẻ lái ở tốc độ cao) và từng bẫy troll đều cắn được nhưng cũng đỡ được.
- `scripts/smoke-test.mjs`: bot tự chơi 15 màn hai lần, ở lần chơi đầu (attempt 0) và sau khi bẫy đổi (attempt 5). Bot tự né dép, nhảy qua chó và xe máy.

## 7. v3: bản đồ lớn liền mạch + checkpoint

Phản hồi: "map phải nối tiếp nhau, map lớn, có checkpoint như game gốc; xe chạy qua không cần báo trước, bẫy random, cây đổ nhanh, mất dạy hơn".

- **Mỗi chương là một bản đồ** (`src/game/stages.js`): các màn cũ thành *khu*, xếp trái sang phải, nối bằng hẻm. Đường hẻm được tìm tự động (Dijkstra, phạt rẽ) và không được chạm vào bất kỳ mặt đường nào khác của khu, nên không có đường tắt.
- **Cổng checkpoint** ở mép khu, ngay cạnh đích thật: đóng cho tới khi về đích khu đó. Chết thì hồi sinh ngay sau cổng gần nhất; các khu đã qua chỉ giữ cảnh vật, không giữ bẫy đuổi theo.
- **Bẫy hẻm ngẫu nhiên, không báo trước**, xếp lại sau mỗi lần chết (seed theo chương/khu/số lần chết nên mô phỏng vẫn tất định): ổ gà mở ngay trước bánh xe, cây ven hẻm đổ ngang (~15 khung hình), cục nóng/chậu cây rơi trúng chỗ đang đứng, xe máy ninja lao từ sau lưng (không còi, không bong bóng). Tối đa 2 xe ninja mỗi hẻm, bẫy cách nhau 3–5 ô.
- **Xe cộ không còn cảnh báo**: bỏ mũi tên "BÍÍP!" ở mép màn hình, bỏ tiếng còi khi xe xuất hiện và bong bóng "TRÁNH RA!".
- **Cây/cột điện đổ nhanh gấp đôi**, gần như không rung lắc báo trước.
- Cách qua (bot trong `scripts/stage-test.mjs` chứng minh với 20 lần xếp bẫy cho mỗi hẻm): trời khô chạy nhanh để vượt ổ gà; ổ gà mở sát quá thì phanh, nhích tới mép rồi nhảy; cây đổ phía trước thì phanh, đổ xong nhảy qua thân cây; có gì rơi xuống thì đạp ga; xe ninja thì dừng lại và nhảy khi nó cách ~90 px. Trời mưa phanh yếu nên phải chạy chậm.
