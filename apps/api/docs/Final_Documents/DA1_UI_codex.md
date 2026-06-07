# 3.4 Thiết kế giao diện

## 3.4.1 Danh sách giao diện

### 3.4.1.1 Mobile app - Khách hàng

| STT | Tên màn hình | Miêu tả màn hình |
| --- | --- | --- |
| 1 | Chào mừng | Màn hình mở đầu của ứng dụng mobile, giới thiệu nhanh dịch vụ và điều hướng người dùng đến đăng nhập hoặc đăng ký. |
| 2 | Đăng nhập | Cho phép khách hàng đăng nhập bằng email và mật khẩu, đồng thời hỗ trợ điều hướng sang đăng ký hoặc khôi phục mật khẩu. |
| 3 | Đăng ký | Thu thập thông tin tài khoản khách hàng gồm họ tên, email, số điện thoại, mật khẩu và xác nhận điều khoản sử dụng. |
| 4 | Trang chủ / Khám phá nhà hàng | Hiển thị địa chỉ hiện tại, danh mục món ăn, ưu đãi nổi bật, danh sách nhà hàng gần người dùng và kết quả tìm kiếm món ăn. |
| 5 | Chọn địa chỉ | Cho phép khách hàng chọn địa chỉ đang dùng từ địa chỉ đã lưu, địa chỉ gần đây hoặc vị trí hiện tại. |
| 6 | Thêm địa chỉ | Cho phép khách hàng thêm địa chỉ giao hàng mới, kèm tên gợi nhớ, chi tiết địa chỉ và ghi chú cho tài xế. |
| 7 | Chi tiết nhà hàng và menu | Hiển thị thông tin nhà hàng, trạng thái hoạt động, danh mục món, danh sách món ăn, đánh giá và thanh xem giỏ hàng. |
| 8 | Chi tiết món ăn | Hiển thị thông tin món ăn, tùy chọn modifier, số lượng và thao tác thêm hoặc cập nhật món trong giỏ hàng. |
| 9 | Chi tiết sản phẩm từ kết quả tìm kiếm | Hiển thị thông tin một món ăn được mở trực tiếp từ kết quả tìm kiếm hoặc danh sách gợi ý. |
| 10 | Giỏ hàng | Hiển thị các món đã chọn, cho phép chỉnh số lượng, xóa món, xem tạm tính và chuyển sang checkout. |
| 11 | Checkout một màn hình | Tổng hợp địa chỉ giao hàng, chi tiết đơn hàng, phí, khuyến mãi, phương thức thanh toán và thao tác đặt hàng. |
| 12 | Chọn địa chỉ giao hàng trong checkout | Cho phép khách hàng xác nhận hoặc thay đổi địa chỉ giao hàng trước khi đặt đơn. |
| 13 | Chọn ưu đãi / mã khuyến mãi | Hiển thị các ưu đãi khả dụng theo nhà hàng, điều kiện áp dụng và trạng thái đủ điều kiện. |
| 14 | Chọn phương thức thanh toán | Cho phép khách hàng chọn tiền mặt, VNPay hoặc phương thức đã lưu cho đơn hàng. |
| 15 | Rà soát đơn hàng | Cho phép khách hàng kiểm tra lại món, địa chỉ, phí, khuyến mãi và tổng tiền trước khi xác nhận đặt hàng. |
| 16 | Trạng thái thanh toán VNPay | Hiển thị kết quả thanh toán VNPay, trạng thái xử lý đơn hàng và các thao tác tiếp theo. |
| 17 | Lịch sử đơn hàng | Hiển thị danh sách đơn hàng đã đặt, trạng thái hiện tại và cho phép mở chi tiết hoặc theo dõi đơn. |
| 18 | Chi tiết đơn hàng | Hiển thị thông tin đầy đủ của một đơn hàng gồm món, thanh toán, địa chỉ, trạng thái và đánh giá nếu có. |
| 19 | Theo dõi trạng thái đơn hàng | Hiển thị tiến trình xử lý đơn hàng theo thời gian thực từ khi đặt đến khi hoàn tất hoặc hủy. |
| 20 | Đánh giá đơn hàng | Cho phép khách hàng đánh giá sao, chọn thẻ nhận xét và gửi bình luận sau khi đơn hàng hoàn tất. |
| 21 | Hộp thư thông báo | Hiển thị danh sách thông báo, trạng thái đã đọc/chưa đọc và điều hướng theo nội dung thông báo. |
| 22 | Hồ sơ cá nhân | Hiển thị thông tin tài khoản, các lối tắt quản lý địa chỉ, thanh toán, cài đặt và đăng xuất. |
| 23 | Sửa hồ sơ cá nhân | Cho phép khách hàng cập nhật tên hiển thị và một số thông tin hồ sơ cơ bản. |
| 24 | Phương thức thanh toán cá nhân | Cho phép khách hàng quản lý phương thức thanh toán mặc định dùng cho đơn hàng. |
| 25 | Cài đặt | Cho phép khách hàng cấu hình thông báo, cập nhật đơn hàng, ngôn ngữ, điều khoản và thông tin ứng dụng. |

### 3.4.1.2 Web portal - Đối tác nhà hàng

| STT | Tên màn hình | Miêu tả màn hình |
| --- | --- | --- |
| 1 | Trang giới thiệu đối tác | Trang công khai dành cho nhà hàng, giới thiệu lợi ích tham gia nền tảng và điều hướng đến đăng ký hoặc đăng nhập. |
| 2 | Đăng nhập đối tác | Cho phép chủ nhà hàng hoặc nhân viên nhà hàng đăng nhập vào portal vận hành. |
| 3 | Đăng ký tài khoản đối tác | Thu thập thông tin tài khoản đại diện nhà hàng trước khi khai báo thông tin kinh doanh. |
| 4 | Đăng ký thông tin nhà hàng | Thu thập tên nhà hàng, loại hình ẩm thực, liên hệ, địa chỉ và tọa độ phục vụ phê duyệt. |
| 5 | Trạng thái hồ sơ đăng ký | Hiển thị trạng thái hồ sơ đang chờ xét duyệt, các bước tiếp theo và thông tin hỗ trợ. |
| 6 | Chờ phê duyệt sau đăng nhập | Màn hình bảo vệ dành cho tài khoản đã đăng nhập nhưng nhà hàng chưa được kích hoạt. |
| 7 | Dashboard nhà hàng | Hiển thị tổng quan doanh thu, đơn hàng, trạng thái cửa hàng, cảnh báo vận hành và đơn cần xử lý. |
| 8 | Bảng đơn hàng / Kitchen board | Hiển thị các đơn hàng theo cột trạng thái để nhà hàng xác nhận, chuẩn bị và đánh dấu sẵn sàng giao. |
| 9 | Chi tiết đơn hàng nhà hàng | Hiển thị đầy đủ chi tiết đơn, khách hàng, thanh toán, timeline, bản đồ và thao tác cập nhật trạng thái. |
| 10 | Quản lý menu | Cho phép nhà hàng xem danh sách món, lọc theo danh mục, bật/tắt món, thêm danh mục, sửa hoặc xóa món. |
| 11 | Tạo món mới | Cho phép nhà hàng khai báo món ăn mới gồm thông tin cơ bản, giá, hình ảnh, danh mục và trạng thái hiển thị. |
| 12 | Chỉnh sửa món và modifier | Cho phép cập nhật món ăn đã có và cấu hình tùy chọn modifier cho món. |
| 13 | Quản lý vùng giao hàng | Cho phép nhà hàng tạo, sửa, bật/tắt vùng giao hàng, phí giao hàng và thời gian ước tính. |
| 14 | Phân tích vận hành | Hiển thị chỉ số kinh doanh, biểu đồ, so sánh kỳ trước và xuất báo cáo vận hành của nhà hàng. |
| 15 | Quản lý khuyến mãi nhà hàng | Hiển thị danh sách khuyến mãi của nhà hàng, trạng thái và các thao tác tạo, sửa, tạm dừng hoặc xóa. |
| 16 | Tạo / chỉnh sửa khuyến mãi nhà hàng | Cho phép nhà hàng cấu hình nội dung ưu đãi, điều kiện áp dụng, ngân sách, lịch chạy và trạng thái phát hành. |
| 17 | Cài đặt tài khoản và cửa hàng | Quản lý hồ sơ, thông tin cửa hàng, bảo mật, thông báo, thiết bị đăng nhập và vùng nguy hiểm. |

