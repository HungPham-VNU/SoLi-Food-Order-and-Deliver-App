SEI “Views and Beyond” Architecture Documentation Template 05 February 2006

# **<Insert OrganizationName>** <Insert Project Name> Software Architecture Document (SAD)

#### **CONTENT OWNER: <Insert Name>**


**DOCUMENT NUMBER:** **RELEASE/REVISION:** **RELEASE/REVISION DATE:**

 - - 
 - - 
 - - 
 - - 
 - - 
 - - 

All future revisions to this document shall be approved by the content owner prior to release.


Template 02November2004




<Insert OrganizationName> <Insert OrganizationName>

## **Table of Contents**


**1** **Documentation Roadmap.................................................................................3**


**1.1** **Document Management and Configuration Control Information. .3**


**1.2** **Purpose and Scope of the SAD.........................................................4**


**1.3** **How the SAD Is Organized................................................................6**


**1.4** **Stakeholder Representation..............................................................6**


**1.5** **Viewpoint Definitions.........................................................................7**


1.5.1<Insert name of viewpoint> Viewpoint Definition.........................................9

1.5.1.1 Abstract.......................................................................10
1.5.1.2 Stakeholders and Their Concerns Addressed............10
1.5.1.3 Elements, Relations, Properties, and Constraints......10
1.5.1.4 Language(s) to Model/Represent Conforming Views.10
1.5.1.5 Applicable Evaluation/Analysis Techniques and
Consistency/Completeness Criteria..........................................10
1.5.1.6 Viewpoint Source........................................................10


**1.6** **How a View is Documented.............................................................10**


**1.7** **Relationship to Other SADs............................................................12**


**1.8** **Process for Updating this SAD.......................................................12**


**2** **Architecture Background................................................................................13**


**2.1** **Problem Background.......................................................................13**


2.1.1System Overview.......................................................................................13


2.1.2Goals and Context.....................................................................................13


2.1.3Significant Driving Requirements...............................................................13


**2.2** **Solution Background.......................................................................13**


2.2.1Architectural Approaches...........................................................................14


last saved: Sunday, May 17, 2026 i


<Insert OrganizationName> <Insert OrganizationName>


2.2.2Analysis Results.........................................................................................14


2.2.3Requirements Coverage............................................................................14


2.2.4Summary of Background Changes Reflected in Current Version..............14


**2.3** **Product Line Reuse Considerations...............................................14**


**3** **Views.................................................................................................................15**


**3.1** **<Insert view name> View.................................................................16**


3.1.1View Description........................................................................................16


3.1.2View Packet Overview...............................................................................16


3.1.3Architecture Background...........................................................................17


3.1.4Variability Mechanisms..............................................................................17


3.1.5View Packets.............................................................................................17

3.1.5.1 View packet # j............................................................17

3.1.5.1.1 Primary Presentation..................................................................17

3.1.5.1.2 Element Catalog.........................................................................17

3.1.5.1.3 Context Diagram.........................................................................17

3.1.5.1.4 Variability Mechanisms...............................................................17

3.1.5.1.5 Architecture Background.............................................................17

3.1.5.1.6 Related View Packets.................................................................17


**4** **Relations Among Views..................................................................................18**


**4.1** **General Relations Among Views.....................................................18**


**4.2** **View-to-View Relations....................................................................18**


**5** **Referenced Materials.......................................................................................19**


**6** **Directory...........................................................................................................20**


**6.1** **Index..................................................................................................20**


**6.2** **Glossary............................................................................................20**


**6.3** **Acronym List.....................................................................................21**


ii last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>


**7** **Sample Figures & Tables................................................................................23**


last saved: Sunday, May 17, 2026 iii


<Insert OrganizationName> <Insert OrganizationName>

## **List of Figures**


Figure 1: Sample Figure..........................................................................................22


last saved: Sunday, May 17, 2026 1


<Insert OrganizationName> <Insert OrganizationName>

## **List of Tables**


Table 1: Stakeholders and Relevant Viewpoints......................................................8


Table 2: Sample Table...........................................................................................22


2 last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>

### **1 Documentation Roadmap**


