## Flight Booking System


# **Revision and Sign Off Sheet**

### **Change Record**

|Author|Version|Change reference|Date|
|---|---|---|---|
|||||
|||||


### **Reviewers**


|Name|Company|Version|Position|Date|
|---|---|---|---|---|
||||||
||||||
||||||
||||||
||||||
||||||
||||||
||||||
||||||


### **Table of Contents**


**1.** **Tổng quan về giải pháp.**
**1.1.** **Mục tiêu của giải pháp.**


Mục tiêu cốt lõi của Hệ thống Đặt vé Máy bay Trực tuyến là xây dựng một nền

tảng toàn diện, cung cấp cho người dùng khả năng tìm kiếm, đặt vé và quản lý

các chuyến bay một cách thuận tiện và hiệu quả:


   - Nâng cao trải nghiệm người dùng là việc tích hợp dịch vụ đặt xe đưa đón

sân bay, tạo nên một hành trình di chuyển liền mạch từ điểm đầu đến điểm

cuối.

   - Hệ thống hướng đến việc tối ưu hóa toàn bộ quy trình đặt vé, từ khâu tìm

kiếm ban đầu đến hoàn tất thanh toán, đồng thời đảm bảo các giao dịch

được thực hiện một cách an toàn tuyệt đối.

   - Bên cạnh đó, việc nâng cao chất lượng dịch vụ cho cả hành khách cá nhân

và các đối tác vận tải (hãng hàng không, công ty cung cấp xe đưa đón) cũng

là một mục tiêu trọng tâm.

   - Việc tích hợp chặt chẽ giữa đặt vé máy bay và dịch vụ đưa đón sân bay

không chỉ đơn thuần là mở rộng tính năng, mà còn phản ánh một chiến

lược nhằm cung cấp một giải pháp du lịch toàn diện hơn, thay vì chỉ là một

công cụ đặt vé đơn lẻ. Bằng cách giải quyết nhiều điểm chạm trong hành

trình của một người đi du lịch (bao gồm cả di chuyển hàng không và di

chuyển mặt đất), hệ thống kỳ vọng sẽ tăng cường sự gắn kết và giá trị mang

lại cho người dùng. Điều này đồng nghĩa với việc kiến trúc hệ thống phải có

khả năng quản lý đa dạng các loại hình dịch vụ, các mối quan hệ với nhà

cung cấp khác nhau (hãng hàng không, công ty cho thuê xe), và tiềm năng

xử lý các phụ thuộc phức tạp giữa các lượt đặt dịch vụ.

   - Luôn phải đảm bảo độ trễ thấp cho các tác vụ tìm kiếm, tính sẵn sàng cao

cho các chức năng đặt vé, và giao diện người dùng trực quan, dễ sử dụng.


**1.2.** **Phạm vi của hệ thống.**
**In-Scope (Những gì có trong phạm vi dự án):**


 - Đăng ký và đăng nhập: Cho phép đăng ký tài khoản bằng email, số điện thoại,
đăng nhập và quản lý thông tin cá nhân.

 - Tìm kiếm và đặt vé máy bay:


   - Tìm kiếm chuyến bay theo ngày, hãng hàng không, điểm đi và điểm đến.

   - Hiển thị danh sách chuyến bay gồm thông tin và giá tiền.

   - Lọc và sắp xếp kết quả theo giá vé, thời gian bay, số điểm dừng.

   - Hiển thị thông tin chi tiết về chuyến bay.

   - Đặt vé máy bay.

- Tìm kiếm và đặt xe đưa đón:

   - Tìm kiếm chuyến xe theo hãng xe, loại phương tiện, điểm đi và điểm đến.

   - Hiển thị thông tin chi tiết về chuyến xe.

   - Hiển thị danh sách phương tiện di chuyển và giá cước.

   - Đặt xe.

   - Hỗ trợ khách hàng thay đổi hoặc hủy vé/đặt xe theo chính sách.

- Thanh toán và xác nhận đặt chỗ:

   - Hỗ trợ nhiều phương thức thanh toán.

   - Gửi email/SMS xác nhận đặt vé và đặt xe thành công.

- Hỗ trợ khách hàng

   - Cung cấp hotline, email, chatbox chăm sóc khách hàng.

   - Hiển thị chính sách hoàn vé, đổi vé, và hướng dẫn sử dụng.

- Quản lý chuyến bay và dịch vụ đưa đó

   - Thêm, chỉnh sửa, và xóa thông tin chuyến bay và xe đưa đón.

   - Theo dõi số lượng vé đã bán và số ghế còn trống.

   - Quản lý đối tác vận tải cung cấp dịch vụ đưa đón sân bay.\

- Quản lý nhân viên

   - Thêm, chỉnh sửa, và xóa thông tin các nhân viên hỗ trợ .

   - Theo dõi công việc của các nhân viên.

- Theo dõi báo cáo, thống kê, đánh giá của khách hàng.


**Out-of-Scope (Những gì không trong phạm vi dự án)**


   - Đặt vé tàu hỏa, xe khách hoặc khách sạn.

   - Chương trình khách hàng thân thiết hoặc tích điểm đổi quà.

   - AI đề xuất chuyến bay và phương tiện thông minh.


**1.3.** **Các bên liên quan chính.**


**Khách hàng cá nhân** :


     - Hành khách có nhu cầu di chuyển bằng máy bay trong nước và quốc tế.

     - Người đi công tác, du lịch, thăm thân hoặc di chuyển vì các mục đích khác.

     - Người cần dịch vụ đưa đón sân bay để thuận tiện cho việc di chuyển.


**Doanh nghiệp và tổ chức**


     - Các công ty thường xuyên đặt vé máy bay cho nhân viên đi công tác.

     - Đại lý du lịch, công ty lữ hành cần đặt vé số lượng lớn cho khách hàng.


   - Các tổ chức đặt vé cho sự kiện, hội nghị hoặc chương trình đào tạo.


**Hãng hàng không và đối tác vận tải**


   - Các hãng hàng không muốn phân phối vé thông qua nền tảng.

   - Các công ty vận tải cung cấp dịch vụ đưa đón sân bay muốn hợp tác với
hệ thống để mở rộng khách hàng.


**Nhân viên quản lý & điều hành hệ thống**


   - Quản trị viên hệ thống chịu trách nhiệm giám sát hoạt động của nền tảng.

   - Nhân viên hỗ trợ khách hàng, giải quyết các vấn đề về đặt vé, hủy vé và
thanh toán.

   - Nhân viên kỹ thuật đảm bảo hệ thống hoạt động ổn định và bảo mật.


**Đội ngũ phát triển:**


   - Team developer

   - Team design

   - Team BA

   - Team Operation


…


**1.4.** **Bối cảnh kinh doanh và kỹ thuật.**
**Bối cảnh Kinh doanh:**

Hệ thống đặt vé máy bay trực tuyến được phát triển với mục tiêu tạo ra lợi

thế cạnh tranh trên thị trường du lịch trực tuyến đang ngày càng phát

triển. Bằng cách cung cấp một trải nghiệm đặt vé tích hợp và liền mạch cho

cả chuyến bay và dịch vụ đưa đón sân bay, hệ thống tập trung vào việc

nâng cao sự thuận tiện cho người dùng, đảm bảo an toàn trong thanh toán

và tối ưu hóa hiệu quả hoạt động cho các đối tác. Việc này không chỉ giúp

thu hút và giữ chân khách hàng mà còn tạo ra một hệ sinh thái dịch vụ du

lịch hoàn chỉnh hơn.


**Bối cảnh Kỹ thuật:**

Hệ thống sẽ được xây dựng trên một nền tảng công nghệ hiện đại, mạnh

