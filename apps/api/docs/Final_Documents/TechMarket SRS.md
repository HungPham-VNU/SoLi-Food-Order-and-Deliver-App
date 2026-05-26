## **SOFTWARE REQUIREMENTS SPECIFICATION** 

## TechMarket 

_Prepared for_ TechMarket Project **Version 1.0** 

Mr. Ngo - uit@gm.uit.edu.vn Mr. Dinh - , uit@gm.uit.edu.vn 

## **Revision and Sign Off Sheet** 

## **Change Record** 

|**Author**|**Version**|**Change reference**|**Date**|
|---|---|---|---|
|Khai Ngo Quang|0.1|Initialize|5/12/2023|
|Khai Ngo Quang|0.2|Add some use case description|10/12/2023|
|Duong Dinh Quang|0.3|Update use case diagram,<br>introduction and use case<br>description|20/12/2023|
|Khai Ngo Quang|0.4|Update use case diagram,<br>business rules, message list|08/1/2023|
|Duong Dinh Quang|1.0|Upload list and view description|08/1/2023|



## **Reviewers** 

|**Name**|**Version**|**Position**|**Date**|
|---|---|---|---|
|Khai Ngo Quang|0.1|Application Owner|6/12/2023|
|Khai Ngo Quang|0.2|Application Owner|11/12/2023|
|Khai Ngo Quang|0.3|Application Owner|21/12/2023|
|Khai Ngo Quang|0.4|Application Owner|08/1/2023|
|Khai Ngo Quang|1.0|Application Owner|08/1/2023|



## **Table of Contents** 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

1.1. Purpose........................................................................................................................................ 1.2. Scope............................................................................................................................................. 1.3. Intended Audiences and Document Organization........................................................................ 2. Functional Requirements....................................................................................................................... **2.1. Use Case Description.......................................................................................................................** UC1: Sign In................................................................................................................................... Activities Flow............................................................................................................................ Business Rules.......................................................................................................................... UC2: Sign Up.................................................................................................................................. 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

Activities Flow........................................................................................................................................ Business Rules...................................................................................................................................... UC14: Pay................................................................................................................................................... 

Activities Flow............................................................................................................................ Business Rules.......................................................................................................................... UC15: Cancel order..................................................................................................................................... Activities Flow........................................................................................................................................ Business Rules...................................................................................................................................... UC16: Confirm delivery of order.................................................................................................................. 

Activities Flow............................................................................................................................ Business Rules.......................................................................................................................... UC18: Chat with seller................................................................................................................................. Activities Flow............................................................................................................................ Business Rules.......................................................................................................................... UC19: Report post....................................................................................................................................... Activities Flow........................................................................................................................................ Business Rules...................................................................................................................................... UC20: Create category................................................................................................................................ Activities Flow........................................................................................................................................ Business Rules...................................................................................................................................... UC21: Update category............................................................................................................................... Activities Flow........................................................................................................................................ Business Rules...................................................................................................................................... UC22: Delete category................................................................................................................................ Activities Flow........................................................................................................................................ Business Rules...................................................................................................................................... UC23: Approve post....................................................................................................................... 

Activities Flow............................................................................................................................ Business Rules.......................................................................................................................... UC25: Ban account..................................................................................................................................... Activities Flow........................................................................................................................................ Business Rules...................................................................................................................................... UC26: Manage TechMarket bank account.................................................................................................. Activities Flow........................................................................................................................................ Business Rules...................................................................................................................................... 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

Activities Flow........................................................................................................................................ Business Rules...................................................................................................................................... UC28: Update information for the help center............................................................................................. Activities Flow........................................................................................................................................ Business Rules...................................................................................................................................... UC29: Handle feedback from user.............................................................................................................. Activities Flow........................................................................................................................................ Business Rules...................................................................................................................................... **2.2. List Description................................................................................................................................ 2.3. View Description............................................................................................................................... 3. Non-functional Requirements............................................................................................................** 3.1. User Access and Security............................................................................................................ 3.2. Performance Requirements.......................................................................................................... 3.3. Implementation Requirements...................................................................................................... **4. Appendixes..........................................................................................................................................** Glossary................................................................................................................................................ Messages............................................................................................................................................ Issues List............................................................................................................................................ 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **1. Introduction** 

## 1.1. **Purpose** 

This document serves as the comprehensive Software Requirements Specification (SRS) and Design Document for the TechMarket project. It encapsulates the detailed requirements and design considerations that will guide the development process. This document is an essential reference for developers, providing a roadmap for application functionality, task assignment, and deployment strategies. 

The primary purpose of this document is to outline the software requirements for the TechMarket project and establish a clear design framework. It acts as a foundational guide for developers, project managers, and other stakeholders involved in the software development lifecycle. By detailing the functionalities and design principles, this document ensures a shared understanding of project goals and expectations. 

## 1.2. **Scope** 

The scope of this document encompasses both the functional and non-functional requirements of the TechMarket project. It defines how the applications under development will operate, outlining features, constraints, and interfaces. The scope extends to cover various aspects, including user interactions, system performance, security, and deployment considerations. 

## 1.3. **Intended Audiences and Document Organization** 

This comprehensive document outlines the roles and responsibilities of various teams involved in the TechMarket project. The project encompasses the development, documentation, and user acceptance testing (UAT) of the application. Each team plays a crucial role in ensuring the success of the project, and this document aims to provide a detailed overview of their responsibilities. 

This document is intended for: 

- ❖ Development team: The development team is at the forefront of transforming project 

requirements into functional, high-quality software. Their responsibilities extend from detailed design to implementation and testing at various levels. 

- ❖ Documentation Team: The documentation team plays a critical role in creating user- 

friendly and informative documentation that accompanies the TechMarket application. Their work contributes to user understanding, efficient onboarding, and successful application usage. 

- ❖ UAT team: The UAT team is responsible for validating the application's functionality 

and usability from an end-user perspective. Their role is crucial in ensuring that the application meets user expectations and requirements. 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

Below are main sections of the document: 

- ❖ **1. Introduction** : This section describes the general introduction of this document. 

- ❖ **2. Functional Requirements** : This section describes the functional requirements in detail. 

- **❖ 3. Non-functional Requirements:** This section describes the non-functional 

   - requirements of this application such as user access and security, interfaces, screens and performance. 

- ❖ **4. Other Requirements:** This section describes other requirements such as archive or security audit function. 

- **❖ 5. Appendixes** : This section describes other requirements for this application and other supporting information for this document **.** 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **2. Functional Requirements** 

## **2.1. Use Case Description** 

UC1: Sign In 

|UC1: Sign In||
|---|---|
|**Name**|**Sign In**|
|**Description**|This use case describes the process by which a user logs into<br>the system.|
|**Actor**|User|
|**Trigger**|❖When the user clicks on the “Sign In” button.|
|**Pre-condition**|❖The user is not logged in to the system.<br>❖The user is in the sign in page (refer to “”Sign In Form” in “List<br>description” file).|
|**Post-condition**|❖The user is logged to the system.<br>❖The user is redirected to the home page.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR Code**|**Description**|
|---|---|---|
|_(3)_|_BR1_|**Validate Rules:**<br>❖The system checks the items [username], [password].<br>❖If any of them is null or blank the system will show an error<br>message MSG 2.<br>❖If [username] does not exist the system will show an error<br>message MSG 22 else [user] = User Repository find by<br>[username] (call findById() function)<br>❖If hash([password]) != user.password then the system will<br>show an error message MSG 22<br>else generate jwt from [user.id] and record this login<br>session.|
|_(4)_|_BR2_|**Message Rules:**<br>❖The system shows the error message MSG 22.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|_(5)_|_BR3_|**Message Rules:**<br>❖The system shows the success message MSG 23.|
|---|---|---|
|_(6)_|_BR4_|**Redirect Rules:**<br>❖The system redirects to the home page.|



UC2: Sign Up 

