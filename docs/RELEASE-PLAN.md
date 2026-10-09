# Kế hoạch phát hành Traffic Hates You v3.0

*Lập ngày 09/10/2026. Các con số về nền tảng lấy từ bài tổng hợp của bên thứ ba (nguồn ở cuối file). Trước khi ký hoặc nộp game, kiểm tra lại trên trang dành cho nhà phát triển của từng nền tảng.*

## 1. Tóm tắt: phát hành ở đâu

Game có ba đặc điểm quyết định chọn nền tảng:

- **Tiếng Việt và tiếng Anh, bối cảnh Sài Gòn.** Người chơi hợp nhất là người Việt; từ bản v3.1 đã có tiếng Anh (tự chọn theo trình duyệt) để lên các cổng game nước ngoài.
- **Chạy trên web (HTML5), nhẹ (~2 MB), có offline, có điều khiển cảm ứng.** Đăng lên web gần như không tốn gì; lên app store thì phải đóng gói thêm.
- **Thể loại rage game "chết là cười".** Loại này lan truyền nhờ clip ngắn (TikTok, Reels, YouTube Shorts) hơn là nhờ người ta lướt cửa hàng ứng dụng.

**Khuyến nghị: tập trung vào web và clip ngắn trước, lên cửa hàng ứng dụng sau.**

| Ưu tiên | Kênh | Lý do | Chi phí | Khi nào |
|---|---|---|---|---|
| 1 | **Link web của mình** (GitHub Pages, nên mua tên miền riêng) | Đã chạy sẵn, chia sẻ link là chơi ngay, giữ 100% doanh thu nếu sau này gắn quảng cáo | Miễn phí, tên miền ~250–350k/năm | Ngay |
| 1 | **TikTok / Facebook Reels / YouTube Shorts** (kênh quảng bá, không phải nơi đặt game) | Rage game lan nhanh nhờ clip "chết lãng xẹt"; khán giả Việt đông nhất ở đây | Miễn phí, tốn thời gian quay | Ngay, đều đặn |
| 2 | **itch.io** | Đăng trong vài phút, không cần duyệt, giữ 90% doanh thu, có trang để nhận ủng hộ | Miễn phí | Tuần 1 |
| 3 | **CrazyGames** | Cổng game web lớn (khoảng 35 triệu người dùng/tháng), chia doanh thu quảng cáo | Phải có bản tiếng Anh và tích hợp SDK | Tháng 1–2 |
| 3 | **Poki** | Cổng lớn nhất (khoảng 60–100 triệu người dùng/tháng tuỳ nguồn) nhưng duyệt rất gắt | Tiếng Anh, SDK, chơi thử nhiều vòng | Sau CrazyGames |
| 4 | **Google Play** (đóng gói PWA bằng Bubblewrap) | Người Việt chủ yếu dùng Android; có app trong cửa hàng giúp game trông "thật" hơn | 25 USD một lần + 12 người thử trong 14 ngày | Tháng 2–3 |
| — | App Store (iOS) | Chưa nên: 99 USD/năm, cần máy Mac, Apple hay từ chối app chỉ bọc trang web | — | Để sau |
| — | Zalo Mini App, TikTok Mini Games | Chưa tìm được hướng dẫn hiện hành cho game; cần tự hỏi Zalo/TikTok | — | Theo dõi |

## 2. Giai đoạn 1 (tuần 1–2): ra mắt bản web cho người Việt

**Mục tiêu:** 1.000 lượt chơi đầu tiên, và biết người chơi bỏ cuộc ở đâu.

1. **Tên miền riêng** (ví dụ `traffichatesyou.vn` hoặc `.com`) trỏ về GitHub Pages: link ngắn, dễ nhớ, dễ in lên clip.
   - Nhớ đổi `og:url` và `og:image` trong `game.html` sang tên miền mới.
2. **Gắn thống kê** dạng không cookie (Cloudflare Web Analytics hoặc GoatCounter, cả hai miễn phí). Nên đo:
   - số lượt vào trang, tỉ lệ bấm CHƠI;
   - người chơi tới được chương mấy, chết bao nhiêu lần trước khi bỏ;
   - tỉ lệ dùng điện thoại so với máy tính.
