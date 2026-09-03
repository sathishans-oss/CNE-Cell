import { Area, Employee, RoleMapping, CNERecord, UpcomingClass, CNEApplication, GalleryItem, ChairpersonMessageData, NewsEventItem, QuickLinkItem, CoordinatorDeskInfo } from '../types';

export const INITIAL_AREAS: Area[] = [
  "216(OT-Complex)-(DSA & IR)",
  "231A(NICU)-(Inborn)",
  "232(OT-Complex)-(Obstetrics)",
  "233A(IPD)-(Obstetrics)",
  "233B(CCU)-(Labour Room)",
  "234A(CCU)-(Paediatric Warmer)",
  "234B(IPD)-(Paediatric Surgery)",
  "235A(CCU)-(PICU)",
  "236(IPD)-(Paediatric Medicine)",
  "241A(IPD)-(Nephrology)",
  "241D(OT-Complex)-(Dialysis)",
  "243A(IPD)-(Psychiatry)",
  "243B(IPD)-(Ophthal)",
  "244(IPD)-(Gynaecology)",
  "245(IPD)-(Med-Onco & Hemat)",
  "246A(IPD)-(Radiotheraphy)",
  "246B(IPD)-(Surgical Oncology)",
  "252(HDU)-(Paediatric Cardiology)",
  "253(OT-Complex)-(Cathlab)",
  "254A(IPD)-(Cardiology)",
  "255A(HDU)-(CTVS)",
  "256A(IPD)-(Pulmonary)",
  "256B(CCU)-(Pulmonary)",
  "261A(OT-Complex)-(Anaesthesia)",
  "261B(OT-Complex)",
  "264A(CCU)-(Neuro Surgery)",
  "264C(OT-Complex)",
  "266(CCU)",
  "312A(ED)-(HDU & CCU)",
  "312B(ED)-(Paediatric Emergency)",
  "313(ED)-(Yellow & Red Area)",
  "341A(IPD)-(General Medicine)",
  "342(CCU)-(Medicine)",
  "343A(IPD)-(General Medicine)",
  "345A(IPD)-(Endocrinology)",
  "346(OT-Complex)-(ERCP & Endoscopy)",
  "351(IPD)-(Orthopaedics)",
  "352A(IPD)-(General Allocation Pool)",
  "353A(IPD)-(General Surgery)",
  "353B(CCU)-(General Surgery)",
  "354(IPD)-(General Surgery)",
  "355B(IPD)-(ENT)",
  "356A(IPD)-(Surgical Gastro)",
  "361(HDU)-(Private Ward)",
  "362A(IPD)-(Plastic Surgery)",
  "362B(IPD)-(OMFS)",
  "363A(IPD)-(Urology)",
  "364A(IPD)-(Geriatric Medicine)",
  "365A(IPD)-(Neurology)",
  "365B(CCU)-(Neurology)",
  "366A(IPD)-(Medical Gastro)",
  "366B(CCU)-(Medical Gastro)",
  "411(OPD)-(Trauma_Telemedicine)",
  "413(OT-Complex)-(Trauma)",
  "414(ED)-(Trauma Emergency)",
  "421A(IPD)-(Neuro Surgery)",
  "422(CCU)-(Neuro Surgery)",
  "423(IPD)-(Trauma Surgery)",
  "424B(IPD)-(General Allocation Pool)",
  "426B(CCU)-(Burn)",
  "426C(HDU)-(Sleep Lab)",
  "431(CCU)-(Trauma)",
  "433(OT-Complex)",
  "434(CCU)-(KTU)",
  "48(Day Care)",
  "511A(IPD)-(CAP)",
  "Airport MI Room",
  "Blood-Bank(OPD)",
  "ICN&Quality Nursing(OPD)",
  "Long Leave Pool Roster",
  "Nursing Pool Roster-I",
  "OPD-Areas(OPD)",
  "PHC Raiwala",
  "DSA & IR",
  "CNE Open Forum",
  "All Department",
  "Outside AIIMS"
].map((name, idx) => ({
  id: `AREA-${idx + 1}`,
  name,
  status: 'ACTIVE',
  createdAt: '2026-01-01'
}));