|**Name**|**Sign Up**|
|---|---|
|**Description**|This use case describes the process by which a user creates a<br>new account in the system|
|**Actor**|User|
|**Trigger**|❖When the user clicks on the “Sign Up” button.|
|**Pre-condition**|❖The user is on the sign up page (refer to “Sign Up Form” in “List<br>description” file).|
|**Post-condition**|❖New account has been created in the ‘INACTIVE’ state.<br>❖The user will be redirected to the home page.<br>❖The user will be asked to verify through email.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR Code**|**Description**|
|---|---|---|
|_(3)_|_BR5_|**Validate Rules:**<br>❖The system checks the items [username], [password],<br>[phoneNumber], [email].<br>❖If any entries are empty, the system shows an error<br>message MSG 2.<br>❖If [username.length] < 8 then the system shows an<br>error message MSG 24.<br>❖If pattern.compile(“"^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[@#$ %^&+=!])(?=\\S+$).{8,}$"”).notMatch([password]) then<br>the system shows an error message MSG 25.<br>❖If pattern.compile(‘^(84|0[3|5|7|8|9])+([0-9]{8})<br>$’).notMatch([phoneNumber]) orthen returns400-|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||BAD_REQUEST error with error message MSG 30<br>❖If pattern.compile(‘^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.<br>[a-zA-Z]{2,}$’).notMatch([email]) then returns 400-<br>BAD_REQUEST error with error message MSG31.<br>❖If [phoneNumber] exists in the system then the system<br>shows an error message MSG 26.<br>❖If [email] exists in the system then the system shows an<br>error message MSG 27.<br>❖[user] = User Repository save new user with all data<br>(call save() function)<br>❖[user.status] = ‘INACTIVE’<br>❖The system will show a success message MSG 28.<br>❖Send verify email as**Email Templates**below,<br>❖**Email Templates:**<br>❖Send mail to user register account as the template<br>below**:**<br>From<br>techmarket@gmail.com<br>To<br>[email]<br>Cc<br>N/A<br>Subjec<br>t<br>Get [Subject] of “Email Template”<br>item of which [Keyword] = “Sign Up”<br>Body<br>Get [Body] of “Email Template” item<br>of which[Keyword]= “Sign Up”<br>❖Following is sample email content:<br>Subject<br>"VerifyRegistration Tech Market|BAD_REQUEST error with error message MSG 30<br>❖If pattern.compile(‘^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.<br>[a-zA-Z]{2,}$’).notMatch([email]) then returns 400-<br>BAD_REQUEST error with error message MSG31.<br>❖If [phoneNumber] exists in the system then the system<br>shows an error message MSG 26.<br>❖If [email] exists in the system then the system shows an<br>error message MSG 27.<br>❖[user] = User Repository save new user with all data<br>(call save() function)<br>❖[user.status] = ‘INACTIVE’<br>❖The system will show a success message MSG 28.<br>❖Send verify email as**Email Templates**below,<br>❖**Email Templates:**<br>❖Send mail to user register account as the template<br>below**:**<br>From<br>techmarket@gmail.com<br>To<br>[email]<br>Cc<br>N/A<br>Subjec<br>t<br>Get [Subject] of “Email Template”<br>item of which [Keyword] = “Sign Up”<br>Body<br>Get [Body] of “Email Template” item<br>of which[Keyword]= “Sign Up”<br>❖Following is sample email content:<br>Subject<br>"VerifyRegistration Tech Market|
|---|---|---|---|
|||Subject|"VerifyRegistration Tech Market|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||Body|Account"||
|---|---|---|---|---|
||||[Body] = “Hello,”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + “Follow this link<br>to verify your email address to<br>finish your registration step.”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + <<Link to verify<br>email>><br>[Body] = [Body] + "<br>If you didn’t<br>ask to verify this address, you can<br>ignore this email."<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + "<br>Thanks."<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + "The<br>Tech<br>Market team"||
|_(5)_|_BR6_|**Message Rules:**<br>❖The system shows success message MSG 28|||
|_(4)_|_BR7_|**Message Rules:**<br>❖The system shows success message MSG 29|||
|_(6)_|_BR8_|**Redirect Rules:**<br>❖The system redirects to the home page.|||



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

UC3: Forgot Password 

|**Name**|**Forgot Password**|
|---|---|
|**Description**|This use case describes the process by which users reset their<br>password when they forgot it.|
|**Actor**|User|
|**Trigger**|❖When the user clicks on the “Forgot password” button.|
|**Pre-condition**|❖The user is not logged in to the system.<br>❖The user is in the sign in page.|
|**Post-condition**|❖Password has been changed.<br>❖The user is redirected to the home page.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Business Rules** 

|**Activity**|**BR Code**|**Description**|**Description**|
|---|---|---|---|
|_(2)_|_BR9_|**Redirect Rules:**<br>❖The system redirects to the forgot password page (refer to<br>“”Forgot Password Form” in “List description” file).||
|_(4)_|_BR10_|**Validate Rules:**<br>❖The system will receive [email] or [phoneNumber].<br>❖If [email] or [phoneNumber] is null or blank, then return<br>400-BAD_REQUEST error with error message MSG2.<br>❖If pattern.compile(‘^(84|0[3|5|7|8|9])+([0-9]{8})<br>$’).notMatch([phoneNumber]) or then returns 400-<br>BAD_REQUEST error with error message MSG 30<br>❖If pattern.compile(‘^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-<br>zA-Z]{2,}$’).notMatch([email]) then returns 400-<br>BAD_REQUEST error with error message MSG31.<br>❖[user] = User Repository<br>findByPhoneOrEmail([phoneNumber], [email]) (call<br>findByPhoneOrEmail() function)<br>❖If [user] == null then returns 400-BAD_REQUEST error<br>with error message MSG32.||
|_(5)_|_BR11_|**Generate Link Rules:**<br>❖[link.expired_in] = Date.now().plus(10, MINUTES).||
|_(6)_|_BR12_|**Send Link Rules:**<br>**Email Templates:**<br>Send mail to user change password or<br>❖<br>message throughzalo as the template below**:**<br>From<br>techmarket@gmail.com<br>To<br>[user.email]||
|||From<br>To|techmarket@gmail.com|
||||[user.email]|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||||
|---|---|---|---|
|||Cc|N/A|
|||Subjec<br>t|Get [Subject] of “Email Template”<br>item of which [Keyword] = “Forgot<br>Password”|
|||Body|Get [Body] of “Email Template” item<br>of which [Keyword] = “Forgot<br>Password”|
|||Subject|"Reset Password"|
|||Body|[Body] = “Hello,”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + “You have<br>requested to reset the password<br>of your TECH MARKET account.”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + "<br>Please click<br>the link to change your password:<br>"<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + [link]<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + "If you didn’t<br>ask to reset your password, you<br>can ignore this email."|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

||||[Body] = [Body] + "<br>Thanks."<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + "The<br>TechMarket team"||
|---|---|---|---|---|
|_(8)_|_BR13_|**Validate Rules:**<br>❖If [link.expired_in].isAfter(Date,now()) then the system<br>redirects to the Change password page.<br>else the system will show an error message MSG 33.|||
|_(12)_|_BR14_|**Validate Rules:**<br>❖The system will receive [password].<br>❖If [password] is null or blank, then return 400-<br>BAD_REQUEST error with error message MSG2.<br>❖If pattern.compile(“"^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[@#$ %^&+=!])(?=\\S+$).{8,}$"”).notMatch([password]) then the<br>system shows an error message MSG 25.<br>❖If hash([password]) == [user.password] then the system<br>shows an error message MSG 34.<br>else [user.password] = hash([password])|||
|_(14)_|_BR15_|**Redirect rules:**<br>❖The system redirects to the sign in page.|||



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## UC4: Leave a feedback 

|**Name**|**Leave a feedback**|
|---|---|
|**Description**|This use case describes how users can leave feedback.|
|**Actor**|User|
|**Trigger**|❖When the admin clicks on the “Feedback” button.|
|**Pre-condition**|❖The user are access to the TechMarket website|
|**Post-condition**|❖The feedback are created|



## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR Code**|**Description**|
|---|---|---|
|_(2)_|_BR16_|**Feedback Form Rules:**<br>❖The system loads the “Leave a feedback” page (refer to<br>“”Leave Feedback Form” in “List description” file).<br>❖The form includes the following information fields:<br>➢[feedback_category] Feedback category:<br>■<br>Faulty feature<br>■<br>Request new feature<br>■<br>Other<br>➢[comment]|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||➢[proof] ( image/video )|
|---|---|---|
|_(5)_|_BR17_|**Creating Rules:**<br>When the user clicks on “Save”, the system will prompt a<br>confirmation message (Refer to MSG 1). If user chooses<br>Cancel, the system does nothing; else, the system will save<br>inputted information and update the item as the following:<br>❖The system checks the items [feedback_category],<br>[comment]<br>❖If any entries are empty, the system shows an error<br>message MSG 2.<br>❖The feedback will be saved with the items:<br>[feedback_category], [comment], [proof] (can be null ),<br>[status] = PENDING|