3. **Ảnh chia sẻ mới:** ảnh hiện tại là cảnh của bản cũ (nhìn từ sau lưng, đường thẳng). Nên dựng lại một ảnh chụp từ trên cao có cổng checkpoint, ổ gà và xe ninja để khớp lối chơi thật.
4. **Quay 10–15 clip ngắn** trước ngày ra mắt rồi đăng đều mỗi ngày. Gợi ý nội dung:
   - "Tưởng qua màn rồi..." (đích giả + cục nóng rơi);
   - "Bà cụ qua đường mạnh nhất Sài Gòn";
   - "Xe ninja không còi";
   - "Chết 47 lần ở một ổ gà";
   - quay phản ứng của bạn bè lần đầu chơi.
   - Mỗi clip để link trong bio/bình luận. Thử thách gợi ý: "**Ai tới công ty trước 8:00?**" (đồng hồ trong game đã sẵn để khoe).
5. **Đăng vào các nhóm Facebook** game indie Việt, nhóm meme giao thông, nhóm dân văn phòng Sài Gòn. Đăng kèm clip, đừng chỉ đăng link.
6. **Gửi cho vài kênh streamer/YouTuber Việt** hay chơi rage game hoặc game troll. Chỉ cần một video là đủ cú hích.

## 3. Giai đoạn 2 (tuần 2–4): itch.io

- Làm theo mục "itch.io" trong `README.md`: `npm run build`, nén **nội dung** thư mục `dist`, tạo dự án HTML.
- Khung 1280×720, bật *Mobile friendly* (Landscape) và *Fullscreen button*.
- Trang game viết song ngữ Việt–Anh, có 3–5 ảnh và 1 GIF chết hài.
- Đặt giá "0 hoặc tuỳ tâm" để nhận ủng hộ.
- Gắn tag: `rage`, `troll`, `funny`, `traffic`, `vietnam`, `3d`, `browser`, `mobile`.
- Tham gia một game jam hoặc sự kiện "rage game" trên itch.io để có thêm lượt xem miễn phí.

## 4. Giai đoạn 3 (tháng 1–2): bản tiếng Anh và các cổng game lớn

Các cổng như CrazyGames và Poki chủ yếu phục vụ người chơi nước ngoài, nên **bản tiếng Anh là điều kiện bắt buộc**.

**Việc kỹ thuật cần làm:**

- [x] **Bản tiếng Anh** (xong ở v3.1): từ điển `src/lang/en.js`, tự chọn theo ngôn ngữ trình duyệt, có nút đổi trong Cài đặt; `npm test` báo nếu có câu tiếng Việt chưa dịch. Bảng hiệu phố cố ý giữ tiếng Việt.
  - Nên nhờ một người bản xứ đọc lại các câu đùa trước khi nộp cổng game.
- [ ] **Tích hợp SDK của cổng game:** lưu tiến trình theo SDK, gọi quảng cáo đúng chỗ, báo lúc bắt đầu và dừng chơi.
  - **Chỗ chèn quảng cáo hợp lý:** giữa các chương (màn hình giới thiệu chương), và sau khoảng 5 lần chết (không phải lần nào chết cũng chèn).
  - Có thể thêm "xem quảng cáo để được hồi sinh tại chỗ", thay cho nút Gọi xe ôm.
- [ ] **Bỏ các link ra ngoài trong bản dành cho cổng game** (nút chia sẻ) nếu cổng yêu cầu.
- [ ] **Vào thẳng màn chơi nhanh**: cổng game đánh giá cao việc bấm là chơi ngay. Nên rút ngắn hoặc bỏ màn giới thiệu chương ở lần đầu.
- [ ] **Chạy thử trên máy yếu**: điện thoại Android tầm trung, Chromebook. Đặt mức đồ hoạ "Tự động" thấp hơn nếu bị giật.

**Thứ tự nộp:**