The Documentation Roadmap should be the first place a new reader of the SAD begins. But for
new and returning readers, it is intended to describe how the SAD is organized so that a reader
with specific interests who does not wish to read the SAD cover-to-cover can find desired
information quickly and directly.


Sub-sections of Section 1 include the following.


  - Section 1.1 (“Document Management and Configuration Control Information”) explains
revision history. This tells you if you’re looking at the correct version of the SAD.


  - Section 1.2 (“Purpose and Scope of the SAD”) explains the purpose and scope of the
SAD, and indicates what information is and is not included. This tells you if the
information you’re seeking is likely to be in this document.


  - Section 1.3 (“How the SAD Is Organized”) explains the information that is found in each
section of the SAD. This tells you what section(s) in this SAD are most likely to contain
the information you seek.


  - Section 1.4 (“Stakeholder Representation”) explains the stakeholders for which the SAD
has been particularly aimed. This tells you how you might use the SAD to do your job.


  - Section 1.5 (“Viewpoint Definitions”) explains the _viewpoints_ (as defined by IEEE
Standard 1471-2000) used in this SAD. For each viewpoint defined in Section 1.5, there
is a corresponding view defined in Section 3 (“Views”). This tells you how the
architectural information has been partitioned, and what views are most likely to contain
the information you seek.


  - Section 1.6 (“How a View is Documented”) explains the standard organization used to
document architectural views in this SAD. This tells you what section within a view you
should read in order to find the information you seek.

#### **1.1 Document Management and Configuration Control** **Information**






- Revision Number: << >>


last saved: Sunday, May 17, 2026 3


<Insert OrganizationName> <Insert OrganizationName>


- Revision Release Date: << _>_ 
- Purpose of Revision: << >>

- Scope of Revision: << _list sections or page numbers that have been revised; provide a_
_summary overview of the differences between this release and the previous one.>>_

#### **1.2 Purpose and Scope of the SAD**





This SAD specifies the software architecture for **<insert scope of SAD>.** All information
regarding the software architecture may be found in this document, although much information is
incorporated by reference to other documents.


**What is software architecture?** The software architecture for a system [1] is the structure or
structures of that system, which comprise software elements, the externally-visible properties of
those elements, and the relationships among them [Bass 2003]. "Externally visible” properties
refers to those assumptions other elements can make of an element, such as its provided services,
performance characteristics, fault handling, shared resource usage, and so on.  This definition
provides the basic litmus test for what information is included in this SAD, and what information
is relegated to downstream documentation.


**Elements and relationships** . The software architecture first and foremost embodies information
about how the elements relate to each other. This means that architecture specifically omits
certain information about elements that does not pertain to their interaction. Thus, a software
architecture is an _abstraction_ of a system that suppresses details of elements that do not affect
how they use, are used by, relate to, or interact with other elements. Elements interact with each
other by means of interfaces that partition details about an element into public and private parts.
Software architecture is concerned with the public side of this division, and that will be
documented in this SAD accordingly. On the other hand, private details of elements—details
having to do solely with internal implementation—are not architectural and will not be
documented in a SAD.


**Multiple structures.** The definition of software architecture makes it clear that systems can and
do comprise more than one structure and that no one structure holds the irrefutable claim to being
the architecture. The neurologist, the orthopedist, the hematologist, and the dermatologist all take
a different perspective on the structure of a human body. Ophthalmologists, cardiologists, and
podiatrists concentrate on subsystems. And the kinesiologist and psychiatrist are concerned with
different aspects of the entire arrangement’s behavior. Although these perspectives are pictured
differently and have very different properties, all are inherently related; together they describe the


1 Here, a system may refer to a system of systems.


4 last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>


architecture of the human body. So it is with software. Modern systems are more than complex
enough to make it difficult to grasp them all at once. Instead, we restrict our attention at any one
moment to one (or a small number) of the software system’s structures. To communicate
meaningfully about an architecture, we must make clear which structure or structures we are
discussing at the moment—which _view_ we are taking of the architecture.  Thus, this SAD follows
the principle that documenting a software architecture is a matter of documenting the relevant
views and then documenting information that applies to more than one view.