export const INITIAL_OFFICERS: Employee[] = [
  {
    srNo: 1,
    employeeId: "FNMDCNO00067",
    name: "Dr.Anita Rani Kansal",
    designation: "C.N.O",
    contactNo: "8800933030",
    email: "anita.cno@aiimsrishikesh.edu.in",
    dob: "20 Dec 1971",
    doj: "2018-05-10"
  },
  {
    srNo: 2,
    employeeId: "AIIMSRDNS0001",
    name: "(Capt.)Ms.Kalpana Beniwal",
    designation: "D.N.S",
    contactNo: "9068624501",
    email: "Kalpana.dns@aiimsrishikesh.edu.in",
    dob: "6 Oct 1986",
    doj: "2019-07-15"
  },
  {
    srNo: 3,
    employeeId: "AIIMSRDNS0002",
    name: "Ms.Vandana",
    designation: "D.N.S",
    contactNo: "8826740820",
    email: "vandana.dns@aiimsrishikesh.edu.in",
    dob: "12 Aug 1984",
    doj: "2019-08-20"
  },
  {
    srNo: 4,
    employeeId: "AIIMSRDNS0013",
    name: "Ms.Rekha Sharma",
    designation: "D.N.S",
    contactNo: "9876543210",
    email: "rekha.dns@aiimsrishikesh.edu.in",
    dob: "15 May 1985",
    doj: "2019-09-01"
  },
  {
    srNo: 5,
    employeeId: "AIIMSRANS00043",
    name: "Mr.Sanjay Singh",
    designation: "A.N.S",
    contactNo: "9876543211",
    email: "sanjay.ans@aiimsrishikesh.edu.in",
    dob: "10 Jan 1988"
  },
  {
    srNo: 6,
    employeeId: "AIIMSRANS00046",
    name: "Ms.Pooja Rawat",
    designation: "A.N.S",
    contactNo: "9876543212",
    email: "pooja.ans@aiimsrishikesh.edu.in",
    dob: "25 Nov 1989"
  },
  {
    srNo: 7,
    employeeId: "RSNHO000841",
    name: "Ms.Ramya T",
    designation: "N.O",
    contactNo: "9876543213",
    email: "ramya.no@aiimsrishikesh.edu.in",
    dob: "14 Feb 1992"
  },
  {
    srNo: 8,
    employeeId: "RSNHO000890",
    name: "Mr.Amit Kumar",
    designation: "N.O",
    contactNo: "9876543214",
    email: "amit.no@aiimsrishikesh.edu.in",
    dob: "30 Mar 1993"
  },
  {
    srNo: 9,
    employeeId: "RSNHO000912",
    name: "Ms.Deepika Negi",
    designation: "N.O",
    contactNo: "9876543215",
    email: "deepika.no@aiimsrishikesh.edu.in",
    dob: "18 Jul 1994"
  },
  {
    srNo: 10,
    employeeId: "RSNHO000955",
    name: "Mr.Vikas Verma",
    designation: "N.O",
    contactNo: "9876543216",
    email: "vikas.no@aiimsrishikesh.edu.in",
    dob: "05 Sep 1991"
  }
];

export const INITIAL_ROLES: RoleMapping[] = [
  {
    employeeId: "RSNHO000841",
    name: "Ms.Ramya T",
    designation: "N.O",
    role: "ADMIN"
  },
  {
    srNo: 1,
    employeeId: "FNMDCNO00067",
    name: "Dr.Anita Rani Kansal",
    designation: "C.N.O",
    role: "ADMIN"
  }
];