### 3.4.1.3 Admin portal - Quản trị hệ thống

| STT | Tên màn hình | Miêu tả màn hình |
| --- | --- | --- |
| 1 | Đăng nhập admin | Cho phép quản trị viên đăng nhập vào hệ thống quản trị với tài khoản có vai trò admin. |
| 2 | Dashboard nền tảng | Hiển thị tổng quan GMV, doanh thu, sức khỏe vận hành, đơn hàng, nhà hàng nổi bật và hồ sơ chờ duyệt. |
| 3 | Quản lý nhà hàng | Cho phép admin tìm kiếm, xem chi tiết, phê duyệt, tạm ngưng hoặc xóa nhà hàng. |
| 4 | Quản lý đơn hàng toàn nền tảng | Hiển thị và lọc đơn hàng toàn hệ thống, xem chi tiết đơn, thanh toán, khách hàng và timeline. |
| 5 | Quản lý người dùng | Cho phép admin tìm kiếm, lọc, xem chi tiết, đổi vai trò, khóa/mở khóa hoặc xóa tài khoản người dùng. |
| 6 | Quản lý khuyến mãi nền tảng | Hiển thị danh sách khuyến mãi cấp nền tảng và các thao tác phát hành, tạm dừng, hủy hoặc xóa. |
| 7 | Chi tiết khuyến mãi và mã coupon | Hiển thị chi tiết một khuyến mãi, danh sách mã coupon và thao tác sinh hoặc thu hồi mã. |
| 8 | Tạo / chỉnh sửa khuyến mãi nền tảng | Cho phép admin cấu hình ưu đãi nền tảng, phạm vi áp dụng, loại kích hoạt, lịch chạy và ngân sách. |
| 9 | Cài đặt tài khoản admin | Cho phép admin cập nhật hồ sơ cá nhân, đổi mật khẩu, thu hồi phiên đăng nhập và đăng xuất. |

## 3.4.2 Chi tiết giao diện

### 3.4.2.1 Mobile app - Khách hàng

#### M01. Chào mừng

- **Mục đích chính:** Giới thiệu nhanh ứng dụng cho khách hàng mới và điều hướng họ đến luồng đăng nhập hoặc đăng ký.
- **Luồng tham chiếu (Use Case):** Là điểm bắt đầu cho `UC-DOM-01 - Authentication & Account Management`, liên quan `UC-1` và yêu cầu tài khoản khách hàng `BRD-01`.
- **Các Control chính:** Button "Get Started", button "Sign In", button "Continue with Google", link "Terms of Service", link "Privacy Policy".
- **Màn hình con / Component phụ:** Khối hero giới thiệu dịch vụ, vùng nút hành động, thông báo lỗi đăng nhập mạng xã hội nếu có.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhấn "Get Started" để mở màn hình đăng ký hoặc "Sign In" để đăng nhập.
  2. Nếu chọn Google, hệ thống gọi dịch vụ xác thực bên ngoài; thành công thì tạo phiên đăng nhập và chuyển vào app, thất bại thì hiển thị thông báo lỗi và giữ nguyên màn hình.

#### M02. Đăng nhập

- **Mục đích chính:** Xác thực khách hàng đã có tài khoản và tạo phiên làm việc trên thiết bị mobile.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, là tiền điều kiện cho các luồng đặt món như `UC-2`, `UC-4`, `UC-8`; tham chiếu `UC-1` và `BRD-01`.
- **Các Control chính:** Textbox "Email", textbox "Password", button ẩn/hiện mật khẩu, button "Sign In", link "Forgot Password", link "Sign Up", button "Continue with Google".
- **Màn hình con / Component phụ:** Thông báo lỗi xác thực, trạng thái loading trên button, bộ điều hướng quay lại màn hình chào mừng.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập email và mật khẩu rồi nhấn "Sign In".
  2. Hệ thống kiểm tra định dạng, gọi API đăng nhập, lưu token khi thành công và chuyển về màn hình chính; nếu sai thông tin hoặc lỗi mạng, hệ thống hiển thị lỗi và cho phép nhập lại.

#### M03. Đăng ký

- **Mục đích chính:** Tạo tài khoản khách hàng mới để sử dụng các chức năng đặt món và theo dõi đơn hàng.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, thực hiện `UC-1`, đáp ứng yêu cầu tạo tài khoản khách hàng `BRD-01`.
- **Các Control chính:** Textbox "Full Name", textbox "Email", textbox "Phone Number", textbox "Password", checkbox chấp nhận điều khoản, button "Continue", link "Log in".
- **Màn hình con / Component phụ:** Thông báo lỗi kiểm tra dữ liệu, trạng thái loading, component điều khoản sử dụng và quyền riêng tư.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập thông tin bắt buộc, đánh dấu đồng ý điều khoản và nhấn "Continue".
  2. Hệ thống kiểm tra dữ liệu, gọi API đăng ký; thành công thì tạo tài khoản và chuyển đến app hoặc đăng nhập, thất bại thì hiển thị nguyên nhân như email đã tồn tại hoặc mật khẩu không hợp lệ.

#### M04. Trang chủ / Khám phá nhà hàng

- **Mục đích chính:** Giúp khách hàng tìm nhà hàng, món ăn và ưu đãi dựa trên vị trí giao hàng hiện tại.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-02 - Restaurant Discovery & Search`, liên quan `UC-2`, `UC-3`, `UC-DOM-08`, `BRD-03`.
- **Các Control chính:** Button chọn địa chỉ, icon thông báo, ô tìm kiếm, chip danh mục, danh sách ưu đãi, card nhà hàng, card món ăn, nút làm mới, thanh giỏ hàng nổi.
- **Màn hình con / Component phụ:** Header địa chỉ, danh mục món, carousel ưu đãi, danh sách nhà hàng gần bạn, trạng thái loading/empty/error, bottom tabs.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn địa chỉ hoặc tìm kiếm món ăn/nhà hàng.
  2. Hệ thống tải danh sách theo vị trí, lọc theo từ khóa hoặc danh mục, mở chi tiết nhà hàng khi chọn card; nếu giỏ hàng có món, thanh giỏ hàng nổi cho phép đi nhanh đến màn hình giỏ hàng.

#### M05. Chọn địa chỉ

- **Mục đích chính:** Cho phép khách hàng chọn địa chỉ giao hàng hiện tại để hệ thống kiểm tra phạm vi phục vụ và tính phí giao hàng.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-6 - Save & Manage Delivery Addresses`, hỗ trợ `UC-DOM-02`, `UC-DOM-03` và yêu cầu vùng phục vụ `BRD-06`.
- **Các Control chính:** Ô tìm kiếm địa chỉ, button "Use current location", tab "Recent", tab "Saved", danh sách địa chỉ, button thêm địa chỉ, icon sửa/xóa.
- **Màn hình con / Component phụ:** Danh sách địa chỉ gần đây, danh sách địa chỉ đã lưu, hộp xác nhận xóa, trạng thái quyền vị trí.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn một địa chỉ trong danh sách hoặc yêu cầu dùng vị trí hiện tại.
  2. Hệ thống lưu địa chỉ được chọn vào trạng thái khách hàng, dùng địa chỉ đó cho tìm kiếm nhà hàng và checkout; nếu không lấy được vị trí, hệ thống thông báo lỗi quyền truy cập hoặc lỗi định vị.