For example, all non-trivial software systems are partitioned into implementation units; these
units are given specific responsibilities, and are the basis of work assignments for programming
teams. This kind of element will comprise programs and data that software in other
implementation units can call or access, and programs and data that are private. In large projects,
the elements will almost certainly be subdivided for assignment to sub-teams. This is one kind of
structure often used to describe a system. It is a very static structure, in that it focuses on the way
the system’s functionality is divided up and assigned to implementation teams.


Other structures are much more focused on the way the elements interact with each other at
runtime to carry out the system’s function. Suppose the system is to be built as a set of parallel
processes. The set of processes that will exist at runtime, the programs in the various
implementation units described previously that are strung together sequentially to form each
process, and the synchronization relations among the processes form another kind of structure
often used to describe a system.


None of these structures alone is _the_ architecture, although they all convey architectural
information. The architecture consists of these structures as well as many others. This example
shows that since architecture can comprise more than one kind of structure, there is more than
one kind of element (e.g., implementation unit and processes), more than one kind of interaction
among elements (e.g., subdivision and synchronization), and even more than one context (e.g.,
development time versus runtime). By intention, the definition does not specify what the
architectural elements and relationships are. Is a software element an object? A process? A
library? A database? A commercial product? It can be any of these things and more.


These structures will be represented in the views of the software architecture that are provided in
Section 3.


**Behavior.** Although software architecture tends to focus on structural information, _behavior of_
_each element is part of the software architecture_ insofar as that behavior can be observed or
discerned from the point of view of another element. This behavior is what allows elements to
interact with each other, which is clearly part of the software architecture and will be documented
in the SAD as such. Behavior is documented in the element catalog of each view.


last saved: Sunday, May 17, 2026 5


<Insert OrganizationName> <Insert OrganizationName>

#### **1.3 How the SAD Is Organized**





This SAD is organized into the following sections:


- **Section 1 (“Documentation Roadmap”) provides information about this document and**
**its intended audience** . It provides the roadmap and document overview.  Every reader who
wishes to find information relevant to the software architecture described in this document
should begin by reading Section 1, which describes how the document is organized, which
stakeholder viewpoints are represented, how stakeholders are expected to use it, and where
information may be found.  Section 1 also provides information about the views that are used
by this SAD to communicate the software architecture.

- **Section 2 (“Architecture Background”) explains why the architecture is what it is.** It
provides a system overview, establishing the context and goals for the development. It
describes the background and rationale for the software architecture. It explains the
constraints and influences that led to the current architecture, and it describes the major
architectural approaches that have been utilized in the architecture. It includes information
about evaluation or validation performed on the architecture to provide assurance it meets its
goals.

- **Section 3 (Views”) and Section 4 (“Relations Among Views”) specify the software**
**architecture** .  Views specify elements of software and the relationships between them. A
view corresponds to a viewpoint (see Section 1.5), and is a representation of one or more
structures present in the software (see Section 1.2).

- **Sections 5 (“Referenced Materials”) and 6 (“Directory”) provide reference information**
**for the reader.** Section 5 provides look-up information for documents that are cited
elsewhere in this SAD. Section 6 is a _directory_, which is an index of architectural elements
and relations telling where each one is defined and used in this SAD. The section also
includes a glossary and acronym list.

#### **1.4 Stakeholder Representation**


This section provides a list of the stakeholder roles considered in the development of the
architecture described by this SAD. For each, the section lists the concerns that the stakeholder
has that can be addressed by the information in this SAD.


Each stakeholder of a software system—customer, user, project manager, coder, analyst, tester,
and so on—is concerned with different characteristics of the system that are affected by its
software architecture. For example, the user is concerned that the system is reliable and available
when needed; the customer is concerned that the architecture can be implemented on schedule
and to budget; the manager is worried (in addition to cost and schedule) that the architecture will
allow teams to work largely independently, interacting in disciplined and controlled ways. The
developer is worried about strategies to achieve all of those goals. The security analyst is


6 last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>


concerned that the system will meet its information assurance requirements, and the performance
analyst is similarly concerned with it satisfying real-time deadlines.


