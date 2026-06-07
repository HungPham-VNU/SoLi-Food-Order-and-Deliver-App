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
  1. Người dùng mới xem phần giới thiệu, có thể mở "Terms of Service" hoặc "Privacy Policy" để đọc thông tin trước khi bắt đầu.
  2. Khi nhấn "Get Started", ứng dụng chuyển sang màn hình đăng ký; khi nhấn "Sign In", ứng dụng chuyển sang màn hình đăng nhập.
  3. Khi chọn "Continue with Google", ứng dụng mở luồng xác thực Google và hiển thị trạng thái đang xử lý để tránh người dùng bấm lặp.
  4. Nếu xác thực thành công, hệ thống tạo phiên đăng nhập và đưa người dùng vào trang chủ; nếu thất bại, màn hình giữ nguyên và hiển thị lý do lỗi dễ hiểu.

#### M02. Đăng nhập

- **Mục đích chính:** Xác thực khách hàng đã có tài khoản và tạo phiên làm việc trên thiết bị mobile.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, là tiền điều kiện cho các luồng đặt món như `UC-2`, `UC-4`, `UC-8`; tham chiếu `UC-1` và `BRD-01`.
- **Các Control chính:** Textbox "Email", textbox "Password", button ẩn/hiện mật khẩu, button "Sign In", link "Forgot Password", link "Sign Up", button "Continue with Google".
- **Màn hình con / Component phụ:** Thông báo lỗi xác thực, trạng thái loading trên button, bộ điều hướng quay lại màn hình chào mừng.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập email, mật khẩu và có thể dùng nút ẩn/hiện mật khẩu để kiểm tra lại trước khi đăng nhập.
  2. Khi nhấn "Sign In", ứng dụng kiểm tra email rỗng, email sai định dạng hoặc mật khẩu chưa nhập và hiển thị lỗi ngay tại trường tương ứng.
  3. Nếu dữ liệu hợp lệ, hệ thống gọi API đăng nhập, lưu token, tải thông tin hồ sơ và chuyển người dùng đến trang chủ hoặc màn hình đang cần đăng nhập.
  4. Nếu sai thông tin hoặc mất kết nối, ứng dụng giữ email đã nhập, thông báo lỗi rõ ràng và cho phép người dùng sửa lại mật khẩu.

#### M03. Đăng ký

- **Mục đích chính:** Tạo tài khoản khách hàng mới để sử dụng các chức năng đặt món và theo dõi đơn hàng.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, thực hiện `UC-1`, đáp ứng yêu cầu tạo tài khoản khách hàng `BRD-01`.
- **Các Control chính:** Textbox "Full Name", textbox "Email", textbox "Phone Number", textbox "Password", checkbox chấp nhận điều khoản, button "Continue", link "Log in".
- **Màn hình con / Component phụ:** Thông báo lỗi kiểm tra dữ liệu, trạng thái loading, component điều khoản sử dụng và quyền riêng tư.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập họ tên, email, số điện thoại, mật khẩu và đánh dấu đồng ý điều khoản trước khi nhấn "Continue".
  2. Ứng dụng kiểm tra từng trường, nhắc người dùng khi email sai định dạng, số điện thoại không hợp lệ, mật khẩu quá yếu hoặc chưa đồng ý điều khoản.
  3. Nếu thông tin hợp lệ, hệ thống gửi yêu cầu tạo tài khoản và hiển thị trạng thái đang xử lý trên nút "Continue".
  4. Khi đăng ký thành công, người dùng được đưa vào app hoặc sang bước đăng nhập; nếu email đã tồn tại hoặc dữ liệu bị từ chối, lỗi được hiển thị tại đúng trường để người dùng sửa.

#### M04. Trang chủ / Khám phá nhà hàng

- **Mục đích chính:** Giúp khách hàng tìm nhà hàng, món ăn và ưu đãi dựa trên vị trí giao hàng hiện tại.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-02 - Restaurant Discovery & Search`, liên quan `UC-2`, `UC-3`, `UC-DOM-08`, `BRD-03`.
- **Các Control chính:** Button chọn địa chỉ, icon thông báo, ô tìm kiếm, chip danh mục, danh sách ưu đãi, card nhà hàng, card món ăn, nút làm mới, thanh giỏ hàng nổi.
- **Màn hình con / Component phụ:** Header địa chỉ, danh mục món, carousel ưu đãi, danh sách nhà hàng gần bạn, trạng thái loading/empty/error, bottom tabs.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Khi mở trang chủ, người dùng thấy địa chỉ đang dùng, danh mục món ăn, ưu đãi nổi bật và danh sách nhà hàng phù hợp với vị trí đó.
  2. Người dùng có thể đổi địa chỉ, nhập từ khóa tìm kiếm hoặc chọn chip danh mục để thu hẹp danh sách món ăn và nhà hàng.
  3. Khi chọn card nhà hàng, ứng dụng mở màn hình chi tiết nhà hàng; khi chọn món ăn, ứng dụng mở màn hình chi tiết món hoặc kết quả liên quan.
  4. Trong lúc tải dữ liệu, màn hình hiển thị trạng thái loading; nếu không có kết quả hoặc có lỗi mạng, người dùng thấy thông báo rỗng/lỗi và nút làm mới.
  5. Nếu giỏ hàng đã có món, thanh giỏ hàng nổi hiển thị số món, tổng tiền tạm tính và cho phép đi nhanh đến màn hình giỏ hàng.

#### M05. Chọn địa chỉ

- **Mục đích chính:** Cho phép khách hàng chọn địa chỉ giao hàng hiện tại để hệ thống kiểm tra phạm vi phục vụ và tính phí giao hàng.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-6 - Save & Manage Delivery Addresses`, hỗ trợ `UC-DOM-02`, `UC-DOM-03` và yêu cầu vùng phục vụ `BRD-06`.
- **Các Control chính:** Ô tìm kiếm địa chỉ, button "Use current location", tab "Recent", tab "Saved", danh sách địa chỉ, button thêm địa chỉ, icon sửa/xóa.
- **Màn hình con / Component phụ:** Danh sách địa chỉ gần đây, danh sách địa chỉ đã lưu, hộp xác nhận xóa, trạng thái quyền vị trí.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập từ khóa để tìm địa chỉ, chuyển giữa tab "Recent" và "Saved", hoặc chọn nhanh một địa chỉ đã lưu.
  2. Khi nhấn "Use current location", ứng dụng xin quyền vị trí nếu chưa có quyền và hiển thị trạng thái đang xác định vị trí.
  3. Sau khi chọn địa chỉ, hệ thống kiểm tra khả năng phục vụ, lưu địa chỉ làm địa chỉ hiện tại và dùng địa chỉ này cho trang chủ, giỏ hàng và checkout.
  4. Nếu người dùng từ chối quyền vị trí hoặc thiết bị không lấy được tọa độ, màn hình giải thích lỗi và gợi ý nhập địa chỉ thủ công.

#### M06. Thêm địa chỉ

- **Mục đích chính:** Lưu địa chỉ giao hàng mới để khách hàng sử dụng lại trong các lần đặt món sau.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-6`, liên quan `BRD-06` về quản lý địa chỉ và kiểm tra khả năng giao hàng.
- **Các Control chính:** Bản đồ hoặc vùng placeholder bản đồ, textbox tên địa chỉ, textbox tìm kiếm địa chỉ, textbox chi tiết địa chỉ, textbox ghi chú cho tài xế, button lưu.
- **Màn hình con / Component phụ:** Bộ chọn vị trí trên bản đồ, gợi ý địa chỉ, thông báo lỗi thiếu thông tin, trạng thái lưu địa chỉ.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn vị trí trên bản đồ hoặc từ gợi ý tìm kiếm, sau đó nhập tên gợi nhớ, địa chỉ chi tiết và ghi chú cho tài xế nếu cần.
  2. Khi nhấn lưu, ứng dụng kiểm tra tọa độ, tên địa chỉ và phần mô tả chi tiết; trường nào thiếu sẽ được đánh dấu ngay trên form.
  3. Nếu dữ liệu hợp lệ, hệ thống lưu địa chỉ vào tài khoản và đặt làm địa chỉ đang dùng khi người dùng thêm địa chỉ từ luồng checkout.
  4. Nếu lưu thất bại do lỗi mạng hoặc địa chỉ không hỗ trợ giao hàng, màn hình giữ lại dữ liệu đã nhập và hiển thị lựa chọn thử lại.

#### M07. Chi tiết nhà hàng và menu

- **Mục đích chính:** Hiển thị thông tin nhà hàng và cho phép khách hàng duyệt menu để chọn món.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-02`, liên quan `UC-3 - View Restaurant Details`, `UC-4 - Add Item to Cart`, `UC-DOM-09`, `BRD-03`, `BRD-04`.
- **Các Control chính:** Button quay lại, button yêu thích, tab/chip danh mục, card món ăn, button thêm nhanh, button xem đánh giá, thanh "View Cart".
- **Màn hình con / Component phụ:** Header ảnh nhà hàng, thông tin phí/thời gian giao, danh mục menu, danh sách món, phần đánh giá, trạng thái nhà hàng đóng cửa.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem thông tin nhà hàng, phí giao hàng, thời gian dự kiến và cuộn menu để chọn nhóm món phù hợp.
  2. Khi chọn chip danh mục, danh sách món cuộn đến đúng nhóm để người dùng mới dễ định vị món cần tìm.
  3. Nếu nhấn vào card món, ứng dụng mở màn hình chi tiết món; nếu nhấn thêm nhanh và món không có tùy chọn bắt buộc, hệ thống thêm món với cấu hình mặc định.
  4. Sau khi thêm món, thanh "View Cart" cập nhật số lượng và tổng tiền tạm tính; nhấn vào thanh này sẽ mở giỏ hàng.
  5. Nếu nhà hàng đang đóng cửa hoặc món hết hàng, nút thêm món bị khóa và màn hình hiển thị lý do để người dùng biết cần chọn món khác.