## UC5: Create post 

|**Name**|**Create post**|
|---|---|
|**Description**|This use case allows Sellers to create a post that contains their<br>product information.|
|**Actor**|User|
|**Trigger**|❖When the user clicks on the “Create post” button.|
|**Pre-condition**|❖The user is logged in to the system.<br>❖The user is in the create post page.|
|**Post-condition**|❖The posts have been created.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

_Figure 1: Activities Flow_ 

## **Business Rules** 

|**Activity**|**BR Code**|**Description**|
|---|---|---|
|_(2)_|_BR18_|**Loading Screen Rules:**<br>❖The system loads the “Create post” screen (refer to<br>“”Create Post Form” in “List description” file).|
|_(5)_|_BR19_|**Creating Rules:**<br>When the user clicks on “Save”, the system will prompt a<br>confirmation message (Refer to MSG 1). If user chooses<br>Cancel, the system does nothing; else, the system will save<br>inputted information and update the item as the following:<br>❖The client concat values from [province], [district] and<br>[ward] to [area].<br>❖The system checks the items [images], [product], [price],<br>[title], [description], [area].<br>❖If any entries are empty, the system shows an error<br>message MSG 2.<br>❖If size of any in [images] > 8.MB then system shows|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||error message MSG 11<br>❖If [product] does not exist then the system shows error<br>message MSG 12.<br>❖If [price] < 0 then the system shows error message<br>MSG 13.<br>❖If [description].length < 50 then the system shows error<br>message MSG 14.<br>❖[user] = <<current user id retrieved from jwt>><br>❖[createdDate] = <<current date time>><br>❖[status] = ‘CREATED’. When a post is in this state, no one<br>except the owner and Administrator can see and interact<br>with it|
|---|---|---|
|_(6)_|_BR20_|**Message Rules:**<br>❖The system shows success message MSG 3|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## UC6: Update post 

|UC6: Update postpdate postdate postpostost||
|---|---|
|**Name**|**Update post**|
|**Description**|This use case describes how user can update a post|
|**Actor**|User|
|**Trigger**|❖When the user clicks on the “Save” button.|
|**Pre-condition**|❖The user is logged in to the system.<br>❖The user has created this post.<br>❖The user in the edit post page.|
|**Post-condition**|❖The posts have been updated.<br>❖The post is in ‘Waiting’ status|



## **Activities Flow** 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Business Rules** 

|**Activity**|**BR Code**|**Description**|
|---|---|---|
|_(2)_|_BR21_|**Loading Screen Rules:**<br>❖The system loads the “Update post” screen  (refer to<br>“”Update Post Form” in “List description” file).|
|_(5)_|_BR22_|**Validate Rules:**<br>When the user clicks on “Save”, the system will prompt a<br>confirmation message (Refer to MSG 1). If user chooses<br>Cancel, the system does nothing; else, the system will save<br>inputted information and update the item as the following:<br>❖The system checks the items [images], [product], [price],<br>[title], [description], [area].<br>❖If any entries are empty, the system shows an error<br>message MSG 2.<br>❖If size of any in [images] > 8.MB then system shows<br>error message MSG 11<br>❖If [product] does not exist then the system shows error<br>message MSG 12.<br>❖If [price] < 0 then the system shows error message<br>MSG 13.<br>❖If [description].length < 50 then the system shows error<br>message MSG 14.<br>❖[user] = <<current user id retrieved from jwt>><br>❖[updatedDate] = <<current date time>><br>❖[status] = ‘PENDING’. When a post is in this state, no one<br>except the owner and Administrator can see and interact<br>with it|
|_(7)_|_BR23_|**Message Rules**<br>❖The system shows success message MSG 16|
|_(8)_|_BR24_|**Message Rules:**|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

❖ The system shows success message MSG 17 

UC7: Delete post 

|**Name**|**Delete post**|
|---|---|
|**Description**|This use case describes how a user can delete a post.|
|**Actor**|User|
|**Trigger**|❖When the user clicks on the “Delete post” button.|
|**Pre-condition**|❖The user is logged in to the system.<br>❖The user has created this post.<br>❖The user in the edit post page.|
|**Post-condition**|❖The posts have been deleted.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR Code**|**Description**|
|---|---|---|
|_(2)_|_BR25_|**Loading Modal Rules:**<br>❖The system loads the “Delete confirmation” modal.|
|_(4)_|_BR26_|**Checking Rules:**<br>❖If [postId] does not exist, the system shows an error<br>message MSG 18 else [post] = Post Repository find by<br>[postId] (call findById() function)|
|_(5)_|_BR27_|**Delete Rules:**<br>❖If [post.order] == null then Post Repository delete by<br>[post.id] (call deleteById() function) else the system show<br>error message MSG 19|
|_(6)_|_BR28_|**Message Rules:**|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||❖The system shows success message MSG 20|
|---|---|---|
|_(7)_|_BR29_|**Message Rules:**|
|||❖The system shows error message MSG 21|



## UC8: Guarantee payment 

|**Name**|**Guarantee payment**|
|---|---|
|**Description**|This use case describes how users can use guaranteed<br>payment functionality for their posts.|
|**Actor**|Seller|
|**Trigger**|❖When the Seller clicks the button.|
|**Pre-condition**|❖The Seller logs into the system.|
|**Post-condition**|❖The post is updated to the ‘Guarantee’ plan.|



## **Activities Flow** 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(2)_|_BR30_|**Loading Screen Rules:**<br>❖The system loads the post details screen (refer to<br>“Seller/Post Details” in “List description” file).|
|_(5)_|_BR31_|**Check Sales Wallet Rules:**<br>❖If ([user.sales_wallet] != null) then the system return<br>response with status code 200 and show confirm message<br>MSG 1<br>else the system return response with status code 400|
|_(5.1)_|_BR32_|**Update post rules:**<br>❖[post.label] = ‘GUARANTEE’<br>❖The system shows message MSG 43|
|_(5.2)_|_BR33_|**Request link sales wallet Rules:**<br>❖The system shows message MSG 44|



## UC9: Link sales wallet 

|**Name**|**Link sales wallet**|
|---|---|
|**Description**|This use case describes how a user can link to their merchant<br>wallet.|
|**Actor**|Seller|
|**Trigger**|❖When the Seller clicks the “Link sales wallet” button.|
|**Pre-condition**|❖The Seller logs into the system.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Post-condition** ❖ This Seller ‘s sales wallet is activated. ~~SE LULUmUmUUUTTCU~~ **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(2)_|_BR34_|**Loading Screen Rules:**<br>❖The system loads the “Wallet link” screen (refer to “Wallet<br>Link” in “List description” file).|
|_(3)_|_BR35_|**Select wallet Rules:**<br>❖The user chooses one of the following wallets:<br>o<br>Momo|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||`o`<br>Paypoo|
|---|---|---|
|_(7)_|_BR36_|**Phone number verification rules:**<br>❖The system use the abstract API phone validator to verify<br>phone numbers with default country code is ‘VN’<br>❖If [phone] is valid then the abstract API return response<br>contains [valid] = true<br>else the abstract API return response contains [valid] = false|
|_(7.1)_|_BR37_|**Sending OTP Code Rules:**<br>❖The system generate an OTP code to verify user own<br>phone number with [expire] = 60000 ( mean 1 minutes )|
|_(7.2)_|_BR38_|**Message Rules:**<br>❖The system show message MSG 45|
|_(9)_|_BR39_|**Checking OTP Rules:**<br>❖If [OTP_code] is match then the system return response<br>with status code 200<br>❖else the system return response with status code 400|
|_(9.1)_|_BR40_|**Update sales wallet rules:**<br>❖If response.status_code == 200 then<br>[user.sales_wallet] = {<br>“vendor” : <<selected wallet>> (ex: “Momo”),<br>“phone” : <<encrypted phone number>><br>}|
|_(9.2)_|_BR41_|**Message rules:**<br>❖The system show message MSG 46|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

UC10: Use post push service 

|**Name**|**Use post push service**|
|---|---|
|**Description**|This use case describes how a user can use the post push<br>service, increase product sales.|
|**Actor**|Seller|
|**Trigger**|❖When the Seller clicks the 'Push to top’ button.|
|**Pre-condition**|❖The Seller logs into the system.<br>❖The post has been created, approved by Admin and not hidden .|
|**Post-condition**|❖The post is pushed to the top of the page.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

**Activity BR** Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

**Description** 