1. **CrazyGames trước.** Theo các nguồn tổng hợp, quy trình dễ hơn Poki và có cách ra mắt thử để xem số liệu.
2. **Poki sau**, khi đã có số liệu tốt (tỉ lệ chơi lại, thời gian chơi).
3. **GameDistribution** là phương án dự phòng: nhận game dễ, phân phối ra nhiều web, nhưng chỉ chia khoảng 33% doanh thu.

## 5. Giai đoạn 4 (tháng 2–3): Google Play

1. Tạo tài khoản Google Play Console (25 USD, trả một lần).
   - Tài khoản **cá nhân** mới phải chạy thử kín với **ít nhất 12 người thử liên tục trong 14 ngày** rồi mới được phát hành công khai. Tài khoản **tổ chức** (có số D-U-N-S) không bị yêu cầu này.
   - Cần chuẩn bị sẵn danh sách khoảng 15 người quen dùng Android.
2. Đóng gói bằng **Bubblewrap** (hoặc PWABuilder) từ link web đã có HTTPS.
   - Xuất file `.aab`.
   - Tự đặt file `assetlinks.json` lên web: Bubblewrap không còn tự tạo file này.
   - Dùng tên miền riêng sẽ dễ hơn GitHub Pages, vì file này phải nằm ở `/.well-known/` của gốc tên miền.
3. Trang cửa hàng gồm:
   - icon 512 px (đã có);
   - ảnh bìa 1024×500;
   - 4–8 ảnh chụp ngang;
   - mô tả song ngữ;
   - xếp hạng độ tuổi (bạo lực hoạt hình nhẹ);
   - chính sách quyền riêng tư (cần có ngay cả khi không thu dữ liệu).
4. ~~Đổi tên thương hiệu thật trong game~~: đã xong ở v3.1, "Grab" thành "xe ôm công nghệ" / "Gọi xe ôm" (tiếng Anh: "ride app" / "Call a ride").

## 6. Pháp lý và rủi ro cần biết

| Rủi ro | Mức | Việc nên làm |
|---|---|---|
| **Quy định game ở Việt Nam** (Nghị định 147/2024/NĐ-CP). Game này không có tương tác giữa người chơi với nhau hay với máy chủ, nên gần với loại **G4**. Theo các nguồn tổng hợp, phát hành game G2–G4 cần doanh nghiệp có Giấy chứng nhận và Giấy xác nhận thông báo phát hành. Mình **chưa tìm được** nguồn nói rõ cá nhân phát hành game miễn phí có phải làm thủ tục này không. | Cao nếu kiếm tiền tại Việt Nam | **Hỏi luật sư hoặc Cục Phát thanh, truyền hình và thông tin điện tử** trước khi gắn quảng cáo hoặc lên Google Play cho thị trường Việt Nam. Trong lúc chờ, để game miễn phí, không quảng cáo. |
| **Tên game giống "Trees Hate You"** | Trung bình | Tên đang bám theo game gốc. Nếu game nổi, có thể bị phàn nàn. Cân nhắc tên riêng hơn, ví dụ "Kẹt Xe Hates You" hay "Saigon Hates You", trước khi lên cổng lớn hoặc Google Play. |
| **Thương hiệu thật trong game** ("Grab") | Đã xử lý | Đổi thành "xe ôm công nghệ" ở v3.1. |
| **Bạo lực hoạt hình** (chết vì xe, rơi đồ) | Thấp | Ghi rõ độ tuổi 12+ trên các nền tảng; phần Giới thiệu trong game đã có câu nhắc tuân thủ luật giao thông. |

## 7. Kiếm tiền

Thứ tự gợi ý; không cần làm ngay:

1. **Không kiếm tiền trong 1 tháng đầu**, chỉ tập trung lấy người chơi và số liệu.
2. **Nhận ủng hộ:** itch.io "tuỳ tâm", kèm mã QR chuyển khoản/MoMo trên trang web (để ngoài game).
3. **Quảng cáo qua SDK cổng game** (CrazyGames, Poki) cho bản tiếng Anh.
4. **Quảng cáo trên web riêng** (AdSense cho game, hoặc mạng quảng cáo dành cho game HTML5). Chỉ làm khi đã rõ phần pháp lý ở mục 6.
5. **Bản mở rộng:** chương mới (ví dụ "Tết về quê", "Kẹt xe cầu Sài Gòn"). Đây là lý do để người chơi cũ quay lại và để quay clip mới.

