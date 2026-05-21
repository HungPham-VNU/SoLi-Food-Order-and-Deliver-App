<!-- Slide number: 1 -->

![Trường Đại học Công nghệ Thông tin](Picture4.jpg)
KHOA CÔNG NGHỆ PHẦN MỀM
# KIẾN TRÚC PHẦN MỀM

HCM-2021

### Notes:
Chapter 4: 4 Understanding Quality Attributes, Software Architecture in Practice Second Edition Third Edition
Chapter 16: Quality Attributes,  .NET Application Architecture Guide, 2nd Edition

<!-- Slide number: 2 -->
# Quality Attributes

### Notes:
Chapter 4: 4 Understanding Quality Attributes, Software Architecture in Practice Second Edition Third Edition
Chapter 16: Quality Attributes,  .NET Application Architecture Guide, 2nd Edition

<!-- Slide number: 3 -->
# Contents
Định nnghĩa thuộc tính chất lượng (QA)
Các thuộc tính chất lượng
Kiến trúc và các yêu cầu
Functional requirements
Quality attribute requirements
Constraints

### Notes:
Chapter 4: 4 Understanding Quality Attributes, Software Architecture in Practice Second Edition Third Edition
Chapter 16: Quality Attributes,  .NET Application Architecture Guide, 2nd Edition

<!-- Slide number: 4 -->
# Quality Attribute
	A quality attribute (QA) is a measurable or testable property of  a system that is used to indicate how well the system satisfies the needs of its stakeholders

	Thuộc tính chất lượng (QA) là một tính chất có thể đo lường hoặc kiểm tra được của hệ thống được sử dụng để chỉ ra mức độ thỏa mãn nhu cầu của các bên liên quan của hệ thống.

### Notes:
Chapter 4: 4 Understanding Quality Attributes, Software Architecture in Practice Second Edition Third Edition
Chapter 16: Quality Attributes,  .NET Application Architecture Guide, 2nd Edition

<!-- Slide number: 5 -->
# Các thuộc tính chất lượng
Chất lượng hệ thống (System qualities)
Chất lượng thời gian thực thi (Run-time qualities)
Chất lượng thiết kế (Design qualities)
Chất lượng người dùng (User qualities)

Reference: https://msdn.microsoft.com/en-us/library/ee658094.aspx

### Notes:
Chapter 4: 4 Understanding Quality Attributes, Software Architecture in Practice Second Edition Third Edition
Chapter 16: Quality Attributes,  .NET Application Architecture Guide, 2nd Edition

<!-- Slide number: 6 -->
# 1. Chất lượng hệ thống
Hỗ trợ (Supportability):
Khả năng của hệ thống về cung cấp thông tin có ích cho việc xác định và sửa lỗi khi có vấn đề trong lúc sử dụng


Kiểm thử (Testability):
Thể hiện khả năng tạo các tiêu chí và thực hiện kiểm thử xem hệ thống có đáp ứng được các tiêu chí ấy hay không.

<!-- Slide number: 7 -->
# 2. Chất lượng thời gian thực thi
Sẵn sàng (Availability):
Thể hiện bằng khoảng thời gian hệ thống hoạt động. Có thể được tính bằng phần trăm của thời gian hệ thống hoạt động trên một khoảng thời gian định trước (năm). Tính sẵn sàng bị ảnh hưởng bởi lỗi của hệ thống, của cơ sở hạ tầng, tải,…


Hợp tác (Interoperability):
Khả năng hệ thống có thể tương tác với hệ thống khác. Một hệ thống có khả năng hợp tác cao sẽ giúp chúng ta tra đổi và tái sử dụng dữ liệu (trong nội bộ và ngoài công ty/tổ chức) một cách dễ dàng.


Quản lý (Manageability):
Khả năng của hệ thống cung cấp cho quản trị viên những phương tiện để quản lý, xác định lỗi, tinh chỉnh,…

<!-- Slide number: 8 -->
# 2. Chất lượng thời gian thực thi
Hiệu năng (Performance):
Thể hiện đáp ứng của hệ thống khi thực thi các yêu cầu trong một khoảng thời gian xác định


Tin cậy (Reliability):
Độ tin cậy là khả năng của một hệ thống duy trì hoạt động theo thời gian. Độ tin cậy được đo bằng xác suất mà một hệ thống sẽ không thực hiện các chức năng dự kiến của nó trong một khoảng thời gian xác định


Mở rộng (Scalability):
Thường được hiểu theo hai nghĩa: hệ thống có thể xử lý thêm các yêu cầu (tải) mà không ảnh hưởng đến hiệu năng và khả năng mở rộng vật lý


An ninh (Security):
Khả năng của hệ thống trong việc chống lại các hoạt động không nằm trong thiết kế, bảo vệ dữ liệu quan trọng,…

<!-- Slide number: 9 -->
# 3. Chất lượng thiết kế
Toàn vẹn khái niệm (Conceptual Integrity):
Sự nhất quán và gắn kết của thiết kế tổng thể, bao gồm cách các thành phần và mô đun được thiết kế


Mềm dẻo (Flexibility):
Khả năng của một hệ thống thích ứng với các môi trường và tình huống khác nhau, đồng thời đối phó với những thay đổi trong các chính sách và quy tắc nghiệp vụ
Hệ thống dễ dàng cấu hình lại hoặc điều chỉnh để đáp ứng các yêu cầu khác nhau của người dùng và hệ thống.

### Notes:

<!-- Slide number: 10 -->
# 3. Chất lượng thiết kế
Có thể bảo trì (Maintainability):
Hệ thống có thể chấp nhận sự thay đổi; những sự thay đổi này sẽ ảnh hưởng đến các thành phần, dịch vụ,… khi thêm hoặc thay đổi chức năng, sửa lỗi,…