#### M08. Chi tiết món ăn

- **Mục đích chính:** Cho phép khách hàng xem chi tiết món, chọn modifier, điều chỉnh số lượng và thêm món vào giỏ.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-4`, thuộc `UC-DOM-03 - Cart & Checkout`, liên quan yêu cầu giỏ hàng một nhà hàng `BRD-05`.
- **Các Control chính:** Button quay lại, button chia sẻ, button yêu thích, nhóm chọn modifier một lựa chọn/nhiều lựa chọn, stepper số lượng, button "Add to Cart" hoặc "Update Cart".
- **Màn hình con / Component phụ:** Ảnh món, mô tả món, nhãn modifier bắt buộc/tùy chọn, thông báo thiếu lựa chọn bắt buộc, thanh tổng giá.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng đọc mô tả món, chọn các modifier bắt buộc như size/topping và chọn thêm các tùy chọn không bắt buộc nếu muốn.
  2. Khi người dùng thay đổi modifier hoặc số lượng, ứng dụng cập nhật tổng giá ngay trên thanh cuối màn hình.
  3. Khi nhấn "Add to Cart" hoặc "Update Cart", hệ thống kiểm tra các nhóm modifier bắt buộc và trạng thái còn bán của món.
  4. Nếu hợp lệ, món được thêm mới hoặc cập nhật trong giỏ hàng và người dùng nhận thông báo thành công; nếu còn thiếu lựa chọn, màn hình cuộn đến nhóm bị thiếu và hiển thị cảnh báo.
  5. Nếu giỏ hàng đang có món từ nhà hàng khác, ứng dụng yêu cầu người dùng xác nhận trước khi thay thế giỏ hàng hiện tại.

#### M09. Chi tiết sản phẩm từ kết quả tìm kiếm

- **Mục đích chính:** Cho phép khách hàng xem nhanh một món ăn được mở từ kết quả tìm kiếm hoặc danh sách gợi ý.
- **Luồng tham chiếu (Use Case):** Hỗ trợ `UC-2`, `UC-3`, `UC-4`, thuộc `UC-DOM-02` và `UC-DOM-03`.
- **Các Control chính:** Button quay lại, ảnh món, thông tin giá, bộ điều chỉnh số lượng, danh sách món liên quan, button thêm vào giỏ.
- **Màn hình con / Component phụ:** Card thông tin sản phẩm, khu vực mô tả, danh sách sản phẩm liên quan, toast thêm giỏ hàng.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng mở món từ kết quả tìm kiếm, xem ảnh, giá, mô tả ngắn và thông tin nhà hàng cung cấp món đó.
  2. Người dùng có thể tăng/giảm số lượng hoặc chọn món liên quan để chuyển sang chi tiết món mới.
  3. Khi nhấn thêm vào giỏ, hệ thống kiểm tra món còn bán, kiểm tra giỏ hàng một nhà hàng và cập nhật giỏ nếu hợp lệ.
  4. Sau khi thêm thành công, ứng dụng hiển thị toast xác nhận và cập nhật thanh giỏ hàng; nếu món không còn khả dụng, nút thêm bị khóa hoặc thông báo lỗi được hiển thị.

#### M10. Giỏ hàng

- **Mục đích chính:** Cho phép khách hàng kiểm tra và chỉnh sửa các món đã chọn trước khi checkout.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-5 - Manage Shopping Cart`, thuộc `UC-DOM-03`, liên quan `BRD-05`.
- **Các Control chính:** Danh sách món trong giỏ, button tăng/giảm số lượng, button xóa món, phần tạm tính/phí giao hàng, button "Proceed to Checkout".
- **Màn hình con / Component phụ:** Empty cart state, dòng tổng tiền, cảnh báo giỏ hàng một nhà hàng, thông báo cập nhật số lượng.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem lại từng món trong giỏ, gồm tên món, modifier đã chọn, số lượng và giá tạm tính.
  2. Khi tăng/giảm số lượng, hệ thống cập nhật dòng món, tạm tính, phí liên quan và tổng tiền ngay trên màn hình.
  3. Khi xóa món, ứng dụng cập nhật giỏ hàng; nếu giỏ không còn món, màn hình chuyển sang trạng thái rỗng và gợi ý quay lại chọn món.
  4. Button "Proceed to Checkout" chỉ bật khi giỏ hàng còn món hợp lệ; nếu có món hết hàng hoặc lỗi giỏ hàng một nhà hàng, màn hình chỉ rõ mục cần sửa trước khi checkout.

#### M11. Checkout một màn hình

- **Mục đích chính:** Gom các bước xác nhận địa chỉ, đơn hàng, phí, ưu đãi và thanh toán vào một màn hình đặt hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-8 - Place Order`, liên quan `UC-6`, `UC-9`, `UC-23`, `UC-DOM-03`, `UC-DOM-04`, `BRD-06`, `BRD-07`.
- **Các Control chính:** Card địa chỉ, danh sách món, phần giá trị đơn hàng, ô/chọn mã khuyến mãi, card phương thức thanh toán, button "Place Order".
- **Màn hình con / Component phụ:** Delivery section, order summary, price breakdown, promotion section, payment section, thanh đặt hàng cố định.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng kiểm tra địa chỉ giao hàng, danh sách món, phí giao hàng, khuyến mãi, phương thức thanh toán và tổng tiền trong cùng một màn hình.
  2. Khi người dùng thay đổi địa chỉ, ưu đãi hoặc phương thức thanh toán, hệ thống tính lại phí, giảm giá và tổng tiền trước khi cho đặt hàng.
  3. Khi nhấn "Place Order", ứng dụng khóa nút đặt hàng, hiển thị trạng thái đang tạo đơn và gửi dữ liệu checkout lên hệ thống.
  4. Hệ thống kiểm tra lại vùng giao, món còn bán, giá hiện tại, mã ưu đãi và phương thức thanh toán; lỗi ở phần nào sẽ được hiển thị ngay tại phần đó.
  5. Nếu tạo đơn thành công, người dùng được chuyển sang thanh toán VNPay hoặc màn hình theo dõi đơn tùy phương thức thanh toán đã chọn.

#### M12. Chọn địa chỉ giao hàng trong checkout

- **Mục đích chính:** Xác nhận địa chỉ được dùng riêng cho đơn hàng đang checkout.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-6` và là bước hỗ trợ cho `UC-8`, liên quan `BRD-06`.
- **Các Control chính:** Danh sách địa chỉ đã lưu, button dùng vị trí hiện tại, button thêm địa chỉ mới, radio/chọn địa chỉ, button xác nhận.
- **Màn hình con / Component phụ:** Order preview, trạng thái kiểm tra vùng giao hàng, thông báo địa chỉ không khả dụng.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng mở màn hình này từ checkout để xem các địa chỉ đã lưu hoặc chọn dùng vị trí hiện tại.
  2. Khi chọn một địa chỉ, hệ thống kiểm tra địa chỉ đó với vùng giao hàng của nhà hàng và hiển thị phí/thời gian giao dự kiến nếu có.
  3. Khi nhấn xác nhận, địa chỉ được đưa về checkout, đồng thời tổng tiền và thời gian giao hàng được tính lại.
  4. Nếu địa chỉ nằm ngoài vùng phục vụ, địa chỉ đó được đánh dấu không khả dụng và người dùng được yêu cầu chọn hoặc thêm địa chỉ khác.

#### M13. Chọn ưu đãi / mã khuyến mãi