#### M06. Thêm địa chỉ

- **Mục đích chính:** Lưu địa chỉ giao hàng mới để khách hàng sử dụng lại trong các lần đặt món sau.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-6`, liên quan `BRD-06` về quản lý địa chỉ và kiểm tra khả năng giao hàng.
- **Các Control chính:** Bản đồ hoặc vùng placeholder bản đồ, textbox tên địa chỉ, textbox tìm kiếm địa chỉ, textbox chi tiết địa chỉ, textbox ghi chú cho tài xế, button lưu.
- **Màn hình con / Component phụ:** Bộ chọn vị trí trên bản đồ, gợi ý địa chỉ, thông báo lỗi thiếu thông tin, trạng thái lưu địa chỉ.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập hoặc chọn vị trí, bổ sung chi tiết địa chỉ và nhấn lưu.
  2. Hệ thống kiểm tra dữ liệu, lưu vào danh sách địa chỉ của tài khoản; nếu thiếu tên hoặc địa chỉ, màn hình hiển thị lỗi tại trường tương ứng.

#### M07. Chi tiết nhà hàng và menu

- **Mục đích chính:** Hiển thị thông tin nhà hàng và cho phép khách hàng duyệt menu để chọn món.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-02`, liên quan `UC-3 - View Restaurant Details`, `UC-4 - Add Item to Cart`, `UC-DOM-09`, `BRD-03`, `BRD-04`.
- **Các Control chính:** Button quay lại, button yêu thích, tab/chip danh mục, card món ăn, button thêm nhanh, button xem đánh giá, thanh "View Cart".
- **Màn hình con / Component phụ:** Header ảnh nhà hàng, thông tin phí/thời gian giao, danh mục menu, danh sách món, phần đánh giá, trạng thái nhà hàng đóng cửa.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng cuộn menu, lọc theo danh mục và chọn món.
  2. Nếu món có tùy chọn, hệ thống mở màn hình chi tiết món; nếu món có thể thêm nhanh, hệ thống cập nhật giỏ hàng và hiển thị thanh giỏ hàng.
  3. Khi nhà hàng đóng cửa hoặc món hết hàng, thao tác thêm món bị vô hiệu hóa.

#### M08. Chi tiết món ăn

- **Mục đích chính:** Cho phép khách hàng xem chi tiết món, chọn modifier, điều chỉnh số lượng và thêm món vào giỏ.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-4`, thuộc `UC-DOM-03 - Cart & Checkout`, liên quan yêu cầu giỏ hàng một nhà hàng `BRD-05`.
- **Các Control chính:** Button quay lại, button chia sẻ, button yêu thích, nhóm chọn modifier một lựa chọn/nhiều lựa chọn, stepper số lượng, button "Add to Cart" hoặc "Update Cart".
- **Màn hình con / Component phụ:** Ảnh món, mô tả món, nhãn modifier bắt buộc/tùy chọn, thông báo thiếu lựa chọn bắt buộc, thanh tổng giá.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn các tùy chọn bắt buộc, chỉnh số lượng và nhấn thêm vào giỏ.
  2. Hệ thống kiểm tra modifier, tính lại giá theo tùy chọn; nếu hợp lệ thì thêm hoặc cập nhật dòng giỏ hàng, nếu thiếu lựa chọn bắt buộc thì hiển thị cảnh báo và không đóng màn hình.

#### M09. Chi tiết sản phẩm từ kết quả tìm kiếm

- **Mục đích chính:** Cho phép khách hàng xem nhanh một món ăn được mở từ kết quả tìm kiếm hoặc danh sách gợi ý.
- **Luồng tham chiếu (Use Case):** Hỗ trợ `UC-2`, `UC-3`, `UC-4`, thuộc `UC-DOM-02` và `UC-DOM-03`.
- **Các Control chính:** Button quay lại, ảnh món, thông tin giá, bộ điều chỉnh số lượng, danh sách món liên quan, button thêm vào giỏ.
- **Màn hình con / Component phụ:** Card thông tin sản phẩm, khu vực mô tả, danh sách sản phẩm liên quan, toast thêm giỏ hàng.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem thông tin, tăng giảm số lượng hoặc chọn món liên quan.
  2. Khi nhấn thêm vào giỏ, hệ thống cập nhật giỏ hàng và phản hồi bằng thông báo; nếu món không còn khả dụng, button thêm giỏ bị khóa hoặc hiển thị lỗi.

#### M10. Giỏ hàng

- **Mục đích chính:** Cho phép khách hàng kiểm tra và chỉnh sửa các món đã chọn trước khi checkout.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-5 - Manage Shopping Cart`, thuộc `UC-DOM-03`, liên quan `BRD-05`.
- **Các Control chính:** Danh sách món trong giỏ, button tăng/giảm số lượng, button xóa món, phần tạm tính/phí giao hàng, button "Proceed to Checkout".
- **Màn hình con / Component phụ:** Empty cart state, dòng tổng tiền, cảnh báo giỏ hàng một nhà hàng, thông báo cập nhật số lượng.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chỉnh số lượng hoặc xóa món khỏi giỏ.
  2. Hệ thống cập nhật tổng tiền ngay trên màn hình; nếu giỏ hàng còn món hợp lệ, button checkout được bật và chuyển sang luồng đặt hàng, nếu giỏ trống thì hiển thị trạng thái rỗng.

#### M11. Checkout một màn hình

- **Mục đích chính:** Gom các bước xác nhận địa chỉ, đơn hàng, phí, ưu đãi và thanh toán vào một màn hình đặt hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-8 - Place Order`, liên quan `UC-6`, `UC-9`, `UC-23`, `UC-DOM-03`, `UC-DOM-04`, `BRD-06`, `BRD-07`.
- **Các Control chính:** Card địa chỉ, danh sách món, phần giá trị đơn hàng, ô/chọn mã khuyến mãi, card phương thức thanh toán, button "Place Order".
- **Màn hình con / Component phụ:** Delivery section, order summary, price breakdown, promotion section, payment section, thanh đặt hàng cố định.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng kiểm tra thông tin và nhấn đặt hàng.
  2. Hệ thống xác thực địa chỉ, giỏ hàng, khuyến mãi và phương thức thanh toán; nếu hợp lệ thì tạo đơn và chuyển sang thanh toán hoặc trạng thái đơn hàng, nếu không hợp lệ thì hiển thị lỗi như địa chỉ ngoài vùng giao, món hết hàng hoặc mã ưu đãi không còn áp dụng.

#### M12. Chọn địa chỉ giao hàng trong checkout

- **Mục đích chính:** Xác nhận địa chỉ được dùng riêng cho đơn hàng đang checkout.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-6` và là bước hỗ trợ cho `UC-8`, liên quan `BRD-06`.
- **Các Control chính:** Danh sách địa chỉ đã lưu, button dùng vị trí hiện tại, button thêm địa chỉ mới, radio/chọn địa chỉ, button xác nhận.
- **Màn hình con / Component phụ:** Order preview, trạng thái kiểm tra vùng giao hàng, thông báo địa chỉ không khả dụng.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn địa chỉ và quay lại checkout.
  2. Hệ thống cập nhật địa chỉ giao hàng của đơn, tính lại phí giao hàng và thời gian dự kiến; nếu địa chỉ nằm ngoài vùng giao của nhà hàng, hệ thống cảnh báo và yêu cầu chọn địa chỉ khác.