mẽ và có khả năng mở rộng, nhằm đáp ứng các yêu cầu về hiệu năng và độ

tin cậy.


**Frontend:**


                - **Nextjs:** Xây dựng giao diện người dùng tương tác.

                - **Tailwind CSS, Material UI:** Tạo giao diện trực quan và hiện
đại.

                - **Local Storage:** Quản lý trạng thái ứng dụng một cách hiệu
quả, đặc biệt trong việc thao tác với giỏ hàng và dữ liệu
người dùng.


**Backend:**


                - **Node.js:** Xử lý các yêu cầu backend một cách nhanh chóng
và hiệu quả.

                - **Express.js:** Framework để xây dựng các API RESTful.

                - **Microservice architecture:** Tổ chức hệ thống thành các
dịch vụ độc lập để dễ quản lý và mở rộng.

                - **Redus Pub/Sub:** Được sử dụng để truyền tải thông tin và
xử lý các sự kiện giữa các dịch vụ microservice, đảm bảo
tính nhất quán và khả năng mở rộng của hệ thống.

                - **Java Spring Boot** : Framework backend để xây dựng
backend chịu tải tốt.


**Database:**


                - **PostgreSQL:** Sử dụng để quản lý các dữ liệu có cấu trúc
như thông tin sản phẩm, đơn hàng, và người dùng.

                - **MongoDB:** Lưu trữ dữ liệu phi cấu trúc như nội dung blog,
phản hồi khách hàng.

                - **Redis:** Cơ sở dữ liệu lưu trữ tạm thời (in-memory cache)
giúp tăng tốc độ truy vấn dữ liệu và tối ưu hóa hiệu suất hệ
thống.

                - Elasticsearch: Logging và tìm kiếm hiệu quả dữ liệu


**Logging:**


**-** **Logstash** : tạo các task và pipeline thu thập log từ các thành
phần trong hệ thống

**-** **Kibana:** Trực quan hóa dữ liệu log và trợ giúp truy xuất log
hiệu quả


**Monitoring:**


**- Prometheus:** lưu trữ và cung cấp dữ liệu monitoring của
system, container,... trong hệ thống


**- Grafana:** Trực quan hóa monitoring, gửi alert,...


**Other:**


                - Cloudflare: bảo mật, chống DDOS, Bot Detect, Request
Monitoring, Request Report, Caching, CDN,...

                - Github Action: Triển khai CI/CD

                - Docker + Docker Compose: Containerize service và triển
khai nhiều container dễ dàng

                - Ansible: giúp triển khai hạ tầng dưới dạng mã (Infrastructure
as Code) - giúp dễ dàng maintain hạ tầng về sau.


Việc lựa chọn đồng thời cả Node.js và Java Spring Boot cho các microservice

backend, cùng với việc sử dụng nhiều loại cơ sở dữ liệu chuyên dụng nhằm triển

khaiu cách tiếp cận như sau:


   - Cách tiếp cận "đa ngôn ngữ" (polyglot), cho phép tận dụng công cụ tốt nhất