export const INITIAL_CNE_RECORDS: CNERecord[] = [
  {
    dataId: "b41c5020",
    area: "243B(IPD)-(Ophthal)",
    fromDate: "2026-03-01",
    toDate: "2026-03-01",
    duration: "1:00:00",
    topic: "Nursing management patient with Glaucoma (Skills: Instillation of Eye Drops)",
    resourcePersonEmpId: "AIIMSRANS00043",
    resourcePersonName: "Mr.Sanjay Singh",
    modeOfTeaching: "Lecture Cum Discussion",
    staffEmpIds: ["AIIMSRDNS0013", "AIIMSRANS00046", "RSNHO000841", "RSNHO000890", "RSNHO000912"],
    staffCount: 13,
    remarks: "Practical demo included eye drop angle technique",
    createdAt: "2026-03-01T10:00:00Z"
  },
  {
    dataId: "CNE-2026-000102",
    area: "235A(CCU)-(PICU)",
    fromDate: "2026-02-18",
    toDate: "2026-02-18",
    duration: "1:30:00",
    topic: "Pediatric Advanced Life Support & Emergency Resuscitation Algorithms",
    resourcePersonEmpId: "AIIMSRDNS0001",
    resourcePersonName: "(Capt.)Ms.Kalpana Beniwal",
    modeOfTeaching: "Hands-on Workshop",
    staffEmpIds: ["AIIMSRDNS0013", "RSNHO000841", "RSNHO000890", "RSNHO000955"],
    staffCount: 18,
    remarks: "Simulation lab practicals on pediatric mannequins",
    createdAt: "2026-02-18T14:30:00Z"
  },
  {
    dataId: "CNE-2026-000103",
    area: "313(ED)-(Yellow & Red Area)",
    fromDate: "2026-02-05",
    toDate: "2026-02-05",
    duration: "1:00:00",
    topic: "Triage Protocols & Rapid Response in Polytrauma Management",
    resourcePersonEmpId: "AIIMSRDNS0002",
    resourcePersonName: "Ms.Vandana",
    modeOfTeaching: "Lecture Cum Discussion",
    staffEmpIds: ["AIIMSRDNS0013", "AIIMSRANS00046", "RSNHO000912", "RSNHO000955"],
    staffCount: 22,
    remarks: "ED workflow optimization",
    createdAt: "2026-02-05T09:15:00Z"
  },
  {
    dataId: "CNE-2026-000104",
    area: "264A(CCU)-(Neuro Surgery)",
    fromDate: "2026-01-22",
    toDate: "2026-01-22",
    duration: "1:00:00",
    topic: "Intracranial Pressure (ICP) Monitoring and Post-Op Neuro-Care",
    resourcePersonEmpId: "AIIMSRANS00043",
    resourcePersonName: "Mr.Sanjay Singh",
    modeOfTeaching: "Clinical Case Discussion",
    staffEmpIds: ["AIIMSRDNS0013", "RSNHO000841", "RSNHO000890"],
    staffCount: 15,
    remarks: "EVD drainage & wave analysis",
    createdAt: "2026-01-22T11:00:00Z"
  },
  {
    dataId: "CNE-2026-000105",
    area: "ICN&Quality Nursing(OPD)",
    fromDate: "2026-01-10",
    toDate: "2026-01-10",
    duration: "2:00:00",
    topic: "Hospital Acquired Infection Control, Bundles of Care & Hand Hygiene Audits",
    resourcePersonEmpId: "FNMDCNO00067",
    resourcePersonName: "Dr.Anita Rani Kansal",
    modeOfTeaching: "Hands-on Workshop",
    staffEmpIds: ["AIIMSRDNS0001", "AIIMSRDNS0002", "AIIMSRDNS0013", "AIIMSRANS00046", "RSNHO000841", "RSNHO000890", "RSNHO000912", "RSNHO000955"],
    staffCount: 45,
    remarks: "Institutional annual quality infection control update",
    createdAt: "2026-01-10T14:00:00Z"
  },
  {
    dataId: "CNE-2025-000089",
    area: "254A(IPD)-(Cardiology)",
    fromDate: "2025-11-14",
    toDate: "2025-11-14",
    duration: "1:00:00",
    topic: "12-Lead ECG Interpretation & Lethal Arrhythmia Recognition for Nurses",
    resourcePersonEmpId: "AIIMSRDNS0001",
    resourcePersonName: "(Capt.)Ms.Kalpana Beniwal",
    modeOfTeaching: "Lecture Cum Discussion",
    staffEmpIds: ["AIIMSRDNS0013", "RSNHO000841", "RSNHO000912"],
    staffCount: 20,
    remarks: "Interactive strip readings",
    createdAt: "2025-11-14T10:30:00Z"
  }
];