- **Mục đích chính:** Cho phép khách hàng chọn ưu đãi phù hợp với nhà hàng và giá trị đơn hàng.
- **Luồng tham chiếu (Use Case):** Hỗ trợ `UC-23 - Manage Restaurant Promotions`, `UC-24 - Manage Platform Promotions`, thuộc `BRD-14`.
- **Các Control chính:** Danh sách ưu đãi, nhãn điều kiện đơn tối thiểu, nhãn giảm giá, button chọn/bỏ chọn, vùng hiển thị trạng thái đủ điều kiện.
- **Màn hình con / Component phụ:** Card ưu đãi khả dụng, card ưu đãi chưa đủ điều kiện, thông báo hết lượt/hết hạn, trạng thái selected promotion.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem danh sách ưu đãi, trong đó mỗi card nêu rõ mức giảm, điều kiện đơn tối thiểu, thời hạn và trạng thái đủ điều kiện.
  2. Khi chọn một ưu đãi, ứng dụng đánh dấu ưu đãi đang chọn và hiển thị số tiền giảm dự kiến để người dùng dễ so sánh.
  3. Hệ thống kiểm tra nhà hàng áp dụng, thời gian hiệu lực, giá trị đơn hàng, số lượt dùng và điều kiện coupon trước khi đưa ưu đãi về checkout.
  4. Nếu đủ điều kiện, ưu đãi được áp dụng và tổng tiền checkout cập nhật; nếu không đủ điều kiện, màn hình giải thích điều kiện còn thiếu như "cần thêm 30.000đ" hoặc "mã đã hết lượt".

#### M14. Chọn phương thức thanh toán

- **Mục đích chính:** Cho phép khách hàng chọn cách thanh toán cho đơn hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-9 - Make Online Payment`, thuộc `UC-DOM-04 - Payment`, liên quan `BRD-07`.
- **Các Control chính:** Radio/card "Cash on Delivery", radio/card "VNPay", danh sách phương thức đã lưu, button lưu hoặc xác nhận.
- **Màn hình con / Component phụ:** Trạng thái phương thức chưa khả dụng, nhãn phương thức mặc định, thông báo thay đổi thành công.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem các phương thức có thể dùng như tiền mặt khi nhận hàng, VNPay hoặc phương thức đã lưu.
  2. Khi chọn một phương thức, card được đánh dấu đang chọn để người dùng biết đơn hàng sẽ dùng cách thanh toán nào.
  3. Khi nhấn lưu hoặc xác nhận, hệ thống ghi nhận lựa chọn cho đơn hàng hiện tại và có thể cập nhật phương thức mặc định nếu màn hình hỗ trợ.
  4. Nếu chọn VNPay, sau khi đặt hàng người dùng sẽ được điều hướng sang thanh toán trực tuyến; nếu chọn tiền mặt, đơn được tạo theo hình thức COD.
  5. Phương thức chưa hỗ trợ hoặc tạm lỗi được khóa và hiển thị lý do thay vì cho người dùng chọn rồi mới báo lỗi.

#### M15. Rà soát đơn hàng

- **Mục đích chính:** Cho phép khách hàng kiểm tra lại toàn bộ thông tin đơn trước khi gửi yêu cầu đặt hàng.
- **Luồng tham chiếu (Use Case):** Là bước xác nhận cuối của `UC-8`, liên quan `UC-DOM-03`, `BRD-05`, `BRD-07`.
- **Các Control chính:** Danh sách món, card địa chỉ, card thanh toán, bảng phí, button "Place Order", button quay lại chỉnh sửa.
- **Màn hình con / Component phụ:** Order review summary, price breakdown, trạng thái kiểm tra khuyến mãi, thông báo lỗi đặt hàng.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng kiểm tra lần cuối danh sách món, địa chỉ, phương thức thanh toán, khuyến mãi, phí và tổng tiền trước khi xác nhận.
  2. Nếu phát hiện sai thông tin, người dùng dùng nút quay lại hoặc chỉnh sửa để trở về bước tương ứng mà không mất dữ liệu checkout.
  3. Khi nhấn "Place Order", hệ thống khóa tạm dữ liệu đơn, kiểm tra lại giá, tồn tại của món, khuyến mãi và khả năng giao hàng.
  4. Nếu tạo đơn thành công, màn hình chuyển sang thanh toán hoặc theo dõi đơn; nếu thất bại, ứng dụng chỉ rõ phần cần sửa như món hết hàng, địa chỉ ngoài vùng giao hoặc mã ưu đãi không hợp lệ.

#### M16. Trạng thái thanh toán VNPay

- **Mục đích chính:** Hiển thị trạng thái thanh toán trực tuyến và hướng dẫn khách hàng xử lý tiếp.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-9`, `UC-DOM-04`, liên quan `BRD-07` và trạng thái đơn hàng `BRD-08`.
- **Các Control chính:** Vùng trạng thái thanh toán, button tiếp tục thanh toán, button theo dõi đơn hàng, button về trang chủ, button làm mới.
- **Màn hình con / Component phụ:** Bộ đếm/polling trạng thái, order summary, thông báo thanh toán thành công/thất bại/đang xử lý.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Sau khi người dùng quay lại từ VNPay, màn hình hiển thị trạng thái đang kiểm tra để người dùng biết giao dịch chưa bị mất.
  2. Hệ thống đọc mã kết quả VNPay, đối soát trạng thái giao dịch và cập nhật trạng thái thanh toán của đơn hàng.
  3. Nếu thanh toán thành công, người dùng thấy thông báo thành công và có thể chuyển ngay sang theo dõi đơn hàng.
  4. Nếu thanh toán thất bại, bị hủy hoặc hết hạn, màn hình hiển thị lý do, cho phép thử thanh toán lại hoặc quay về trang chủ mà không tạo đơn trùng.
  5. Button làm mới gọi lại kiểm tra trạng thái khi người dùng chưa thấy kết quả mới nhất.

#### M17. Lịch sử đơn hàng

- **Mục đích chính:** Cho phép khách hàng xem lại các đơn hàng đã đặt và truy cập nhanh vào theo dõi hoặc chi tiết đơn.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-10 - View Order History`, thuộc `UC-DOM-05 - Order Tracking & History`.
- **Các Control chính:** Danh sách order card, button lọc, pull-to-refresh, button mở chi tiết, nhãn trạng thái đơn.
- **Màn hình con / Component phụ:** Empty state, loading skeleton, error state, order card gồm mã đơn, nhà hàng, tổng tiền và trạng thái.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng mở lịch sử để xem các đơn gần đây được sắp xếp từ mới đến cũ, mỗi card hiển thị mã đơn, nhà hàng, tổng tiền và trạng thái.
  2. Khi kéo để làm mới hoặc dùng bộ lọc, hệ thống tải lại danh sách đơn của tài khoản hiện tại và cập nhật trạng thái mới nhất.
  3. Khi chọn một đơn, ứng dụng mở chi tiết đơn; với đơn đang xử lý, người dùng có thể đi tiếp sang màn hình theo dõi trạng thái.
  4. Nếu chưa có đơn hàng, màn hình hiển thị trạng thái rỗng thân thiện; nếu tải thất bại, người dùng có nút thử lại.

#### M18. Chi tiết đơn hàng

- **Mục đích chính:** Hiển thị toàn bộ dữ liệu của một đơn hàng đã đặt.
- **Luồng tham chiếu (Use Case):** Hỗ trợ `UC-10`, `UC-20`, `UC-9`, `UC-22`, thuộc `UC-DOM-05`.
- **Các Control chính:** Header trạng thái, danh sách món, phần thanh toán, phần địa chỉ, button tiếp tục VNPay, button đánh giá, button theo dõi đơn.
- **Màn hình con / Component phụ:** Order summary, payment summary, delivery address card, review entry, loading/error state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng mở đơn từ lịch sử, thông báo hoặc màn hình theo dõi để xem lại toàn bộ thông tin của đơn.
  2. Hệ thống tải danh sách món, địa chỉ giao hàng, thanh toán, phí, khuyến mãi và timeline trạng thái.
  3. Tùy trạng thái đơn, màn hình hiển thị thao tác phù hợp như tiếp tục thanh toán VNPay, theo dõi đơn, đánh giá hoặc quay lại lịch sử.
  4. Nếu tải chi tiết thất bại, màn hình giữ người dùng tại trang này và cung cấp nút thử lại thay vì đưa về danh sách.

#### M19. Theo dõi trạng thái đơn hàng

- **Mục đích chính:** Cung cấp tiến trình xử lý đơn hàng theo thời gian thực cho khách hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-20 - Track Order Status`, thuộc `UC-DOM-05` và `UC-DOM-11 - Real-time Tracking`, liên quan `BRD-08`.
- **Các Control chính:** Timeline trạng thái, card thông tin nhà hàng, danh sách món, bảng phí, button đánh giá khi đủ điều kiện.
- **Màn hình con / Component phụ:** Status timeline, inline review prompt, trạng thái đơn bị hủy, loading/error state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem timeline để biết đơn đang ở bước nào: đã đặt, nhà hàng xác nhận, đang chuẩn bị, sẵn sàng giao, đã giao hoặc đã hủy.
  2. Hệ thống nhận cập nhật từ backend theo thời gian thực hoặc bằng cơ chế làm mới định kỳ, sau đó cập nhật timeline và nội dung mô tả trạng thái.
  3. Nếu đơn bị hủy, màn hình hiển thị trạng thái hủy và lý do nếu có để người dùng hiểu chuyện gì đã xảy ra.
  4. Khi đơn hoàn tất, màn hình hiển thị lối vào đánh giá để người dùng gửi phản hồi ngay sau trải nghiệm.

