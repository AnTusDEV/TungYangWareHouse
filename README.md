# TungYang WareHouse (ERP Mini - Quản lý Kho Văn Phòng)

Hệ thống quản lý kho văn phòng và vật tư doanh nghiệp (**Tung Yang - Ricco**), xây dựng theo kiến trúc Full-Stack React + Express + TypeScript, hỗ trợ đầy đủ nghiệp vụ nhập - xuất - tồn, tra cứu nhanh, thống kê trực quan, nhập/xuất dữ liệu Excel và đồng bộ cơ sở dữ liệu Microsoft SQL Server.

---

## Tính năng chính

### 1. Xác thực & Phân quyền người dùng
- Đăng nhập tài khoản với tùy chọn **Ghi nhớ đăng nhập** (`rememberMe`) và lưu phiên bằng Zustand (`localStorage`).
- Phân quyền 2 vai trò:
  - **Admin (`admin`)**: Toàn quyền quản trị hệ thống và quản lý tài khoản nhân sự.
  - **Thủ kho (`user`)**: Vận hành nhập/xuất kho, tra cứu, báo cáo và cập nhật thông tin cá nhân.
- Mã hóa mật khẩu bằng `bcryptjs`, hỗ trợ cập nhật hồ sơ cá nhân và đổi mật khẩu.
- **Quản lý tài khoản** (Admin): Tạo tài khoản mới, chỉnh sửa thông tin/vai trò, khóa/mở khóa tài khoản, đặt lại mật khẩu và xóa tài khoản.
- **Cơ chế dự phòng (Offline Fallback)**: Khi chưa kết nối tới SQL Server, hệ thống tự động sử dụng bộ nhớ tạm trên server và `localStorage` ở trình duyệt để đảm bảo vẫn đăng nhập và vận hành liên tục.

### 2. Dashboard Thống kê Vận hành
- **6 thẻ KPI tổng quan**: Tổng mặt hàng, Phiếu nhập kho, Phiếu xuất kho, Hàng hết kho (`tồn = 0`), Hàng tồn nhiều (`>= định mức tối đa`), Nhóm hàng hoạt động.
- **Biểu đồ trực quan (Recharts)**:
  - Biểu đồ tròn phân bổ tồn kho theo Nhóm hàng (nhấn vào từng nhóm để xem danh sách hàng hóa chi tiết).
  - Biểu đồ cột so sánh Nhập - Xuất kho theo tháng (6 tháng gần nhất).
  - Biểu đồ ngang Top 5 mặt hàng xuất kho nhiều nhất.
- Bảng cảnh báo nhanh **Hàng hóa đã hết kho** và thẻ **Tra cứu nhanh tồn kho theo từng phòng kho**.

### 3. Quản lý Kho, Hàng hóa & Danh mục
- **Quản lý Kho (`Warehouses`)**: Thêm, sửa, xóa phòng kho (chặn xóa nếu kho đang chứa hàng), xem chi tiết tồn kho từng phòng kho.
- **Danh mục Hàng hóa (`Items`)**:
  - Tự động sinh mã hàng dạng `HH0001`, `HH0002`,...
  - Lọc theo nhóm hàng, phòng kho và trạng thái tồn (`Hết hàng`, `Còn hàng`, `Tồn nhiều`).
  - **Import Excel (`.xlsx`)**: Tự động nhận diện và tạo mới Nhóm hàng, Đơn vị tính hoặc Phòng kho nếu chưa có trong hệ thống.
  - **Export Excel (`.xlsx`)** và tải file mẫu nhập liệu chuẩn.
- **Nhóm hàng & Đơn vị tính (`Categories & Units`)**: Quản lý phân loại vật tư, hỗ trợ đồng bộ ngược các danh mục còn thiếu từ danh sách hàng hóa hiện có.

### 4. Nghiệp vụ Nhập kho & Xuất kho
- **Phiếu Nhập Kho (`PNYYYYMMxxx`)**:
  - Tạo phiếu nhập nhiều mặt hàng cùng lúc, tự động cộng tồn kho và ghi lịch sử biến động.
  - Hỗ trợ **chỉnh sửa và xóa phiếu trong vòng 24 giờ** kể từ thời điểm tạo (tự động hoàn trả/cập nhật lại số lượng tồn kho tương ứng).
- **Phiếu Xuất Kho (`PXYYYYMMxxx`)**:
  - Kiểm tra chặt chẽ tồn kho theo từng dòng hàng (không cho phép xuất vượt quá số lượng tồn hiện tại), tự động trừ tồn kho và lưu lịch sử giao dịch.

