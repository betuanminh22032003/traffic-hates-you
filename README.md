# Traffic Hates You – bản Sài Gòn 3D

Game troll-platformer 3D góc nhìn từ trên-sau lưng (kiểu Trees Hate You): chạy xe máy tới công ty trước 8:00 qua 15 màn đường phố Sài Gòn, tự do chạy tới, phanh, lách trái phải và nhảy. Thứ gì trên đường cũng ghét bạn: ổ gà tàng hình, đèn đỏ troll, cột điện đổ, chó không xích, bà cụ qua đường, xe buýt, ô tô mở cửa, đinh tặc, cục nóng máy lạnh rơi, cây đổ, triều cường, cổng công ty tự đóng... Chết là chuyện bình thường, mỗi lần chết đồng hồ chạy thêm 1 phút.

![Traffic Hates You](public/icons/og.png)

## Nội dung

- **15 màn, 4 chương**: Hẻm Nhỏ (bình minh) · Đường Lớn (ban ngày) · Mưa Sài Gòn (mưa, đường trơn) · Tới Công Ty (Quận 1).
- **20 loại bẫy**, mỗi màn có 3–6 bẫy, chơi kiểu "chết một lần là nhớ".
- Đồ họa 3D kiểu hoạt hình (toon shading, viền đen), phố nhà ống, bảng hiệu, dây điện, mưa, nước ngập.
- Nhạc nền ngũ cung và hiệu ứng âm thanh đều được tổng hợp bằng Web Audio, không cần file âm thanh.
- Lưu tiến trình (màn đã mở, số lần chết ít nhất mỗi màn, kỷ lục cả lượt).
- Chơi được bằng bàn phím, cảm ứng (điện thoại, máy tính bảng) và tay cầm.
- Cài được như app (PWA) và chơi offline.
- Cài đặt: nhạc, âm thanh, rung, chất lượng đồ họa (Tự động/Cao/Vừa/Thấp), toàn màn hình, xóa tiến trình.

## Điều khiển

| Hành động | Bàn phím | Cảm ứng | Tay cầm |
|---|---|---|---|
| Chạy tới | ↑ / W | kéo cần gạt lên | cần trái / D-pad lên |
| Phanh, lùi | ↓ / S | kéo cần gạt xuống | cần trái / D-pad xuống |
| Lách trái / phải | ← → / A D | kéo cần gạt sang ngang | cần trái / D-pad |
| Nhảy | Space (hoặc J, K) | nút ⤒ bên phải | A |
| Chơi lại màn | R | menu tạm dừng | |
| Tạm dừng | Esc / P | ❚❚ | Start |

## Chạy trên máy

Cần Node.js 20 trở lên.

```bash
npm install
npm run dev        # mở http://localhost:5173
npm test           # bot tự chơi 15 màn, xác nhận màn nào cũng qua được
npm run build      # xuất bản phát hành vào thư mục dist/
npm run preview    # chạy thử bản build
```

## Phát hành

`npm run build` tạo thư mục `dist/` gồm toàn file tĩnh (HTML, JS, font, icon). Bản build dùng đường dẫn tương đối nên đặt ở thư mục nào cũng chạy.

### GitHub Pages (tự động)

Workflow `.github/workflows/deploy.yml` đã có sẵn: mỗi lần push lên `main` sẽ chạy test, build và đăng lên Pages.

1. Vào repo trên GitHub → **Settings → Pages**.
2. Ở **Source** chọn **GitHub Actions**.
3. Merge vào `main` (hoặc chạy workflow "Deploy to GitHub Pages" bằng tay trong tab Actions).
4. Link game: `https://<tên-tài-khoản>.github.io/traffic-hates-you/`.

### itch.io

1. `npm run build`
2. Nén **nội dung** thư mục `dist` (không nén cả thư mục): `cd dist && zip -r ../traffic-hates-you.zip .`
3. Trên itch.io: Create new project → Kind of project: **HTML** → upload file zip → tick **This file will be played in the browser**.
4. Gợi ý cài đặt khung game: 1280 × 720, bật **Mobile friendly** (orientation: Landscape) và **Fullscreen button**.

### Netlify / Vercel / Cloudflare Pages

Kết nối repo, build command `npm run build`, publish directory `dist`. Không cần cấu hình thêm.

### Lên điện thoại như app