||**Code**||
|---|---|---|
|_(3)_|_BR42_|**Loading Screen Rules:**<br>❖The system loads the “Post push plan” screen” (refer to<br>“Post Push Plan” in “List description” file).|
|_(4)_|_BR43_|**Post push plan Rules:**<br>❖The system shows service plan list comes with price (for<br>each push):<br>●<br>Now<br>●<br>3 days<br>●<br>7 days|
|_(5)_|_BR44_|**Post push time frame Rules:**<br>❖The system shows service time frame list:<br>●<br>8h00 - 9h00<br>●<br>9h00 - 10h00<br>●<br>10h00 - 11h00<br>●<br>13h00 - 14h00<br>●<br>14h00 - 15h00<br>●<br>15h00 - 16h00<br>●<br>16h00 - 17h00<br>●<br>18h00 - 19h00<br>●<br>19h00 - 20h00<br>●<br>20h00 - 21h00|
|_(7)_|_BR45_|**Loading Screen Rules:**<br>❖The system loads the “Post push checkout” screen (refer to<br>“Post Push Checkout” in “List description” file).|
|_(8)_|_BR46_|**Select payment method Rules:**<br>❖The user selects the following available payment methods:<br>●Cash on delivery (COD)<br>●Payment via visa/mastercard<br>●Payment via Momo e-wallet<br>●Payment via PayPoo<br>●Payment via ZaloPay|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||●Payment via VNPAY<br>●Payment via Paypal payment gateway<br>●Payment via internet banking . A few affiliate banks are<br>available like: ABBank, ACB,AgriBank, Bac A Bank, Bảo<br>Việt Bank, BIDV, Đông á bank, Eximbank, GPBank,<br>HDBank, Liên Việt Bank, MB Bank, Nam Á Bank, NCB,<br>OCB, OCEAN BANK, Sacombank, SCB, SeaBank, SHB,<br>TechcomBank, TPBank, VIB, VietABank, Vietcombank,<br>Vietinbank,VPBank|
|---|---|---|
|_(10)_|_BR47_|**Payment process rules:**<br>When the user clicks on “Pay”, the system will prompt a<br>confirmation message (Refer to MSG 1). If user chooses<br>Cancel, the system does nothing; else, the system will save<br>inputted information and update the item as the following:<br>❖The system checks the items [post_id], [Rules], [Time<br>frames].<br>❖If any entries are empty, the system shows an error<br>message MSG 2.<br>❖[Push Plan.post] = Post repository find by id [post_id]<br>(call findById() function)<br>❖[Push Plan.rules] = [Rules]<br>❖[Push Plan.timeFrames] = [Time frames]<br>❖Save [Push Plan] to database (call save() function)<br>❖The system willprocesspayment like UC14|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

UC11: Confirm sales order 

|**Name**|**Confirm sales order**|
|---|---|
|**Description**|This use case describes how sellers can confirm the order of buyers.|
|**Actor**|Seller|
|**Trigger**|❖When the user clicks on the “Confirm” button.|
|**Pre-condition**|❖The buyer is logged in to the system.<br>❖The user has placed the order successfully.|
|**Post-condition**|❖The order status has been changed to ’CONFIRMED’|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(1)_|_BR48_|**Loading Screen Rules:**<br>❖The system loads the “Order Details” screen (refer to<br>“Seller/Order Details” in the “List description” file).|
|_(7)_|_BR49_|**Confirm rules:**<br>❖The system extract the [orderId] from the request<br>❖If [orderId] == null then the system returns error response<br>with status code 400 BAD_REQUEST<br>❖If  [order] = Order repository find by id ([orderId]) == null<br>then the system returns error responsewithstatus code|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||400 BAD_REQUEST<br>❖If [order.status] != ‘CREATED’ then the systems returns<br>error response with status code 400 BAD_REQUEST<br>❖[order.status] = ‘CONFIRMED’|
|---|---|---|
|_(8)_|_BR50_|**Message rules:**<br>❖The system shows message MSG 40.|
|_(9)_|_BR51_|**Send message rules:**<br>❖The system sends a notification to the buyer’s dialog box<br>according to the following template:<br>❖[Seller name] + ' has successfully confirmed the order with<br>id' + [Order id].|



UC12: Place order 

|**Name**|**Place order**|
|---|---|
|**Description**|This use case allows the Buyer to place orders.|
|**Actor**|Buyer|
|**Trigger**|❖When the user clicks on the “Buy now” button in the post details<br>screen.<br>❖Otherwise, user clicks on “Buy” button in cart screen|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|**Pre-condition**|❖The user is logged in to the system.|
|---|---|
|**Post-condition**|❖The order has been created.<br>❖In case the user chooses to pay online, the payment will be<br>transferred to TechMarket's account for safekeeping.|



## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR Code**|**Description**|
|---|---|---|
|_(2)_|_BR52_|**Loading Screen Rules:**<br>❖The system loads the “Check out” screen (refer to<br>“Checkout” in the “List description” file).|
|_(4.1)_|_BR53_|**Address enter Rules:**|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||❖The user selects an existing address previously saved in<br>the account or enters a new address.<br>❖When the user clicks on “Save”, the system will prompt a<br>confirmation message (Refer to MSG 1). If user chooses<br>Cancel, the system does nothing; else, the system will<br>save inputted information and update the item as the<br>following:|
|---|---|---|
|_(4.2)_|_BR54_|**Consignee information enter Rules:**<br>❖The user enters consignee information, including [Name],<br>[Phone number].<br>❖Additionally, users can confirm information available in<br>the account (if any)<br>❖When the user clicks on “Save”, the system will prompt a<br>confirmation message (Refer to MSG 1). If the user<br>chooses Cancel, the system does nothing; else, the<br>system will save inputted information and update the<br>item.|
|_(4.3)_|_BR55_|**Select payment method Rules:**<br>❖The user selects the following available payment<br>methods:<br>●Cash on delivery (COD)<br>●Payment via visa/mastercard<br>●Payment via Momo e-wallet<br>●Payment via PayPoo<br>●Payment via ZaloPay<br>●Payment via VNPAY<br>●Payment via Paypal payment gateway<br>●Payment via internet banking . A few affiliate banks are<br>available like: ABBank, ACB,AgriBank, Bac A Bank,<br>Bảo Việt Bank, BIDV, Đông á bank, Eximbank,<br>GPBank, HDBank, Liên Việt Bank, MB Bank, Nam Á<br>Bank, NCB, OCB, OCEAN BANK, Sacombank, SCB,<br>SeaBank, SHB, TechcomBank, TPBank, VIB,<br>VietABank,Vietcombank,Vietinbank,VPBank|
|_(6)_|_BR56_|**Check payment method rules:**|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||❖The system checks the payment method the user has<br>chosen.<br>➢If it is an online payment, the user needs to complete<br>thepayment accordingto the regulations states in**BR8**|
|---|---|---|
|_(8)_|_BR57_|**Make payment rules**<br>❖Switch ([paymentMethod])<br>➢case (‘visa/mastercard’) : the following information must<br>be filled in: [card number], [cardholder name], [card<br>opening date] and [CVV number]<br>➢case (‘Paypal’) : they need to enter their account<br>information correctly<br>➢case (‘Momo e-wallet’ || ‘ZaloPay’ || ‘VNPAY’ ||<br>‘PayPoo’ ):  they need to do:<br>- For TechMarket web: Scan the QR code with the<br>Momo/Zalo/VNPAY application on their phone to pay<br>- For TechMarket application on phone: Log in to<br>Momo/Zalo/VNPAY on phone to make payment. The system<br>must navigate to the Momo application and manually create<br>an invoice with the following information: [Order code], [Order<br>value]<br>➢case (‘internet banking’):  they need to enter complete<br>information as required by each bank.|
|_(9.1)_|_BR58_|**Message rules:**<br>❖The system shows message MSG 4|
|_(9.2)_|_BR59_|**Message rules:**<br>❖The system shows message MSG 5|
|_(10)_|_BR60_|**Saving rules:**<br>❖In online payment case, the payment will be transferred to<br>TechMarket's account for safekeeping<br>❖The system creates an order as the Order**template**<br>below.|
|||**Order template**<br>●[orderId] = <<automatic generated>>|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

● [orderPrice] = <<total of price of products, shipping fee>> ● [userId] = <<current user’s id>> ● [deliveryAddress] = <<address that user entered>> ● [paymentMethod] = <<method that user chosen>> ● if ([paymentMethod] = ‘COD’) then [paymentStatus] = ‘unpaid’ else [paymentStatus] = ‘paid’ ● [shipmentStatus] = ‘order successful’ ● [orderStatus] = ‘wait for confirmation’ ● [productList[]] = <<list of product>> 