#### M13. Chọn ưu đãi / mã khuyến mãi

- **Mục đích chính:** Cho phép khách hàng chọn ưu đãi phù hợp với nhà hàng và giá trị đơn hàng.
- **Luồng tham chiếu (Use Case):** Hỗ trợ `UC-23 - Manage Restaurant Promotions`, `UC-24 - Manage Platform Promotions`, thuộc `BRD-14`.
- **Các Control chính:** Danh sách ưu đãi, nhãn điều kiện đơn tối thiểu, nhãn giảm giá, button chọn/bỏ chọn, vùng hiển thị trạng thái đủ điều kiện.
- **Màn hình con / Component phụ:** Card ưu đãi khả dụng, card ưu đãi chưa đủ điều kiện, thông báo hết lượt/hết hạn, trạng thái selected promotion.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn một ưu đãi.
  2. Hệ thống kiểm tra nhà hàng, thời gian hiệu lực, giá trị đơn hàng và số lượt dùng; nếu đủ điều kiện thì áp dụng giảm giá vào checkout, nếu không đủ điều kiện thì giải thích điều kiện còn thiếu.

#### M14. Chọn phương thức thanh toán

- **Mục đích chính:** Cho phép khách hàng chọn cách thanh toán cho đơn hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-9 - Make Online Payment`, thuộc `UC-DOM-04 - Payment`, liên quan `BRD-07`.
- **Các Control chính:** Radio/card "Cash on Delivery", radio/card "VNPay", danh sách phương thức đã lưu, button lưu hoặc xác nhận.
- **Màn hình con / Component phụ:** Trạng thái phương thức chưa khả dụng, nhãn phương thức mặc định, thông báo thay đổi thành công.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn một phương thức thanh toán.
  2. Hệ thống lưu lựa chọn cho đơn hàng hiện tại hoặc làm mặc định; nếu chọn VNPay, sau khi đặt hàng hệ thống điều hướng sang luồng thanh toán trực tuyến, nếu chọn tiền mặt thì đơn được tạo theo phương thức COD.

#### M15. Rà soát đơn hàng

- **Mục đích chính:** Cho phép khách hàng kiểm tra lại toàn bộ thông tin đơn trước khi gửi yêu cầu đặt hàng.
- **Luồng tham chiếu (Use Case):** Là bước xác nhận cuối của `UC-8`, liên quan `UC-DOM-03`, `BRD-05`, `BRD-07`.
- **Các Control chính:** Danh sách món, card địa chỉ, card thanh toán, bảng phí, button "Place Order", button quay lại chỉnh sửa.
- **Màn hình con / Component phụ:** Order review summary, price breakdown, trạng thái kiểm tra khuyến mãi, thông báo lỗi đặt hàng.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng rà soát và nhấn "Place Order".
  2. Hệ thống khóa dữ liệu đơn tại thời điểm đặt, kiểm tra lại giá và khả dụng của món; thành công thì tạo đơn, thất bại thì thông báo lỗi và yêu cầu người dùng chỉnh sửa thông tin liên quan.

#### M16. Trạng thái thanh toán VNPay

- **Mục đích chính:** Hiển thị trạng thái thanh toán trực tuyến và hướng dẫn khách hàng xử lý tiếp.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-9`, `UC-DOM-04`, liên quan `BRD-07` và trạng thái đơn hàng `BRD-08`.
- **Các Control chính:** Vùng trạng thái thanh toán, button tiếp tục thanh toán, button theo dõi đơn hàng, button về trang chủ, button làm mới.
- **Màn hình con / Component phụ:** Bộ đếm/polling trạng thái, order summary, thông báo thanh toán thành công/thất bại/đang xử lý.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Sau khi người dùng quay lại từ VNPay, hệ thống đọc kết quả, kiểm tra trạng thái giao dịch và cập nhật đơn hàng.
  2. Nếu thanh toán thành công, người dùng có thể theo dõi đơn; nếu thất bại hoặc hết hạn, màn hình cung cấp thao tác thử lại hoặc quay về trang chủ.

#### M17. Lịch sử đơn hàng

- **Mục đích chính:** Cho phép khách hàng xem lại các đơn hàng đã đặt và truy cập nhanh vào theo dõi hoặc chi tiết đơn.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-10 - View Order History`, thuộc `UC-DOM-05 - Order Tracking & History`.
- **Các Control chính:** Danh sách order card, button lọc, pull-to-refresh, button mở chi tiết, nhãn trạng thái đơn.
- **Màn hình con / Component phụ:** Empty state, loading skeleton, error state, order card gồm mã đơn, nhà hàng, tổng tiền và trạng thái.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng kéo để làm mới hoặc chọn một đơn.
  2. Hệ thống tải danh sách đơn của tài khoản hiện tại, hiển thị trạng thái mới nhất và điều hướng đến chi tiết hoặc theo dõi khi người dùng chọn đơn.

#### M18. Chi tiết đơn hàng

- **Mục đích chính:** Hiển thị toàn bộ dữ liệu của một đơn hàng đã đặt.
- **Luồng tham chiếu (Use Case):** Hỗ trợ `UC-10`, `UC-20`, `UC-9`, `UC-22`, thuộc `UC-DOM-05`.
- **Các Control chính:** Header trạng thái, danh sách món, phần thanh toán, phần địa chỉ, button tiếp tục VNPay, button đánh giá, button theo dõi đơn.
- **Màn hình con / Component phụ:** Order summary, payment summary, delivery address card, review entry, loading/error state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng mở đơn từ lịch sử.
  2. Hệ thống tải chi tiết đơn, hiển thị thông tin thanh toán và trạng thái; nếu đơn đang chờ thanh toán VNPay thì cho phép tiếp tục thanh toán, nếu đơn đã hoàn tất thì hiển thị thao tác đánh giá.

#### M19. Theo dõi trạng thái đơn hàng

- **Mục đích chính:** Cung cấp tiến trình xử lý đơn hàng theo thời gian thực cho khách hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-20 - Track Order Status`, thuộc `UC-DOM-05` và `UC-DOM-11 - Real-time Tracking`, liên quan `BRD-08`.
- **Các Control chính:** Timeline trạng thái, card thông tin nhà hàng, danh sách món, bảng phí, button đánh giá khi đủ điều kiện.
- **Màn hình con / Component phụ:** Status timeline, inline review prompt, trạng thái đơn bị hủy, loading/error state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Hệ thống hiển thị các mốc như đã đặt, nhà hàng xác nhận, đang chuẩn bị, sẵn sàng, đã giao hoặc đã hủy.
  2. Khi trạng thái thay đổi từ backend, timeline được cập nhật; nếu đơn hoàn tất, màn hình mở lối vào đánh giá.