#### M20. Đánh giá đơn hàng

- **Mục đích chính:** Thu thập phản hồi của khách hàng sau khi đơn hàng kết thúc.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-22 - Submit Rating & Review`, thuộc `UC-DOM-09 - Reviews & Feedback`, liên quan `BRD-13`.
- **Các Control chính:** Bộ chọn sao 1-5, tag nhận xét, textbox bình luận, button gửi đánh giá, button quay lại.
- **Màn hình con / Component phụ:** Existing review read-only state, bộ đếm ký tự, thông báo gửi thành công/thất bại, trạng thái loading.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn số sao, chọn các tag nhận xét phù hợp và có thể nhập bình luận chi tiết nếu muốn.
  2. Ứng dụng hiển thị bộ đếm ký tự và nhắc người dùng khi chưa chọn số sao hoặc nội dung vượt giới hạn.
  3. Khi nhấn gửi đánh giá, hệ thống kiểm tra đơn đã hoàn tất và chưa từng được đánh giá bởi tài khoản hiện tại.
  4. Nếu gửi thành công, review được lưu và màn hình đơn hàng cập nhật trạng thái đã đánh giá; nếu thất bại, lỗi như "đơn chưa hoàn tất" hoặc "đã đánh giá" được hiển thị rõ.

#### M21. Hộp thư thông báo

- **Mục đích chính:** Tập trung các thông báo liên quan đơn hàng, khuyến mãi và tài khoản cho khách hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-26 - Manage Real-Time Notifications`, thuộc `UC-DOM-08 - Notifications`, liên quan `BRD-11`.
- **Các Control chính:** Danh sách thông báo, button "Mark all read", pull-to-refresh, item thông báo, badge chưa đọc.
- **Màn hình con / Component phụ:** Empty notification state, unread indicator, notification detail navigation, loading/error state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng mở hộp thư để xem thông báo đơn hàng, ưu đãi và tài khoản, trong đó thông báo chưa đọc có badge riêng.
  2. Khi kéo để làm mới, hệ thống tải thông báo mới nhất và giữ thứ tự theo thời gian.
  3. Khi chọn một thông báo, hệ thống đánh dấu đã đọc rồi điều hướng đến màn hình liên quan như chi tiết đơn, ưu đãi hoặc cài đặt.
  4. Khi nhấn "Mark all read", toàn bộ thông báo chưa đọc được cập nhật trạng thái; nếu thao tác thất bại, badge chưa đọc được giữ nguyên và hiển thị lỗi.

#### M22. Hồ sơ cá nhân

- **Mục đích chính:** Hiển thị trung tâm tài khoản cá nhân và các lối tắt quản lý thông tin khách hàng.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, hỗ trợ `UC-6`, `UC-9`, `UC-26`, liên quan `BRD-01`, `BRD-06`, `BRD-07`.
- **Các Control chính:** Avatar, tên/email, menu "Personal Info", "Saved Addresses", "Payment Methods", "Settings", button "Log Out".
- **Màn hình con / Component phụ:** Hộp xác nhận đăng xuất, trạng thái hủy đăng ký push token, bottom tab profile.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem avatar, tên, email và các lối tắt quản lý thông tin cá nhân trong một màn hình trung tâm.
  2. Khi chọn "Personal Info", "Saved Addresses", "Payment Methods" hoặc "Settings", ứng dụng mở đúng màn hình quản lý tương ứng.
  3. Khi nhấn "Log Out", ứng dụng hiển thị hộp xác nhận để tránh đăng xuất nhầm.
  4. Nếu người dùng xác nhận, hệ thống hủy token thông báo của thiết bị, xóa phiên đăng nhập và đưa người dùng về luồng xác thực.

#### M23. Sửa hồ sơ cá nhân

- **Mục đích chính:** Cho phép khách hàng cập nhật thông tin hồ sơ cơ bản.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, liên quan `UC-1` và `BRD-01`.
- **Các Control chính:** Textbox tên hiển thị, textbox email, trường số điện thoại chỉ đọc, button lưu, button hủy.
- **Màn hình con / Component phụ:** Placeholder ảnh đại diện, thông báo lưu thành công/thất bại, trạng thái loading.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chỉnh tên hiển thị hoặc email trong phạm vi hệ thống cho phép; số điện thoại chỉ đọc để tránh thay đổi thông tin xác thực ngoài quy trình.
  2. Khi nhấn lưu, ứng dụng kiểm tra trường bắt buộc, định dạng email và các ràng buộc hồ sơ.
  3. Nếu hợp lệ, hệ thống gửi yêu cầu cập nhật, hiển thị trạng thái đang lưu và làm mới thông tin hồ sơ sau khi thành công.
  4. Nếu lưu thất bại, màn hình giữ dữ liệu người dùng vừa nhập và hiển thị lỗi để người dùng sửa hoặc thử lại.

#### M24. Phương thức thanh toán cá nhân

- **Mục đích chính:** Quản lý phương thức thanh toán ưu tiên của khách hàng.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-9`, `UC-DOM-04`, liên quan `BRD-07`.
- **Các Control chính:** Card COD, card VNPay, trạng thái phương thức thẻ chưa hỗ trợ, button lưu.
- **Màn hình con / Component phụ:** Nhãn phương thức mặc định, cảnh báo tính khả dụng, thông báo lưu lựa chọn.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem các phương thức thanh toán có thể đặt làm mặc định, gồm COD và VNPay.
  2. Khi chọn một card, màn hình đánh dấu phương thức đang chọn và mô tả cách phương thức đó sẽ được dùng trong đơn hàng sau.
  3. Khi nhấn lưu, hệ thống cập nhật lựa chọn vào hồ sơ khách hàng và hiển thị thông báo lưu thành công.
  4. Nếu một phương thức chưa hỗ trợ, card được khóa kèm lý do để người dùng không nhầm là lỗi thao tác.

#### M25. Cài đặt

- **Mục đích chính:** Cho phép khách hàng cấu hình hành vi ứng dụng và truy cập thông tin pháp lý.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-08`, liên quan `UC-26`, `BRD-11` và quản lý tài khoản `BRD-01`.
- **Các Control chính:** Toggle "Push Notifications", toggle "Order Updates", menu "Language", "Privacy Policy", "Terms of Service", "About".
- **Màn hình con / Component phụ:** Dialog quyền thông báo, trang điều khoản, trang chính sách quyền riêng tư, trạng thái lưu cài đặt.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng bật/tắt "Push Notifications" và "Order Updates" để kiểm soát loại thông báo muốn nhận.
  2. Nếu bật thông báo khi thiết bị chưa cấp quyền, ứng dụng mở dialog xin quyền hoặc hướng dẫn người dùng vào cài đặt hệ điều hành.
  3. Khi thay đổi tùy chọn, hệ thống lưu cấu hình, đăng ký hoặc hủy đăng ký push token tương ứng với thiết bị hiện tại.
  4. Khi mở "Language", "Privacy Policy", "Terms of Service" hoặc "About", ứng dụng điều hướng đến trang thông tin tương ứng mà không làm mất các cài đặt đã lưu.

### 3.4.2.2 Web portal - Đối tác nhà hàng

#### W01. Trang giới thiệu đối tác

- **Mục đích chính:** Giới thiệu portal cho đối tác nhà hàng và chuyển đổi khách truy cập thành tài khoản đăng ký.
- **Luồng tham chiếu (Use Case):** Là điểm đầu của `UC-DOM-06 - Restaurant Operations`, liên quan `UC-11 - Restaurant Registration & Profile Management`, `BRD-02`.
- **Các Control chính:** Navigation "Features", "How it works", "Stories", button "Start selling", button "Sign in", các CTA đăng ký.
- **Màn hình con / Component phụ:** Hero đối tác, phần lợi ích, quy trình tham gia, câu chuyện thành công, footer.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng đọc các phần giới thiệu lợi ích, quy trình tham gia, câu chuyện thành công và thông tin hỗ trợ trước khi quyết định đăng ký.
  2. Khi nhấn "Start selling" hoặc CTA đăng ký, portal chuyển đến màn hình đăng ký tài khoản đối tác; khi nhấn "Sign in", portal chuyển đến màn hình đăng nhập.
  3. Khi chọn các mục "Features", "How it works" hoặc "Stories", hệ thống cuộn đến đúng section để người dùng không phải tự tìm nội dung.
  4. Nếu người dùng đã đăng nhập, portal có thể điều hướng thẳng đến dashboard hoặc màn hình trạng thái hồ sơ tùy trạng thái nhà hàng.