This information is represented as a matrix, where the rows list stakeholder roles, the columns list
concerns, and a cell in the matrix contains an indication of how serious the concern is to a
stakeholder in that role. This information is used to motivate the choice of viewpoints chosen in
Section 1.5.








|CONTENTS OF THIS SECTION: The list of stakeholders will be unique for each organization that is developing a<br>SAD. ANSI/IEEE 1471-2000 requires that at least the following stakeholders be considered:<br> Users<br> Acquirers<br> Developers<br> Maintainers.<br>You may wish to consider the following additional stakeholders.|Col2|Col3|
|---|---|---|
|<br>Customer<br><br>Application software developers<br><br>Infrastructure software<br>developers<br><br>End users<br><br>Application system engineers<br><br>Application hardware engineers|<br>Project manager<br><br>Communications engineers<br><br>Chief Engineer/Chief Scientist<br><br>Program management<br><br>System and software integration<br>and test engineers<br><br>Safety engineers and certifiers|<br>External  organizations<br><br>Operational system managers<br><br>Trainers<br><br>Maintainers<br><br>Auditors<br><br>Security engineers and certifiers|


#### **1.5 Viewpoint Definitions**





The SAD employs a stakeholder-focused, multiple view approach to architecture documentation,
as required by ANSI/IEEE 1471-2000, the recommended best practice for documenting the
architecture of software-intensive systems [IEEE 1471].


As described in Section 1.2, a software architecture comprises more than one software structure,
each of which provides an engineering handle on different system qualities. A _view_ is the
specification of one or more of these structures, and documenting a software architecture, then, is
a matter of documenting the relevant views and then documenting information that applies to
more than one view [Clements 2002].


ANSI/IEEE 1471-2000 provides guidance for choosing the best set of views to document, by
bringing stakeholder interests to bear. It prescribes defining a set of viewpoints to satisfy the
stakeholder community. A viewpoint identifies the set of concerns to be addressed, and identifies
the modeling techniques, evaluation techniques, consistency checking techniques, etc., used by


last saved: Sunday, May 17, 2026 7


<Insert OrganizationName> <Insert OrganizationName>


any conforming view. A view, then, is a viewpoint applied to a system. It is a representation of a
set of software elements, their properties, and the relationships among them that conform to a
defining viewpoint. Together, the chosen set of views show the entire architecture and all of its
relevant properties. A SAD contains the viewpoints, relevant views, and information that applies
to more than one view to give a holistic description of the system.


The remainder of Section 1.5 defines the viewpoints used in this SAD. The following table
summarizes the stakeholders in this project and the viewpoints that have been included to address
their concerns.


_Table 1:_ _Stakeholders and Relevant Viewpoints_

|Stakeholder|Viewpoint(s) that apply to that class of<br>stakeholder’s concerns|
|---|---|
|||
|||
|||
|||



8 last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>

##### **1.5.1 <Insert name of viewpoint> Viewpoint Definition**