#### M20. Đánh giá đơn hàng

- **Mục đích chính:** Thu thập phản hồi của khách hàng sau khi đơn hàng kết thúc.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-22 - Submit Rating & Review`, thuộc `UC-DOM-09 - Reviews & Feedback`, liên quan `BRD-13`.
- **Các Control chính:** Bộ chọn sao 1-5, tag nhận xét, textbox bình luận, button gửi đánh giá, button quay lại.
- **Màn hình con / Component phụ:** Existing review read-only state, bộ đếm ký tự, thông báo gửi thành công/thất bại, trạng thái loading.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn số sao, chọn tối đa các tag phù hợp và nhập bình luận tùy chọn.
  2. Hệ thống kiểm tra đơn có đủ điều kiện đánh giá không; thành công thì lưu review và cập nhật màn hình đơn hàng, thất bại thì hiển thị lỗi như đơn chưa hoàn tất hoặc đã đánh giá.

#### M21. Hộp thư thông báo

- **Mục đích chính:** Tập trung các thông báo liên quan đơn hàng, khuyến mãi và tài khoản cho khách hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-26 - Manage Real-Time Notifications`, thuộc `UC-DOM-08 - Notifications`, liên quan `BRD-11`.
- **Các Control chính:** Danh sách thông báo, button "Mark all read", pull-to-refresh, item thông báo, badge chưa đọc.
- **Màn hình con / Component phụ:** Empty notification state, unread indicator, notification detail navigation, loading/error state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng mở hộp thư, kéo làm mới hoặc chọn một thông báo.
  2. Hệ thống đánh dấu đã đọc khi người dùng mở thông báo và điều hướng đến màn hình liên quan như đơn hàng, ưu đãi hoặc cài đặt; button "Mark all read" cập nhật toàn bộ trạng thái đã đọc.

#### M22. Hồ sơ cá nhân

- **Mục đích chính:** Hiển thị trung tâm tài khoản cá nhân và các lối tắt quản lý thông tin khách hàng.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, hỗ trợ `UC-6`, `UC-9`, `UC-26`, liên quan `BRD-01`, `BRD-06`, `BRD-07`.
- **Các Control chính:** Avatar, tên/email, menu "Personal Info", "Saved Addresses", "Payment Methods", "Settings", button "Log Out".
- **Màn hình con / Component phụ:** Hộp xác nhận đăng xuất, trạng thái hủy đăng ký push token, bottom tab profile.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn từng mục để vào màn hình quản lý tương ứng.
  2. Khi nhấn đăng xuất, hệ thống hiển thị xác nhận; nếu đồng ý, hệ thống hủy token thông báo của thiết bị, xóa phiên đăng nhập và chuyển về luồng xác thực.

#### M23. Sửa hồ sơ cá nhân

- **Mục đích chính:** Cho phép khách hàng cập nhật thông tin hồ sơ cơ bản.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, liên quan `UC-1` và `BRD-01`.
- **Các Control chính:** Textbox tên hiển thị, textbox email, trường số điện thoại chỉ đọc, button lưu, button hủy.
- **Màn hình con / Component phụ:** Placeholder ảnh đại diện, thông báo lưu thành công/thất bại, trạng thái loading.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chỉnh thông tin cho phép và nhấn lưu.
  2. Hệ thống kiểm tra dữ liệu, gửi yêu cầu cập nhật hồ sơ; thành công thì cập nhật thông tin hiển thị, thất bại thì giữ dữ liệu hiện tại và hiển thị lỗi.

#### M24. Phương thức thanh toán cá nhân

- **Mục đích chính:** Quản lý phương thức thanh toán ưu tiên của khách hàng.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-9`, `UC-DOM-04`, liên quan `BRD-07`.
- **Các Control chính:** Card COD, card VNPay, trạng thái phương thức thẻ chưa hỗ trợ, button lưu.
- **Màn hình con / Component phụ:** Nhãn phương thức mặc định, cảnh báo tính khả dụng, thông báo lưu lựa chọn.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn phương thức mặc định và nhấn lưu.
  2. Hệ thống lưu lựa chọn vào hồ sơ hoặc trạng thái checkout; nếu phương thức chưa khả dụng, card được khóa và hiển thị thông tin chờ hỗ trợ.

#### M25. Cài đặt

- **Mục đích chính:** Cho phép khách hàng cấu hình hành vi ứng dụng và truy cập thông tin pháp lý.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-08`, liên quan `UC-26`, `BRD-11` và quản lý tài khoản `BRD-01`.
- **Các Control chính:** Toggle "Push Notifications", toggle "Order Updates", menu "Language", "Privacy Policy", "Terms of Service", "About".
- **Màn hình con / Component phụ:** Dialog quyền thông báo, trang điều khoản, trang chính sách quyền riêng tư, trạng thái lưu cài đặt.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng bật/tắt thông báo hoặc mở các mục thông tin.
  2. Hệ thống lưu cấu hình thông báo, đăng ký hoặc hủy đăng ký nhận push tương ứng; nếu thiết bị chưa cấp quyền, hệ thống yêu cầu quyền hoặc hiển thị hướng dẫn.

### 3.4.2.2 Web portal - Đối tác nhà hàng

#### W01. Trang giới thiệu đối tác

- **Mục đích chính:** Giới thiệu portal cho đối tác nhà hàng và chuyển đổi khách truy cập thành tài khoản đăng ký.
- **Luồng tham chiếu (Use Case):** Là điểm đầu của `UC-DOM-06 - Restaurant Operations`, liên quan `UC-11 - Restaurant Registration & Profile Management`, `BRD-02`.
- **Các Control chính:** Navigation "Features", "How it works", "Stories", button "Start selling", button "Sign in", các CTA đăng ký.
- **Màn hình con / Component phụ:** Hero đối tác, phần lợi ích, quy trình tham gia, câu chuyện thành công, footer.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng đọc thông tin và nhấn CTA đăng ký hoặc đăng nhập.
  2. Hệ thống điều hướng đến màn hình đăng ký tài khoản đối tác hoặc đăng nhập; các anchor trong trang cuộn đến phần nội dung tương ứng.

#### W02. Đăng nhập đối tác

- **Mục đích chính:** Xác thực chủ nhà hàng hoặc nhân viên nhà hàng trước khi truy cập portal vận hành.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, là tiền điều kiện cho `UC-DOM-06`, `UC-12`, `UC-14`, `UC-23`; liên quan `BRD-01`.
- **Các Control chính:** Textbox "Work Email", textbox "Password", button ẩn/hiện mật khẩu, checkbox "Remember this device", button "Authorize Access", link đăng ký, link "Forgot Access".
- **Màn hình con / Component phụ:** Login form, trạng thái loading, alert lỗi đăng nhập, panel nhận diện thương hiệu partner portal.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập email và mật khẩu, chọn ghi nhớ thiết bị nếu cần rồi nhấn đăng nhập.
  2. Hệ thống xác thực tài khoản và vai trò; thành công thì chuyển đến dashboard hoặc trang chờ phê duyệt, thất bại thì hiển thị lỗi và không tạo phiên.

#### W03. Đăng ký tài khoản đối tác