export const INITIAL_UPCOMING_CLASSES: UpcomingClass[] = [
  {
    classId: "CLS-2026-001",
    topic: "Comprehensive Ventilator Care & Weaning Protocols in Intensive Care",
    area: "266(CCU)",
    date: "2026-09-08",
    time: "14:00 - 15:30",
    duration: "1:30:00",
    resourcePersonEmpId: "AIIMSRDNS0001",
    resourcePersonName: "(Capt.)Ms.Kalpana Beniwal",
    modeOfTeaching: "Hands-on Workshop",
    description: "In-depth clinical workshop on ventilator modes, alarm troubleshooting, endotracheal suctioning techniques, and sedation vacation.",
    maxParticipants: 35,
    currentApplicationsCount: 18,
    status: "OPEN"
  },
  {
    classId: "CLS-2026-002",
    topic: "Medication Administration Safety: High-Alert Drugs & Double-Check Standards",
    area: "CNE Open Forum",
    date: "2026-09-15",
    time: "11:00 - 12:00",
    duration: "1:00:00",
    resourcePersonEmpId: "FNMDCNO00067",
    resourcePersonName: "Dr.Anita Rani Kansal",
    modeOfTeaching: "Lecture Cum Discussion",
    description: "Guidelines on preventing look-alike sound-alike (LASA) errors, infusion pump calculations, and adverse event reporting.",
    maxParticipants: 60,
    currentApplicationsCount: 42,
    status: "OPEN"
  },
  {
    classId: "CLS-2026-003",
    topic: "Neonatal Resuscitation Program (NRP) Skills Refresher",
    area: "231A(NICU)-(Inborn)",
    date: "2026-09-22",
    time: "15:00 - 16:30",
    duration: "1:30:00",
    resourcePersonEmpId: "AIIMSRANS00043",
    resourcePersonName: "Mr.Sanjay Singh",
    modeOfTeaching: "Hands-on Workshop",
    description: "Targeted refresher on T-piece resuscitator, chest compressions, and umbilical venous catheterization assistance.",
    maxParticipants: 25,
    currentApplicationsCount: 12,
    status: "OPEN"
  },
  {
    classId: "CLS-2026-004",
    topic: "Chemotherapy Safe Handling, Extravasation Management & PPE Protocols",
    area: "245(IPD)-(Med-Onco & Hemat)",
    date: "2026-09-29",
    time: "14:00 - 15:00",
    duration: "1:00:00",
    resourcePersonEmpId: "AIIMSRDNS0002",
    resourcePersonName: "Ms.Vandana",
    modeOfTeaching: "Lecture Cum Discussion",
    description: "Hazardous drug preparation and disposal, spill kit usage, and prompt extravasation care steps.",
    maxParticipants: 40,
    currentApplicationsCount: 20,
    status: "OPEN"
  }
];

export const INITIAL_APPLICATIONS: CNEApplication[] = [
  {
    applicationId: "APP-2026-0001",
    classId: "CLS-2026-001",
    classTopic: "Comprehensive Ventilator Care & Weaning Protocols in Intensive Care",
    classDate: "2026-09-08",
    classArea: "266(CCU)",
    employeeId: "AIIMSRDNS0013",
    employeeName: "Ms.Rekha Sharma",
    appliedAt: "2026-08-28T08:30:00Z",
    status: "Approved",
    remarks: "Duty off approved for session"
  },
  {
    applicationId: "APP-2026-0002",
    classId: "CLS-2026-002",
    classTopic: "Medication Administration Safety: High-Alert Drugs & Double-Check Standards",
    classDate: "2026-09-15",
    classArea: "CNE Open Forum",
    employeeId: "AIIMSRDNS0013",
    employeeName: "Ms.Rekha Sharma",
    appliedAt: "2026-08-29T11:20:00Z",
    status: "Applied",
    remarks: "Mandatory departmental attendance"
  },
  {
    applicationId: "APP-2026-0003",
    classId: "CLS-2026-001",
    classTopic: "Comprehensive Ventilator Care & Weaning Protocols in Intensive Care",
    classDate: "2026-09-08",
    classArea: "266(CCU)",
    employeeId: "RSNHO000890",
    employeeName: "Mr.Amit Kumar",
    appliedAt: "2026-08-29T14:15:00Z",
    status: "Applied"
  }
];