UC13: Choose shipping address 

|**Name**|**Choose shipping address**|
|---|---|
|**Description**|This use case describes how a user can select an existing<br>address or create a new one.|
|**Actor**|Buyer|
|**Trigger**|❖When the Buyer clicks on the “Choose address” button.|
|**Pre-condition**|❖The Buyer is logged in to the system.<br>❖The Buyer is on the place order page  (refer to “Checkout” in the<br>“List description” file).|
|**Post-condition**|❖The new address is saved.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR Code**|**Description**|
|---|---|---|
|_(2)_|_BR61_|**Loading Dialog Rules:**<br>❖The system shows the address dialog|
|_(4)_|_BR62_|**Loading Dialog Rules:**<br>❖The system shows create address dialog|
|_(5)_|_BR63_|**Fill In Address Rules:**<br>❖The system displays the steps to fill in the address:|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||[province_city] -> [district] -> [ward] -> [details]|
|---|---|---|
|_(7)_|_BR64_|**Creating Rules:**<br>When the user clicks the “Create” button, the system will<br>prompt a confirmation message (Refer to MSG 1). If user<br>chooses Cancel, the system does nothing; else, the system<br>will save inputted information and update the item as the<br>following:<br>❖The system checks the items [province_city], [district],<br>[ward], [details].<br>●<br>If any entries are empty, the system shows an error<br>message MSG 2.<br>❖[address.user] = <<current user id retrieved from jwt>><br>❖[address.createAt] = <<current date time>>|
|_(10)_|_BR65_|**Saving Rules:**<br>❖The currently created order is updated with:<br>●<br>[order.address]= <<chosen address>>|



UC14: Pay 

|**Name**|**Pay**|
|---|---|
|**Description**|This use case describes how users can pay for orders through<br>the payment gateway.|
|**Actor**|Buyer|
|**Trigger**|❖When the user clicks on the “Pay now” button .|
|**Pre-condition**|❖The user is logged in to the system.<br>❖The user is on the checkout page  (refer to “Checkout” in the<br>“List description” file).<br>❖The user has chosen Pay via payment gateway.|
|**Post-condition**|❖The payment has been created for order.<br>❖Money has been transferred to the system.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR Code**|**Description**|
|---|---|---|
|_(4)_|_BR66_|**Creating request rules:**<br>❖The system extracts order information from the request.<br>❖[order] = request.body.order<br>❖Create [paymentRequest]<br>❖[paymentRequest.data] = [oder] to xml<br>❖[paymentRequest.checksum] =<br>SHA512([paymentRequest.data] + [private-key])<br>❖[paymentRequest.method] = request.body.method|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||❖paymentClient.send([paymentRequest])|
|---|---|---|
|_(5)_|_BR67_|**Validate Rules:**<br>❖The system extracts items from [paymentRequest]: [data],<br>[checksum] and [method]<br>❖If any entries are empty, the system shows an error<br>message MSG 2.<br>❖If [checksum] is not valid or [method] is unsupported<br>then the system returns an error response.<br>Else the system saves order information and creates a<br>link for paying this order.|
|_(9)_|_BR68_|**Validate Rules:**<br>❖The system extracts the response from payment service<br>❖If [response.status] == 200 then<br>[order] = Order repository find by id [response.order.id]<br>[payment] = Payment repository creates new payment.<br>[payment.order] = [order]<br>[payment.createdDate] = Date.now()<br>[payment.provider] = corresponding provider<br>[payment.method] = [response.method]<br>[payment.status] = ‘PENDING’<br>return success response with [payment] and payment<br>gateway link [response.link]<br>else the system returns an error message MSG37.|
|_(11)_|_BR69_|**Redirect Rules:**<br>❖The system redirects the user to the link that has been<br>received from thepayment service.|
|_(12)_|_BR70_|**Payment processing rules:**<br>❖The system updates the corresponding payment.<br>➢[payment.status]= ‘PROCESSING’|
|_(14)_|_BR71_|**Update payment success rules**<br>❖The system updates the corresponding payment.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||➢[payment.status]= ‘COMPLETED’|➢[payment.status]= ‘COMPLETED’|
|---|---|---|---|
|_(15)_|_BR72_|**Sending email rules:**<br>❖**Email Templates:**<br>❖Send mail to user after successful order payment:**:**<br>From<br>techmarket@gmail.com<br>To<br>[email]<br>Cc<br>N/A<br>Subjec<br>t<br>Get [Subject] of “Email Template”<br>item of which [Keyword] = “Order<br>Payment Success”<br>Body<br>Get [Body] of “Email Template” item<br>of which [Keyword] = “Order<br>Payment Success”<br>❖Following is a sample email content:<br>Subject<br>"Order Payment Confirmation -<br>Tech Market"<br>Body<br>[Body] = “Hello,”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + “Thank you for<br>your purchase! Your order<br>payment has been successfully<br>processed.”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + “- Order<br>Number: [Order Number]”<br>[Body] = [Body] + “- Payment||
|||Subject|"Order Payment Confirmation -<br>Tech Market"|
|||Body|[Body] = “Hello,”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + “Thank you for<br>your purchase! Your order<br>payment has been successfully<br>processed.”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + “- Order<br>Number: [Order Number]”<br>[Body] = [Body] + “- Payment|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

||||Amount: [Payment Amount]”<br>[Body] = [Body] + “- Payment<br>Method: [Payment Method]”<br>[Body] = [Body] + “Your items will<br>be shipped shortly. You can track<br>your order using the provided<br>tracking details.”<br>[Body] = [Body] + "<br>If you have any<br>questions or concerns, please<br>feel free to contact our customer<br>support."<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + "<br>Thanks for<br>shopping with Tech Market!"<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + "<br>Best regards,"<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + "The<br>Tech<br>Market team"||
|---|---|---|---|---|
|_(16)_|_BR73_|**Message rules:**<br>❖The system shows message MSG 38|||
|_(17)_|_BR74_|**Message rules:**<br>❖The system shows message MSG 39|||



UC15: Cancel order 

|**Name**|**Cancel order**|
|---|---|
|**Description**|This use case describes how a user can cancel an order|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|**Actor**|Buyer|
|---|---|
|**Trigger**|❖When the Buyer clicks the cancel button.|
|**Pre-condition**|❖The Buyer is logged in to the system.<br>❖The user is on the order details page  (refer to “Buyer/Order<br>Details” in the “List description” file).<br>❖The order has been created and is in CREATED status|
|**Post-condition**|❖The order was cancelled successfully.|



## **Activities Flow** 

## **Business Rules** 

|**Activity**<br>**BR Code**|**Description**|
|---|---|
|_(3)_<br>_BR75_|**Message Rules:**|
||❖The system will prompt a confirmation message (Refer to|
|||
|Software Requirements Specification, Version 1.0||
|Prepared by Mr.  Ngo, Mr. Dinh|Prepared by Mr.  Ngo, Mr. Dinh|
|Last modified on 10/09/21 1:00:00 PM||



|||MSG 1). If user chooses Cancel, the system does nothing;|
|---|---|---|
|_(4)_|_BR76_|**Check payment information Rules:**<br>❖The system checks order payment information and is<br>ready to refund within 7 days.<br>❖When the refund is successful, [order.payment_status] =<br>REFUND|
|_(5)_|_BR77_|**Cancelling Rules:**<br>❖[order.status] = CANCEL|



UC16: Confirm delivery of order 

|**Name**|**Confirm delivery of order**|
|---|---|
|**Description**|This use case allows Buyer to confirm delivery of order.|
|**Actor**|Buyer|
|**Trigger**|❖When the user clicks on the “Received” button.|
|**Pre-condition**|❖The user is logged in to the system.<br>❖The user is on the order details page  (refer to “Buyer/Order<br>Details” in the “List description” file).<br>❖The order has been successfully delivered by the shipping unit.|
|**Post-condition**|❖The money is transferred to the seller's account.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(2)_|_BR78_|**Message rules:**<br>❖The system shows message MSG 6|
|_(4)_|_BR79_|**Money transfer rules:**<br>❖Upon successful delivery, payment funds previously kept<br>securely in TechMarket's account will be transferred to the<br>seller's account.|
|_(6)_|_BR80_|**Notification rules:**<br>❖The system sends a notification to the seller's dialog box<br>according to the following template:<br>❖[Buyer name] + ' has successfully confirmed receipt of the<br>order with code ' + [Order code].|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## UC17: Rate seller 

