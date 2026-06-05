window.LECTURE_SLIDES = [
  {
    source: "01",
    section: "Opening",
    title: "Security in applications and networks",
    subtitle: "Week 01 frames security as the protection of valuable assets under realistic risk.",
    visual: "big",
    visualLabel: "SECURITY",
    visualSub: "value + risk + protection",
    points: [
      "Today is about developing a security mindset, not memorizing isolated definitions.",
      "We will move from everyday risk to formal requirements: confidentiality, integrity, and availability.",
      "The lecture ends with basic design principles for building more secure systems."
    ],
    notes: [
      "Use this as the clean opening instead of the source title image. Set the expectation that the class is conceptual and practical."
    ]
  },
  {
    source: "02",
    section: "Opening",
    title: "Lecture 1 has one central question",
    subtitle: "When should we worry about security?",
    visual: "equation",
    visualItems: [
      { title: "Value", text: "Something matters to a person, organization, or society." },
      { title: "Risk", text: "There is a credible way it could be harmed." },
      { title: "Security concern", text: "We need protection, detection, or response." }
    ],
    points: [
      "Security starts when something has value.",
      "Value alone is not enough; there must also be risk.",
      "The course teaches how to reason from value and risk toward controls."
    ]
  },
  {
    source: "03",
    section: "Instructor context",
    title: "A little bit about me",
    subtitle: "Instructor background slide. Add your own verified academic and professional details here.",
    visual: "cards",
    visualItems: [
      { title: "Research", text: "Information security, applied machine learning, and related areas." },
      { title: "Teaching", text: "Security concepts connected to systems, networks, and real cases." },
      { title: "Expectation", text: "Students should ask questions and reason carefully." }
    ],
    points: [
      "Do not invent biography details on this slide.",
      "Use this moment to connect your research identity with the course.",
      "Keep the tone professional and brief before moving to student introductions."
    ],
    notes: [
      "The source slide is visual/personal. Replace these placeholders with facts you want public."
    ]
  },
  {
    source: "04",
    section: "Instructor context",
    title: "How this class will feel",
    subtitle: "Security is technical, but the classroom should be active and question-driven.",
    visual: "cards",
    visualItems: [
      { title: "Concepts", text: "Definitions become useful only when applied to scenarios." },
      { title: "Discussion", text: "Students should test assumptions and ask for clarification." },
      { title: "Practice", text: "Examples and short activities turn vocabulary into judgment." }
    ],
    points: [
      "Use this slide to explain the learning style of the course.",
      "Emphasize that security is about reasoning under uncertainty.",
      "Invite participation early."
    ],
    notes: [
      "The source slide is another personal/context slide. Keep only factual information you approve."
    ]
  },
  {
    source: "05",
    section: "Class opening",
    title: "Briefly introduce yourself",
    subtitle: "Start with technology, consequences, and lived experience.",
    visual: "prompts",
    visualItems: [
      { title: "Your name", text: "Begin with who you are." },
      { title: "Uninvent one invention", text: "What would you remove from history, and why?" },
      { title: "Cyber incident", text: "Have you been affected by a cybersecurity incident?" }
    ],
    points: [
      "The uninvention question reveals that technologies have tradeoffs.",
      "The cybersecurity incident question shows that security is not abstract.",
      "Students can share only what they are comfortable sharing."
    ],
    activity: "Student introductions"
  },
  {
    source: "06",
    section: "Course expectations",
    title: "Before we continue...",
    subtitle: "A few norms make the class easier to teach and easier to learn.",
    visual: "big",
    visualLabel: "FOCUS",
    visualSub: "attention is part of the learning environment",
    points: [
      "Set expectations before the technical content begins.",
      "Explain that classroom norms are not arbitrary; they protect attention.",
      "Connect the norms to the active style of the course."
    ]
  },
  {
    source: "07",
    section: "Course framing",
    title: "Security in applications and networks",
    subtitle: "Security appears at multiple layers: people, software, networks, data, and infrastructure.",
    visual: "flow",
    visualItems: [
      { title: "People", text: "Users, admins, attackers, victims." },
      { title: "Applications", text: "Services and software logic." },
      { title: "Networks", text: "Communication paths and protocols." },
      { title: "Data", text: "Information stored or transmitted." },
      { title: "Infrastructure", text: "Systems society depends on." }
    ],
    points: [
      "Application security and network security are connected.",
      "Human behavior is part of the system.",
      "The same vocabulary will be used across layers."
    ]
  },
  {
    source: "08",
    section: "Course expectations",
    title: "Rules are here to protect attention",
    subtitle: "Devices are allowed when they serve the activity, not when they replace attention.",
    visual: "cards",
    visualItems: [
      { title: "Devices", text: "Phones, tablets, and laptops are put away unless required." },
      { title: "Break", text: "Usually one short break during class." },
      { title: "Questions", text: "If you are lost, ask. Even a loud HELP is better than silence." }
    ],
    points: [
      "The use of phone, tablet, or laptop is strictly prohibited during lecture unless required for class activities.",
      "There will usually be one short break during the class.",
      "If students are lost, they should ask a question."
    ],
    activity: "Most importantly: have fun"
  },
  {
    source: "09",
    section: "Course expectations",
    title: "AI can help, but it cannot understand for you",
    subtitle: "Use AI as a thinking aid, not as a substitute for comprehension.",
    visual: "flow",
    visualItems: [
      { title: "Use", text: "Use AI if it benefits your learning." },
      { title: "Understand", text: "Check every step and claim." },
      { title: "Explain", text: "Be ready to explain verbally." },
      { title: "Mismatch", text: "If explanation contradicts submitted work..." },
      { title: "Consequence", text: "The assignment may receive zero." }
    ],
    points: [
      "AI use is allowed when it benefits students.",
      "Comprehension may be checked verbally at random.",
      "If written work implies understanding but the student cannot explain it, the assignment can be marked zero."
    ]
  },
  {
    source: "10",
    section: "Course expectations",
    title: "FAQ: how to pronounce my name",
    subtitle: "Small human details reduce distance in the classroom.",
    visual: "cards",
    visualItems: [
      { title: "Mahdi", text: "Ma - h - di" },
      { title: "Madi", text: "Approximately similar." },
      { title: "Max", text: "Easy and acceptable version." }
    ],
    points: [
      "Include a pronunciation note so students feel comfortable addressing you.",
      "The source slide offers Mahdi, Madi, or Max.",
      "This is a quick transition before questions and acknowledgments."
    ]
  },
  {
    source: "11",
    section: "Acknowledgment",
    title: "Questions, doubts, and source acknowledgment",
    subtitle: "The original lecture acknowledges Georgia Tech and CS 6035.",
    visual: "cards",
    visualItems: [
      { title: "Questions", text: "Invite doubts before moving into definitions." },
      { title: "Acknowledgment", text: "Georgia Tech, Dr. Wenke Lee, Dr. Mustaque Ahamad." },
      { title: "Course source", text: "CS 6035: Introduction to Information Security." }
    ],
    points: [
      "Ask whether students have questions before the technical section begins.",
      "Preserve the acknowledgment from the source deck.",
      "Make clear that this web version is adapted for your course."
    ]
  },
  {
    source: "12",
    section: "Definition",
    title: "Computer security is protection for system resources",
    subtitle: "NIST defines computer security around preserving confidentiality, integrity, and availability.",
    visual: "cia",
    visualItems: [
      { title: "Confidentiality", position: "top" },
      { title: "Integrity", position: "left" },
      { title: "Availability", position: "right" }
    ],
    points: [
      "NIST describes computer security as protection afforded to an automated information system.",
      "The protection aims to preserve applicable objectives.",
      "The protected resources include hardware, software, firmware, data, and telecommunications."
    ],
    notes: [
      "Use the NIST definition as the formal anchor before moving into the mindset slides."
    ]
  },
  {
    source: "13",
    section: "Security mindset",
    title: "Security mindset begins with better questions",
    subtitle: "Why is cybersecurity important? How do we understand it? What needs to be done?",
    visual: "prompts",
    visualItems: [
      { title: "Why?", text: "Why is cybersecurity important?" },
      { title: "How?", text: "How do we understand cybersecurity?" },
      { title: "What?", text: "What needs to be done to address cybersecurity?" }
    ],
    points: [
      "The security mindset is a way of questioning systems.",
      "The first question is importance: what could be harmed?",
      "The next question is action: what can we do about it?"
    ]
  },
  {
    source: "14",
    section: "Security mindset",
    title: "We worry when value meets risk",
    subtitle: "Security becomes relevant when something valuable could be harmed.",
    visual: "equation",
    visualItems: [
      { title: "Something of value", text: "Data, money, identity, reputation, infrastructure." },
      { title: "Risk of harm", text: "A plausible path to loss, misuse, disruption, or damage." },
      { title: "Cybersecurity concern", text: "A reason to prevent, detect, respond, or recover." }
    ],
    points: [
      "The source slide says: we worry about security when we have something of value.",
      "There must also be a risk that the value could be harmed.",
      "This value/risk frame will organize the rest of the lecture."
    ]
  },
  {
    source: "15",
    section: "Motivation",
    title: "Who is safe?",
    subtitle: "Data breaches show that exposure is widespread and constantly changing.",
    visual: "pulse",
    visualLabel: "BREACHES",
    visualSub: "every dot is a reminder that security failures scale",
    points: [
      "The source deck links to Information Is Beautiful's visualization of major data breaches.",
      "Use this slide to make the problem visible at societal scale.",
      "Ask students what patterns they notice: targets, data types, frequency, and impact."
    ],
    activity: "Prompt: who is actually safe?"
  },
  {
    source: "16",
    section: "Motivation",
    title: "Individuals store sensitive data online",
    subtitle: "If stolen, criminals can profit from it.",
    visual: "cards",
    visualItems: [
      { title: "Identity", text: "Names, IDs, credentials, contact information." },
      { title: "Financial data", text: "Cards, bank accounts, transaction history." },
      { title: "Private life", text: "Messages, photos, health, location, behavior." }
    ],
    points: [
      "Cybersecurity matters because individuals keep sensitive data online.",
      "Stolen data can be monetized.",
      "The harm is not only technical; it affects people."
    ]
  },
  {
    source: "17",
    section: "Motivation",
    title: "Black market values turn data into incentive",
    subtitle: "Attackers often act because stolen data has exchange value.",
    visual: "cards",
    visualItems: [
      { title: "Credentials", text: "Access can be sold or reused." },
      { title: "Payment data", text: "Financial information can be abused directly." },
      { title: "Profiles", text: "Personal details support fraud and targeting." }
    ],
    points: [
      "The source slide introduces black market values.",
      "This is where economic motivation enters the threat model.",
      "Students should see that attackers are often rational profit seekers."
    ],
    notes: [
      "No prices are invented here. Add current examples only from a source you trust."
    ]
  },
  {
    source: "18",
    section: "Motivation",
    title: "Cyber risk reaches organizations and infrastructure",
    subtitle: "Business, government, smart grids, and society all depend on connected systems.",
    visual: "flow",
    visualItems: [
      { title: "Business", text: "Proprietary information can be stored online." },
      { title: "Government", text: "Unauthorized access can be economically or politically damaging." },
      { title: "Smart grids", text: "Control of cyber systems can affect infrastructure." },
      { title: "Community", text: "Whoever controls the grid can affect the community." },
      { title: "Society", text: "Modern societies rely on the internet." }
    ],
    points: [
      "Business and government proprietary information is often stored on the internet.",
      "Smart grids rely on cyber systems.",
      "Societies rely on the internet, so cybersecurity becomes a public concern."
    ]
  },
  {
    source: "19",
    section: "Risk model",
    title: "Cyber assets at risk require a security mindset",
    subtitle: "To understand risk, we need threats, vulnerabilities, and attacks.",
    visual: "flow",
    visualItems: [
      { title: "Online assets", text: "Information and systems we care about." },
      { title: "Risk question", text: "How could they be harmed?" },
      { title: "Security mindset", text: "A structured way to reason." },
      { title: "Threats", text: "Possible sources of harm." },
      { title: "Vulnerabilities + attacks", text: "Weaknesses and exploitation." }
    ],
    points: [
      "The source asks how we understand the risk to online information and systems.",
      "The answer begins with developing a security mindset.",
      "The next vocabulary is threats, vulnerabilities, and attacks."
    ]
  },
  {
    source: "20",
    section: "Risk model",
    title: "Important questions define the analysis",
    subtitle: "Before choosing controls, identify value, threat, risk, source, and measures.",
    visual: "prompts",
    visualItems: [
      { title: "Value", text: "What is valuable in this context?" },
      { title: "Threat source", text: "Where do threats come from?" },
      { title: "Risk", text: "What kind of harm are we talking about?" },
      { title: "Actor", text: "Who is the source of the threat?" },
      { title: "Measures", text: "What security measures can we take?" }
    ],
    points: [
      "What is of value in the context of cybersecurity?",
      "Where do the threats come from, and who is the source?",
      "What kind of risk is present, and what security measures can we take?"
    ]
  },
  {
    source: "21",
    section: "Transition",
    title: "From risk questions to an attack model",
    subtitle: "The next step is to connect actors, weaknesses, exploitation, and consequences.",
    visual: "flow",
    visualItems: [
      { title: "Actor", text: "Who wants to cause harm?" },
      { title: "Weakness", text: "What can be exploited?" },
      { title: "Action", text: "How is the weakness used?" },
      { title: "Breach", text: "What compromise occurs?" },
      { title: "Impact", text: "Who is harmed, and how?" }
    ],
    points: [
      "The source slide is visual-only, so this redesigned slide makes its transition explicit.",
      "It bridges the motivation section and the vulnerability/attack section.",
      "Use it to slow down before introducing the formal chain."
    ]
  },
  {
    source: "22",
    section: "Threat model",
    title: "Threat actors exploit vulnerabilities to launch attacks",
    subtitle: "Attacks can lead to compromise or security breaches.",
    visual: "flow",
    visualItems: [
      { title: "Threat actor", text: "Source of possible harm." },
      { title: "Vulnerability", text: "Weakness in software, networks, or humans." },
      { title: "Attack", text: "Attempt to exploit the weakness." },
      { title: "Compromise", text: "Loss of security properties." },
      { title: "Breach", text: "Observable security failure." }
    ],
    points: [
      "Threat actors exploit vulnerabilities.",
      "Attacks lead to compromises or security breaches.",
      "Vulnerabilities can be found in software, networks, and humans."
    ]
  },
  {
    source: "23",
    section: "Threat model",
    title: "Threat actors have different motivations",
    subtitle: "The threat source is who wants to do harm in online life.",
    visual: "cards",
    visualItems: [
      { title: "Cybercriminals", text: "Want to profit from sensitive data for financial gain." },
      { title: "Hacktivists", text: "Act against something you are or something you do." },
      { title: "Nation-states", text: "Seek political advantage or espionage." }
    ],
    points: [
      "Cybercriminals are often financially motivated.",
      "Hacktivists are often politically or socially motivated.",
      "Nation-states may act for advantage, intelligence, or espionage."
    ]
  },
  {
    source: "24",
    section: "Threat model",
    title: "Vulnerabilities are difficult to eliminate completely",
    subtitle: "Software, networks, and users all create possible weaknesses.",
    visual: "flow",
    visualItems: [
      { title: "Threats", text: "Start with who or what could harm us." },
      { title: "Vulnerabilities", text: "Weaknesses make harm possible." },
      { title: "Exploitation", text: "Attackers use the weakness." },
      { title: "Attack", text: "The exploitation attempt occurs." },
      { title: "Breach", text: "Compromise becomes visible." }
    ],
    points: [
      "It is very hard to get rid of vulnerabilities completely.",
      "Vulnerabilities can exist in software, computer systems, networks, and users.",
      "The source slide emphasizes that humans are often the weak link."
    ]
  },
  {
    source: "25",
    section: "Threat model",
    title: "Vulnerabilities and attacks: before exploitation",
    subtitle: "A vulnerability is a condition that makes an attack possible.",
    visual: "cards",
    visualItems: [
      { title: "Unpatched code", text: "A technical weakness." },
      { title: "Weak password", text: "A human or policy weakness." },
      { title: "Misconfiguration", text: "A system administration weakness." }
    ],
    points: [
      "This source slide begins a sequence on vulnerabilities and attacks.",
      "A vulnerability is not yet an attack.",
      "The attacker still needs a path to exploit it."
    ]
  },
  {
    source: "26",
    section: "Threat model",
    title: "A few hours later...",
    subtitle: "Small weaknesses can become serious when attackers have time and opportunity.",
    visual: "flow",
    visualItems: [
      { title: "Discovery", text: "The weakness is found." },
      { title: "Preparation", text: "The attacker chooses a method." },
      { title: "Execution", text: "The exploit is attempted." },
      { title: "Movement", text: "Access may expand." },
      { title: "Impact", text: "The system owner notices harm." }
    ],
    points: [
      "The source phrase 'a few hours later' marks movement from vulnerability to consequence.",
      "Time matters because attackers can iterate.",
      "This is a good place to ask students what defenders should monitor."
    ]
  },
  {
    source: "27",
    section: "Threat model",
    title: "FAIL is not the beginning of the story",
    subtitle: "A visible failure usually follows earlier missed signals.",
    visual: "big",
    visualLabel: "FAIL",
    visualSub: "late symptom, not first cause",
    points: [
      "The source slide uses FAIL as the visible outcome.",
      "Teach students to work backward from failure to vulnerability and threat actor.",
      "A security mindset asks what conditions made the failure possible."
    ]
  },
  {
    source: "28",
    section: "Threat model",
    title: "An attack path is a chain, not a single moment",
    subtitle: "Security analysis should identify each link in the chain.",
    visual: "flow",
    visualItems: [
      { title: "Entry", text: "How did the attacker get in?" },
      { title: "Privilege", text: "What could they access?" },
      { title: "Movement", text: "Where could they go next?" },
      { title: "Objective", text: "What did they want?" },
      { title: "Evidence", text: "What would reveal the path?" }
    ],
    points: [
      "The source slide continues the vulnerability/attack visual sequence.",
      "A code-based chain makes the idea explicit.",
      "Students should practice naming each stage."
    ]
  },
  {
    source: "29",
    section: "Threat model",
    title: "Consequences connect the technical and the human",
    subtitle: "Compromise matters because it creates harm.",
    visual: "cards",
    visualItems: [
      { title: "Data exposure", text: "Confidential information may be disclosed." },
      { title: "Data change", text: "Integrity of records may be damaged." },
      { title: "Service disruption", text: "Availability may be lost." }
    ],
    points: [
      "The source sequence ends by reinforcing that attacks produce consequences.",
      "These consequences map naturally to CIA.",
      "This prepares the transition to the real-world example."
    ]
  },
  {
    source: "30",
    section: "Case discussion",
    title: "A real-world example: Target Corporation",
    subtitle: "Target is introduced as a large United States department store retailer.",
    visual: "cards",
    visualItems: [
      { title: "Organization", text: "A large retailer with many systems and relationships." },
      { title: "Assets", text: "Customer data, payment processes, operations, reputation." },
      { title: "Question", text: "What could make those assets vulnerable?" }
    ],
    points: [
      "The source slide states that Target Corporation is the eighth-largest department store retailer in the United States.",
      "Use the case as a discussion scaffold rather than a memorized story.",
      "Ask students to identify assets before talking about attacks."
    ],
    notes: [
      "Add verified case facts later if you want a historically detailed version."
    ]
  },
  {
    source: "31",
    section: "Case discussion",
    title: "Analyze the case through the vocabulary",
    subtitle: "Do not jump from company name directly to conclusion.",
    visual: "flow",
    visualItems: [
      { title: "Asset", text: "What matters?" },
      { title: "Threat actor", text: "Who might benefit?" },
      { title: "Vulnerability", text: "What weakness exists?" },
      { title: "Attack", text: "How is it exploited?" },
      { title: "Breach", text: "What security property is lost?" }
    ],
    points: [
      "The source slide is visual, so this version turns it into an analysis procedure.",
      "The same five-part chain from earlier now becomes a case method.",
      "Students should practice mapping real incidents to concepts."
    ]
  },
  {
    source: "32",
    section: "Case discussion",
    title: "A case should end with security requirements",
    subtitle: "After the attack story, ask which requirement failed.",
    visual: "matrix",
    visualItems: [
      { title: "Sensitive data exposed", text: "Confidentiality" },
      { title: "Records changed", text: "Integrity" },
      { title: "Systems unavailable", text: "Availability" },
      { title: "Wrong person gets access", text: "Authorization" }
    ],
    points: [
      "The source slide continues the real-world example.",
      "This redesigned slide connects the case to requirements.",
      "Students should not stop at 'there was a breach'; they should name what property failed."
    ]
  },
  {
    source: "33",
    section: "Concept map",
    title: "Revisiting threats, vulnerabilities, attacks, and risk",
    subtitle: "The relationship of key concepts becomes the central map of the lecture.",
    visual: "flow",
    visualItems: [
      { title: "Value", text: "Assets that matter." },
      { title: "Threat", text: "Possible source of harm." },
      { title: "Vulnerability", text: "Weakness that can be used." },
      { title: "Attack", text: "Action against the system." },
      { title: "Risk", text: "Potential harm to the asset." }
    ],
    points: [
      "The source slide explicitly revisits the relationship of key cybersecurity concepts.",
      "This slide should feel like the summary map of the first half.",
      "Use it to check whether students can define each term."
    ]
  },
  {
    source: "34",
    section: "Security requirements",
    title: "What should we do in cybersecurity?",
    subtitle: "Make threats less profitable, reduce vulnerabilities, and meet CIA requirements.",
    visual: "cia",
    visualItems: [
      { title: "Confidentiality", position: "top" },
      { title: "Integrity", position: "left" },
      { title: "Availability", position: "right" }
    ],
    points: [
      "Make threats go away when possible, because crime should not pay.",
      "Reduce vulnerabilities.",
      "Strive to meet confidentiality, integrity, and availability."
    ],
    activity: "CIA is not the intelligence agency"
  },
  {
    source: "35",
    section: "Security requirements",
    title: "CIA is essential, but it is not everything",
    subtitle: "Authentication, authorization, and non-repudiation extend the basic triad.",
    visual: "cards",
    visualItems: [
      { title: "Authentication", text: "Verifying identity." },
      { title: "Authorization", text: "Determining access levels." },
      { title: "Non-repudiation", text: "Assurance that someone cannot deny validity." }
    ],
    points: [
      "The source slide jokes about CIAAAN as additional components added to CIA.",
      "Authentication gives individuals access based on identity.",
      "Authorization determines access levels for files, services, programs, data, and features."
    ]
  },
  {
    source: "36",
    section: "Security requirements",
    title: "Sometimes threats are easier to think about than requirements",
    subtitle: "Translate common threats into the requirement they violate.",
    visual: "matrix",
    visualItems: [
      { title: "Information disclosure", text: "Confidentiality" },
      { title: "Denial-of-service", text: "Availability" },
      { title: "Tampering with information", text: "Integrity" },
      { title: "Unauthorized access", text: "Authorization" },
      { title: "Phishing", text: "Authentication" }
    ],
    points: [
      "It can be easier to start in terms of threats.",
      "Information disclosure maps to confidentiality.",
      "Denial-of-service maps to availability; tampering maps to integrity."
    ]
  },
  {
    source: "37",
    section: "Security requirements",
    title: "Phishing and spoofing are related, but not the same",
    subtitle: "Phishing retrieves sensitive information; spoofing helps deliver deception.",
    visual: "balance",
    visualItems: [
      { title: "Phishing", text: "Tricks you into giving sensitive financial information to a cyber crook." },
      { title: "Spoofing", text: "Impersonates or falsifies a source and may deliver malware." }
    ],
    points: [
      "Spoofing can download malware to your computer or network.",
      "Phishing tricks users into giving up sensitive financial information.",
      "The source summary: phishing is a method of retrieval, while spoofing is a means of delivery."
    ]
  },
  {
    source: "38",
    section: "CIA deep dive",
    title: "Confidentiality means access on a need-to-know basis",
    subtitle: "Access control specifies who can access what.",
    visual: "flow",
    visualItems: [
      { title: "Identity", text: "Who is the user?" },
      { title: "Authentication", text: "Can we verify the identity?" },
      { title: "Access control", text: "Who can access what?" },
      { title: "Need to know", text: "Access is limited by purpose." },
      { title: "Confidentiality", text: "Unauthorized users cannot read information." }
    ],
    points: [
      "Confidentiality is about unauthorized users not reading information.",
      "We need identity and authentication to know who is requesting access.",
      "Confidentiality can be difficult to ensure but easiest to assess in a binary success/fail sense."
    ]
  },
  {
    source: "39",
    section: "CIA deep dive",
    title: "Integrity is about unauthorized modification",
    subtitle: "Integrity is harder to measure because it is contextual and often non-binary.",
    visual: "cards",
    visualItems: [
      { title: "Confidentiality", text: "Concerned with access to assets." },
      { title: "Integrity", text: "Concerned with unauthorized modification of assets." },
      { title: "Context", text: "Means different things for a bank account or a medical record." }
    ],
    points: [
      "Integrity is concerned with unauthorized modification of assets.",
      "It is more difficult to measure than confidentiality.",
      "Integrity has degrees and depends on context."
    ]
  },
  {
    source: "40",
    section: "CIA deep dive",
    title: "Availability is complex and context-dependent",
    subtitle: "Availability can refer to usefulness, capacity, pace, completion time, and more.",
    visual: "cards",
    visualItems: [
      { title: "Useful", text: "The asset provides intended value." },
      { title: "Capacity", text: "There are enough resources." },
      { title: "Pace", text: "Progress occurs at an acceptable rate." },
      { title: "Completion", text: "Work finishes within an acceptable period." }
    ],
    points: [
      "The source slide cites Pfleeger and Pfleeger.",
      "Availability is complex and context-dependent.",
      "It could mean any subset of usefulness, sufficient capacity, proper pace, and acceptable completion time."
    ]
  },
  {
    source: "41",
    section: "CIA deep dive",
    title: "Availability has operational properties",
    subtitle: "A resource is available when authorized users can use it as intended.",
    visual: "cards",
    visualItems: [
      { title: "Timely response", text: "Requests receive responses in time." },
      { title: "Fair allocation", text: "No starvation of resources." },
      { title: "Fault tolerance", text: "No total breakdown." },
      { title: "Usability", text: "Easy to use in the intended way." },
      { title: "Concurrency", text: "Controls deadlock and shared access." }
    ],
    points: [
      "Availability includes timely request response.",
      "It includes fair allocation of resources and fault tolerance.",
      "It also includes usability and controlled concurrency."
    ]
  },
  {
    source: "42",
    section: "CIA tradeoffs",
    title: "Security requirements must be balanced",
    subtitle: "Improving one security property can weaken another.",
    visual: "balance",
    visualItems: [
      { title: "More confidentiality", text: "Disconnecting from the internet may reduce exposure but harms availability and updates." },
      { title: "More integrity checking", text: "More reviews can improve integrity but reduce confidentiality and availability." }
    ],
    points: [
      "Example 1: disconnecting a computer from the internet can increase confidentiality.",
      "Availability suffers, and integrity may suffer due to lost updates.",
      "Example 2: extensive data checks can increase integrity but may reduce confidentiality and availability."
    ]
  },
  {
    source: "43",
    section: "Defense strategy",
    title: "What should the good guys do?",
    subtitle: "Security work is a cycle: prevention, detection, response, recovery.",
    visual: "loop",
    visualItems: [
      { title: "Prevention" },
      { title: "Detection" },
      { title: "Response" },
      { title: "Recovery and remediation" }
    ],
    points: [
      "Prevention attempts to stop harm before it happens.",
      "Detection finds evidence that something is wrong.",
      "Response, recovery, and remediation reduce damage and restore confidence."
    ],
    activity: "Policy is what; mechanism is how"
  },
  {
    source: "44",
    section: "Secure design",
    title: "Reduce vulnerabilities with basic secure design principles",
    subtitle: "Complexity is the enemy: economy of mechanism.",
    visual: "principles",
    visualItems: [
      { title: "Economy of mechanism", text: "Keep design simple." },
      { title: "Fail-safe defaults", text: "Default situation is lack of access." },
      { title: "Complete mediation", text: "Check access consistently." },
      { title: "Open design", text: "Security should not depend on secrecy of design." },
      { title: "Least privilege", text: "Give only the access needed." },
      { title: "Psychological acceptability", text: "Security must be usable." }
    ],
    points: [
      "Complexity is the enemy.",
      "Fail-safe defaults and least privilege reduce accidental exposure.",
      "Psychological acceptability reminds us that users are part of the system."
    ]
  },
  {
    source: "45",
    section: "Summary",
    title: "Security mindset: what students should take away",
    subtitle: "Cybersecurity is a large problem for people, governments, companies, and society.",
    visual: "flow",
    visualItems: [
      { title: "Assets", text: "What has value?" },
      { title: "Threats", text: "Who or what could harm it?" },
      { title: "Vulnerabilities", text: "What weaknesses exist?" },
      { title: "Attacks", text: "How can weaknesses be exploited?" },
      { title: "Assurance", text: "How do controls improve confidence?" }
    ],
    points: [
      "Cybersecurity is a huge problem for people, governments, companies, and more.",
      "The goal is to enhance the level of assurance of systems.",
      "A security mindset requires knowing threats, actors, motivations, and how attacks succeed."
    ],
    activity: "Exit prompt: explain one CIA tradeoff"
  }
];