#### W02. Đăng nhập đối tác

- **Mục đích chính:** Xác thực chủ nhà hàng hoặc nhân viên nhà hàng trước khi truy cập portal vận hành.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, là tiền điều kiện cho `UC-DOM-06`, `UC-12`, `UC-14`, `UC-23`; liên quan `BRD-01`.
- **Các Control chính:** Textbox "Work Email", textbox "Password", button ẩn/hiện mật khẩu, checkbox "Remember this device", button "Authorize Access", link đăng ký, link "Forgot Access".
- **Màn hình con / Component phụ:** Login form, trạng thái loading, alert lỗi đăng nhập, panel nhận diện thương hiệu partner portal.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Chủ nhà hàng hoặc nhân viên nhập email công việc, mật khẩu và có thể chọn "Remember this device" trước khi đăng nhập.
  2. Khi nhấn "Authorize Access", portal kiểm tra email, mật khẩu rỗng hoặc sai định dạng trước khi gửi yêu cầu xác thực.
  3. Nếu xác thực thành công, hệ thống kiểm tra vai trò và trạng thái hồ sơ nhà hàng để chuyển đến dashboard, màn hình chờ phê duyệt hoặc trang trạng thái phù hợp.
  4. Nếu sai thông tin, tài khoản không có quyền đối tác hoặc có lỗi mạng, portal không tạo phiên và hiển thị lỗi rõ ràng ngay trong login form.

#### W03. Đăng ký tài khoản đối tác

- **Mục đích chính:** Tạo tài khoản đại diện nhà hàng trước khi khai báo hồ sơ kinh doanh.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-11`, `UC-DOM-01`, `UC-DOM-06`, liên quan `BRD-02`.
- **Các Control chính:** Textbox họ tên, textbox email, textbox mật khẩu, button ẩn/hiện mật khẩu, button "Create Account", button Google, button Apple, link đăng nhập.
- **Màn hình con / Component phụ:** Register form, social auth section, trạng thái loading, thông báo lỗi dữ liệu.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập thông tin đại diện nhà hàng như họ tên, email và mật khẩu hoặc chọn đăng ký nhanh bằng Google/Apple nếu được hỗ trợ.
  2. Portal hiển thị gợi ý độ mạnh mật khẩu và báo lỗi tại từng trường khi email sai định dạng, mật khẩu yếu hoặc thiếu thông tin bắt buộc.
  3. Khi nhấn "Create Account", hệ thống gọi API đăng ký tài khoản đối tác và hiển thị trạng thái đang xử lý.
  4. Nếu tạo tài khoản thành công, người dùng được chuyển sang bước khai báo thông tin nhà hàng; nếu email đã được sử dụng hoặc dữ liệu không hợp lệ, form giữ nguyên dữ liệu để người dùng sửa.

#### W04. Đăng ký thông tin nhà hàng

- **Mục đích chính:** Thu thập hồ sơ nhà hàng để hệ thống và admin xét duyệt trước khi cho phép bán hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-11`, hỗ trợ `UC-27 - Approve/Reject Restaurant Applications`, liên quan `BRD-02`, `BRD-04`, `BRD-06`.
- **Các Control chính:** Textbox tên nhà hàng, combobox loại ẩm thực, textbox điện thoại, textbox email công khai, textbox địa chỉ, button định vị, trường lat/lon ẩn, button gửi hồ sơ.
- **Màn hình con / Component phụ:** Bản đồ/khối định vị, form thông tin liên hệ, thông báo lỗi địa chỉ, footer tiến trình đăng ký.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập tên nhà hàng, loại hình ẩm thực, số điện thoại, email công khai và địa chỉ phục vụ xét duyệt.
  2. Khi nhấn button định vị hoặc nhập địa chỉ, portal chuẩn hóa địa chỉ, xác định tọa độ và hiển thị bản đồ/khối định vị để người dùng kiểm tra lại.
  3. Khi gửi hồ sơ, hệ thống kiểm tra các trường bắt buộc, định dạng liên hệ và tọa độ địa chỉ trước khi lưu hồ sơ.
  4. Nếu gửi thành công, người dùng được chuyển đến màn hình trạng thái chờ duyệt; nếu thất bại, portal chỉ rõ trường cần sửa như thiếu địa chỉ, sai số điện thoại hoặc không xác định được tọa độ.

#### W05. Trạng thái hồ sơ đăng ký

- **Mục đích chính:** Thông báo cho đối tác rằng hồ sơ đã được gửi và đang chờ phê duyệt.
- **Luồng tham chiếu (Use Case):** Hỗ trợ `UC-11` và `UC-27`, liên quan `BRD-02`.
- **Các Control chính:** Button quay về trang chủ, button liên hệ hỗ trợ, link đăng nhập, vùng hiển thị các bước tiếp theo.
- **Màn hình con / Component phụ:** Status card, timeline xét duyệt, alert hướng dẫn, thông tin liên hệ hỗ trợ.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Sau khi gửi hồ sơ, người dùng thấy trạng thái hiện tại của hồ sơ như đang chờ duyệt, cần bổ sung thông tin hoặc đã bị từ chối.
  2. Màn hình hiển thị các bước tiếp theo, thời điểm gửi và hướng dẫn để người dùng biết mình cần chờ hay cần hành động thêm.
  3. Khi người dùng quay lại hoặc làm mới trạng thái, hệ thống tải trạng thái xét duyệt mới nhất từ backend.
  4. Nếu hồ sơ được phê duyệt, lần đăng nhập tiếp theo sẽ vào dashboard; nếu cần hỗ trợ, người dùng có thể dùng CTA liên hệ hoặc link đăng nhập.

#### W06. Chờ phê duyệt sau đăng nhập

- **Mục đích chính:** Chặn truy cập chức năng vận hành đối với tài khoản đã đăng nhập nhưng nhà hàng chưa được duyệt.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-11`, `UC-27`, hỗ trợ kiểm soát truy cập trong `UC-DOM-06`, liên quan `BRD-02`.
- **Các Control chính:** Nút đăng xuất, nút liên hệ hỗ trợ, thông tin trạng thái hồ sơ, navigation tối giản.
- **Màn hình con / Component phụ:** Pending approval panel, checklist quy trình duyệt, alert trạng thái tài khoản.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Khi người dùng đăng nhập thành công nhưng nhà hàng chưa được kích hoạt, portal tự động đưa người dùng đến màn hình chờ phê duyệt.
  2. Màn hình giải thích rằng các chức năng vận hành như đơn hàng, menu và khuyến mãi sẽ mở sau khi hồ sơ được duyệt.
  3. Nếu người dùng cố truy cập route vận hành, hệ thống chặn truy cập và đưa lại về màn hình chờ phê duyệt.
  4. Người dùng có thể đăng xuất hoặc liên hệ hỗ trợ; khi đăng xuất, hệ thống xóa phiên và quay về màn hình đăng nhập.

#### W07. Dashboard nhà hàng

- **Mục đích chính:** Cung cấp tổng quan vận hành nhà hàng và các việc cần xử lý ngay.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-06`, `UC-DOM-12 - Reporting & Monitoring`, liên quan `UC-13`, `UC-14`, `UC-33`, `BRD-08`, `BRD-09`, `BRD-15`.
- **Các Control chính:** Toggle trạng thái cửa hàng, KPI cards, danh sách cảnh báo, danh sách đơn gần đây, button xem đơn, khu vực doanh thu.
- **Màn hình con / Component phụ:** Store status panel, urgent alerts, revenue summary, average order value, recent orders table/card.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem nhanh doanh thu, số đơn, cảnh báo vận hành, đơn mới và trạng thái đang nhận đơn của cửa hàng.
  2. Khi đổi khoảng thời gian hoặc làm mới trang, hệ thống tải lại KPI, biểu đồ và danh sách đơn gần đây.
  3. Khi bật hoặc tắt trạng thái cửa hàng, portal cập nhật khả năng nhận đơn và hiển thị kết quả để nhân viên biết cửa hàng đang online hay offline.
  4. Khi chọn một đơn trong danh sách, portal điều hướng đến màn hình chi tiết đơn để nhân viên xác nhận, chuẩn bị hoặc xử lý tiếp.