|**Name**|**Rate seller**|
|---|---|
|**Description**|This use case describes how buyer can rate the seller after<br>receiving order|
|**Actor**|Buyer|
|**Trigger**|❖When the user clicks on the “Rate” button.|
|**Pre-condition**|❖The user is logged in to the system.<br>❖The order has been successfully confirmed to be shipped by the<br>shippingunit.|
|**Post-condition**|❖Seller’s rating has been saved.|



## **Activities Flow** 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(2)_|_BR81_|**Loading screen rules:**<br>❖The system loads the Rate page (refer to “Rate Seller<br>Form” in the “List description” file).|
|_(4)_|_BR82_|**Validate rules:**<br>❖The system extracts the rating data from request: [buyerId],<br>[sellerId], [postId], [comment] and [rating]<br>❖If any of them is null or empty then the system returns error<br>message MSG 2.<br>❖[buyer] = User repository find by id [buyerId] (call<br>userRepository.findById() function)<br>❖[seller] = User repository find by id [sellerId] (call<br>userRepository.findById() function)<br>❖[post] = Post repository find by id [postId] (call<br>postRepository.findById() function)<br>❖If [buyer] == null then the system returns error response<br>with status code 400 BAD_REQUEST<br>❖If [seller] == null then the system returns error response<br>with status code 400 BAD_REQUEST<br>❖If [post] == null then the system returns error response with<br>status code 400 BAD_REQUEST|
|_(5)_|_BR83_|**Rate rules:**<br>❖[rate] = Rating repository create new.<br>❖[rate.buyer] = [buyer]<br>❖[rate.seller] = [seller]<br>❖[rate.buyer] = [buyer]<br>❖[rate.rating] = [rating]<br>❖[rate.comment] = [comment]|
|_(6)_|_BR84_|**Message rules:**|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||❖The system shows message MSG 42.|
|---|---|---|
|_(7)_|_BR85_|**Message rules:**<br>❖The system shows message MSG 41.|



## UC18: Chat with seller 

|**Name**|**Chat with seller**|
|---|---|
|**Description**|This use case describes how users can view post and product<br>details.|
|**Actor**|User|
|**Trigger**|❖When the user clicks on the “Chat with seller” button.|
|**Pre-condition**|❖The user is on the post details page (refer to “User/Post Details”<br>in the “List description” file).|
|**Post-condition**|❖The user is redirected to the Chat page.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(2)_|_BR86_|**Redirect Rules:**<br>❖The system loads the Chat page (refer to “Chat” in the “List<br>description” file).|
|_(3)_|_BR87_|**Sending Rules:**<br>❖The system extracts the [sellerId] that the user wants to<br>chat with and [userId] from the request.<br>❖If the socket connection with key [sellerId]-[userId] not<br>exists then [channel] = socket.open()<br>❖The systems extracts [message] from request|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

❖ If the [message] contains impolite words then the system shows error message MSG 35. else [channel].push([message]) 

## UC19: Report post 

|UC19: Reportpost||
|---|---|
|**Name**|**Report post**|
|**Description**|This use case describes how users can report violative posts|
|**Actor**|Buyer|
|**Trigger**|❖When the Buyer clicks the ‘Report’ button.|
|**Pre-condition**|❖The Buyer is logged in to the system.<br>❖The user is on the post details page (refer to “User/Post Details”<br>in the “List description” file).|
|**Post-condition**|❖The report is created and sent to Admin to review.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(3)_|_BR88_|**Loading Dialog Rules:**<br>❖The system loads the “Report list” dialog.|
|_(4)_|_BR89_|**Report Reason List Rules:**<br>❖The system shows the following options:<br>●<br>Cheat<br>●<br>Duplicate|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||●<br>Goods sold<br>●<br>Unable to contact<br>●<br>Information is not factually correct<br>●<br>Counterfeit goods, fake goods<br>●<br>Goods damaged after purchase|
|---|---|---|
|_(5)_|_BR90_|**Fill in contact information rules:**<br>❖The system request user to provide the following<br>information:<br>●<br>[report.phone_number]<br>●<br>[report.email]<br>●<br>[report.description]|
|_(7)_|_BR91_|**Creating Rules:**<br>When the user clicks the “Report” button, the system will<br>prompt a confirmation message (Refer to MSG 1). If user<br>chooses Cancel, the system does nothing; else, the system will<br>save inputted information and update the item as the following:<br>❖The system check the following items :<br>[report.phone_number], [report.email], [report.reason],<br>[report.description]<br>●<br>If any entries are empty, the system shows an error<br>message MSG 2.<br>●<br>If [report.phone_number] is invalid then the system<br>shows message MSG 30<br>●<br>If [report.email] is invalid then the system shows<br>message MSG 31|
|_(8)_|_BR92_|**Message Rules:**<br>❖The system shows message MSG 47|



## UC20: Create category 

|**Name**|**Create category**|
|---|---|
|**Description**|This use case describes how users can create new categories<br>for the system|
|**Actor**|Admin|
|**Trigger**|❖When the Admin clicks the “Create” button.|
|**Pre-condition**|❖The Admin is logged in to the system.<br>❖The admin accessed the category screen.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Post-condition** ❖ The new category is created. ~~SLU~~ **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(2)_|_BR93_|**Loading Screen Rules:**<br>❖The system loads the “Create category” screen (refer to<br>“Create Category” in the “List description” file).|
|_(3)_|_BR94_|**Fill In Category Rules:**<br>❖The system request user to fill in the following information:<br>●<br>[category.name]<br>●<br>[category.description]<br>●<br>[category.brands] = [ {|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||‘name’:<br>‘logo’:<br>}  ]|
|---|---|---|
|_(5)_|_BR95_|**Checking Category Rules:**<br>When the user clicks the “Create” button, the system will<br>prompt a confirmation message (Refer to MSG 1). If user<br>chooses Cancel, the system does nothing; else, the system will<br>save inputted information and update the item as the following:<br>❖The system check the following items : [category.name],<br>[category.description],[category.brands]<br>●<br>If any entries are empty, the system shows an error<br>message MSG 2.<br>●<br>If [category.name] is already exist then the system return<br>response with status code 400<br>else  the system return response with status code 200|
|_(5.1)_|_BR96_|**Saving Rules:**<br>❖The system save the new category with the following<br>entries:<br>❖[category.name]<br>❖[category.description]<br>❖[category.brands] = [{<br>‘name’:<br>‘logo’:<br>} ]|
|_(5.2)_|_BR97_|**Message Rules:**<br>❖The system shows message MSG 49|
|_(6)_|_BR98_|**Message Rules:**<br>❖The system shows message MSG 48|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

UC21: Update category 

|**Name**|**Update category**|
|---|---|
|**Description**|This use case describes how a user can change the category<br>information|
|**Actor**|Admin|
|**Trigger**|❖When the Admin clicks the “Edit” button.|
|**Pre-condition**|❖The Admin is logged in to the system.<br>❖The admin accessed the category screen.|
|**Post-condition**|❖The category is updated.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(2)_|_BR99_|**Loading Screen Rules:**<br>❖The system loads the “Category details” screen.|
|_(4)_|_BR100_|**Loading Screen Rules:**<br>❖The system loads the “Category edit” screen.|
|_(7)_|_BR101_|**Checking Category Rules:**<br>When the user clicks the “Save” button, the system will<br>prompt a confirmation message (RefertoMSG1). Ifuser|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||chooses Cancel, the system does nothing; else, the system will<br>save inputted information and update the item as the following:<br>❖The system check the following items : [category.name],<br>[category.description],[category.brands]<br>●<br>If any entries are empty, the system shows an error<br>message MSG 2.<br>●<br>If [category.name] is already exist then the system return<br>response with status code 400<br>else  the system return response with status code 200|
|---|---|---|
|_(7.1)_|_BR102_|**Saving Rules:**<br>❖The system save the new category with the following<br>entries:<br>❖[category.name]<br>❖[category.description]<br>❖[category.brands] = [{<br>‘name’:<br>‘logo’:<br>} ]|
|_(7.2)_|_BR103_|**Message Rules:**<br>❖The system shows message MSG 49|
|_(8)_|_BR104_|**Message Rules:**<br>❖The system shows message MSG 50|



## UC22: Delete category 