export const INITIAL_GALLERY: GalleryItem[] = [
  {
    id: "IMG-2026-001",
    title: "Hands-on Pediatric Airway & Resuscitation Workshop",
    description: "Nursing officers practicing bag-valve-mask and intubation assistance in PICU simulation lab.",
    date: "2026-02-18",
    imageUrl: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80",
    uploadedBy: "RSNHO000841",
    uploadedAt: "2026-02-19T09:00:00Z",
    isActive: true
  },
  {
    id: "IMG-2026-002",
    title: "Hospital Infection Control & Quality Audits Session",
    description: "Annual infection control workshop conducted by CNO for senior nursing staff and supervisors.",
    date: "2026-01-10",
    imageUrl: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80",
    uploadedBy: "RSNHO000841",
    uploadedAt: "2026-01-11T12:00:00Z",
    isActive: true
  },
  {
    id: "IMG-2026-003",
    title: "12-Lead ECG Interpretation Interactive Lecture",
    description: "Interactive rhythm analysis and telemetry monitoring session for cardiology and HDU nursing teams.",
    date: "2025-11-14",
    imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80",
    uploadedBy: "RSNHO000841",
    uploadedAt: "2025-11-15T15:30:00Z",
    isActive: true
  },
  {
    id: "IMG-2026-004",
    title: "Ophthalmic Nursing & Glaucoma Care Skill Station",
    description: "Demonstration of sterile eye drop instillation and post-operative eye shield application.",
    date: "2026-03-01",
    imageUrl: "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?auto=format&fit=crop&w=800&q=80",
    uploadedBy: "RSNHO000841",
    uploadedAt: "2026-03-02T10:00:00Z",
    isActive: true
  }
];

export const INITIAL_USER_CREDS: Record<string, string> = {
  // Sandbox mock credentials (hashed/simulated)
};

export const INITIAL_CHAIRPERSON_MESSAGE: ChairpersonMessageData = {
  name: "Dr. Anita Rani Kansal",
  designation: "Chief Nursing Officer (C.N.O) & Chairperson, CNE Committee",
  institution: "All India Institute of Medical Sciences (AIIMS), Rishikesh",
  photoUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80",
  title: "Fostering Clinical Rigour, Compassion & Lifelong Learning in Nursing",
  message: [
    "Welcome to the Clinical Nursing Education (CNE) Portal of AIIMS Rishikesh. Continuing education is not merely a professional obligation; it is the cornerstone of patient safety, clinical excellence, and progressive nursing practice.",
    "In a tertiary healthcare and apex academic institution like AIIMS Rishikesh, our nursing fraternity stands on the frontlines of complex medical care, specialized surgical interventions, and intensive critical monitoring. Continuous upskilling ensures that every intervention delivered to our patients meets national and international benchmarks of evidence-based nursing care.",
    "This centralized CNE portal serves as an institutional hub to democratize learning, maintain transparent training portfolios, and recognize the scholarly contributions of both our resource persons and enthusiastic learners. I encourage every nursing officer to take full ownership of their professional development and participate actively in our continuous education calendar."
  ],
  keyHighlights: [
    "Institutional commitment to 100% evidence-based clinical protocols",
    "Comprehensive simulation-assisted emergency & critical care modules",
    "Standardized digital documentation for annual training records and professional portfolios",
    "Equal growth and continuous skill enhancement for all nursing cadres"
  ]
};