- **Mục đích chính:** Tạo tài khoản đại diện nhà hàng trước khi khai báo hồ sơ kinh doanh.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-11`, `UC-DOM-01`, `UC-DOM-06`, liên quan `BRD-02`.
- **Các Control chính:** Textbox họ tên, textbox email, textbox mật khẩu, button ẩn/hiện mật khẩu, button "Create Account", button Google, button Apple, link đăng nhập.
- **Màn hình con / Component phụ:** Register form, social auth section, trạng thái loading, thông báo lỗi dữ liệu.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập thông tin đại diện và tạo tài khoản.
  2. Hệ thống kiểm tra email, mật khẩu, gọi API đăng ký; thành công thì chuyển sang màn hình đăng ký thông tin nhà hàng, thất bại thì hiển thị lỗi như email đã được sử dụng.

#### W04. Đăng ký thông tin nhà hàng

- **Mục đích chính:** Thu thập hồ sơ nhà hàng để hệ thống và admin xét duyệt trước khi cho phép bán hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-11`, hỗ trợ `UC-27 - Approve/Reject Restaurant Applications`, liên quan `BRD-02`, `BRD-04`, `BRD-06`.
- **Các Control chính:** Textbox tên nhà hàng, combobox loại ẩm thực, textbox điện thoại, textbox email công khai, textbox địa chỉ, button định vị, trường lat/lon ẩn, button gửi hồ sơ.
- **Màn hình con / Component phụ:** Bản đồ/khối định vị, form thông tin liên hệ, thông báo lỗi địa chỉ, footer tiến trình đăng ký.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập thông tin nhà hàng và yêu cầu định vị địa chỉ nếu cần.
  2. Hệ thống chuẩn hóa địa chỉ, lưu tọa độ và gửi hồ sơ; thành công thì chuyển đến trạng thái chờ duyệt, thất bại thì chỉ rõ trường chưa hợp lệ.

#### W05. Trạng thái hồ sơ đăng ký

- **Mục đích chính:** Thông báo cho đối tác rằng hồ sơ đã được gửi và đang chờ phê duyệt.
- **Luồng tham chiếu (Use Case):** Hỗ trợ `UC-11` và `UC-27`, liên quan `BRD-02`.
- **Các Control chính:** Button quay về trang chủ, button liên hệ hỗ trợ, link đăng nhập, vùng hiển thị các bước tiếp theo.
- **Màn hình con / Component phụ:** Status card, timeline xét duyệt, alert hướng dẫn, thông tin liên hệ hỗ trợ.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Sau khi gửi hồ sơ, hệ thống hiển thị trạng thái đang chờ.
  2. Người dùng có thể quay lại đăng nhập hoặc liên hệ hỗ trợ; khi admin phê duyệt, lần đăng nhập sau sẽ điều hướng vào dashboard.

#### W06. Chờ phê duyệt sau đăng nhập

- **Mục đích chính:** Chặn truy cập chức năng vận hành đối với tài khoản đã đăng nhập nhưng nhà hàng chưa được duyệt.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-11`, `UC-27`, hỗ trợ kiểm soát truy cập trong `UC-DOM-06`, liên quan `BRD-02`.
- **Các Control chính:** Nút đăng xuất, nút liên hệ hỗ trợ, thông tin trạng thái hồ sơ, navigation tối giản.
- **Màn hình con / Component phụ:** Pending approval panel, checklist quy trình duyệt, alert trạng thái tài khoản.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Khi người dùng đăng nhập nhưng hồ sơ chưa active, hệ thống đưa đến màn hình này.
  2. Người dùng không thể mở các route vận hành; nếu đăng xuất, phiên bị xóa và quay lại màn hình đăng nhập.

#### W07. Dashboard nhà hàng

- **Mục đích chính:** Cung cấp tổng quan vận hành nhà hàng và các việc cần xử lý ngay.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-06`, `UC-DOM-12 - Reporting & Monitoring`, liên quan `UC-13`, `UC-14`, `UC-33`, `BRD-08`, `BRD-09`, `BRD-15`.
- **Các Control chính:** Toggle trạng thái cửa hàng, KPI cards, danh sách cảnh báo, danh sách đơn gần đây, button xem đơn, khu vực doanh thu.
- **Màn hình con / Component phụ:** Store status panel, urgent alerts, revenue summary, average order value, recent orders table/card.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem nhanh doanh thu, đơn hàng và cảnh báo.
  2. Khi bật/tắt cửa hàng, hệ thống cập nhật trạng thái nhận đơn; khi chọn một đơn, portal điều hướng đến chi tiết đơn để xử lý.

#### W08. Bảng đơn hàng / Kitchen board

- **Mục đích chính:** Giúp nhà hàng xử lý đơn theo luồng vận hành bếp từ yêu cầu mới đến sẵn sàng giao.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-14 - Accept or Reject Order`, `UC-15 - Prepare Order for Pickup`, thuộc `UC-DOM-06`, liên quan `BRD-09`.
- **Các Control chính:** Cột trạng thái đơn, order card, thao tác kéo thả, button xác nhận, button bắt đầu chuẩn bị, button đánh dấu sẵn sàng, toast đơn mới.
- **Màn hình con / Component phụ:** Kanban columns, order card detail snippet, realtime new order notification, empty column state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Nhà hàng xem đơn ở từng cột và kéo thả hoặc nhấn action để chuyển trạng thái.
  2. Hệ thống gọi API tương ứng; thành công thì card chuyển cột và khách hàng nhận cập nhật, thất bại thì hiển thị lỗi và hoàn nguyên thao tác.

#### W09. Chi tiết đơn hàng nhà hàng

- **Mục đích chính:** Cung cấp đầy đủ thông tin đơn để nhà hàng xác nhận, chuẩn bị, hủy hoặc đánh dấu sẵn sàng.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-14`, `UC-15`, `UC-21 - Cancel Order`, `UC-DOM-06`, liên quan `BRD-08`, `BRD-09`.
- **Các Control chính:** Button xác nhận, button bắt đầu chuẩn bị, button sẵn sàng, button hủy đơn, dialog lý do hủy, danh sách món, timeline.
- **Màn hình con / Component phụ:** Order header, item list, customer/payment panel, delivery map, cancellation dialog, order notes.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Nhân viên mở đơn để xem món, ghi chú và thông tin thanh toán.
  2. Tùy trạng thái, hệ thống hiển thị action hợp lệ; khi người dùng xác nhận action, backend cập nhật trạng thái đơn và đồng bộ đến mobile khách hàng.

#### W10. Quản lý menu

- **Mục đích chính:** Cho phép nhà hàng quản lý danh sách món và trạng thái bán của menu.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-12 - Manage Menu Items`, `UC-13 - Toggle Item & Restaurant Availability`, thuộc `UC-DOM-06`, liên quan `BRD-04`.
- **Các Control chính:** Danh sách món, bộ lọc danh mục, button thêm món, form thêm danh mục, switch bật/tắt món, button sửa, button xóa, toggle cửa hàng online/offline.
- **Màn hình con / Component phụ:** Sidebar danh mục, confirm delete dialog, empty menu state, item availability badge.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng lọc món, thêm danh mục, bật/tắt món hoặc mở form sửa.
  2. Hệ thống cập nhật trạng thái món tức thời; khi xóa món, hệ thống yêu cầu xác nhận để tránh mất dữ liệu ngoài ý muốn.

#### W11. Tạo món mới

- **Mục đích chính:** Cho phép nhà hàng khai báo món ăn mới để hiển thị trên mobile app khách hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-12`, thuộc `UC-DOM-06`, liên quan `BRD-04`.
- **Các Control chính:** Textbox tên món, textarea mô tả, input giá, combobox danh mục, upload ảnh, tag chế độ ăn, switch hiển thị, button discard, button publish.
- **Màn hình con / Component phụ:** Product essence form, dietary tags, media uploader, visibility panel, footer action bar.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập thông tin món và nhấn publish.
  2. Hệ thống kiểm tra dữ liệu bắt buộc, tải ảnh nếu có và tạo món mới; thành công thì điều hướng về quản lý menu, thất bại thì hiển thị lỗi tại form.