|**Name**|**Report post**|
|---|---|
|**Description**|This use case describes how a user can delete a category|
|**Actor**|Admin|
|**Trigger**|❖When the Admin clicks the “Delete” button.|
|**Pre-condition**|❖The Admin is logged in to the system.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

||❖The Admin accessed the category screen.|
|---|---|
|**Post-condition**|❖The categories are deleted.|
|**Activities Flow**||



## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(3)_|_BR105_|**Loading Screen Rules:**<br>❖The system shows message MSG 51|
|_(5)_|_BR106_|**Changing Rules:**<br>For each selected categories:<br>❖[postRepository].findAllByCategory([selectedCategory])<br>❖for each post found: [post.category] =<br>[categoryRepository].findByName(‘other’)|
|_(6)_|_BR107_|**Deleting Rules:**<br>For each selected categories:<br>❖If( [categoryRepository].existById([selectedCategory.id])==|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

true ) then [categoryRepository].deleteById([selectedCategory]) else the system returns a response with status code 400 and shows message MSG 49 

## UC23: Approve post 

|**Name**|**Approve post**|
|---|---|
|**Description**|This use case allows the Administrator to approve the user's<br>post.|
|**Actor**|Administrator|
|**Trigger**|❖When the Administrator clicks on the “Approve” button.|
|**Pre-condition**|❖The Administrator is logged in to the system with ‘Admin’<br>permission.|
|**Post-condition**|❖The post is approved and visible to all users.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(2)_|_BR108_|**Loading Screen Rules:**<br>❖The system loads the “Post details” screen (refer to<br>“Admin/Post Details” in the “List description” file).|
|_(4)_|_BR109_|**Message Rules:**<br>❖The system shows message MSG 7|
|_(5)_|_BR110_|**Approving rules:**|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||❖If the current user is not ADMIN then the system shows<br>error message MSG 15.<br>❖The system will update the item as the following:<br>➢[status]= APPROVED|
|---|---|---|
|_(6)_|_BR111_|**Message Rules:**<br>❖The system shows message MSG 8|



UC24: Reject post 

|UC24: Rejectpost||
|---|---|
|**Name**|**Reject post**|
|**Description**|This use case allows the Administrator to reject the user's post.|
|**Actor**|Administrator|
|**Trigger**|❖When the Administrator clicks on the “Reject” button.|
|**Pre-condition**|❖The Administrator is logged in to the system with ‘Admin’<br>permission.|
|**Post-condition**|❖The post is rejected and deleted.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

_Figure 1: Activities Flow_ 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(2)_|_BR112_|**Loading Screen Rules:**<br>❖The system loads the “Post details” screen (refer to<br>“Admin/Post Details” in the “List description” file).|
|_(4)_|_BR113_|**Message Rules:**<br>❖The system shows message MSG 9|
|_(5)_|_BR114_|**Notification Rules:**<br>❖The system sends a notification to the seller's dialog box<br>according to the following template:<br>❖‘Your post with the title’+ [Name] + ‘has been approved by<br>the Administrator. \nNow everyone can see your posts.’|
|_(7)_|_BR115_|**Message Rules:**<br>❖The system shows message MSG 10|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## UC25: Ban account 

|UC25: Ban account||
|---|---|
|**Name**|**Ban account**|
|**Description**|This use case describes how a user can ban a user account that<br>violates website’s regulations|
|**Actor**|Admin|
|**Trigger**|❖When the Admin clicks the “Ban” button.|
|**Pre-condition**|❖The Admin is logged in to the system.<br>❖The Admin accessed the user screen.<br>❖The user account has been reported in violation.|
|**Post-condition**|❖The user account is banned.|



## **Activities Flow** 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|**Description**|
|---|---|---|---|
|_(2)_|_BR116_|**Loading Screen Rules:**<br>❖The system loads the “Report details” screen||
|_(4)_|_BR117_|**Changing Rules:**<br>❖[user.status] = VIOLATE||
|_(5)_|_BR118_|**Sending email rules:**<br>❖**Email Templates:**<br>❖Send mail to user after approve their report:<br>From<br>techmarket@gmail.com<br>To<br>[user.email]<br>Cc<br>N/A<br>Subject<br>Get [Subject] of “Email Template”<br>item of which [Keyword] = “Your<br>report has been approved”<br>Body<br>Get [Body] of “Email Template” item<br>of which [Keyword] = “Your report<br>has been approved”<br>❖Following is a sample email content:<br>Subject<br>"Your report has been approved -<br>Tech Market"<br>Body<br>[Body] = “Hello,”<br>[Body] = [Body] + 2 new lines||
|||Subject|"Your report has been approved -<br>Tech Market"|
|||Body|[Body] = “Hello,”<br>[Body] = [Body] + 2 new lines|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

||||[Body] = [Body] + “Thanks for<br>your report on the post<br>[post.title]!”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + “We have<br>reviewed and confirmed the user<br>[user.username] violated our<br>rules. Posts by this person will be<br>taken down.”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + "<br>Thank you for<br>your cooperation. Hope you<br>continue to accompany us.”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + "<br>Best regards,"<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + "The<br>Tech<br>Market team"||
|---|---|---|---|---|
|_(8)_|_BR119_|**Ban Rules:**<br>❖[user.status] = BANNED|||
|_(9)_|_BR120_|**Sending email rules:**<br>❖**Email Templates:**<br>❖Send mail to user after change their account status**:**<br>From<br>techmarket@gmail.com<br>To<br>[user.email]<br>Cc<br>N/A|||
|||From|techmarket@gmail.com||
|||To|[user.email]||
|||Cc|N/A||



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||||
|---|---|---|---|
|||Subject|Get [Subject] of “Email Template”<br>item of which [Keyword] = “Account<br>violates regulations”|
|||Body|Get [Body] of “Email Template” item<br>of which [Keyword] = “Account<br>violates regulations”|
|||Subject|"Account violates regulations - Tech<br>Market"|
|||Body|[Body] = “Hello,”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + “We found that<br>your account violates our posting<br>rules.”<br>[Body] = [Body] + 2 new lines<br>[Body] = [Body] + “Report<br>Details:”<br>[Body] = [Body] + 1 new lines<br>[Body] = [Body] + “- Reason:<br>[report.reason]”<br>[Body] = [Body] + “- Details:<br>[report.description]”<br>[Body] = [Body] + "<br>If you have any<br>questions or concerns, please<br>feel free to contact our customer<br>support."|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|[Body] = [Body] + 2 new lines|
|---|
|[Body] = [Body] + "<br>Thank you for|
|using our service!"|
|[Body] = [Body] + 2 new lines|
|[Body] = [Body] + "<br>Best regards,"|
|[Body] = [Body] + 2 new lines|
|[Body] = [Body] + "The<br>Tech|
|Market team"|



## UC26: Manage TechMarket bank account 

|**Name**|**Manage TechMarket bank account**|
|---|---|
|**Description**|This use case describes how a user can manage a client's<br>trading currency storage account.|
|**Actor**|Admin|
|**Trigger**|❖When the Admin wants to change TechMarket bank account.|
|**Pre-condition**|❖The Admin is logged in to the system.<br>❖The Admin accessed the bank account screen.|
|**Post-condition**|❖The bank account is changed.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(2)_|_BR121_|**Loading Screen Rules:**<br>❖The system loads the “Bank account details” screen|
|_(3)_|_BR122_|**Bank Rules:**<br>❖Change the following entries:<br>●<br>[Bank] - select in a bank list<br>●<br>[Account_number]|
|_(5)_|_BR123_|**Validating rules:**<br>❖Verify account information with the selected bank.|
|_(5.1)_|_BR124_|**Saving Rules:**|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|||❖[bankAccount] = {<br>‘bank’ : <<selected bank>>,<br>‘account_number’: <<entered number>><br>}|
|---|---|---|
|_(5.2)_|_BR125_|**Message Rules:**<br>❖The system shows message MSG 53|
|_(6)_|_BR126_|**Message Rules:**<br>❖The system shows message MSG 52|



UC27: Update legal documents 

|UC27: Update legal|documents|
|---|---|
|**Name**|**Update legal documents**|
|**Description**|This use case describes how users can update legal documents<br>related to a publicly available website.|
|**Actor**|Admin|
|**Trigger**|❖When the Admin wants to change legal documents.|
|**Pre-condition**|❖The Admin is logged in to the system.<br>❖The Admin accessed the legal document screen.|
|**Post-condition**|❖The documents are changed.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(3)_|_BR127_|**Opening File Rules:**<br>❖Require the following file types: .doc, .docx, .pdf.|
|_(8)_|_BR128_|**Saving Rules:**<br>❖Replace document with the file you just uploaded.|
|_(9)_|_BR129_|**Message Rules:**<br>❖The system shows message MSG 54|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