export const INITIAL_NEWS_EVENTS: NewsEventItem[] = [
  {
    id: "NEWS-2026-001",
    title: "Notice: Annual CNE Credit Hour Guidelines 2026-27",
    date: "2026-08-25",
    category: "Circular",
    summary: "Office memorandum outlining continuing nursing education guidelines for all Nursing Officers and Senior Nursing Officers for the academic year.",
    content: "As per circular AIIMS/DNS/CNE/2026/104, all nursing personnel are encouraged to complete a minimum of 20 verified CNE training hours annually. Completed sessions automatically generate official summary reports for verification by CNE Coordinator & Chairperson.",
    venue: "Office of the CNO / CNE Committee",
    isImportant: true
  },
  {
    id: "NEWS-2026-002",
    title: "Upcoming 3-Day Advanced Airway & Mechanical Ventilation Masterclass",
    date: "2026-09-08",
    category: "Workshop",
    summary: "Hands-on intensive masterclass on ventilator modes, lung-protective strategies, and troubleshooting patient-ventilator asynchrony.",
    content: "Targeted at ICU, CCU, and HDU nursing officers. Hands-on skill stations with mechanical ventilators and simulation manikins in the Clinical Skills Simulation Center.",
    venue: "Mini Auditorium & PICU Simulation Lab",
    speaker: "Faculty from Critical Care & Nursing Services",
    isImportant: true
  },
  {
    id: "NEWS-2026-003",
    title: "Regional Conference: Innovations in Infection Prevention & Sepsis Bundles",
    date: "2026-09-22",
    category: "Conference",
    summary: "Annual institutional symposium on hospital acquired infections (HAI), central line bundles, and surgical site infection mitigation.",
    content: "Featuring guest lectures from national infection control experts and clinical presentations by our infection control nurse specialists.",
    venue: "Main Auditorium, AIIMS Rishikesh",
    speaker: "Hospital Infection Control Committee (HICC)",
    isImportant: false
  },
  {
    id: "NEWS-2026-004",
    title: "Training Session: Point-of-Care Ultrasound (POCUS) Vascular Access",
    date: "2026-09-14",
    category: "Training",
    summary: "Skill station on ultrasound-guided peripheral IV cannulation and midline catheter placement in difficult access patients.",
    content: "Hands-on ultrasound training stations allowing participants to practice vessel visualization and needle guidance techniques.",
    venue: "Skills Lab, 4th Floor Medical College",
    speaker: "Interventional Nursing Team",
    isImportant: false
  },
  {
    id: "NEWS-2026-005",
    title: "System Update: CNE Self-Service Portal Features Instant PDF Generation",
    date: "2026-08-12",
    category: "Update",
    summary: "Nursing staff can now access instant digital attendance records, class schedules, and export verified CNE records.",
    content: "The portal supports seamless integration with Google Sheets, allowing real-time synchronization of scheduled classes and verified attendance.",
    venue: "Institutional Web Portal",
    isImportant: false
  }
];