### 5. Tra cứu, Lịch sử & Báo cáo
- **Tìm kiếm nhanh trên Header**: Hỗ trợ tìm kiếm tiếng Việt không dấu theo mã hàng, tên vật tư, nhóm hàng, kho và ghi chú.
- **Tra cứu tồn kho**: Lọc đa tiêu chí theo kho, nhóm hàng, trạng thái tồn và xuất báo cáo Excel.
- **Lịch sử nhập xuất**: Ghi nhận chi tiết tồn trước (`previousStock`), số lượng thay đổi, tồn sau (`newStock`), người thực hiện, bộ phận nhận; lọc và xuất Excel.
- **Báo cáo thống kê**: Tổng hợp chỉ số nhập - xuất - tồn theo toàn hệ thống hoặc từng phòng kho và xuất file `.xlsx`.

### 6. Cài đặt & Kết nối Microsoft SQL Server
- Màn hình Cài đặt được bảo vệ bằng mật khẩu quản trị riêng (có chức năng khóa/mở khóa và đổi mật khẩu).
- Cấu hình thông số kết nối Microsoft SQL Server (`host`, `port`, `user`, `password`, `database`, `encrypt`).
- Hỗ trợ **Kiểm tra kết nối**, **Khởi tạo tự động 8 bảng CSDL** (`categories`, `warehouses`, `units`, `items`, `stock_vouchers`, `stock_voucher_items`, `inventory_logs`, `users`), tự động khôi phục chi tiết dòng phiếu từ log (`repair-voucher-items`) và làm sạch bộ nhớ đệm trình duyệt.

---

## Công nghệ sử dụng

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), Zustand (persist middleware), Recharts, Lucide React, SheetJS (`xlsx`), Motion.
- **Backend**: Node.js, Express 4, `tsx`, `mssql`, `bcryptjs`, `dotenv`.

---

## Cấu trúc thư mục

```text
.
├── server.ts                  # Express server, API Auth/Users, MSSQL endpoints & Vite middleware
├── index.html                 # HTML entry point
├── metadata.json              # Thông tin mô tả ứng dụng
├── package.json               # Scripts và dependencies
├── tsconfig.json              # Cấu hình TypeScript
├── vite.config.ts             # Cấu hình Vite & Tailwind CSS v4
├── .env.example               # Mẫu biến môi trường
└── src/
    ├── App.tsx                # Root component, điều hướng tab & theme Dark/Light
    ├── main.tsx               # React DOM entry
    ├── index.css              # Tailwind CSS v4 stylesheet
    ├── types/
    │   ├── auth.ts            # Kiểu dữ liệu User, LoginCredentials, CreateUserData...
    │   └── inventory.ts       # Kiểu dữ liệu Warehouse, Category, Unit, Item, StockVoucher, InventoryLog
    ├── store/
    │   ├── useAuthStore.ts    # Zustand store quản lý đăng nhập, người dùng
    │   └── useInventoryStore.ts # Zustand store quản lý kho, phiếu, log & đồng bộ MSSQL
    ├── lib/
    │   ├── authApi.ts         # Client API xác thực & fallback localStorage
    │   ├── sqlServerSync.ts   # Client API giao tiếp /api/mssql/*
    │   ├── excel.ts           # Đọc/xuất file Excel (.xlsx) & tải file mẫu
    │   └── formatters.ts      # Định dạng số, tiền tệ, ngày giờ, sinh mã hàng/phiếu
    └── components/
        ├── auth/              # LoginView, AccountManager, ProfileModal, ChangePasswordModal
        ├── layout/            # Sidebar, Header
        ├── dashboard/         # Dashboard thống kê & biểu đồ
        ├── warehouses/        # WarehouseManager
        ├── items/             # ItemManager
        ├── categories/        # CategoryUnitManager
        ├── stock-in/          # StockInManager
        ├── stock-out/         # StockOutManager
        ├── stock-lookup/      # StockLookup
        ├── history/           # TransactionHistory
        ├── reports/           # ReportsView
        ├── settings/          # SettingsView
        └── common/            # DataTable, Modal, ConfirmDialog, ProductSelect, ExcelImportModal...
```

---

## Hướng dẫn cài đặt & khởi chạy