- Mở link game trên điện thoại → menu trình duyệt → **Thêm vào màn hình chính**. Game chạy toàn màn hình, nằm ngang, chơi được offline.
- Muốn lên Google Play: đóng gói PWA bằng [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) hoặc [PWABuilder](https://www.pwabuilder.com/) từ link đã đăng (cần HTTPS).

### Trước khi phát hành, kiểm tra

- [ ] `npm test` báo `All levels beatable.`
- [ ] `npm run build` không lỗi, `npm run preview` chơi thử được màn 1.
- [ ] Đổi link/ảnh chia sẻ nếu cần: thẻ `og:*` trong `index.html`, ảnh `public/icons/og.png`.
- [ ] Đổi phiên bản trong `package.json` và chữ `v1.0` ở màn hình tiêu đề (`index.html`).
- [ ] Đổi tên cache trong `public/sw.js` (`thy-v1` → `thy-v2`...) mỗi lần phát hành bản mới để người chơi cũ nhận bản mới ngay.

## Cấu trúc mã

```
index.html              khung trang + các màn hình menu (DOM)
src/main.js             vòng lặp game, luồng màn chơi, menu, input (phím, cảm ứng, tay cầm)
src/game/logic.js       mô phỏng gameplay thuần (không DOM, không three.js, tất định)
src/game/levels.js      dữ liệu 15 màn + 4 chương
src/game/messages.js    câu thoại khi chết
src/render/view.js      scene three.js, camera, người chơi, hạt, bong bóng thoại
src/render/world.js     dựng phố: đường, ổ gà, vỉa hè, nhà ống, dây điện, trời, mưa
src/render/entities.js  hình 3D cho từng loại bẫy
src/render/models.js    mô hình (xe máy, chó, CSGT, bà cụ, xe buýt, ô tô, cây...)
src/render/toon.js      vật liệu toon, viền, chữ vẽ bằng canvas
src/audio.js            hiệu ứng âm thanh + nhạc nền tổng hợp
src/save.js             lưu tiến trình và cài đặt (localStorage)
scripts/smoke-test.mjs  bot tự chơi hết các màn (npm test)
scripts/solutions.mjs   "đường đi" của bot cho từng màn
scripts/make-icons.mjs  vẽ lại icon app (cần Playwright)
public/                 manifest PWA, service worker, icon
legacy-2d.html          bản prototype 2D ban đầu (không nằm trong bản build)
```

Logic dùng tọa độ "pixel": x chạy dọc con đường, z ngang đường (lề ở `z = ±120`), độ cao giữ quy ước bản 2D cũ (y hướng xuống, mặt đường ở `G = 440`); phần vẽ 3D đổi sang trục Y hướng lên. Camera bám sau lưng người chơi. Vì logic tất định nên bot trong `scripts/` có thể phát lại một lời giải và chứng minh màn đó qua được.

## Thêm hoặc sửa màn

1. Mở `src/game/levels.js`, thêm một phần tử vào `LEVELS` (`id`, `ch` = chương, `name`, `len` = chiều dài, `rain` nếu trời mưa, `build` trả về danh sách bẫy).
2. Mặc định bẫy chắn hết bề ngang đường; ổ gà, đinh, rào có thể chỉ chắn một phần bằng `z0`/`z1` (người chơi lách qua được). Ô tô, nắp cống, chó đặt theo `z`; xe ngược chiều, xe buýt và đồ rơi tự nhắm vào làn người chơi đang đi.
3. Các bẫy có sẵn: `hole`, `light`, `pole`, `tree`, `manhole`, `dog`, `onc` (ngược chiều / vượt ẩu), `bus`, `flood`, `gate`, `finish`, `sign`, `car`, `fall` (máy lạnh, chậu kiểng, thép), `walker` (bà cụ), `cart` (xe bánh mì), `nails`, `banner`, `speedcam`, `plat` (thúng, ván, giàn giáo), `block`, `txt`.
4. Thêm lời giải cho bot vào `scripts/solutions.mjs` rồi chạy `npm test`. Gỡ lỗi một màn: `node scripts/dbg.mjs <id>` in ra từng sự kiện.

Số liệu vật lý tham khảo: tốc độ tối đa 6.5 px/khung (≈ 77 km/h trên đồng hồ), nhảy cao ≈ 140 px, nhảy xa ≈ 270 px khi chạy hết tốc; dây điện ở độ cao 305 px (chạm là giật điện).

## Giấy phép tài nguyên

- Three.js: MIT. Font Baloo 2: SIL Open Font License (qua gói `@fontsource/baloo-2`).
- Toàn bộ mô hình, hình vẽ, âm thanh, nhạc trong game được tạo bằng mã trong repo này.