#### W12. Chỉnh sửa món và modifier

- **Mục đích chính:** Cho phép nhà hàng cập nhật món đã có và cấu hình các lựa chọn thêm như size, topping hoặc ghi chú bắt buộc.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-12`, `UC-13`, thuộc `UC-DOM-06`, liên quan `BRD-04`.
- **Các Control chính:** Form thông tin món, upload ảnh, switch trạng thái, khu vực modifier, button thêm nhóm modifier, button lưu thay đổi.
- **Màn hình con / Component phụ:** Modifier card, nhóm option, trạng thái loading dữ liệu món, alert lưu thành công/thất bại.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng mở món, chỉnh thông tin hoặc thêm modifier rồi lưu.
  2. Hệ thống cập nhật dữ liệu món và các lựa chọn liên quan; nếu modifier bắt buộc không có option hợp lệ, hệ thống báo lỗi để người dùng hoàn thiện.

#### W13. Quản lý vùng giao hàng

- **Mục đích chính:** Cho phép nhà hàng cấu hình khu vực có thể giao hàng, phí và thời gian dự kiến.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-7 - Manage Delivery Zones`, thuộc `UC-DOM-06` và `UC-DOM-07`, liên quan `BRD-06`.
- **Các Control chính:** Danh sách vùng giao, button tạo vùng mới, dialog tạo/sửa vùng, switch kích hoạt, input phí giao hàng, input thời gian, công cụ ước tính giao hàng.
- **Màn hình con / Component phụ:** Delivery zone list, coverage map, delivery estimator, empty state, form dialog.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng tạo hoặc sửa vùng giao hàng.
  2. Hệ thống lưu cấu hình vùng và dùng dữ liệu này để kiểm tra địa chỉ khách hàng trong checkout; nếu vùng bị tắt, địa chỉ thuộc vùng đó sẽ không được xem là khả dụng.

#### W14. Phân tích vận hành

- **Mục đích chính:** Cung cấp báo cáo hiệu suất bán hàng và vận hành cho nhà hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-33 - View and Export Operational Reports`, thuộc `UC-DOM-12`, liên quan `BRD-15`.
- **Các Control chính:** Bộ chọn khoảng thời gian, toggle so sánh baseline, button export, KPI row, biểu đồ doanh thu, bảng món bán chạy, danh sách sự cố.
- **Màn hình con / Component phụ:** Operational banner, chart panels, data tables, export state, empty analytics state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn khoảng thời gian hoặc bật so sánh.
  2. Hệ thống tải lại số liệu, cập nhật biểu đồ và bảng; khi nhấn export, hệ thống tạo file báo cáo hoặc gọi API xuất dữ liệu.

#### W15. Quản lý khuyến mãi nhà hàng

- **Mục đích chính:** Cho phép nhà hàng quản lý các ưu đãi do nhà hàng tự tạo.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-23 - Manage Restaurant Promotions`, thuộc `UC-DOM-06`, liên quan `BRD-14`.
- **Các Control chính:** Summary cards, filter pills, promotion cards, button "New Promotion", button edit, button pause/publish/resume, button delete.
- **Màn hình con / Component phụ:** Promotion status badge, confirm delete dialog, empty promotion state, action menu.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem danh sách và thay đổi trạng thái khuyến mãi.
  2. Hệ thống kiểm tra quyền sở hữu nhà hàng, cập nhật trạng thái hoặc xóa khuyến mãi; nếu khuyến mãi đang chạy có ràng buộc, hệ thống cảnh báo trước khi thay đổi.

#### W16. Tạo / chỉnh sửa khuyến mãi nhà hàng

- **Mục đích chính:** Cấu hình nội dung và điều kiện áp dụng ưu đãi cấp nhà hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-23`, liên quan `BRD-14`.
- **Các Control chính:** Textbox tên khuyến mãi, textarea mô tả, combobox loại giảm giá, input giá trị giảm, input đơn tối thiểu, input giới hạn lượt dùng, lịch bắt đầu/kết thúc, button lưu nháp, button publish.
- **Màn hình con / Component phụ:** Promotion form sections, validation summary, schedule picker, stacking mode selector.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập thông tin khuyến mãi và chọn lưu nháp hoặc phát hành.
  2. Hệ thống kiểm tra thời gian, giá trị giảm, giới hạn lượt dùng; thành công thì lưu dữ liệu và cập nhật danh sách khuyến mãi, thất bại thì hiển thị lỗi theo trường.

#### W17. Cài đặt tài khoản và cửa hàng

- **Mục đích chính:** Quản lý cấu hình tài khoản đối tác, thông tin cửa hàng, bảo mật, thông báo và thiết bị đăng nhập.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, `UC-DOM-06`, `UC-DOM-08`, liên quan `UC-11`, `UC-26`, `BRD-01`, `BRD-04`, `BRD-11`.
- **Các Control chính:** Sidebar tab Profile/Store/Security/Notifications/Devices/Danger, form hồ sơ, form cửa hàng, form đổi mật khẩu, toggle thông báo, button đăng xuất hoặc thao tác nguy hiểm.
- **Màn hình con / Component phụ:** Settings sidebar, profile panel, store panel, security panel, notification preferences, device sessions, danger zone.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn tab và cập nhật thông tin tương ứng.
  2. Hệ thống kiểm tra quyền, lưu thay đổi từng nhóm cấu hình; với thao tác nhạy cảm như đổi mật khẩu hoặc đăng xuất thiết bị, hệ thống yêu cầu xác nhận và cập nhật phiên đăng nhập.

### 3.4.2.3 Admin portal - Quản trị hệ thống

#### A01. Đăng nhập admin

- **Mục đích chính:** Xác thực quản trị viên và đảm bảo chỉ tài khoản có vai trò admin được truy cập portal quản trị.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, là tiền điều kiện cho `UC-DOM-10 - Administration`, liên quan `UC-35 - Manage Admin Roles & Permissions`, `BRD-01`, `BRD-16`.
- **Các Control chính:** Textbox email, textbox mật khẩu, button đăng nhập, link chuyển sang restaurant portal, thông báo lỗi.
- **Màn hình con / Component phụ:** Login panel, trạng thái loading, alert lỗi quyền truy cập, session bootstrap.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập thông tin và nhấn đăng nhập.
  2. Hệ thống xác thực tài khoản, kiểm tra vai trò admin; nếu hợp lệ thì chuyển vào dashboard, nếu không phải admin hoặc sai thông tin thì hiển thị lỗi và không cấp quyền.

#### A02. Dashboard nền tảng

- **Mục đích chính:** Cung cấp góc nhìn tổng quan về sức khỏe kinh doanh và vận hành toàn nền tảng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-34 - View Dashboard & Platform Overview`, hỗ trợ `UC-30`, `UC-33`, thuộc `UC-DOM-10`, `UC-DOM-12`, liên quan `BRD-15`, `BRD-16`.
- **Các Control chính:** Bộ chọn khoảng thời gian, KPI cards, biểu đồ GMV/doanh thu, heatmap vận hành, danh sách nhà hàng top, danh sách hồ sơ chờ duyệt.
- **Màn hình con / Component phụ:** Revenue chart, operations heatmap, top earners table, bottleneck panel, pending approval panel.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin chọn khoảng thời gian để xem số liệu tổng quan.
  2. Hệ thống tải lại chỉ số và biểu đồ; khi admin chọn hồ sơ chờ duyệt hoặc đối tượng vận hành, màn hình điều hướng sang module quản lý tương ứng.