|Vie|There will be one of these subsections for each viewpoint defined. The subsections are as follows:<br> Abstract: A brief overview of the viewpoint<br> Stakeholders and their concerns addressed: This section describes the stakeholders and their concerns that<br>this viewpoint is intended to address. Listed are questions that can be answered by consulting views that<br>conform to this viewpoint. Optionally, the section includes significant questions that cannot be answered by<br>consulting views conforming to this viewpoint.<br> Elements, relations, properties, and constraints: This section defines the types of elements, the relations<br>among them, the significant properties they exhibit, and the constraints they obey for views conforming to<br>this viewpoint.<br> Language(s) to model/represent conforming views: This section lists the language or languages that will be<br>used to model or represent views conforming to this viewpoint, and cite a definition document for each.<br> Applicable evaluation/analysis techniques and consistency/completeness criteria: This section describes<br>rules for consistency and completeness that apply to views in this viewpoint, as well as any analysis of<br>evaluation techniques that apply to the view that can be used to predict qualities of the system whose<br>architecture is being specified.<br> Viewpoint source: This section provides a citation for the source of this viewpoint definition, if any.<br>Following is an example of a viewpoint definition.<br>1.5.1 Module decomposition viewpoint definition<br>1.5.1.1 Abstract. Views conforming to the module decomposition viewpoint partition the system into a unique<br>non-overlapping set of hierarchically decomposable implementation units (modules).<br>1.5.1.2 Stakeholders and Their Concerns Addressed. Stakeholders and their concerns addressed by this<br>viewpoint include<br> project managers, who must define work assignments, form teams, and formulate project plans and<br>budgets and schedules;<br> COTS specialists, who need to have software elements defined as units of functionality, so they can<br>search the marketplace and perform trade studies to find suitable COTS candidates;<br> testers and integrators who use the modules as their unit of work;<br> configuration management specialists who are in charge of maintaining current and past versions of the<br>elements;<br> system build engineers who use the elements to produce a running version of the system;<br> maintainers, who are tasked with modifying the software elements;<br> implementers, who are required to implement the elements;<br> software architects for those software elements sufficiently large or complex enough to warrant their<br>own software architectures;<br> the customer, who is concerned that projected changes to the system over its lifetime can be made<br>economically by confining the effects of each change to a small number of elements.<br>1.5.1.3 Elements, Relations, Properties, and Constraints. Elements of the module decomposition viewpoint are<br>modules, which are units of implementation that provide defined functionality. Modules are hierarchically<br>decomposable; hence, the relation is “is-part-of.” Properties of elements include their names, the<br>functionality assigned to them (including a statement of the quality attributes associated with that<br>functionality), and their software-to-software interfaces. The module properties may include requirements<br>allocation, supporting requirements traceability.<br>1.5.1.4 Language(s) to Model/Represent Conforming Views. Views conforming to the module decomposition<br>viewpoint may be represented by (a) plain text using indentation or outline form [Clements 2002]; (b) UML,<br>using subsystems or classes to represent elements and “is part of” or nesting to represent the decomposition<br>relation.<br>1.5.1.5 Applicable Evaluation/Analysis Techniques and Consistency/Completeness Criteria.<br>Completeness/consistency criteria include (a) no element has more than one parent; (b) major functionality<br>is provided for by exactly one element; (c) the union of all elements’ functionality covers the requirements for<br>the system; (d) every piece of source code can be mapped to an element in the module decomposition view<br>(if not, the view is not complete); (e) the selection of module aligns with current and proposed procurement<br>decisions. Additional consistency/completeness criteria apply to the specifications of the elements’<br>interfaces. Applicable evaluation/analysis techniques include (a) scenario-based evaluation techniques such<br>as ATAM [Clements 2001] to assure that projected changes are supported economically by the|
|---|---|
|||



last saved: Sunday, May 17, 2026 9


<Insert OrganizationName> <Insert OrganizationName>



**1.5.1.1** **Abstract**


**1.5.1.2** **Stakeholders and Their Concerns Addressed**


**1.5.1.3** **Elements, Relations, Properties, and Constraints**


**1.5.1.4** **Language(s) to Model/Represent Conforming Views**


**1.5.1.5** **Applicable Evaluation/Analysis Techniques and**
**Consistency/Completeness Criteria**


**1.5.1.6** **Viewpoint Source**

#### **1.6 How a View is Documented**







10 last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>


Section 3 of this SAD contains one view for each viewpoint listed in Section 1.5. Each view is
documented as a set of view packets. A view packet is the smallest bundle of architectural
documentation that might be given to an individual stakeholder.


Each view is documented as follows, where the letter _i_ stands for the number of the view: 1, 2,
etc.:


- Section 3.i: Name of view.

- Section 3.i.1: View description. This section describes the purpose and contents of the view.
It should refer to (and match) the viewpoint description in Section 1.5 to which this view
conforms.

- Section 3.i.2: View packet overview. This section shows the set of view packets in this view,
and provides rationale that explains why the chosen set is complete and non-duplicative. The
set of view packets may be listed textually, or shown graphically in terms of how they
partition the entire architecture being shown in the view.

- Section 3.i.3: Architecture background. Whereas the architecture background of Section 2
pertains to those constraints and decisions whose scope is the entire architecture, this section
provides any architecture background (including significant driving requirements, design
approaches, patterns, analysis results, and requirements coverage) that applies to this view.