cho từng tác vụ cụ thể (ví dụ, Node.js cho các API gateway hoặc lớp BFF

(Backend For Frontend) yêu cầu xử lý I/O cao, hoặc để triển khai cho

[Payment Service, vì Node.js được đa phần các nền tảng thanh toán thứ 3 hỗ](http://node.js/)

[trợ tốn. Ngoài ra, nhóm còn sử dụng Node.js để xây dựng Print Service, một](http://node.js/)

service chuyên dùng để generate mặt vé PDF cho người dùng, nguyên do là

vì Javascript support rất tốt cho việc render giao diện, ở đây là mặt vé.

   - Java cho logic nghiệp vụ phức tạp hoặc các quy trình tính toán nặng, cho

nên các core service cần độ chính xác, ổn định và chịu tải cao sẽ nằm ở

đây.

   - PostgreSQL cho dữ liệu giao dịch chuyến bay/đặt vé

   - MongoDB cho nội dung ít cấu trúc hơn như đánh giá, hoặc các loại dữ liệu

bất cấu trúc phát sinh về sau.

   - Redis cho caching tốc độ cao).


Tuy nhiên, cách tiếp cận này cũng mang lại sự phức tạp đáng kể trong vận hành,

đòi hỏi đội ngũ có kỹ năng đa dạng, quy trình CI/CD mạnh mẽ và khả năng giám

sát toàn diện trên nhiều công nghệ khác nhau.


Để triển khai microservice hiệu quả, nhóm quyết định sử dụng container và các

công cụ logging/monitoring chuyên dụng (như ELK stack, Prometheus/Grafana).

Điều này đòi hỏi một văn hóa và hạ tầng DevOps mạnh mẽ. Việc quản lý hiệu quả

một hệ thống như vậy phụ thuộc rất nhiều vào tự động hóa cho các quy trình xây

dựng, kiểm thử, triển khai (CI/CD), cung cấp hạ tầng (Infrastructure as Code - IaC),

và giám sát chủ động với các cảnh báo. Do đó, kiến trúc phải được thiết kế để tạo


điều kiện thuận lợi cho các thực hành DevOps này.


**Bảng 2: Công nghệ Cốt lõi và Lý do Lựa chọn**








|Thành phần Công nghệ|Vai trò trong Hệ thống|Lý do Chính cho Lựa chọn|
|---|---|---|
|Next.js|Xây dựng giao diện người<br>dùng (Frontend)|Cung cấp trải nghiệm người<br>dùng phong phú, hiệu năng<br>tốt với server-side rendering<br>và static site generation, hệ<br>sinh thái mạnh mẽ.|
|Node.js (Express.js)|Xây dựng các microservice<br>backend (ví dụ: API<br>Gateway, các dịch vụ I/O-<br>bound)|Hiệu năng cao cho các tác vụ<br>bất đồng bộ, non-blocking<br>I/O, phù hợp cho các ứng<br>dụng thời gian thực và API.<br>Hệ sinh thái npm lớn. Thích<br>hợp triển khai Payment<br>service và Print service vì<br>support rất tốt cho các tác<br>vụ này.|
|Java Spring Boot|Xây dựng các microservice<br>backend (ví dụ: dịch vụ xử lý<br>nghiệp vụ phức tạp, CPU-<br>bound)|Framework mạnh mẽ, ổn<br>định cho các ứng dụng<br>doanh nghiệp, hỗ trợ tốt cho<br>việc xây dựng các REST API,<br>bảo mật, và tích hợp với các<br>hệ thống khác. Cộng đồng<br>lớn và nhiều thư viện hỗ trợ.|
|PostgreSQL|Cơ sở dữ liệu quan hệ chính|Độ tin cậy cao, hỗ trợ ACID,<br>phù hợp cho dữ liệu giao<br>dịch và có cấu trúc như<br>thông tin chuyến bay, đặt vé,<br>người dùng. Nhiều tính năng<br>nâng cao và khả năng mở<br>rộng tốt.|


|MongoDB|Cơ sở dữ liệu NoSQL (tài<br>liệu)|Linh hoạt cho dữ liệu phi<br>cấu trúc hoặc bán cấu trúc<br>như phản hồi khách hàng,<br>logs (nếu không chỉ dùng<br>Elasticsearch). Khả năng mở<br>rộng theo chiều ngang tốt.|
|---|---|---|
|Redis|Cache trong bộ nhớ,<br>Message Broker (Pub/Sub)|Tốc độ truy cập cực nhanh,<br>giảm tải cho cơ sở dữ liệu<br>chính. Hỗ trợ các cấu trúc<br>dữ liệu đa dạng, Pub/Sub<br>cho giao tiếp bất đồng bộ<br>giữa các service.|
|Elasticsearch|Công cụ tìm kiếm và phân<br>tích log|Khả năng tìm kiếm toàn văn<br>mạnh mẽ, phân tích log hiệu<br>quả, hỗ trợ truy vấn phức<br>tạp và trả về kết quả nhanh<br>chóng.|
|Logstash, Kibana|Thu thập và trực quan hóa<br>log|Logstash thu thập và xử lý<br>log từ nhiều nguồn. Kibana<br>cung cấp giao diện trực<br>quan để tìm kiếm, phân tích<br>và hiển thị log, tạo<br>dashboard.|
|Prometheus, Grafana|Giám sát hệ thống và cảnh<br>báo|Prometheus thu thập<br>metrics hệ thống. Grafana<br>trực quan hóa metrics, tạo<br>dashboard giám sát tùy<br>chỉnh và cấu hình cảnh báo<br>chủ động.|
|Microservice Arch.|Mô hình kiến trúc tổng thể|Tăng khả năng mở rộng, khả<br>năng chịu lỗi, cho phép phát<br>triển và triển khai độc lập|


**2.** **Kiến trúc tổng thể.**
**2.1.** **Mô hình kiến trúc.**
**Kiến trúc microservices** :

   - Các chức năng lớn (auth, film, search) được đóng gói thành một service
nhỏ, triển khai độc lập.

   - Giao tiếp giữa các service qua gRPC


**Patterns hỗ trợ** :

   - API Gateway để sử dụng như chốt chặn đầu tiên, thực hiện routing, rate
limit, API whitelist,...

   - Redis Pub/Sub để triển khai event driven, giúp giao tiếp bất đồng bộ giữa
các service

   - gRPC để giao tiếp đồng bộ tốc độ cao giữa các service.

   - Configuration Server để có thể tập trung hóa việc quản lý cấu hình


**2.2.** **Các thành phần chính và quan hệ.**


- **API Gateway:**

  - _Chức năng chính:_ Là điểm vào duy nhất cho tất cả các yêu cầu từ client

(giao diện web). Xử lý việc định tuyến yêu cầu đến các microservice

backend phù hợp, rate limiting, IP Whitelist, và có thể là chuyển đổi yêu

cầu/phản hồi.

  - _Giao tiếp với:_ Ứng dụng Client và các microservices trong hệ thống.

  - _Lưu ý triển khai:_ Triển khai bộ nhớ đệm (cache) cho các phản hồi của các

yêu cầu thường xuyên và ít thay đổi. Hỗ trợ các mẫu như circuit breaker

để tăng khả năng chịu lỗi khi các service phụ thuộc gặp sự cố. Ghi log và

theo dõi tất cả các yêu cầu đến và phản hồi đi để phục vụ cho việc giám

sát.

- **User Service (Dịch vụ Xác thực, Phân quyền, quản lý các user trong hệ**

**thống):**

  - _Chức năng chính:_ Quản lý định danh người dùng, bao gồm đăng ký (UC12),

đăng nhập (UC1), quản lý mật khẩu. Phát hành, xác thực và làm mới JSON

Web Tokens (JWT). Quản lý vai trò và quyền hạn của người dùng, cung

cấp thông tin này cho các quyết định ủy quyền.

  - _Giao tiếp với:_ API Gateway, có thể là các dịch vụ cung cấp Notification bên

thứ 3 (SMS/Email) để thực hiện gửi OTP xác thực,...

  - _Lưu ý triển khai:_ Bảo mật việc lưu trữ thông tin xác thực (ví dụ: mật khẩu

đã hash). Token JWT nên có thời gian sống ngắn và cơ chế refresh token

an toàn.

- **Flight Service (Dịch vụ Quản lý Chuyến bay):**

  - _Chức năng chính:_ Quản lý tất cả dữ liệu liên quan đến chuyến bay, hãng

hàng không, sân bay và sơ đồ chỗ ngồi. Xử lý logic tìm kiếm chuyến bay

(UC2, UC3), tạo (UC18), cập nhật (UC20), và xóa (UC19) chuyến bay và quan

trọng nhất là đặt chỗ (UC5)- bao gồm chọn chỗ ngồi (UC5.1), thêm hành lý

(UC5.2). Cung cấp thông tin về tình trạng chuyến bay và chi tiết.

  - _Giao tiếp với:_ User Service (lấy thông tin người dùng).

  - _Lưu ý triển khai:_ Tối ưu hóa truy vấn tìm kiếm chuyến bay, có thể sử dụng

Elasticsearch cho các tìm kiếm phức tạp. Đảm bảo tính nhất quán của dữ

liệu chuyến bay. Đối với tính năng đặt chuyến bay, phải triển khai giải


pháp chống race condition

- **Order Service (Dịch vụ đơn đặt vé):**

  - _Chức năng chính:_ Quản lý đơn hàng/đặt chỗ (UC10, UC11), xử lý hủy vé

(UC8, UC14), là một phần trong quá trình xử lý cho chức năng đặt chỗ,

đóng vai trò như là nơi lưu trữ tất cả các đơn đặt chỗ trong hệ thống.

  - _Giao tiếp với:_ Flight Service (để lấy chi tiết chuyến bay, tình trạng ghế),

User Profile Service (để lấy thông tin khách hàng), Payment Service (để

khởi tạo và xác nhận thanh toán), Notification Service.

  - _Lưu ý triển khai:_ Xử lý các giao dịch đặt vé một cách an toàn và đảm bảo

tính nhất quán dữ liệu. Quản lý trạng thái đặt chỗ phức tạp.

- **Car Service (Dịch vụ Đưa đón Sân bay):**

  - _Chức năng chính:_ Quản lý dữ liệu cho các nhà cung cấp dịch vụ đưa đón

sân bay, các loại xe và giá cước. Xử lý tìm kiếm dịch vụ đưa đón (UC4), đặt

dịch vụ (UC9), và xem các lượt đặt dịch vụ đưa đón (UC21).

  - _Giao tiếp với:_ User Profile Service (để lấy thông tin khách hàng), Payment

Service (nếu dịch vụ đưa đón được thanh toán riêng hoặc là một phần của

gói), Notification Service.

  - _Lưu ý triển khai:_ Tích hợp với API của các đối tác cung cấp dịch vụ đưa

đón (nếu có).

- **Payment Service (Dịch vụ Thanh toán):**

  - _Chức năng chính:_ Tích hợp với các cổng thanh toán bên ngoài như VNPAY

(UC6 trong). Xử lý các yêu cầu thanh toán, xử lý các callback/webhook từ

cổng thanh toán, và cập nhật trạng thái thanh toán.

  - _Giao tiếp với:_ Order Service, Airport Transfer Service, các cổng thanh toán

bên ngoài, Notification Service (để gửi xác nhận thanh toán).

  - _Lưu ý triển khai:_ Đảm bảo an toàn tuyệt đối cho các giao dịch thanh toán.

Xử lý các trường hợp lỗi và timeout từ cổng thanh toán.

- **Notification Service (Dịch vụ Thông báo):**

  - _Chức năng chính:_ Gửi thông báo cho người dùng qua Email và SMS cho các

sự kiện như xác nhận đăng ký, đặt chỗ thành công, xác nhận thanh toán,

thay đổi chuyến bay, hủy vé.

  - _Giao tiếp với:_ User Service, Order Service, Car Service, Payment Service.

  - _Lưu ý triển khai:_ Tích hợp với các nhà cung cấp dịch vụ Email/SMS. Quản

lý template thông báo. Xử lý các trường hợp gửi thất bại.


- **Print Service (Dịch vụ in vé):**

  - _Chức năng chính:_ Chịu trách nhiệm là cổng API để generate mặt vé cho

flight, car booking,...

  - _Giao tiếp với: Client,_ Order Service.

  - _Lưu ý triển khai:_ Đảm bảo hiệu suất, chống DDOS bằng Cloudflare.


**3.** **Các quyết định kiến trúc.**
**3.1.** **Các quyết định quan trọng và lý do.**


|ID Quyết định|Tuyên bố Quyết<br>định|Lý do (Liên kết với<br>BRD/SRS hoặc Best<br>practices)|Trade-off Chính|
|---|---|---|---|
|AD-001|Áp dụng Kiến trúc<br>Microservice|BRD; Tăng khả năng<br>mở rộng, cô lập lỗi,<br>đa dạng công nghệ,<br>phát triển độc lập.|Tăng độ phức tạp<br>trong triển khai,<br>giám sát và giao tiếp<br>giữa các service. Đòi<br>hỏi Service<br>Discovery, API<br>Gateway.|
|AD-002|Triển khai mẫu API<br>Gateway|Best practice; Tập<br>trung hóa các mối<br>quan tâm chung,<br>đơn giản hóa client.|Gateway có thể trở<br>thành điểm nghẽn<br>cổ chai nếu không<br>được thiết kế và mở<br>rộng đúng cách.|
|AD-003|Sử dụng JWT cho<br>Xác thực Stateless|Tiêu chuẩn ngành<br>cho microservice;<br>Giảm tải quản lý<br>phiên, cải thiện khả<br>năng mở rộng.|Cần quản lý vòng<br>đời token (refresh<br>token) cẩn thận. Khó<br>thu hồi token ngay<br>lập tức.|
|AD-004|Áp dụng Chiến lược<br>Lưu trữ Đa dạng|BRD; Tối ưu hóa lưu<br>trữ cho từng loại dữ<br>liệu và mẫu truy<br>cập.|Tăng độ phức tạp<br>vận hành, đòi hỏi<br>chuyên môn đa<br>dạng về CSDL. Khó<br>khăn trong việc đảm<br>bảo tính nhất quán<br>dữ liệu trên các hệ<br>thống khác nhau.|
|AD-005|Giao tiếp Bất đồng<br>bộ qua Redis<br>Pub/Sub|BRD; Tăng khả năng<br>phục hồi, tách rời<br>service.|Phức tạp hơn trong<br>việc theo dõi luồng<br>và gỡ lỗi so với giao<br>tiếp đồng bộ. Cần xử|


|Col1|Col2|Col3|lý lỗi và retry logic<br>cho các message.|
|---|---|---|---|
|AD-006|Backend Kết hợp<br>(Node.js & Java<br>Spring Boot)|BRD; Tận dụng thế<br>mạnh của từng nền<br>tảng.|Đòi hỏi đội ngũ có<br>kỹ năng đa dạng, có<br>thể làm tăng chi phí<br>phát triển và bảo trì.<br>Cần tiêu chuẩn hóa<br>quy trình phát triển<br>trên cả hai nền tảng.|



**3.2.** **Các ràng buộc kỹ thuật (Technical Constraints).**


Các ràng buộc kỹ thuật sau đây ảnh hưởng đến thiết kế và triển khai của hệ

thống:


 - **Stacks Công nghệ Bắt buộc:** Các công nghệ được liệt kê trong BRD Mục 2.1.3

(bao gồm Next.js, Node.js, Java Spring Boot, PostgreSQL, MongoDB, Redis,

Elasticsearch, Logstash, Kibana, Prometheus, Grafana) được coi là ràng buộc

nếu việc sử dụng chúng là không thể thương lượng.

 - **Tuân thủ Quy định:** Phải tuân thủ Quy định Chung về Bảo vệ Dữ liệu (GDPR)

đối với việc bảo vệ dữ liệu người dùng. [1]

 - **Mục tiêu Hiệu năng:** Hệ thống phải hỗ trợ ít nhất 100 người dùng đồng thời

và đảm bảo tính sẵn sàng 24/7.

 - **Tích hợp Bên Thứ ba:** Yêu cầu tích hợp với các dịch vụ bên ngoài cụ thể như

VNPAY để thanh toán (UC6) và có khả năng tích hợp API với các đối tác cung

cấp dịch vụ đưa đón sân bay.

 - **Khoảng trống Thông tin:** Việc thiếu các đặc tả chi tiết cho một số khía cạnh

nhất định trong BRD/SRS (ví dụ: cơ chế service discovery cụ thể, giao thức

giao tiếp chi tiết giữa các service ngoài Redis Pub/Sub) hoạt động như một

ràng buộc, buộc kiến trúc phải đưa ra các giả định hoặc đề xuất có cơ sở hợp

lý.


**3.3.** **Các nguyên tắc thiết kế (Design Principles).**


- **Single Responsibility Principle - SRP:** Mỗi microservice sẽ có một mục đích

duy nhất, được xác định rõ ràng, tập trung vào một khả năng nghiệp vụ cụ

thể.

- **Loose Coupling:** Các dịch vụ sẽ được thiết kế để giảm thiểu sự phụ thuộc lẫn

nhau, tương tác thông qua các API được xác định rõ ràng.

- **High Cohesion:** Chức năng trong mỗi microservice sẽ có liên quan chặt chẽ

với nhau.

- **Design for Failure / Resilience:** Hệ thống sẽ được thiết kế để dự đoán và xử

lý một cách linh hoạt các lỗi trong dịch vụ hoặc các thành phần phụ thuộc (ví

dụ: sử dụng timeouts, retries, circuit breakers).

- **Scalability - Horizontal:** Các dịch vụ sẽ được thiết kế để có thể mở rộng theo

chiều ngang bằng cách thêm nhiều instance hơn.

- **Security by Design:** Các cân nhắc về bảo mật sẽ được tích hợp vào tất cả các

giai đoạn của vòng đời thiết kế và phát triển, chứ không phải là một suy nghĩ

sau cùng. Điều này hỗ trợ việc tuân thủ GDPR.

- **Stateless Services:** Các dịch vụ backend sẽ được thiết kế để không lưu trạng

thái (stateless) bất cứ khi nào có thể, chuyển việc quản lý trạng thái phiên

sang một kho lưu trữ phân tán như Redis, để đơn giản hóa việc mở rộng và

cải thiện khả năng phục hồi.

- **API-First Design:** Các API sẽ được coi là các thành phần hàng đầu, được thiết

kế một cách cẩn thận để đảm bảo sự rõ ràng, nhất quán và dễ dàng sử dụng

bởi client và các dịch vụ khác.

- **Infrastructure as Code (IaC):** sử dụng Ansible để triển khai hạ tầng, phù hợp với bất kì
Cloud Provider nào.


**4.** **Kiến trúc logic.**
**4.1.** **Các Module chính.**


- **API Gateway:**

  - _Chức năng:_ Điểm vào duy nhất cho client, định tuyến, xác thực cơ bản,

rate limiting.

  - _Đầu vào:_ Yêu cầu HTTP từ client (Next.js).

  - _Đầu ra:_ Phản hồi HTTP cho client sau khi xử lý bởi các service backend.


  - _Tương tác:_ Tất cả các service backend (User, Flight, Order, etc.).

  - _Lưu trữ:_ Chủ yếu xử lý logic, không lưu trữ dữ liệu lâu dài ngoài cache.

- **User Service (Dịch vụ Xác thực & Phân quyền):**

  - _Chức năng:_ Quản lý người dùng (đăng ký UC12, đăng nhập UC1, đổi mật

khẩu), cấp phát và xác thực JWT, quản lý vai trò và quyền hạn.

  - _Đầu vào:_ Thông tin đăng nhập (email/SĐT, mật khẩu), thông tin đăng ký.

  - _Đầu ra:_ JWT (access token, refresh token), trạng thái xác thực.

  - _Tương tác:_ API Gateway, Notification Service (cho OTP).

  - _Lưu trữ:_ Có thể lưu trữ thông tin về session token hoặc refresh token (nếu

cần thiết), thông tin về vai trò người dùng.

- **Flight Service (Dịch vụ Quản lý Chuyến bay):**

  - _Chức năng:_ Quản lý thông tin chuyến bay (UC18, UC20, UC19), hãng hàng

không, sân bay, sơ đồ ghế. Xử lý tìm kiếm chuyến bay (UC2), xem chi tiết

chuyến bay (UC3), đặt chuyến bay.

  - _Đầu vào:_ Tiêu chí tìm kiếm chuyến bay, thông tin tạo/cập nhật chuyến

bay, đặt chuyến bay.

  - _Đầu ra:_ Danh sách chuyến bay, chi tiết chuyến bay, tình trạng sẵn có.

  - _Tương tác:_ Order Service, User Service, Elasticsearch (cho tìm kiếm),

Notification Service.

  - _Lưu trữ:_ Dữ liệu chuyến bay, hãng hàng không, sân bay, sơ đồ ghế (trong

PostgreSQL).

- **Order Service (Dịch vụ Đặt chỗ):**

  - _Chức năng:_ Xử lý đặt vé (UC5, UC5.1, UC5.2), quản lý đơn hàng (UC10,

UC11), hủy vé (UC8, UC14), hỗ trợ đặt vé hộ (UC13 [1] ).

  - _Đầu vào:_ Yêu cầu đặt vé (thông tin chuyến bay, hành khách, ghế ngồi), yêu

cầu hủy vé.

  - _Đầu ra:_ Xác nhận đặt vé, trạng thái đơn hàng, thông tin hoàn tiền.

  - _Tương tác:_ Flight Service, User Service, Payment Service, Notification

Service

  - _Lưu trữ:_ Dữ liệu đơn hàng, vé đã đặt (trong PostgreSQL).

- **Car Transfer Service (Dịch vụ Đưa đón Sân bay):**

  - _Chức năng:_ Quản lý thông tin dịch vụ đưa đón, nhà cung cấp, xe. Xử lý tìm

kiếm (UC4), đặt xe (UC9), xem danh sách đặt xe (UC21).

  - _Đầu vào:_ Tiêu chí tìm kiếm xe, thông tin đặt xe.


  - _Đầu ra:_ Danh sách xe phù hợp, xác nhận đặt xe.

  - _Tương tác:_ User Service, Payment Service, Notification Service, API đối tác

vận tải.

  - _Lưu trữ:_ Dữ liệu dịch vụ đưa đón, đặt xe (trong PostgreSQL).

- **Payment Service (Dịch vụ Thanh toán):**

  - _Chức năng:_ Tích hợp cổng thanh toán (VNPAY - UC6), xử lý giao dịch, cập

nhật trạng thái thanh toán.

  - _Đầu vào:_ Yêu cầu thanh toán từ Booking Service/Airport Transfer Service,

callback/webhook từ cổng thanh toán.

  - _Đầu ra:_ Trạng thái thanh toán.

  - _Tương tác:_ Order Service, Flight Service, Cổng thanh toán VNPAY,

Notification Service.

  - _Lưu trữ:_ Lịch sử giao dịch (trong PostgreSQL), không lưu trữ thông tin thẻ

nhạy cảm.

- **Notification Service (Dịch vụ Thông báo):**

  - _Chức năng:_ Gửi email/SMS xác nhận đăng ký, đặt vé, thanh toán, thay đổi

lịch trình, hủy vé.

  - _Đầu vào:_ Yêu cầu gửi thông báo (nội dung, người nhận, loại thông báo).

  - _Đầu ra:_ Trạng thái gửi thông báo.

  - _Tương tác:_ Auth Service, Booking Service, Airport Transfer Service,

Payment Service, Flight Service.

  - _Lưu trữ:_ Có thể lưu log gửi thông báo.

- **Print Service (Dịch vụ Quản trị):**


_Chức năng:_ Cho phép generate mặt vé PDF


_Đầu vào:_ Yêu cầu in mặt vé


_Đầu ra:_ Mặt vé PDF


_Tương tác:_ Order service để lấy thông tin booking.


_Lưu trữ:_ Có thể lưu trữ các template mặt vé.


**4.2.** **Luồng dữ liệu và xử lý.**
**4.2.1. Đặt chuyến bay**


**Mô tả:** Khi một customer/nhân viên hỗ trợ thực hiện yêu cầu đặt chuyến
bay, hệ thống sẽ thực hiện một loạt thao tác kiểm tra thông tin về chuyến,


chỗ, sau đó nếu tất cả đều hợp lệ thì có thể tiến hành đặt chỗ và lưu
thông tin đặt vé, sau đó thông báo thành công cho người dùng.


**4.2.2. Tìm kiếm chuyến bay**


**Mô tả:** Người dùng có thể thực hiện tìm kiếm chuyến bay trên hệ thống.
Khi có yêu cầu, hệ thống sẽ thực hiện truy vấn dữ liệu và trả về thông tin
các chuyến bay cho người dùng.


**4.2.3. Thanh toán**


**Mô tả:** Hệ thống sẽ thực hiện chuỗi thao tác khi có yêu cầu thanh toán:

   - Nếu chọn thanh toán bằng tiền mặt: sẽ yêu cầu điền thông tin, và
gửi yêu cầu về lưu trữ trong database, sau đó hiển thị thông tin liên
hệ, địa chỉ thanh toán để người customer đến tận nơi thanh toán.

   - Nếu chọn thanh toán online: hệ thống sẽ chuyển hướng người
dùng sang cổng thanh toán của bên thứ 3, sau khi thanh toán
thành công/thất bại cổng thanh toán sẽ gửi request tới webhook
của hệ thống, hệ thống từ đó sẽ ghi nhận và xử lý, cập nhật trạng
thái đơn hàng.


**4.2.4. Đăng ký**


**Mô tả:** Khi có yêu cầu đăng ký gửi đến, hệ thống sẽ thực hiện một loạt
hành động:

1. Tiếp nhận thông tin người dùng và lưu vào bộ nhớ tạm (Redis)
2. Yêu cầu xác thực email và gửi mã OTP
3. Tiếp nhận và xác thực mã OTP, nếu hợp lệ sẽ tiến hành lấy thông

tin người dùng đang lưu trong bộ nhớ tạm ra lưu trong bộ nhớ dài
hạn (PostgreSQL).


**4.2.5. Thêm chuyến bay**


**Mô tả:** Thực hiện các hành động sau khi có yêu cầu tạo một chuyến bay
mới:

1. Xác thực thông tin chuyến bay có hợp lệ hay không (ngày bay, giá

gốc, sân bay đến, sân bay đi,...)
2. Lấy ra dữ liệu của máy bay được chọn, vì mỗi máy bay sẽ có sơ đồ

chỗ ngồi riêng, nên sẽ thực hiện clone chỗ ngồi của máy bay đó và
mapping qua chuyến bay, tạo thành sơ đồ của chuyến bay.
3. Tạo các quy định cho chuyến bay đó: ví dụ quy định hạng ghế, quy

định hành lý, quy định loại hành khách,...


**5.** **Kiến trúc vật lý.**
**5.1.** **Tổng quan triển khai.**


Hệ thống được triển khai trên một tổ hợp rất nhiều server từ rất nhiều
Cloud Provider khác nhau: Digital Ocean, Cloudfly, Render.
Dữ liệu được lưu trữ trên hạ tầng PostgreSQL, Redis, MongoDB được
triển khai bằng Ansible trên các server Digital Ocean.


**5.2.** **Thành phần sử dụng**


|Thành phần|Dịch vụ AWS sử dụng|Vai trò|
|---|---|---|
|CDN|Cloudflare|Phân phối nội dung tĩnh<br>(ảnh, video, HTML/JS)<br>với độ trễ thấp|
|API Gateway|Nginx|Quản lý, bảo mật và định<br>tuyến các yêu cầu API<br>đến các microservice<br>backend.|
|Caching|Redis|Cache dữ liệu cần truy<br>xuất nhanh, dữ liệu<br>tạm,...|
|Event notifcation<br>system|Redis Pub/Sub|Hệ thống truyền tin<br>nhắn theo mô hình<br>publish-subscribe (xuất<br>bản - đăng ký) để giải<br>quyết giao tiếp bất đồng<br>bộ giữa các services|
|Database|PostgreSQL, MongoDB triển<br>khai với Ansible|Lưu trữ dữ liệu|
|Logging|Elasticsearch + Logstash +<br>Kibana|Triển khai logging mọi<br>request đến hệ thống, hỗ<br>trợ tracking lỗi hiệu quả<br>bởi khả năng tìm kiếm<br>cực tốt của Elasticsearch|
|Mornitoring|Prometheus + Grafana|Monitoring toàn bộ hệ<br>thống: Ram, CPU,<br>Network,...|
|Container Registry|Docker Hub|Lưu trữ image container|


**6.** **Bảo mật.**
**6.1.** **Xác thực (Authenticate).**


- **Stimulus (Tác nhân kích thích):** Người dùng (Khách hàng, Nhân viên) cố

gắng đăng nhập vào hệ thống, đăng ký tài khoản mới.

- **Stimulus Source (Nguồn tác nhân kích thích):** Người dùng cuối thông qua

giao diện web của hệ thống.

- **Environment (Môi trường):** Trong hoạt động bình thường của hệ thống, khi

người dùng tương tác với các chức năng yêu cầu định danh.

- **Artifact (Thành phần hệ thống chịu tác động):** User Service Service, API

Gateway, cơ sở dữ liệu lưu trữ thông tin người dùng.

- **Response (Phản hồi của hệ thống):**

  - Hệ thống sử dụng thuật toán bcrypt (hoặc tương đương mạnh mẽ) để băm

(hash) mật khẩu cùng với salt trước khi lưu trữ, đảm bảo mật khẩu gốc

không bao giờ được lưu trữ dưới dạng văn bản thuần.

  - Khi đăng nhập thành công (sử dụng email/SĐT và mật khẩu theo BR1 của

UC1 trong), User Service sẽ phát hành JSON Web Tokens (JWT), bao gồm

một access token có thời gian sống ngắn và một refresh token có thời gian

sống dài hơn để duy trì phiên làm việc mà không cần người dùng đăng

nhập lại thường xuyên.

  - Đối với các yêu cầu đăng ký tài khoản mới hoặc đặt lại mật khẩu, hệ thống

sẽ gửi mã OTP (One-Time Password) qua email hoặc SMS (tùy theo cấu

hình và thông tin người dùng cung cấp) đến người dùng để xác minh

danh tính.

  - Hệ thống triển khai cơ chế khóa tài khoản tạm thời sau một số lần đăng

nhập thất bại liên tiếp để chống lại các cuộc tấn công brute-force.

- **Response Measure (Đo lường phản hồi):**

  - 100% mật khẩu người dùng được mã hóa bằng thuật toán băm mạnh có

salt khi lưu trữ.

  - Thời gian tạo và xác thực access token JWT bởi Auth Service phải dưới

50ms trong điều kiện tải bình thường.

  - Mã OTP phải được gửi đến email/SMS của người dùng trong vòng 30 giây

kể từ khi yêu cầu được thực hiện.


  - Độ trễ của toàn bộ quy trình đăng nhập (từ khi người dùng gửi thông tin

đến khi nhận được phản hồi) không vượt quá 500ms ở percentile thứ 95.

  - Tài khoản bị khóa trong ít nhất 15 phút sau 5 lần đăng nhập thất bại.


**6.2.** **Phân quyền (Authorization).**


- **Stimulus (Tác nhân kích thích):** Người dùng đã xác thực cố gắng truy cập

một tài nguyên hoặc thực hiện một chức năng cụ thể trong hệ thống.

- **Stimulus Source (Nguồn tác nhân kích thích):** Yêu cầu từ người dùng đã

đăng nhập (mang theo JWT) đến API Gateway hoặc trực tiếp giữa các

microservice nội bộ.

- **Environment (Môi trường):** Sau khi người dùng đã đăng nhập thành công

và đang tương tác với các chức năng của hệ thống.

- **Artifact (Thành phần hệ thống chịu tác động):** API Gateway, các

microservice backend (Flight Service, Order Service, Car Service, v.v.),...

- **Response (Phản hồi của hệ thống):**

  - Hệ thống triển khai mô hình Kiểm soát Truy cập Dựa trên Vai trò (Role
Based Access Control - RBAC). Các vai trò chính bao gồm: Khách hàng

(Customer), Nhân viên Hỗ trợ (Support Staff), Nhân viên Hãng hàng không

(Airline Staff), và Quản trị viên (Admin).

  - Quyền hạn cụ thể cho từng vai trò được xác định chi tiết trong Ma trận

Bảo mật (Security Matrix). Ví dụ, Nhân viên Hãng hàng không có quyền

tạo, cập nhật, xóa chuyến bay; Nhân viên Hỗ trợ có quyền xử lý yêu cầu

hủy vé của khách hàng.

  - API Gateway, phối hợp với User Service, sẽ thực hiện kiểm tra quyền truy

cập dựa trên vai trò được mã hóa trong JWT của người dùng trước khi

định tuyến yêu cầu đến microservice tương ứng.

  - Từng microservice sẽ có thể thực hiện kiểm tra quyền chi tiết hơn nếu cần

thiết cho các hoạt động cụ thể bên trong service đó.

- **Response Measure (Đo lường phản hồi):**

  - 100% các endpoint API yêu cầu xác thực và phân quyền phải được bảo vệ.

  - Thời gian kiểm tra phân quyền không được cộng thêm quá 20ms vào tổng

thời gian xử lý yêu cầu.

  - Thực hiện kiểm tra (audit) định kỳ (ví dụ: hàng quý) đối với việc gán vai


trò và quyền hạn của người dùng để đảm bảo tuân thủ và phát hiện các

cấu hình sai sót.












|Vai trò|Trách nhiệm Chính|Ví dụ Quyền hạn Cụ thể|
|---|---|---|
|Khách hàng (Customer)|Tìm kiếm, đặt vé máy bay,<br>đặt xe đưa đón, quản lý đặt<br>chỗ cá nhân.|Đăng ký/Đăng nhập, Tìm<br>kiếm chuyến bay, Đặt vé,<br>Hủy vé (theo chính sách),<br>Xem lịch sử đặt vé, Đặt xe<br>đưa đón.|
|Nhân viên Hỗ trợ (Support<br>Staf)|Hỗ trợ khách hàng, xử lý yêu<br>cầu thay đổi/hủy vé, tạo tài<br>khoản.|Đặt vé hộ khách hàng, Xử lý<br>yêu cầu hủy vé, Tạo tài<br>khoản customer, Khóa tài<br>khoản customer, Xem danh<br>sách customer.|
|Nhân viên Hãng hàng không<br>(Airline Staf)|Quản lý thông tin chuyến<br>bay, lịch trình, xác nhận<br>hành khách.|Thêm/Sửa/Xóa chuyến bay,<br>Xem danh sách đặt xe đưa<br>đón (liên quan đến chuyến<br>bay), Quản lý thông tin máy<br>bay.|
|Quản trị viên (Admin)|Quản lý toàn bộ hệ thống,<br>người dùng, nhân viên, xem<br>báo cáo.|Quản lý tài khoản (tạo, xem,<br>xóa), Quản lý nhân viên<br>(thêm, sửa, xóa, phân<br>quyền), Xem báo cáo thống<br>kê.|


**6.3.** **Bảo vệ API và dịch vụ.**


- **Stimulus (Tác nhân kích thích):** Lưu lượng truy cập đến các API của hệ

thống từ client hoặc từ các dịch vụ bên ngoài; các tương tác giữa các

microservice nội bộ.

- **Stimulus Source (Nguồn tác nhân kích thích):** Trình duyệt/ứng dụng của

người dùng, các hệ thống của đối tác (nếu có API mở), các microservice khác

trong hệ thống.

- **Environment (Môi trường):** Trong quá trình hoạt động bình thường của hệ

thống, bao gồm cả giao tiếp công khai và nội bộ.

- **Artifact (Thành phần hệ thống chịu tác động):** API Gateway, tất cả các

microservice backend.

- **Response (Phản hồi của hệ thống):**

  - Tất cả các API bên ngoài được public qua Gateway sẽ sử dụng giao thức

HTTPS/TLS để mã hóa dữ liệu truyền đi.

  - Thực hiện xác thực đầu vào (input validation) nghiêm ngặt dựa trên

schema (ví dụ: OpenAPI, JSON Schema) cho tất cả các yêu cầu API để ngăn

chặn các cuộc tấn công injection (SQL injection, XSS, v.v.) và đảm bảo tính

toàn vẹn dữ liệu.

  - Cấu hình giới hạn tốc độ truy cập (rate limiting) và hạn ngạch (throttling)

trên API Gateway để ngăn chặn lạm dụng API và các hình thức tấn công

từ chối dịch vụ (DoS/DDoS) cơ bản.

  - Tích hợp AWS Web Application Firewall (WAF) với API Gateway để bảo

vệ chống lại các lỗ hổng web phổ biến (ví dụ: OWASP Top 10).

  - Giao tiếp giữa các microservice nội bộ diễn ra trong môi trường VPC riêng

biệt. Cân nhắc sử dụng Mutual TLS (mTLS) cho các lệnh gọi API nhạy cảm

giữa các service để đảm bảo cả hai phía đều được xác thực.

- **Response Measure (Đo lường phản hồi):**

  - 100% lưu lượng API bên ngoài được mã hóa bằng HTTPS/TLS.

  - Ít nhất 95% các trường đầu vào của API được xác thực theo schema.

  - Tỷ lệ yêu cầu bị chặn bởi WAF hoặc rate limiting được giám sát và phân

tích thường xuyên.

  - Độ trễ do các biện pháp bảo vệ API (WAF, validation) không vượt quá 10%

tổng thời gian xử lý yêu cầu.


**6.4.** **Mã hóa dữ liệu.**


- **Stimulus (Tác nhân kích thích):** Dữ liệu nhạy cảm của người dùng (thông

tin cá nhân, thông tin thanh toán) được lưu trữ trong cơ sở dữ liệu hoặc

truyền qua mạng.

- **Stimulus Source (Nguồn tác nhân kích thích):** Các quy trình tạo, cập nhật,

truy xuất dữ liệu người dùng và dữ liệu giao dịch.

- **Environment (Môi trường):** Tại nơi lưu trữ (at rest) trong các cơ sở dữ liệu

(PostgreSQL, MongoDB) và trong quá trình truyền (in transit) giữa client, API

Gateway và các microservice.

- **Artifact (Thành phần hệ thống chịu tác động):** Cơ sở dữ liệu PostgreSQL,

MongoDB, Redis (nếu lưu trữ dữ liệu nhạy cảm), các kênh giao tiếp mạng.

- **Response (Phản hồi của hệ thống):**

  - **Mã hóa khi lưu trữ (Encryption at Rest):** Dữ liệu nhận dạng cá nhân

(PII) nhạy cảm của khách hàng (tên, thông tin liên hệ, thông tin hộ chiếu

nếu được thu thập) trong PostgreSQL và MongoDB sẽ được mã hóa bằng

các thuật toán mạnh như AES-256. Việc quản lý khóa mã hóa sẽ được thực

hiện thông qua AWS Key Management Service (KMS).

  - Các bản sao lưu (backup) của cơ sở dữ liệu cũng phải được mã hóa.

  - **Mã hóa khi truyền (Encryption in Transit):** Tất cả dữ liệu truyền giữa

client và API Gateway, cũng như giữa API Gateway và các microservice,

và giữa các microservice (nếu qua mạng công cộng hoặc không tin cậy)

phải được mã hóa bằng HTTPS/TLS.

  - Tuân thủ các yêu cầu của GDPR liên quan đến bảo vệ dữ liệu cá nhân.

- **Response Measure (Đo lường phản hồi):**

  - 100% dữ liệu PII nhạy cảm được mã hóa khi lưu trữ.

  - 100% các kênh giao tiếp bên ngoài và các kênh giao tiếp nội bộ quan trọng

sử dụng TLS 1.2 trở lên.

  - Các quy trình quản lý khóa mã hóa được tuân thủ nghiêm ngặt và được

kiểm tra định kỳ.


**6.5.** **Bảo vệ tài nguyên hạ tầng**


  - Database có IP whitelist, chỉ các service được chỉ định mới được quyền truy cập,
và không mở port ra public

  - Các thành phần để monitoring, logging hệ thống như Grafana, Kibana được IP
Whitelist và triển khai Cloudflare để chặn DDOS, BOT,...

  - Server phải được phân quyền rõ ràng, không dùng tài khoản root

  - Chặn truy cập server bằng dạng username password mà dùng SSH key, đổi port
sang port khác 22 để tránh truy cập trái phép.

  - Tắt server ping để tránh dò IP

  - Triển khai Cloudflare để giấu IP và chống DDOS

  - Có logging toàn bộ command trong server để phát hiện hành vi bất thường

  - Backup được mã hóa với mật khẩu để tránh đánh cắp


**7.** **Hiệu năng và khả năng mở rộng.**
**7.1.** **Đảm bảo hiệu năng.**


  - **Sử dụng CDN (Cloudflare)** để phân phối assets và ảnh tĩnh:

`o` Giảm tải lên origin server.

`o` Tăng tốc độ truy cập từ mọi khu vực.


  - **Caching:** Sử dụng **Redis** để cache:

`o` Chuyến bay phổ biến

`o` Data tạm


  - **Event notification service:** Dùng **Redis Pub Sub** để xử lý bất đồng bộ:

`o` Luồng đặt chuyến bay.


**7.2.** **Phương án mở rộng.**


**Mở rộng ngang (Horizontal Scaling):**


      - **Auto Scaling** : Có thể triển khai Docker Swarm để triển khai Auto Scaling.


**-** **Microservice scaling:** Mỗi service như Flight, Order, Car có thể mở rộng
riêng biệt.


**Mở rộng dọc (Vertical Scaling):**


      - **Tăng cấu hình máy chủ** : Dễ áp dụng cho DB (nếu tạm thời), nhưng giới
hạn về chi phí và tối đa phần cứng.


**8.** **Rủi ro và phương án giảm thiểu.**












|Rủi ro|Mô tả|Ảnh hưởng<br>(Mức độ)|Giảm thiểu|Xử lý khi xảy<br>ra|
|---|---|---|---|---|
|**Rủi ro Liên**<br>**quan đến Hạ**<br>**tầng & Dịch vụ**|||||
|Mất kết nối<br>Redis|Redis không<br>khả dụng làm<br>mất cache,<br>phiên làm việc,<br>hoặc cơ chế giữ<br>chỗ tạm thời,<br>tăng tải đột<br>ngột cho CSDL<br>chính.|Cao|Thiết lập Redis<br>Cluster với<br>Multi-AZ, sử<br>dụng TTL phù<br>hợp cho cache.<br>Thiết kế ứng<br>dụng có khả<br>năng fallback<br>(ví dụ: đọc trực<br>tiếp từ CSDL<br>nếu cache lỗi,<br>tuy nhiên chấp<br>nhận hiệu năng<br>giảm).|Fallback sang<br>CSDL (nếu có<br>thể), cảnh báo<br>qua Grafana.<br>Khởi động<br>lại/khôi phục<br>Redis cluster.|
|Service trên<br>Docker Swarm<br>không tự động<br>mở rộng kịp|Lượng truy cập<br>tăng đột biến<br>(ví dụ: khuyến<br>mãi lớn) khiến<br>Auto Scaling<br>không phản<br>ứng đủ nhanh.|Cao|Cấu hình Auto<br>Scaling chủ<br>động hơn dựa<br>trên dự đoán<br>tải, hoặc pre-<br>warm (chuẩn<br>bị sẵn) một số<br>instance trước<br>các sự kiện lớn.|Ưu tiên phục<br>vụ từ<br>cache/CDN.<br>Thông báo lỗi<br>thân thiện cho<br>người dùng.<br>Theo dõi và<br>điều chỉnh<br>ngưỡng Auto<br>Scaling.|


|Lỗi RDS / Mất<br>kết nối CSDL<br>(PostgreSQL/M<br>ongoDB)|CSDL chính bị<br>lỗi, mất kết nối,<br>hoặc dữ liệu bị<br>hỏng.|Rất Cao|Cấu hình<br>database<br>replicate,<br>backup thường<br>xuyên|Khôi phục từ<br>snapshot gần<br>nhất. Thực hiện<br>failover sang<br>AZ/replica<br>khác. Điều tra<br>nguyên nhân<br>gốc rễ.|
|---|---|---|---|---|
|Lỗi API<br>Gateway|API Gateway<br>quá tải, cấu<br>hình sai|Rất Cao|Triển khai<br>ansible cho cấu<br>hình Nginx, để<br>đảm bảo dễ<br>quản lý và<br>rollback khi có<br>thể dựa vào<br>version control<br>như Git|Kiểm tra cấu<br>hình, log.<br>Rollback về<br>phiên bản cũ<br>hơn|
|**Rủi ro Liên**<br>**quan đến Tích**<br>**hợp Bên Thứ**<br>**Ba**|||||
|Lỗi Cổng thanh<br>toán (VNPAY)|Cổng thanh<br>toán VNPAY<br>không khả<br>dụng hoặc xử<br>lý giao dịch<br>chậm/lỗi.|Cao|Triển khai cơ<br>chế retry logic<br>cho các yêu cầu<br>thanh toán.<br>Thông báo rõ<br>ràng cho người<br>dùng về tình<br>trạng và hướng<br>dẫn họ thử lại<br>sau. Cân nhắc<br>tích hợp với<br>nhiều cổng<br>thanh toán dự<br>phòng (trong|Theo dõi trạng<br>thái VNPAY.<br>Hướng dẫn<br>người dùng thử<br>lại. Xử lý các<br>giao dịch<br>treo/lỗi thủ<br>công nếu cần.|


|Col1|Col2|Col3|tương lai).|Col5|
|---|---|---|---|---|
|Lỗi API của<br>Hãng hàng<br>không/Đối tác<br>Đưa đón|API của đối tác<br>không phản<br>hồi, trả về dữ<br>liệu sai, hoặc<br>thay đổi API<br>không tương<br>thích.|Trung bình -<br>Cao|Xây dựng lớp<br>adapter mạnh<br>mẽ để tương<br>tác với API đối<br>tác, có khả<br>năng xử lý lỗi,<br>timeout, và<br>retry. Cache dữ<br>liệu từ API đối<br>tác (nếu phù<br>hợp và được<br>phép). Thiết lập<br>cơ chế giám sát<br>và cảnh báo<br>cho các lỗi tích<br>hợp.|Liên hệ đối tác<br>để giải quyết.<br>Sử dụng dữ liệu<br>cache (nếu có)<br>tạm thời. Thông<br>báo cho người<br>dùng nếu dịch<br>vụ của đối tác<br>không khả<br>dụng.|
|**Rủi ro Liên**<br>**quan đến Bảo**<br>**mật**|||||
||||||
|Rò rỉ Token<br>JWT|Access token<br>hoặc refresh<br>token bị đánh<br>cắp hoặc sử<br>dụng trái phép.|Cao|Sử dụng access<br>token có thời<br>gian sống ngắn.<br>Lưu trữ refresh<br>token một cách<br>an toàn (ví dụ:<br>httpOnly<br>cookie). Triển<br>khai cơ chế thu<br>hồi token (có<br>thể phức tạp<br>với JWT). Giám<br>sát các hành vi|Thu hồi token<br>(nếu có cơ chế).<br>Buộc người<br>dùng đăng xuất<br>và đăng nhập<br>lại. Điều tra<br>nguồn gốc rò rỉ.|


|Col1|Col2|Col3|đáng ngờ liên<br>quan đến<br>token.|Col5|
|---|---|---|---|---|
|Lỗ hổng trong<br>Mã nguồn/Thư<br>viện|Các lỗ hổng bảo<br>mật trong mã<br>nguồn tự phát<br>triển hoặc<br>trong các thư<br>viện của bên<br>thứ ba được sử<br>dụng.|Cao|Thực hiện quy<br>trình Secure<br>SDLC (Software<br>Development<br>Lifecycle). Quét<br>lỗ hổng mã<br>nguồn (SAST,<br>DAST) thường<br>xuyên. Cập<br>nhật các thư<br>viện và<br>dependencies<br>lên phiên bản<br>mới nhất, đã vá<br>lỗi. Thực hiện<br>penetration<br>testing định kỳ.|Vá lỗi khẩn<br>cấp. Cách ly các<br>thành phần bị<br>ảnh hưởng.<br>Khôi phục từ<br>bản sao lưu<br>nếu cần.|
|**Rủi ro Liên**<br>**quan đến Dữ**<br>**liệu**|||||
|Mất nhất quán<br>Dữ liệu trong<br>Microservices|Do tính chất<br>phân tán, dữ<br>liệu giữa các<br>service (ví dụ:<br>Booking và<br>Flight<br>inventory) có<br>thể trở nên<br>không nhất<br>quán sau một<br>lỗi.|Trung bình|Áp dụng mẫu<br>Saga cho các<br>giao dịch kéo<br>dài qua nhiều<br>service để đảm<br>bảo tính nhất<br>quán cuối cùng<br>(eventual<br>consistency).<br>Sử dụng các cơ<br>chế retry và<br>compensating|Chạy các quy<br>trình đối chiếu<br>và sửa lỗi dữ<br>liệu thủ công<br>hoặc tự động.<br>Điều tra<br>nguyên nhân<br>gây mất nhất<br>quán.|