### 1. Yêu cầu hệ thống
- **Node.js**: v20+ hoặc v22+
- **npm**
- *(Tùy chọn)* **Microsoft SQL Server** nếu muốn lưu trữ và đồng bộ dữ liệu tập trung qua mạng LAN/Server.

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình biến môi trường
Tạo file `.env` từ file mẫu `.env.example`:
```bash
cp .env.example .env
```

Các biến môi trường chính:
```env
# Cổng chạy server (mặc định 3000)
PORT=3000

# Cấu hình Microsoft SQL Server (tùy chọn)
MSSQL_HOST=SERVER_LAN
MSSQL_PORT=1433
MSSQL_USER=antu
MSSQL_PASSWORD=your_password
MSSQL_DATABASE=inventory_db_test
```

> **Lưu ý**: Nếu không cấu hình `MSSQL_HOST` (hoặc không kết nối được SQL Server), hệ thống vẫn khởi chạy bình thường với cơ chế lưu trữ tạm trên server (cho tài khoản) và `localStorage` (cho dữ liệu kho).

### 4. Chạy môi trường phát triển (Development)
```bash
npm run dev
```
Ứng dụng (gồm cả Express API và Vite frontend) sẽ chạy tại: `http://localhost:3000`

### 5. Kiểm tra TypeScript & Build Production
```bash
# Kiểm tra lỗi kiểu TypeScript
npm run lint

# Build frontend (dist/) và bundle backend (dist/server.cjs)
npm run build

# Chạy bản Production
npm start
```

---

## Tài khoản & Mật khẩu mặc định

Khi khởi tạo lần đầu (trên SQL Server hoặc chế độ fallback):

| Tên đăng nhập | Mật khẩu   | Vai trò        | Ghi chú |
| :---          | :---       | :---           | :---    |
| `admin`       | `admin123` | Quản trị viên  | Toàn quyền quản lý hệ thống & tài khoản |
| `nhanvien`    | `user123`  | Thủ kho (`user`) | Vận hành nhập, xuất, tra cứu, báo cáo |

- **Mật khẩu mở khóa màn hình Cài đặt**: `Antu123!@` *(có thể thay đổi trực tiếp trong mục Cài đặt sau khi mở khóa)*.
- Khuyến nghị đổi toàn bộ mật khẩu mặc định trước khi đưa vào sử dụng thực tế.

---

## Danh sách API Endpoints (`server.ts`)

### Xác thực & Tài khoản
- `POST /api/auth/login` — Đăng nhập hệ thống
- `GET /api/auth/me` — Lấy thông tin tài khoản theo token
- `PUT /api/auth/profile` — Cập nhật thông tin cá nhân
- `PUT /api/auth/change-password` — Đổi mật khẩu người dùng
- `GET /api/users` — Lấy danh sách tài khoản
- `POST /api/users` — Tạo tài khoản mới
- `PUT /api/users/:id` — Cập nhật thông tin tài khoản
- `PUT /api/users/:id/status` — Khóa / mở khóa tài khoản (`active` | `locked`)
- `PUT /api/users/:id/reset-password` — Đặt lại mật khẩu người dùng
- `DELETE /api/users/:id` — Xóa tài khoản

### Đồng bộ Microsoft SQL Server
- `POST /api/mssql/test` — Kiểm tra kết nối tới SQL Server và tự tạo database nếu chưa tồn tại
- `POST /api/mssql/init-tables` — Khởi tạo toàn bộ các bảng dữ liệu trong SQL Server
- `POST /api/mssql/fetch-all` — Tải toàn bộ danh mục, hàng hóa, phiếu, lịch sử và tài khoản
- `POST /api/mssql/save-item` / `POST /api/mssql/delete-item` — Lưu / xóa hàng hóa
- `POST /api/mssql/save-warehouse` / `POST /api/mssql/delete-warehouse` — Lưu / xóa kho
- `POST /api/mssql/save-category` / `POST /api/mssql/delete-category` — Lưu / xóa nhóm hàng
- `POST /api/mssql/save-unit` / `POST /api/mssql/delete-unit` — Lưu / xóa đơn vị tính
- `POST /api/mssql/save-voucher` / `POST /api/mssql/delete-voucher` — Lưu / xóa phiếu nhập xuất & cập nhật tồn kho theo transaction
- `POST /api/mssql/repair-voucher-items` — Khôi phục dữ liệu dòng phiếu bị thiếu từ `inventory_logs`
- `POST /api/mssql/save-user` / `POST /api/mssql/delete-user` — Đồng bộ tài khoản lên SQL Server