#### W08. Bảng đơn hàng / Kitchen board

- **Mục đích chính:** Giúp nhà hàng xử lý đơn theo luồng vận hành bếp từ yêu cầu mới đến sẵn sàng giao.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-14 - Accept or Reject Order`, `UC-15 - Prepare Order for Pickup`, thuộc `UC-DOM-06`, liên quan `BRD-09`.
- **Các Control chính:** Cột trạng thái đơn, order card, thao tác kéo thả, button xác nhận, button bắt đầu chuẩn bị, button đánh dấu sẵn sàng, toast đơn mới.
- **Màn hình con / Component phụ:** Kanban columns, order card detail snippet, realtime new order notification, empty column state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Nhân viên xem đơn theo từng cột trạng thái để biết đơn nào mới, đơn nào đang chuẩn bị và đơn nào đã sẵn sàng giao.
  2. Nhân viên có thể kéo thả order card hoặc nhấn button hành động trên card để chuyển trạng thái đơn.
  3. Hệ thống kiểm tra bước chuyển trạng thái có hợp lệ không, sau đó gọi API cập nhật và tạm thời hiển thị card ở trạng thái mới.
  4. Nếu cập nhật thành công, khách hàng nhận thông báo trạng thái mới; nếu thất bại, portal hoàn nguyên card về cột cũ và hiển thị lỗi cho nhân viên.

#### W09. Chi tiết đơn hàng nhà hàng

- **Mục đích chính:** Cung cấp đầy đủ thông tin đơn để nhà hàng xác nhận, chuẩn bị, hủy hoặc đánh dấu sẵn sàng.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-14`, `UC-15`, `UC-21 - Cancel Order`, `UC-DOM-06`, liên quan `BRD-08`, `BRD-09`.
- **Các Control chính:** Button xác nhận, button bắt đầu chuẩn bị, button sẵn sàng, button hủy đơn, dialog lý do hủy, danh sách món, timeline.
- **Màn hình con / Component phụ:** Order header, item list, customer/payment panel, delivery map, cancellation dialog, order notes.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Nhân viên mở đơn để xem mã đơn, danh sách món, modifier, ghi chú của khách, thông tin thanh toán và địa chỉ giao hàng.
  2. Portal chỉ hiển thị các hành động hợp lệ với trạng thái hiện tại, ví dụ xác nhận đơn, bắt đầu chuẩn bị, đánh dấu sẵn sàng hoặc hủy đơn.
  3. Với thao tác hủy hoặc thao tác ảnh hưởng khách hàng, hệ thống yêu cầu xác nhận và nhập lý do nếu cần.
  4. Khi hành động được xác nhận, backend cập nhật trạng thái đơn, đồng bộ về kitchen board và gửi cập nhật đến mobile khách hàng.
  5. Nếu thao tác thất bại, portal giữ trạng thái cũ của đơn và hiển thị lỗi để nhân viên thử lại hoặc kiểm tra đơn.

#### W10. Quản lý menu

- **Mục đích chính:** Cho phép nhà hàng quản lý danh sách món và trạng thái bán của menu.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-12 - Manage Menu Items`, `UC-13 - Toggle Item & Restaurant Availability`, thuộc `UC-DOM-06`, liên quan `BRD-04`.
- **Các Control chính:** Danh sách món, bộ lọc danh mục, button thêm món, form thêm danh mục, switch bật/tắt món, button sửa, button xóa, toggle cửa hàng online/offline.
- **Màn hình con / Component phụ:** Sidebar danh mục, confirm delete dialog, empty menu state, item availability badge.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem danh sách món theo danh mục, dùng bộ lọc để tìm món cần chỉnh và nhận biết món đang hiển thị hay tạm ẩn qua badge trạng thái.
  2. Khi bật/tắt switch của món, hệ thống cập nhật trạng thái bán để món xuất hiện hoặc bị ẩn trên mobile app khách hàng.
  3. Khi nhấn thêm danh mục hoặc sửa món, portal mở form tương ứng để người dùng cập nhật nội dung menu.
  4. Khi xóa món, hệ thống hiển thị hộp xác nhận để tránh mất dữ liệu ngoài ý muốn; sau khi xác nhận, danh sách được làm mới.

#### W11. Tạo món mới

- **Mục đích chính:** Cho phép nhà hàng khai báo món ăn mới để hiển thị trên mobile app khách hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-12`, thuộc `UC-DOM-06`, liên quan `BRD-04`.
- **Các Control chính:** Textbox tên món, textarea mô tả, input giá, combobox danh mục, upload ảnh, tag chế độ ăn, switch hiển thị, button discard, button publish.
- **Màn hình con / Component phụ:** Product essence form, dietary tags, media uploader, visibility panel, footer action bar.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập tên món, mô tả, giá, danh mục, ảnh, tag chế độ ăn và chọn món có hiển thị ngay sau khi tạo hay không.
  2. Nếu nhấn "discard" khi form đã thay đổi, portal yêu cầu xác nhận để tránh mất nội dung đang nhập.
  3. Khi nhấn "publish", hệ thống kiểm tra trường bắt buộc, định dạng giá và ảnh tải lên trước khi tạo món.
  4. Nếu tạo thành công, portal điều hướng về quản lý menu và hiển thị món mới; nếu thất bại, lỗi được hiển thị tại trường hoặc khu vực upload liên quan.

#### W12. Chỉnh sửa món và modifier

- **Mục đích chính:** Cho phép nhà hàng cập nhật món đã có và cấu hình các lựa chọn thêm như size, topping hoặc ghi chú bắt buộc.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-12`, `UC-13`, thuộc `UC-DOM-06`, liên quan `BRD-04`.
- **Các Control chính:** Form thông tin món, upload ảnh, switch trạng thái, khu vực modifier, button thêm nhóm modifier, button lưu thay đổi.
- **Màn hình con / Component phụ:** Modifier card, nhóm option, trạng thái loading dữ liệu món, alert lưu thành công/thất bại.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng mở món đã có, chờ portal tải dữ liệu hiện tại rồi chỉnh thông tin cơ bản, ảnh, trạng thái hiển thị hoặc nhóm modifier.
  2. Khi thêm nhóm modifier, người dùng cấu hình tên nhóm, bắt buộc/tùy chọn, số lựa chọn và danh sách option.
  3. Khi nhấn lưu, hệ thống kiểm tra giá, danh mục, trạng thái món và các nhóm modifier bắt buộc có option hợp lệ.
  4. Nếu lưu thành công, thay đổi được đồng bộ lên menu khách hàng; nếu thất bại, portal hiển thị lỗi tại phần thông tin món hoặc modifier cần sửa.

#### W13. Quản lý vùng giao hàng

- **Mục đích chính:** Cho phép nhà hàng cấu hình khu vực có thể giao hàng, phí và thời gian dự kiến.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-7 - Manage Delivery Zones`, thuộc `UC-DOM-06` và `UC-DOM-07`, liên quan `BRD-06`.
- **Các Control chính:** Danh sách vùng giao, button tạo vùng mới, dialog tạo/sửa vùng, switch kích hoạt, input phí giao hàng, input thời gian, công cụ ước tính giao hàng.
- **Màn hình con / Component phụ:** Delivery zone list, coverage map, delivery estimator, empty state, form dialog.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem các vùng giao hàng hiện có, phí giao hàng, thời gian ước tính và trạng thái bật/tắt của từng vùng.
  2. Khi tạo hoặc sửa vùng, portal mở dialog để nhập phạm vi, phí, thời gian giao và trạng thái kích hoạt.
  3. Khi lưu, hệ thống kiểm tra dữ liệu vùng giao như phạm vi, phí và thời gian không được bỏ trống hoặc sai định dạng.
  4. Vùng giao được bật sẽ dùng để kiểm tra địa chỉ khách trong checkout; vùng bị tắt sẽ không được tính là khả dụng dù địa chỉ nằm trong phạm vi đó.

#### W14. Phân tích vận hành