UC28: Update information for the help center 

|**Name**|**Update information for the help center**|
|---|---|
|**Description**|This use case describes how users can update content and<br>questions for the help center.|
|**Actor**|Customer Care Department|
|**Trigger**|❖When the Customer Care Department wants to update the help<br>center.|
|**Pre-condition**|❖The Customer Care Department is logged in to the system.<br>❖The Customer Care Department accessed the document screen.|
|**Post-condition**|❖The documents are changed.|



## **Activities Flow** 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(4)_|_BR130_|**Opening File Rules:**<br>❖Require the following file types: .doc, .docx, .pdf.|
|_(9)_|_BR131_|**Saving Rules:**<br>❖If the user makes a change then replace the document with<br>the file you just uploaded.<br>❖If the user makes an addition then the file you just<br>uploaded will be saved.|
|_(10)_|_BR132_|**Message Rules:**<br>❖The system shows message MSG 54|



## UC29: Handle feedback from user 

|**Name**|**Handle feedback from user**|
|---|---|
|**Description**|This use case describes how users can view and respond to<br>customer feedback.|
|**Actor**|Customer Care Department|
|**Trigger**|❖When the Customer Care Department wants to handle user<br>feedback.|
|**Pre-condition**|❖The Customer Care Department is logged in to the system.<br>❖The Customer Care Department accessed the feedback screen.|
|**Post-condition**|❖The feedback is handled.|



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## **Activities Flow** 

## **Business Rules** 

|**Activity**|**BR**<br>**Code**|**Description**|
|---|---|---|
|_(2)_|_BR133_|**Loading Screen Rules:**<br>❖The system shows the “Feedback details” screen.|
|_(3)_|_BR134_|**Handling Rules:**<br>❖Users need to carefully consider feedback before clicking<br>the ‘Handle’ button|
|_(4)_|_BR135_|**Changing Rules:**<br>❖[feedback.status] = HANDLED|
|_(5)_|_BR136_|**Message Rules:**<br>❖The system shows message MSG 55|



## **2.2. List Description** 

## TechMarket List Description.xlsx 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

TechMarket List View.xlsx 

## **2.3. View Description** 

## **3. Non-functional Requirements** 

## **3.1. User Access and Security** 

|**Actor**<br>**Function**|**Admin**|**User**|**Buyer**|**Seller**|**Customer Care**<br>**Department**|
|---|---|---|---|---|---|
|Sign In|x|x||||
|Sign Up||x||||
|Forgot password||x||||
|Leave a feedback||x|x|||
|Create post||x||||
|Update post||x||||
|Delete post||x||||
|Guarantee payment||||x||
|Link sales wallet||||x||
|Use post push service||||x||
|Confirm sales order||||x||
|Place order|||x|||
|Choose shipping<br>address|||x|||
|Pay|||x|||
|Cancel order|||x|||
|Confirm delivery of<br>order|||x|||
|Rate seller|||x|||
|Chat with seller|||x|||
|Report post|||x|||
|Create category|x|||||
|Update category name|x|||||
|Delete category|x|||||
|Approve post|x|||||
|Reject post|x|||||
|Ban account|x|||||
|Manage TechMarket<br>bank account|x|||||
|Update legal<br>documents|x|||||



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|Update information for<br>the help centre|||||x|
|---|---|---|---|---|---|
|Handle feedback from<br>user|||||x|



- X: User has full permission to do the action. 

## **3.2. Performance Requirements Number of user** 

- ❖ Number of concurrent user: 150 

- ❖ Number of business user: 600 - 700 

## **Data volume** 

- ❖ Number of documents: 6M – 8M file size 

- ❖ Data growth rate: 5MB/ day 

## **Level of availability** 

- ❖ 95%: Effective system management (assessed according to IBM standards, continuous operating time per year is no more than 18.25 days). 

## **Usage frequency** 

- ❖ The system is used regularly, every hour there will be data exchanged between businesses and their supply partners. Therefore, the system needs to be set up on a server capable of operating throughout business hours. Upgrades, maintenance, and repairs only take place after hours. 

## **3.3. Implementation Requirements Location** 

Ho Chi Minh city 

## **Read-only Duration** 

1 day 

## **Read-only Timeframe** 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

## 0:00 

## **Maintenance Window** 

Every week on Sunday evening at 11 p.m., lasting 1 to 2 hours. During this time, programmers can take advantage of it to edit and update new code 

## **Overall conversion timeline** 

1st, 15th and 25th of every month 

## **4. Appendixes** 

## Glossary 

The list below contains all the necessary terms to interpret the document, including acronyms and abbreviations. 

|**Term**|**Description**|
|---|---|
|_BR_|**B**usiness**R**ule|
|_CBR_|**C**ommon**B**usiness**R**ule|
|_DB_|Notes**D**ata**b**ase|
|_MSG_|**M**es**s**a**g**e|
|_UC_|**U**se**C**ase|
|_N/A_|**N**ot**A**vailable or**N**ot**A**pplicable, used to indicate when information<br>in a certain section could not be provided because it does not apply to<br>this application.|
|_UI_|**U**ser**I**nterface|
|_SRS_|**S**oftware**R**equirements**S**pecification|
|_TBD_|**T**o**b**e**d**etermined or**t**o**b**e**d**efined|



## Messages 

This section describes the details of messages used in business rules e.g. error messages, confirmation messages, etc. 

|**Message Code**|**Message Content**|**Button**|
|---|---|---|
|MSG 1|Are you certain with this decision?|OK/Cancel|
|MSG 2|You need to fill in all fields||



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|MSG 3|Your post is ready to publish. Waiting for the<br>Administrator.||
|---|---|---|
|MSG 4|Payment failed. Please check your account.||
|MSG 5|Payment success.||
|MSG 6|Are you sure you have received your order?|OK/Cancel|
|MSG 7|Are you certain to approve this post?||
|MSG 8|Approve successful||
|MSG 9|Are you certain to reject this post?||
|MSG 10|Reject successful||
|MSG 11|File size is too large||
|MSG 12|Product does not exist||
|MSG 13|Price can not be less than 0||
|MSG 14|Description must contain at least 50 characters||
|MSG 15|You don’t have permission||
|MSG 16|Your post has been updated. Waiting for the<br>administrator's approval.||
|MSG 17|Update post failed.||
|MSG 18|The post does not exist.||
|MSG 19|Can not delete the post that has been purchased.||
|MSG 20|Delete post successfully.||
|MSG 21|Delete post failed.||
|MSG 22|Username or password is incorrect.||
|MSG 23|Logged in successfully.||
|MSG 24|Username must contain at least 8 characters.||
|MSG 25|Invalid password||
|MSG 26|Phone number has been used.||
|MSG 27|Email has been used.||
|MSG 28|Successfully registered.||
|MSG 29|Phone/email already exists.||
|MSG 30|Invalid phone number.||



Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

|MSG 31|Invalid email||
|---|---|---|
|MSG 32|User not found.||
|MSG 33|Invalid verification link.||
|MSG 34|Must not be the same as the old password||
|MSG 35|The post does not exist.||
|MSG 36|The message contains impolite words.||
|MSG 37|Invalid payment information.||
|MSG 38|Payment success.||
|MSG 39|Payment failed.||
|MSG 40|Confirm order successfully.||
|MSG 41|Rating buyer failed.||
|MSG 42|Thanks for your rating.||
|MSG 43|This post has been updated with 'Guarantee Payment'||
|MSG 44|You need to link to your sales wallet first!|Link/<br>Cancel|
|MSG 45|Phone number is not valid||
|MSG 46|OTP is incorrect||
|MSG 47|Thank you for your report. We will review and send<br>the verification results to the email you provide.||
|MSG 48|Your new category has been created.||
|MSG 49|The category name already exists||
|MSG 50|Category update successful||
|MSG 51|ALERT. Do you want to delete these categories? This<br>action can not be undone.|OK/<br>Cancel|
|MSG 52|Account change successful||
|MSG 53|This account is Invalid.||
|MSG 54|Document was updated successfully.||
|MSG 55|Handle feedback successful||



Issues List 

## N/A 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

Software Requirements Specification, Version 1.0 Prepared by Mr.  Ngo, Mr. Dinh Last modified on 10/09/21 1:00:00 PM 

