# Traffic Hates You – bản Sài Gòn

Prototype game troll-platformer: chạy xe máy tới công ty trước 8:00 qua 3 màn đường phố đầy bẫy (ổ gà tàng hình, đèn đỏ troll, cột điện đổ, triều cường, xe buýt, bảo vệ đóng cổng...).

## Chơi

Mở `index.html` bằng trình duyệt (không cần build).

- `→` / `D`: chạy · `←` / `A`: phanh · `Space` / `↑`: nhảy · `R`: chơi lại màn
- Điện thoại: nút cảm ứng trên màn hình

## Cấu trúc

Một file duy nhất, canvas 2D + Web Audio, không thư viện. Màn chơi khai báo trong mảng `LEVELS`; mỗi bẫy là một entity (`Hole`, `Light`, `Pole`, `Manhole`, `Dog`, `Oncoming`, `Bus`, `Flood`, `Gate`, `Finish`).