- Section 3.i.4: Variability mechanisms. This section describes any architectural variability
mechanisms (e.g., adaptation data, compile-time parameters, variable replication, and so
forth) described by this view, including a description of how and when those mechanisms
may be exercised and any constraints on their use.

- Section 3.i.5: View packets. This section presents all of the view packets given for this view.
Each view packet is described using the following outline, where the letter _j_ stands for the
number of the view packet being described: 1, 2, etc.

 Section 3.i.5.j: View packet #j.
 Section 3.i.5.j.1: Primary presentation. This section presents the elements and the
relations among them that populate this view packet, using an appropriate language,
languages, notation, or tool-based representation.
 Section 3.i.5.j.2: Element catalog. Whereas the primary presentation shows the important
elements and relations of the view packet, this section provides additional information
needed to complete the architectural picture.  It consists of the following subsections:
 Section 3.i.5.j.2.1: Elements. This section describes each element shown in the
primary presentation, details its responsibilities of each element, and specifies values
of the elements’ relevant _properties_, which are defined in the viewpoint to which this
view conforms.
 Section 3.i.5.j.2.2: Relations. This section describes any additional relations among
elements shown in the primary presentation, or specializations or restrictions on the
relations shown in the primary presentation.
 Section 3.i.5.j.2.3: Interfaces. This section specifies the software interfaces to any
elements shown in the primary presentation that must be visible to other elements.
 Section 3.i.5.j.2.4: Behavior. This section specifies any significant behavior of
elements or groups of interacting elements shown in the primary presentation.


last saved: Sunday, May 17, 2026 11


<Insert OrganizationName> <Insert OrganizationName>


 Section 3.i.5.j.2.5: Constraints: This section lists any constraints on elements or
relations not otherwise described.
 Section 3.i.5.j.3: Context diagram. This section provides a context diagram showing the
context of the part of the system represented by this view packet. It also designates the
view packet’s scope with a distinguished symbol, and shows interactions with external
entities in the vocabulary of the view.
 Section 3.i.5.j.4: Variability mechanisms.  This section describes any variabilities that are
available in the portion of the system shown in the view packet, along with how and
when those mechanisms may be exercised.
 Section 3.i.5.j.5: Architecture background. This section provides rationale for any
significant design decisions whose scope is limited to this view packet.
 Section 3.i.5.j.6: Relation to other view packets. This section provides references for
related view packets, including the parent, children, and siblings of this view packet.
Related view packets may be in the same view or in different views.

#### **1.7 Relationship to Other SADs**


#### **1.8 Process for Updating this SAD**





12 last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>

### **2 Architecture Background**

#### **2.1 Problem Background**




##### **2.1.1 System Overview**




##### **2.1.2 Goals and Context**




##### **2.1.3 Significant Driving Requirements**




#### **2.2 Solution Background**





SMSM Quality Attribute Workshop and QAW and Architecture Tradeoff Analysis Method and ATAM are

service marks of Carnegie Mellon University.


last saved: Sunday, May 17, 2026 13


<Insert OrganizationName> <Insert OrganizationName>

##### **2.2.1 Architectural Approaches**




##### **2.2.2 Analysis Results**




##### **2.2.3 Requirements Coverage**




##### **2.2.4 Summary of Background Changes Reflected in Current Version**




#### **2.3 Product Line Reuse Considerations**





14 last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>

### **3 Views**





This section contains the views of the software architecture. A view is a representation of a whole
system from the perspective of a related set of concerns [IEEE 1471]. Concretely, a view shows a
particular type of software architectural elements that occur in a system, their properties, and the
relations among them. A view conforms to a defining viewpoint.


Architectural views can be divided into three groups, depending on the broad nature of the
elements they show. These are:


  - Module views. Here, the elements are modules, which are units of implementation.