export const INITIAL_QUICK_LINKS: QuickLinkItem[] = [
  {
    id: "ql-upcoming",
    title: "Upcoming CNE Schedule",
    description: "Browse open classes, curriculum topics, venue allocations, and secure your registration.",
    iconName: "Sparkles",
    target: "upcoming",
    badge: "Open for Enrollment",
    actionType: "navigate"
  },
  {
    id: "ql-calendar",
    title: "CNE Interactive Calendar",
    description: "View monthly training schedules, departmental rotations, and upcoming skill sessions.",
    iconName: "Calendar",
    target: "calendar",
    badge: "Monthly View",
    actionType: "navigate"
  },
  {
    id: "ql-guidelines",
    title: "CNE Guidelines & Policy",
    description: "Institutional policy document outlining attendance requirements, credits, and speaker recognition.",
    iconName: "FileCheck",
    target: "guidelines",
    badge: "Official Norms",
    actionType: "modal",
    modalContent: {
      title: "AIIMS Rishikesh CNE Guidelines & Attendance Norms",
      body: [
        "1. Minimum Attendance: All Nursing Officers (N.O) and Senior Nursing Officers (S.N.O) should aim to complete at least 20 documented CNE hours per academic year.",
        "2. Punctuality & Verification: Attendance is digitally signed and logged through the Area Incharge and verified against institutional roster data.",
        "3. Faculty / Resource Person Recognition: Serving as an approved resource person or instructor carries double CNE credits and is recognized as institutional academic leadership.",
        "4. Certificate of Completion: Certificates and annual summary records can be downloaded directly from the portal once logged in with verified credentials.",
        "5. Leave & Excusal: Prior written notification to the CNE Coordinator is required if unable to attend a class for which registration was confirmed."
      ]
    }
  },
  {
    id: "ql-cell-info",
    title: "Nursing Education Cell",
    description: "Overview of CNE Committee mandate, organizational hierarchy, and departmental coordinators.",
    iconName: "GraduationCap",
    target: "cell-info",
    badge: "Committee Info",
    actionType: "modal",
    modalContent: {
      title: "About the Nursing Education Cell",
      body: [
        "The Nursing Education Cell at AIIMS Rishikesh is constituted under the Department of Nursing Services to foster academic vitality, clinical competence, and professional innovation.",
        "Leadership: Chaired by the Chief Nursing Officer (C.N.O) in coordination with Deputy Nursing Superintendents (D.N.S) and Assistant Nursing Superintendents (A.N.S).",
        "Coordinators: Ms. Suman Choudhary and Ms. Ramya T.",
        "Key Mandates: Curriculum design for clinical specialties, simulation-based resuscitation workshops, orientation programmes for newly recruited officers, and institutional continuous learning audits.",
        "Contact: Nursing Education Cell, Room No. 214, Medical College Building, AIIMS Rishikesh."
      ]
    }
  },
  {
    id: "ql-cne-portfolio-guide",
    title: "CNE Portfolio Guide",
    description: "Step-by-step instructions on generating certified CNE portfolios for verification by CNE Coordinator & Chairperson.",
    iconName: "Award",
    target: "cne-portfolio-guide",
    badge: "Portfolio Guide",
    actionType: "modal",
    modalContent: {
      title: "CNE Portfolio Certification Guide",
      body: [
        "Step 1: Sign in to the CNE Portal using your institutional Employee ID.",
        "Step 2: Review your cumulative CNE hours and completed sessions under 'My CNE'.",
        "Step 3: Click the 'Generate Annual CNE Record' button to download the institutional PDF report.",
        "Step 4: Get your generated record verified and signed by the CNE Coordinator and Chairperson, CNE Committee / CNO.",
        "Step 5: Retain the verified record in your personal professional portfolio."
      ]
    }
  },
  {
    id: "ql-contact",
    title: "Contact CNE Coordinator Desk",
    description: "Get in touch with CNE coordinators, raise roster queries, or propose a specialized training session.",
    iconName: "Users",
    target: "contact",
    badge: "Help & Support",
    actionType: "modal",
    modalContent: {
      title: "CNE Coordinator Desk Contact Information",
      body: [
        "Office: Department of Nursing Services, All India Institute of Medical Sciences, Rishikesh - 249203, Uttarakhand, India.",
        "CNE Coordinators: Ms. Suman Choudhary | Ms. Ramya T",
        "Email: training.nur@aiimsrishikesh.edu.in",
        "Working Hours: Monday to Friday: 09:00 AM – 05:00 PM | Saturday: 09:00 AM – 01:00 PM"
      ]
    }
  }
];

export const INITIAL_COORDINATOR_DESK: CoordinatorDeskInfo = {
  note: 'Have questions regarding class credits, attendance verification, or training schedules?',
  coordinators: ['Ms. Suman Choudhary', 'Ms. Ramya T'],
  email: 'training.nur@aiimsrishikesh.edu.in'
};