- **Mục đích chính:** Cung cấp báo cáo hiệu suất bán hàng và vận hành cho nhà hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-33 - View and Export Operational Reports`, thuộc `UC-DOM-12`, liên quan `BRD-15`.
- **Các Control chính:** Bộ chọn khoảng thời gian, toggle so sánh baseline, button export, KPI row, biểu đồ doanh thu, bảng món bán chạy, danh sách sự cố.
- **Màn hình con / Component phụ:** Operational banner, chart panels, data tables, export state, empty analytics state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn khoảng thời gian cần xem và có thể bật so sánh với kỳ trước để hiểu biến động vận hành.
  2. Hệ thống tải lại KPI, biểu đồ doanh thu, bảng món bán chạy và danh sách sự cố theo bộ lọc đã chọn.
  3. Khi nhấn export, portal tạo file báo cáo hoặc gọi API xuất dữ liệu và hiển thị trạng thái đang xuất để người dùng chờ.
  4. Nếu không có dữ liệu trong khoảng thời gian đã chọn, màn hình hiển thị empty state; nếu tải lỗi, người dùng có thể thử lại.

#### W15. Quản lý khuyến mãi nhà hàng

- **Mục đích chính:** Cho phép nhà hàng quản lý các ưu đãi do nhà hàng tự tạo.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-23 - Manage Restaurant Promotions`, thuộc `UC-DOM-06`, liên quan `BRD-14`.
- **Các Control chính:** Summary cards, filter pills, promotion cards, button "New Promotion", button edit, button pause/publish/resume, button delete.
- **Màn hình con / Component phụ:** Promotion status badge, confirm delete dialog, empty promotion state, action menu.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng xem các khuyến mãi của nhà hàng theo trạng thái như nháp, đang chạy, tạm dừng hoặc đã kết thúc.
  2. Khi nhấn "New Promotion" hoặc edit, portal mở form tạo/chỉnh sửa khuyến mãi với dữ liệu tương ứng.
  3. Khi pause, resume, publish hoặc delete, hệ thống kiểm tra quyền sở hữu nhà hàng và yêu cầu xác nhận nếu thao tác ảnh hưởng khuyến mãi đang chạy.
  4. Nếu thao tác thành công, danh sách và badge trạng thái được cập nhật; nếu thất bại, portal giữ trạng thái cũ và hiển thị lý do.

#### W16. Tạo / chỉnh sửa khuyến mãi nhà hàng

- **Mục đích chính:** Cấu hình nội dung và điều kiện áp dụng ưu đãi cấp nhà hàng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-23`, liên quan `BRD-14`.
- **Các Control chính:** Textbox tên khuyến mãi, textarea mô tả, combobox loại giảm giá, input giá trị giảm, input đơn tối thiểu, input giới hạn lượt dùng, lịch bắt đầu/kết thúc, button lưu nháp, button publish.
- **Màn hình con / Component phụ:** Promotion form sections, validation summary, schedule picker, stacking mode selector.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng nhập tên, mô tả, loại giảm giá, giá trị giảm, đơn tối thiểu, giới hạn lượt dùng và lịch bắt đầu/kết thúc.
  2. Khi chọn lưu nháp, hệ thống lưu cấu hình hiện có để người dùng có thể hoàn thiện sau.
  3. Khi chọn publish, hệ thống kiểm tra chặt hơn về thời gian chạy, giá trị giảm, giới hạn lượt dùng và điều kiện áp dụng.
  4. Nếu hợp lệ, khuyến mãi được lưu và danh sách khuyến mãi cập nhật; nếu chưa hợp lệ, validation summary và từng trường lỗi hướng dẫn người dùng sửa.

#### W17. Cài đặt tài khoản và cửa hàng

- **Mục đích chính:** Quản lý cấu hình tài khoản đối tác, thông tin cửa hàng, bảo mật, thông báo và thiết bị đăng nhập.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, `UC-DOM-06`, `UC-DOM-08`, liên quan `UC-11`, `UC-26`, `BRD-01`, `BRD-04`, `BRD-11`.
- **Các Control chính:** Sidebar tab Profile/Store/Security/Notifications/Devices/Danger, form hồ sơ, form cửa hàng, form đổi mật khẩu, toggle thông báo, button đăng xuất hoặc thao tác nguy hiểm.
- **Màn hình con / Component phụ:** Settings sidebar, profile panel, store panel, security panel, notification preferences, device sessions, danger zone.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Người dùng chọn tab Profile, Store, Security, Notifications, Devices hoặc Danger để quản lý đúng nhóm cài đặt cần thay đổi.
  2. Khi chỉnh thông tin và nhấn lưu trong một tab, portal chỉ gửi dữ liệu của nhóm đó để tránh ảnh hưởng các phần khác.
  3. Hệ thống kiểm tra quyền và ràng buộc dữ liệu trước khi lưu; nếu thiếu thông tin, lỗi được hiển thị tại form đang thao tác.
  4. Với thao tác nhạy cảm như đổi mật khẩu, đăng xuất thiết bị hoặc thao tác trong Danger zone, hệ thống yêu cầu xác nhận và cập nhật phiên đăng nhập sau khi thành công.

### 3.4.2.3 Admin portal - Quản trị hệ thống

#### A01. Đăng nhập admin

- **Mục đích chính:** Xác thực quản trị viên và đảm bảo chỉ tài khoản có vai trò admin được truy cập portal quản trị.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, là tiền điều kiện cho `UC-DOM-10 - Administration`, liên quan `UC-35 - Manage Admin Roles & Permissions`, `BRD-01`, `BRD-16`.
- **Các Control chính:** Textbox email, textbox mật khẩu, button đăng nhập, link chuyển sang restaurant portal, thông báo lỗi.
- **Màn hình con / Component phụ:** Login panel, trạng thái loading, alert lỗi quyền truy cập, session bootstrap.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin nhập email và mật khẩu, sau đó nhấn đăng nhập để truy cập portal quản trị.
  2. Màn hình kiểm tra email, mật khẩu rỗng hoặc sai định dạng trước khi gửi yêu cầu xác thực.
  3. Hệ thống xác thực tài khoản, kiểm tra vai trò admin và khởi tạo phiên cùng danh sách quyền được phép sử dụng.
  4. Nếu hợp lệ, admin được chuyển vào dashboard nền tảng; nếu sai thông tin hoặc không có vai trò admin, hệ thống hiển thị lỗi và không cấp quyền truy cập.
  5. Link chuyển sang restaurant portal đưa người dùng ra đúng màn hình đăng nhập đối tác khi họ vào nhầm portal.

#### A02. Dashboard nền tảng

- **Mục đích chính:** Cung cấp góc nhìn tổng quan về sức khỏe kinh doanh và vận hành toàn nền tảng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-34 - View Dashboard & Platform Overview`, hỗ trợ `UC-30`, `UC-33`, thuộc `UC-DOM-10`, `UC-DOM-12`, liên quan `BRD-15`, `BRD-16`.
- **Các Control chính:** Bộ chọn khoảng thời gian, KPI cards, biểu đồ GMV/doanh thu, heatmap vận hành, danh sách nhà hàng top, danh sách hồ sơ chờ duyệt.
- **Màn hình con / Component phụ:** Revenue chart, operations heatmap, top earners table, bottleneck panel, pending approval panel.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin chọn khoảng thời gian để xem GMV, doanh thu, sức khỏe vận hành, đơn hàng và hồ sơ đang chờ duyệt.
  2. Khi bộ lọc thời gian thay đổi, hệ thống tải lại KPI cards, biểu đồ doanh thu, heatmap vận hành và danh sách nhà hàng nổi bật.
  3. Khi chọn một hồ sơ chờ duyệt, nhà hàng top hoặc điểm nghẽn vận hành, portal điều hướng đến module quản lý tương ứng với bộ lọc phù hợp.
  4. Nếu dữ liệu đang tải, dashboard hiển thị trạng thái loading; nếu không có dữ liệu hoặc tải lỗi, màn hình hiển thị empty/error state để admin biết cần làm mới.

#### A03. Quản lý nhà hàng