#### A03. Quản lý nhà hàng

- **Mục đích chính:** Cho phép admin quản lý vòng đời hồ sơ nhà hàng trên nền tảng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-27 - Approve/Reject Restaurant Applications`, thuộc `UC-DOM-10`, liên quan `BRD-02`, `BRD-16`.
- **Các Control chính:** KPI trạng thái nhà hàng, ô tìm kiếm, button export, bảng nhà hàng, filter trạng thái, review sheet, button approve, button suspend, button delete.
- **Màn hình con / Component phụ:** Restaurant detail sheet, timeline hồ sơ, owner info, address panel, confirm action dialogs.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin tìm kiếm hoặc lọc nhà hàng, mở sheet để xem thông tin chi tiết.
  2. Khi approve, suspend hoặc delete, hệ thống yêu cầu xác nhận nếu cần, gọi API cập nhật trạng thái và làm mới bảng; kết quả thao tác được ghi nhận phục vụ kiểm soát quản trị.

#### A04. Quản lý đơn hàng toàn nền tảng

- **Mục đích chính:** Cho phép admin giám sát và tra cứu đơn hàng trên toàn hệ thống.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-30 - Monitor Orders and Platform Health`, hỗ trợ `UC-32 - Administrative Order Cancellation & Refund`, thuộc `UC-DOM-10`, liên quan `BRD-08`, `BRD-16`.
- **Các Control chính:** KPI đơn hàng, ô tìm kiếm, filter phương thức thanh toán, filter trạng thái, button export, bảng đơn hàng, phân trang, detail sheet.
- **Màn hình con / Component phụ:** Order detail sheet, tabs Items/Timeline/Customer/Payment, link VNPay nếu có, loading/error state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin lọc đơn theo trạng thái, thanh toán hoặc từ khóa, rồi mở chi tiết để kiểm tra.
  2. Hệ thống hiển thị dữ liệu đơn, timeline, khách hàng và thanh toán; nếu có URL giao dịch VNPay, admin có thể mở để đối soát.

#### A05. Quản lý người dùng

- **Mục đích chính:** Cho phép admin quản lý tài khoản khách hàng, đối tác và quản trị viên.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-31 - Search and Manage User Accounts`, hỗ trợ `UC-35`, thuộc `UC-DOM-10`, liên quan `BRD-01`, `BRD-16`.
- **Các Control chính:** KPI theo vai trò, ô tìm kiếm, filter trạng thái, role pills, bảng người dùng, phân trang, detail sheet, button đổi vai trò, button khóa/mở khóa, button xóa.
- **Màn hình con / Component phụ:** User detail sheet, ban reason form, ban duration selector, role change confirmation, delete confirmation.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin tìm kiếm tài khoản và mở chi tiết.
  2. Khi đổi vai trò hoặc khóa tài khoản, hệ thống kiểm tra quyền admin, yêu cầu lý do nếu khóa, cập nhật tài khoản và làm mới danh sách; nếu thao tác không hợp lệ, hệ thống hiển thị lỗi.

#### A06. Quản lý khuyến mãi nền tảng

- **Mục đích chính:** Cho phép admin quản lý các chương trình ưu đãi ở cấp nền tảng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-24 - Manage Platform Promotions`, thuộc `UC-DOM-10`, liên quan `BRD-14`, `BRD-16`.
- **Các Control chính:** Summary cards, bộ lọc trạng thái, danh sách promotion cards, button tạo mới, button xem chi tiết, button publish/pause/resume/cancel/delete.
- **Màn hình con / Component phụ:** Promotion status badge, action menu, confirm action dialog, empty state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin xem các chương trình hiện có và chọn thao tác quản trị.
  2. Hệ thống cập nhật trạng thái khuyến mãi, kiểm tra thời gian hiệu lực và phạm vi áp dụng; với thao tác hủy hoặc xóa, hệ thống yêu cầu xác nhận để tránh ảnh hưởng người dùng.

#### A07. Chi tiết khuyến mãi và mã coupon

- **Mục đích chính:** Hiển thị đầy đủ thông tin một chương trình khuyến mãi và quản lý mã coupon phát sinh.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-24`, hỗ trợ quản lý coupon trong `BRD-14`.
- **Các Control chính:** Tabs chi tiết/coupons, button edit, button publish, button pause, button cancel, button generate coupon, button revoke coupon.
- **Màn hình con / Component phụ:** Promotion detail panel, coupon table, coupon generation dialog, revoke confirmation, usage statistics.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin mở một khuyến mãi để kiểm tra cấu hình và danh sách mã.
  2. Khi sinh mã, hệ thống tạo coupon theo số lượng/điều kiện; khi thu hồi, coupon không còn được áp dụng trong checkout và bảng được cập nhật lại.

#### A08. Tạo / chỉnh sửa khuyến mãi nền tảng

- **Mục đích chính:** Cấu hình chương trình ưu đãi cấp nền tảng với phạm vi và cơ chế áp dụng linh hoạt.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-24`, liên quan `BRD-14`, `BRD-16`.
- **Các Control chính:** Textbox tên, textarea mô tả, selector phạm vi platform/restaurant, selector trigger tự động/coupon, selector loại giảm, input giá trị giảm, input giới hạn ngân sách/lượt dùng, lịch chạy, button save draft, button publish.
- **Màn hình con / Component phụ:** Scope selector, trigger selector, discount configuration, limit configuration, schedule picker, validation summary.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin nhập cấu hình và chọn lưu nháp hoặc phát hành.
  2. Hệ thống kiểm tra điều kiện giảm giá, phạm vi áp dụng, lịch chạy và giới hạn sử dụng; thành công thì lưu khuyến mãi và cập nhật danh sách, thất bại thì hiển thị lỗi theo từng nhóm cấu hình.

#### A09. Cài đặt tài khoản admin

- **Mục đích chính:** Cho phép quản trị viên cập nhật hồ sơ cá nhân và tăng cường bảo mật tài khoản.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, hỗ trợ `UC-35`, liên quan `BRD-01`, `BRD-16`.
- **Các Control chính:** Tab Profile, tab Security, textbox display name, textbox avatar URL, email chỉ đọc, form đổi mật khẩu, chỉ báo độ mạnh mật khẩu, button revoke other sessions, button sign out.
- **Màn hình con / Component phụ:** Profile settings form, security settings form, password strength indicator, session revocation confirmation.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin cập nhật hồ sơ hoặc đổi mật khẩu trong tab tương ứng.
  2. Hệ thống kiểm tra dữ liệu, lưu thay đổi hồ sơ; với đổi mật khẩu, hệ thống yêu cầu mật khẩu hiện tại và mật khẩu mới hợp lệ, sau đó có thể thu hồi các phiên đăng nhập khác để giảm rủi ro bảo mật.