Tái sử dụng (Reusability):
Khả năng một (vài) thành phần hoặc hệ thống con có thể được sử dụng lại cho ứng dụng khác, trong ngữ cảnh khác. Tái sử dụng hạn chế tối thiểu sao chép lại các thành phần cũng như thời gian thực thi.

### Notes:

<!-- Slide number: 11 -->
# 4. Thuộc tính người dùng
Dễ dùng (Usability):
Khả năng thể hiện sự thuận tiện của hệ thống đáp ứng các yêu cầu của người dùng (giao diện, linh hoạt của các chức năng,…)
Hệ thống trực quan, dễ bản địa hóa và toàn cầu hóa, đồng thời có thể cung cấp quyền truy cập, trải nghiệm tốt cho người dùng gồm cả những người khuyết tật.

<!-- Slide number: 12 -->
# Architecture and Requirements
Functional requirements
Quality attribute requirements
Constraints

<!-- Slide number: 13 -->
# Architecture and Requirements 1.Funtional requirements
Khả năng hệ thống thực hiện các nhiệm vụ theo dự định
Các chức năng không làm căn cứ để định nghĩa kiến trúc, vì không có kiến trúc nào thỏa mãn tất cả các chức năng.
Chức năng dễ bị thay đổi khi yêu cầu thay đổi.
Thực tế, thiết kế kiến trúc như một tập các cấu trúc kết hợp các thành phần của cấu trúc: các tầng, các lớp, dịch vụ, các hợp phần (components), v.v. Tuy nhiên, mỗi thành phần trong cấu trúc cần chịu trách nhiệm một chức năng nào đó.

### Notes:
Functional requirements. These requirements state what the system mustdo, and how it must behave or react to runtime stimuli.

<!-- Slide number: 14 -->
# Architecture and Requirements2.Specifying Quality attribute requirements
Source of stimulus: tác nhân kích hoạt sự kiện
Stimulus: Một phản hồi thỏa một điều kiện nào đó xuất hiện trong hệ thống
Environment: Môi trường cho phép “Stimulus” xảy ra
Artifact: Các yếu tố sử dụng để “Stimulus” được thực hiện

![](Picture5.jpg)

<!-- Slide number: 15 -->
# Architecture and Requirements2.Specifying Quality attribute requirements
Response: Là các hành động cam kết của hệ thống khi có phản hồi trả về.
Response measure: Là những yếu tố có thể đánh giá (đo được, hoặc kiểm tra được) được khi hệ thống nhận được phản hồi.

![](Picture6.jpg)

A general scenario for availability

### Notes:
A general scenario for availability
Một kịch bản chung về tính khả dụng

<!-- Slide number: 16 -->
# Architecture and Requirements3. Constraints
Ràng buộc là một quyết định thiết kế được đưa ra trong những điều kiện và tình huống cụ thể.
Ví dụ:
Chỉ định sử dụng ngôn ngữ lập trình
Tái sử dụng mã nguồn,
Đào tạo đội ngũ về một lĩnh vực nào đó, v.v.

Các điều trên được gọi là tầm nhìn của kiến trúc sư

### Notes:

<!-- Slide number: 17 -->
# functionality

<!-- Slide number: 18 -->
# Quality attribute requirements
Allocation of responsibilities
Identifying the important responsibilities
Determining non-runtime and runtime elements
Strategies for making these decisions include functional decomposition, modeling real-world objects.
Coordination model
Identifying the elements of the system that must coordinate or not.
Determining the properties
Choosing the communication mechanism
Data model
Choosing the major data abstractions
Compiling metadata needed for consistent interpretation of the data
Organizing the data

### Notes:

<!-- Slide number: 19 -->

![](Picture1.jpg)
# Quality attribute requirements
Management of resources
Identifying the resources: managed, limits for each.
Determining which element(s) manage each resource
Determining how resources are shared, employed when is contention.
Determining the impact of saturation on different resources
Mapping among architectural elements
The mapping of modules and runtime elements to each other
The assignment of runtime elements to processors
The assignment of items in the data model to data stores.
The mapping of modules and runtime elements to units of delivery.
An architecture must provide two types of mappings
Mapping between elements in different types of architecture structures
Mapping between software elements and environment elements

<!-- Slide number: 20 -->
# Quality attribute requirements
Binding time decisions
For allocation of responsibilities
For choice of coordination model
For resource management
For choice of technology
Choice of technology
Deciding which technologies are available to realize the decisions made in the other categories.
Determining whether the available tools to support this technology choice.
Determining the support available for the technology
Determining the side effects of choosing a technology
Determining whether a new technology is compatible with the existing technology stack

<!-- Slide number: 21 -->
# Summary
Requirements for a system come in three categories: 1. Functional. These requirements are satisfied by including an appropriate set of responsibilities within the design.
2. Quality attribute. These requirements are satisfied by the structures and behaviors of the architecture.
3. Constraints. A constraint is a design decision that’s already been made. To express a quality attribute requirement, we use a quality attribute scenario. The parts of the scenario are these:
1. Source of stimulus2. Stimulus3. Environment4. Artifact5. Response6. Response measure

<!-- Slide number: 22 -->
# Tổng kết chủ đề
An architectural tactic is a design decision that affects a quality attribute response. The focus of a tactic is on a single quality attribute response. Architectural patterns can be seen as “packages” of tactics. The seven categories of architectural design decisions are these:
1. Allocation of responsibilities2. Coordination model3. Data model4. Management of resources5. Mapping among architectural elements6. Binding time decisions7. Choice of technology