- **Mục đích chính:** Cho phép admin quản lý vòng đời hồ sơ nhà hàng trên nền tảng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-27 - Approve/Reject Restaurant Applications`, thuộc `UC-DOM-10`, liên quan `BRD-02`, `BRD-16`.
- **Các Control chính:** KPI trạng thái nhà hàng, ô tìm kiếm, button export, bảng nhà hàng, filter trạng thái, review sheet, button approve, button suspend, button delete.
- **Màn hình con / Component phụ:** Restaurant detail sheet, timeline hồ sơ, owner info, address panel, confirm action dialogs.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin dùng ô tìm kiếm, filter trạng thái và KPI để thu hẹp danh sách nhà hàng cần kiểm tra.
  2. Khi mở review sheet, portal hiển thị thông tin chủ sở hữu, địa chỉ, timeline hồ sơ và dữ liệu cần xét duyệt.
  3. Khi approve, suspend hoặc delete, hệ thống yêu cầu xác nhận và có thể yêu cầu lý do với thao tác ảnh hưởng hoạt động nhà hàng.
  4. Sau khi xác nhận, hệ thống kiểm tra quyền admin, gọi API cập nhật trạng thái, làm mới bảng và ghi nhận thao tác phục vụ kiểm soát quản trị.
  5. Nếu thao tác thất bại, sheet vẫn mở để admin đọc lỗi và xử lý lại mà không mất ngữ cảnh đang xem.

#### A04. Quản lý đơn hàng toàn nền tảng

- **Mục đích chính:** Cho phép admin giám sát và tra cứu đơn hàng trên toàn hệ thống.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-30 - Monitor Orders and Platform Health`, hỗ trợ `UC-32 - Administrative Order Cancellation & Refund`, thuộc `UC-DOM-10`, liên quan `BRD-08`, `BRD-16`.
- **Các Control chính:** KPI đơn hàng, ô tìm kiếm, filter phương thức thanh toán, filter trạng thái, button export, bảng đơn hàng, phân trang, detail sheet.
- **Màn hình con / Component phụ:** Order detail sheet, tabs Items/Timeline/Customer/Payment, link VNPay nếu có, loading/error state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin lọc đơn theo trạng thái, phương thức thanh toán, từ khóa hoặc phân trang để tìm đơn cần giám sát.
  2. Khi mở detail sheet, hệ thống hiển thị các tab món, timeline, khách hàng và thanh toán để admin kiểm tra đầy đủ ngữ cảnh.
  3. Nếu đơn có giao dịch VNPay, link VNPay được hiển thị để admin mở thông tin đối soát khi cần.
  4. Khi nhấn export, hệ thống xuất dữ liệu theo bộ lọc hiện tại; nếu bảng hoặc chi tiết tải lỗi, portal hiển thị trạng thái lỗi và cho phép thử lại.

#### A05. Quản lý người dùng

- **Mục đích chính:** Cho phép admin quản lý tài khoản khách hàng, đối tác và quản trị viên.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-31 - Search and Manage User Accounts`, hỗ trợ `UC-35`, thuộc `UC-DOM-10`, liên quan `BRD-01`, `BRD-16`.
- **Các Control chính:** KPI theo vai trò, ô tìm kiếm, filter trạng thái, role pills, bảng người dùng, phân trang, detail sheet, button đổi vai trò, button khóa/mở khóa, button xóa.
- **Màn hình con / Component phụ:** User detail sheet, ban reason form, ban duration selector, role change confirmation, delete confirmation.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin xem KPI theo vai trò, dùng tìm kiếm và filter trạng thái để tìm tài khoản khách hàng, đối tác hoặc quản trị viên.
  2. Khi mở detail sheet, portal hiển thị thông tin tài khoản, vai trò hiện tại, trạng thái và các thao tác được phép.
  3. Khi đổi vai trò, khóa/mở khóa hoặc xóa tài khoản, hệ thống yêu cầu xác nhận; với thao tác khóa, admin phải nhập lý do và thời hạn nếu có.
  4. Hệ thống kiểm tra quyền admin, ngăn thao tác không hợp lệ như tự hạ quyền tài khoản đang dùng, rồi cập nhật danh sách sau khi thành công.
  5. Nếu thao tác bị từ chối hoặc lỗi, portal hiển thị lý do để admin biết đó là lỗi quyền, lỗi dữ liệu hay lỗi hệ thống.

#### A06. Quản lý khuyến mãi nền tảng

- **Mục đích chính:** Cho phép admin quản lý các chương trình ưu đãi ở cấp nền tảng.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-24 - Manage Platform Promotions`, thuộc `UC-DOM-10`, liên quan `BRD-14`, `BRD-16`.
- **Các Control chính:** Summary cards, bộ lọc trạng thái, danh sách promotion cards, button tạo mới, button xem chi tiết, button publish/pause/resume/cancel/delete.
- **Màn hình con / Component phụ:** Promotion status badge, action menu, confirm action dialog, empty state.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin xem danh sách chương trình ưu đãi nền tảng, trạng thái hiện tại và phạm vi ảnh hưởng của từng chương trình.
  2. Admin dùng bộ lọc trạng thái hoặc mở chi tiết để kiểm tra trước khi publish, pause, resume, cancel hoặc delete.
  3. Hệ thống kiểm tra thời gian hiệu lực, phạm vi áp dụng và quyền admin trước khi cập nhật trạng thái khuyến mãi.
  4. Với thao tác hủy hoặc xóa, portal yêu cầu xác nhận để tránh ảnh hưởng người dùng đang checkout hoặc đang giữ coupon.
  5. Sau khi thao tác thành công, badge trạng thái và danh sách được cập nhật; nếu thất bại, trạng thái cũ được giữ nguyên.

#### A07. Chi tiết khuyến mãi và mã coupon

- **Mục đích chính:** Hiển thị đầy đủ thông tin một chương trình khuyến mãi và quản lý mã coupon phát sinh.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-24`, hỗ trợ quản lý coupon trong `BRD-14`.
- **Các Control chính:** Tabs chi tiết/coupons, button edit, button publish, button pause, button cancel, button generate coupon, button revoke coupon.
- **Màn hình con / Component phụ:** Promotion detail panel, coupon table, coupon generation dialog, revoke confirmation, usage statistics.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin mở một khuyến mãi để xem cấu hình, phạm vi áp dụng, thống kê sử dụng và danh sách coupon đã phát sinh.
  2. Khi chuyển tab chi tiết/coupons, portal giữ nguyên khuyến mãi đang xem để admin không mất ngữ cảnh.
  3. Khi sinh coupon, admin nhập số lượng và điều kiện trong dialog; hệ thống tạo mã, cập nhật bảng coupon và thống kê liên quan.
  4. Khi thu hồi coupon, portal yêu cầu xác nhận; sau khi thu hồi, coupon không còn được áp dụng trong checkout và bảng được làm mới.
  5. Các thao tác edit, publish, pause hoặc cancel cập nhật trạng thái khuyến mãi sau khi hệ thống kiểm tra quyền và điều kiện hợp lệ.

#### A08. Tạo / chỉnh sửa khuyến mãi nền tảng

- **Mục đích chính:** Cấu hình chương trình ưu đãi cấp nền tảng với phạm vi và cơ chế áp dụng linh hoạt.
- **Luồng tham chiếu (Use Case):** Thực hiện `UC-24`, liên quan `BRD-14`, `BRD-16`.
- **Các Control chính:** Textbox tên, textarea mô tả, selector phạm vi platform/restaurant, selector trigger tự động/coupon, selector loại giảm, input giá trị giảm, input giới hạn ngân sách/lượt dùng, lịch chạy, button save draft, button publish.
- **Màn hình con / Component phụ:** Scope selector, trigger selector, discount configuration, limit configuration, schedule picker, validation summary.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin nhập tên, mô tả, phạm vi áp dụng, cơ chế kích hoạt, loại giảm giá, giá trị giảm, ngân sách/lượt dùng và lịch chạy.
  2. Khi chọn save draft, hệ thống lưu cấu hình hiện có để admin tiếp tục hoàn thiện sau mà chưa phát hành ra người dùng.
  3. Khi chọn publish, hệ thống kiểm tra phạm vi áp dụng, điều kiện giảm giá, lịch chạy, ngân sách và giới hạn sử dụng trước khi phát hành.
  4. Nếu hợp lệ, khuyến mãi được lưu và danh sách cập nhật; nếu chưa hợp lệ, validation summary nhóm lỗi theo từng phần cấu hình để admin sửa nhanh.

#### A09. Cài đặt tài khoản admin

- **Mục đích chính:** Cho phép quản trị viên cập nhật hồ sơ cá nhân và tăng cường bảo mật tài khoản.
- **Luồng tham chiếu (Use Case):** Thuộc `UC-DOM-01`, hỗ trợ `UC-35`, liên quan `BRD-01`, `BRD-16`.
- **Các Control chính:** Tab Profile, tab Security, textbox display name, textbox avatar URL, email chỉ đọc, form đổi mật khẩu, chỉ báo độ mạnh mật khẩu, button revoke other sessions, button sign out.
- **Màn hình con / Component phụ:** Profile settings form, security settings form, password strength indicator, session revocation confirmation.
- **Mô tả sử dụng và xử lý sự kiện:**
  1. Admin chọn tab Profile để cập nhật tên hiển thị hoặc avatar URL, hoặc chọn tab Security để đổi mật khẩu và quản lý phiên đăng nhập.
  2. Khi lưu hồ sơ, hệ thống kiểm tra dữ liệu cơ bản và cập nhật thông tin hiển thị của tài khoản admin.
  3. Khi đổi mật khẩu, portal yêu cầu mật khẩu hiện tại, mật khẩu mới hợp lệ và hiển thị chỉ báo độ mạnh mật khẩu để admin kiểm tra trước khi lưu.
  4. Khi nhấn revoke other sessions, hệ thống yêu cầu xác nhận rồi thu hồi các phiên đăng nhập khác để giảm rủi ro bảo mật.
  5. Khi sign out, phiên hiện tại bị xóa và admin được đưa về màn hình đăng nhập admin.