## 8. Lịch tóm tắt

| Tuần | Việc |
|---|---|
| 1 | Mua tên miền, gắn thống kê, làm ảnh chia sẻ mới, quay 10 clip |
| 2 | Ra mắt: đăng clip mỗi ngày, đăng nhóm Facebook, gửi streamer; mở trang itch.io |
| 3–4 | Đọc số liệu (người chơi bỏ ở đâu), chỉnh độ khó chỗ bỏ nhiều; nhờ người bản xứ đọc lại bản tiếng Anh |
| 5–8 | Tích hợp SDK, nộp CrazyGames; hỏi pháp lý |
| 9–12 | Google Play (12 người thử × 14 ngày), nộp Poki nếu số liệu CrazyGames tốt |

## 9. Chỉ số để biết đang đi đúng

- **Tỉ lệ bấm CHƠI** trên số lượt vào trang: trên 60% là ổn.
- **Tỉ lệ qua hết chương 1**: rage game thường thấp. Dưới 15% thì chương 1 đang quá khó cho người mới; nên làm khu đầu dễ hơn.
- **Thời gian chơi trung bình**: trên 8 phút là tốt cho game web.
- **Lượt chia sẻ từ màn hình kết thúc** (nút KHOE BẠN BÈ).
- **Clip nào có nhiều lượt xem nhất**: dùng loại bẫy đó cho chương sau.

## Nguồn

- [Best Places to Publish a Web Game in 2026 (Cinevva)](https://app.cinevva.com/guides/publish-web-game)
- [How to Get Your Game on Poki (2026) (Cinevva)](https://app.cinevva.com/guides/publish-game-poki)
- [Web game monetization (Cinevva)](https://app.cinevva.com/guides/web-game-monetization)
- [Poki vs CrazyGames vs GameDistribution revenue share (Playgama)](https://playgama.com/blog/business-faqs/poki-vs-crazygames-vs-gamedistribution-revenue-share/)
- [Where to publish web games (Abratabia)](https://abratabia.com/publishing-web-games/where-to-publish.php)
- [Google Play closed testing requirements 2026 (Testers Community)](https://www.testerscommunity.com/blog/google-play-closed-testing-requirements-2026)
- [Google Play closed testing: what developers need to know in 2026 (ExtendsClass)](https://extendsclass.com/blog/google-plays-closed-testing-requirement-what-developers-need-to-know-in-2026)
- [Bubblewrap: publish your PWA in the Google Play Store (Thinktecture)](https://www.thinktecture.com/en/pwa/twa-bubblewrap)
- [PWA in Play (Google for Developers)](https://developers.google.com/chromeos/app-development/publish/pwa-in-play)
- [Điều kiện, thủ tục cung cấp dịch vụ trò chơi điện tử G2, G3, G4 (LuatVietnam)](https://luatvietnam.vn/doanh-nghiep/dieu-kien-thu-tuc-de-cung-cap-dich-vu-tro-choi-dien-tu-g2-g3-g4-561-101208-article.html)
- [Kinh doanh trò chơi điện tử trên mạng theo Nghị định 147/2024/NĐ-CP (LuatVietnam)](https://luatvietnam.vn/linh-vuc-khac/kinh-doanh-tro-choi-dien-tu-tren-mang-883-100134-article.html)
- [Công văn 48/CP-KGVX 2025 đính chính Nghị định 147/2024 (Thư viện pháp luật)](https://thuvienphapluat.vn/cong-van/Cong-nghe-thong-tin/Cong-van-48-CP-KGVX-2025-dinh-chinh-Nghi-dinh-147-2024-ND-CP-643256.aspx)
- [TikTok tests mini games with users in Vietnam (Social Media Today, 2022)](https://www.socialmediatoday.com/news/tiktok-tests-new-mini-games-with-users-in-vietnam/624104/)