Modules represent a code-based way of considering the system. Modules are assigned
areas of functional responsibility, and are assigned to teams for implementation. There is
less emphasis on how the resulting software manifests itself at runtime. Module
structures allow us to answer questions such as: What is the primary functional
responsibility assigned to each module? What other software elements is a module
allowed to use? What other software does it actually use? What modules are related to
other modules by generalization or specialization (i.e., inheritance) relationships?


  - Component-and-connector views. Here, the elements are runtime components (which are
principal units of computation) and connectors (which are the communication vehicles
among components). Component and connector structures help answer questions such as:
What are the major executing components and how do they interact? What are the major
shared data stores? Which parts of the system are replicated? How does data progress
through the system? What parts of the system can run in parallel? How can the system’s
structure change as it executes?


  - Allocation views. These views show the relationship between the software elements and
elements in one or more external environments in which the software is created and
executed. Allocation structures answer questions such as: What processor does each
software element execute on? In what files is each element stored during development,
testing, and system building? What is the assignment of the software element to
development teams?


These three kinds of structures correspond to the three broad kinds of decisions that architectural
design involves:


  - How is the system to be structured as a set of code units (modules)


last saved: Sunday, May 17, 2026 15


<Insert OrganizationName> <Insert OrganizationName>


  - How is the system to be structured as a set of elements that have run-time behavior
(components) and interactions (connectors) ?


  - How is the system to relate to non-software structures in its environment (such as CPUs,
file systems, networks, development teams, etc.)?


Often, a view shows information from more than one of these categories.  However, unless
chosen carefully, the information in such a hybrid view can be confusing and not well understood.


The views presented in this SAD are the following:














|Name<br>of view|Viewtype<br>that defines<br>this view|Types of<br>elements and<br>relations shown|Col4|Is this a<br>module<br>view?|Is this a<br>component-and-<br>connector view?|Is this an<br>allocation<br>view?|
|---|---|---|---|---|---|---|
||||||||
||||||||
||||||||
||||||||


#### **3.1 <Insert view name> View**




##### **3.1.1 View Description** **3.1.2 View Packet Overview**

This view has been divided into the following view packets for convenience of presentation:


<<list, table, or diagram>>


16 last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>

##### **3.1.3 Architecture Background** **3.1.4 Variability Mechanisms** **3.1.5 View Packets**





**3.1.5.1** **View packet # j**


3.1.5.1.1 Primary Presentation


3.1.5.1.2 Element Catalog


_3.1.5.1.2.1_ _Elements_


_3.1.5.1.2.2_ _Relations_


_3.1.5.1.2.3_ _Interfaces_


_3.1.5.1.2.4_ _Behavior_


_3.1.5.1.2.5_ _Constraints_


3.1.5.1.3 Context Diagram


3.1.5.1.4 Variability Mechanisms


3.1.5.1.5 Architecture Background


3.1.5.1.6 Related View Packets


last saved: Sunday, May 17, 2026 17


<Insert OrganizationName> <Insert OrganizationName>

### **4 Relations Among Views**


Each of the views specified in Section 3 provides a different perspective and design handle on a
system, and each is valid and useful in its own right. Although the views give different system
perspectives, they are not independent. Elements of one view will be related to elements of other
views, and we need to reason about these relations. For example, a module in a decomposition
view may be manifested as one, part of one, or several components in one of the component-andconnector views, reflecting its runtime alter-ego. In general, mappings between views are many to
many.  Section 4 describes the relations that exist among the views given in Section 3. As
required by ANSI/IEEE 1471-2000, it also describes any known inconsistencies among the views.

#### **4.1 General Relations Among Views**




#### **4.2 View-to-View Relations**





18 last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>

### **5 Referenced Materials**





|Barbacci 2003|Barbacci, M.; Ellison, R.; Lattanze, A.; Stafford, J.; Weinstock,<br>C.; & Wood, W. Quality Attribute Workshops (QAWs), Third<br>Edition (CMU/SEI-2003-TR-016). Pittsburgh, PA: Software<br>Engineering Institute, Carnegie Mellon University, 2003.<br><http://www.sei.cmu.edu/publications/documents/03.reports/03t<br>r016.html>.|
|---|---|
|Bass 2003|Bass, Clements, Kazman,_Software Architecture in Practice,_ <br>second edition, Addison Wesley Longman, 2003.|
|Clements 2001|Clements, Kazman, Klein,_Evaluating Software Architectures:_<br>_Methods and Case Studies,_ Addison Wesley Longman, 2001.|
|Clements 2002|Clements, Bachmann, Bass, Garlan, Ivers, Little, Nord,<br>Stafford,_Documenting Software Architectures: Views and_<br>_Beyond_, Addison Wesley Longman, 2002.|
|IEEE 1471|ANSI/IEEE-1471-2000,_IEEE Recommended Practice for_<br>_Architectural Description of Software-Intensive Systems_, 21<br>September 2000.|


last saved: Sunday, May 17, 2026 19


<Insert OrganizationName> <Insert OrganizationName>

### **6 Directory**

#### **6.1 Index**


#### **6.2 Glossary**





|Term|Definition|
|---|---|
|software architecture|The structure or structures of that system,<br>which comprise software elements, the<br>externally visible properties of those<br>elements, and the relationships among them<br>[Bass 2003]. "Externally visible” properties<br>refer to those assumptions other elements can<br>make of an element, such as its provided<br>services, performance characteristics, fault<br>handling, shared resource usage, and so on.|
|view|A representation of a whole system from the<br>perspective of a related set of concerns [IEEE<br>1471]. A representation of a particular type of<br>software architectural elements that occur in a<br>system, their properties, and the relations<br>among them. A view conforms to a defining<br>viewpoint.|
|view packet|The smallest package of architectural<br>documentation that could usefully be given to<br>a stakeholder. The documentation of a view is|


20 last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>

|Col1|composed of one or more view packets.|
|---|---|
|viewpoint|A specification of the conventions for<br>constructing and using a view; a pattern or<br>template from which to develop individual<br>views by establishing the purposes and<br>audience for a view, and the techniques for its<br>creation and analysis [IEEE 1471]. Identifies<br>the set of concerns to be addressed, and<br>identifies the modeling techniques, evaluation<br>techniques, consistency checking techniques,<br>etc., used by any conforming view.|


#### **6.3 Acronym List**

|API|Application Programming Interface; Application Program Interface;<br>Application Programmer Interface|
|---|---|
|ATAM|Architecture Tradeoff Analysis Method|
|CMM|Capability Maturity Model|
|CMMI|Capability Maturity Model Integration|
|CORBA|Common object request broker architecture|
|COTS|Commercial-Off-The-Shelf|
|EPIC|Evolutionary Process for Integrating COTS-Based Systems|
|IEEE|Institute of Electrical and Electronics Engineers|
|KPA|Key Process Area|
|OO|Object Oriented|
|ORB|Object Request Broker|
|OS|Operating System|
|QAW|Quality Attribute Workshop|
|RUP|Rational Unified Process|
|SAD|Software Architecture Document|
|SDE|Software Development Environment|
|SEE|Software Engineering Environment|
|SEI|Software Engineering Institute<br>Systems Engineering & Integration<br>Software End Item|
|SEPG|Software Engineering Process Group|



last saved: Sunday, May 17, 2026 21


<Insert OrganizationName> <Insert OrganizationName>

|Col1|Col2|
|---|---|
|SLOC|Source Lines of Code|
|SW-CMM|Capability Maturity Model for Software|
|CMMI-SW|Capability Maturity Model Integrated - includes Software Engineering|
|UML|Unified Modeling Language|



22 last saved: Sunday, May 17, 2026


<Insert OrganizationName> <Insert OrganizationName>

### **7 Sample Figures & Tables**


_Figure 1:_ _Sample Figure_


_Table 2:_ _Sample Table_

|Table Heading|Table Heading|Table Heading|Table Heading|
|---|---|---|---|
|Table Body|Table Body|Table Body|Table Body|
|Table Body|Table Body|Table Body|Table Body|
|Table Body|Table Body|Table Body|Table Body|
|Table Body|Table Body|Table Body|Table Body|



last saved: Sunday, May 17, 2026 23


<Insert OrganizationName> <Insert OrganizationName>

### **Appendix A Appendices**




#### **Heading 2 - Appendix** **Heading 2 - Appendix**

24 last saved: Sunday, May 17, 2026


