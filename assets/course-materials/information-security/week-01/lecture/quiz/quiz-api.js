const CONFIG = window.QUIZ_CONFIG || {};
const STORAGE_KEY = "tc2007b-quiz-pilot";

const demoQuestionBanks = {
  "tc2007b-w1-l1": [
  {
    id: "q-cia-goals",
    prompt: "Which three goals make up the CIA triad?",
    options: ["Confidentiality, integrity, availability", "Control, identity, authorization", "Cryptography, isolation, auditing", "Compliance, inspection, access"],
    answer: 0
  },
  {
    id: "q-dos",
    prompt: "A denial-of-service attack primarily violates which requirement?",
    options: ["Integrity", "Availability", "Confidentiality", "Accountability"],
    answer: 1
  },
  {
    id: "q-bank-balance",
    prompt: "An unauthorized change to a bank balance is mainly an attack on what?",
    options: ["Availability", "Confidentiality", "Integrity", "Authentication"],
    answer: 2
  },
  {
    id: "q-password-file",
    prompt: "A leaked password file is mainly a failure of what?",
    options: ["Confidentiality", "Availability", "Integrity", "Non-repudiation"],
    answer: 0
  },
  {
    id: "q-value-risk",
    prompt: "The lecture frames a security problem as the combination of which two ideas?",
    options: ["Policy and mechanism", "Value and risk", "Privacy and law", "Hardware and software"],
    answer: 1
  },
  {
    id: "q-phishing",
    prompt: "What does phishing usually try to make the victim do?",
    options: ["Increase system availability", "Give up sensitive information", "Patch a vulnerability", "Encrypt a database"],
    answer: 1
  },
  {
    id: "q-spoofing",
    prompt: "Spoofing is best described as what?",
    options: ["Disguising the source or identity", "Repairing damaged data", "Blocking all network traffic", "Measuring password strength"],
    answer: 0
  },
  {
    id: "q-least-privilege",
    prompt: "Least privilege means giving a user or component what level of access?",
    options: ["Administrator access by default", "Only the access it needs", "Temporary access to everything", "Access based on seniority"],
    answer: 1
  },
  {
    id: "q-open-design",
    prompt: "Open design says security should not depend on what?",
    options: ["The attacker being slow", "The design remaining secret", "Users choosing strong passwords", "Backups being available"],
    answer: 1
  },
  {
    id: "q-defense-lifecycle",
    prompt: "Which sequence matches the defense lifecycle from the lecture?",
    options: ["Detect, prevent, recover, respond", "Prevent, detect, respond, recover", "Recover, detect, prevent, respond", "Respond, prevent, recover, detect"],
    answer: 1
  },
  {
    id: "q-policy-mechanism",
    prompt: "In security design, policy is the 'what'. What is mechanism?",
    options: ["The budget", "The course rule", "The technical how", "The attacker motive"],
    answer: 2
  },
  {
    id: "q-balance",
    prompt: "Why does the lecture say we balance CIA rather than maximize all three?",
    options: ["They can pull against each other", "They are legally optional", "Only confidentiality matters", "They are the same property"],
    answer: 0
  }
  ],
  "tc2007b-w1-l2": [
    {
      id: "q-law-ethics",
      prompt: "What is the best description of the relationship between law and ethics?",
      options: ["They are always identical", "Ethics can guide behavior beyond what law requires", "Ethics matters only when there is no technology", "Law never affects security work"],
      answer: 1,
      explanation: "Professional ethics can ask for responsible behavior even when the law is incomplete or slow."
    },
    {
      id: "q-law-privacy",
      prompt: "Accidentally receiving sensitive health data most directly raises which issue?",
      options: ["Privacy", "Availability only", "Password entropy", "Packet filtering"],
      answer: 0,
      explanation: "Sensitive personal data creates privacy and legal/ethical handling duties."
    },
    {
      id: "q-law-authorization",
      prompt: "A useful ethical test before accessing data is to ask what?",
      options: ["Can I technically open it?", "Am I authorized and is there a legitimate purpose?", "Will the file load quickly?", "Can I guess the password?"],
      answer: 1,
      explanation: "Technical ability is not the same as authorization or legitimacy."
    },
    {
      id: "q-law-disclosure",
      prompt: "Responsible vulnerability disclosure aims to balance what?",
      options: ["Public safety and giving maintainers time to fix", "Speed and entertainment", "Secrecy forever and no documentation", "Deleting evidence and moving on"],
      answer: 0,
      explanation: "Responsible disclosure reduces harm while enabling repair."
    },
    {
      id: "q-law-consent",
      prompt: "Why is consent important in security testing?",
      options: ["It makes attacks impossible", "It separates authorized testing from unauthorized intrusion", "It removes the need for scope", "It guarantees no bugs"],
      answer: 1,
      explanation: "Permission and scope are what make testing legitimate."
    },
    {
      id: "q-law-ownership",
      prompt: "Finding an exposed database online means you should first do what?",
      options: ["Download all records", "Share screenshots publicly", "Avoid accessing data and report through an appropriate channel", "Try common passwords"],
      answer: 2,
      explanation: "Minimize access and report responsibly."
    },
    {
      id: "q-law-minimization",
      prompt: "Data minimization means collecting what?",
      options: ["Everything possible", "Only what is needed for the stated purpose", "Only encrypted data with no purpose", "Only passwords"],
      answer: 1,
      explanation: "Collecting less sensitive data reduces risk and supports privacy."
    },
    {
      id: "q-law-logs",
      prompt: "Security logs can create privacy risk because they may contain what?",
      options: ["Personal identifiers and behavior traces", "Only random noise", "No useful information", "Only public holidays"],
      answer: 0,
      explanation: "Logs can reveal identities, actions, locations, and timing."
    },
    {
      id: "q-law-scope",
      prompt: "In an authorized pentest, scope defines what?",
      options: ["What systems and actions are permitted", "The color of the report", "The student's grade", "The hashing algorithm only"],
      answer: 0,
      explanation: "Scope prevents testing from becoming unauthorized activity."
    },
    {
      id: "q-law-harm",
      prompt: "A core ethical principle for security work is to avoid what?",
      options: ["Documenting findings", "Unnecessary harm", "Getting permission", "Reducing risk"],
      answer: 1,
      explanation: "Security work should reduce harm, not create avoidable damage."
    }
  ],
  "tc2007b-w2-l1": [
    {
      id: "q-auth-authn",
      prompt: "Authentication answers which question?",
      options: ["What are you allowed to do?", "Who are you?", "Was the message modified?", "Is the service online?"],
      answer: 1,
      explanation: "Authentication verifies identity. Authorization decides allowed actions."
    },
    {
      id: "q-auth-factors",
      prompt: "Which option combines two different authentication factors?",
      options: ["Password and PIN", "Password and security question", "Password and authenticator app code", "Two different passwords"],
      answer: 2,
      explanation: "A password is something you know; an authenticator app code is something you have."
    },
    {
      id: "q-auth-salt",
      prompt: "Why do password hashes need salts?",
      options: ["To make passwords shorter", "To prevent identical passwords from producing identical stored hashes", "To let users log in without passwords", "To encrypt the database"],
      answer: 1,
      explanation: "A unique salt makes precomputed/rainbow-table attacks much less useful."
    },
    {
      id: "q-auth-slowhash",
      prompt: "Which storage design is safest after a password database leak?",
      options: ["Plaintext passwords", "Fast unsalted hashes", "Slow salted password hashes", "Encrypted passwords with the key in the same table"],
      answer: 2,
      explanation: "Slow salted password hashing makes offline guessing more expensive."
    },
    {
      id: "q-auth-biometrics",
      prompt: "What is a major risk of relying on biometrics?",
      options: ["They are easy to rotate after a leak", "They cannot be copied by sensors", "They are hard to change if compromised", "They remove all false positives"],
      answer: 2,
      explanation: "You can change a password, but you cannot easily change your fingerprint or face."
    },
    {
      id: "q-auth-mfa-phishing",
      prompt: "Which MFA method is generally more phishing-resistant?",
      options: ["SMS code", "Email code", "Push approval with no context", "Hardware security key / passkey"],
      answer: 3,
      explanation: "Security keys and passkeys bind authentication to the legitimate site."
    },
    {
      id: "q-auth-rotation",
      prompt: "Current password guidance generally discourages forced periodic password changes because they often cause what?",
      options: ["Better memorization", "Weaker predictable passwords", "More entropy", "Faster hashing"],
      answer: 1,
      explanation: "Forced rotation often pushes users toward predictable patterns."
    },
    {
      id: "q-auth-online-offline",
      prompt: "A leaked hash file mainly creates what type of attacker opportunity?",
      options: ["Offline guessing", "Physical tailgating", "DNS spoofing", "Availability failure"],
      answer: 0,
      explanation: "Attackers can test guesses offline without hitting the login page."
    },
    {
      id: "q-auth-lockout",
      prompt: "Rate limiting login attempts mainly protects against what?",
      options: ["Stored XSS", "Online brute force", "Disk failure", "Role explosion"],
      answer: 1,
      explanation: "Rate limiting slows repeated online guesses."
    },
    {
      id: "q-auth-usability",
      prompt: "Why is authentication a usability problem too?",
      options: ["Users bypass painful systems", "Users never make mistakes", "Security improves when login is confusing", "Usability and security never interact"],
      answer: 0,
      explanation: "If authentication is too painful, people find workarounds that can weaken security."
    }
  ],
  "tc2007b-w2-l2": [
    {
      id: "q-ac-authz",
      prompt: "Authorization answers which question?",
      options: ["Who are you?", "What are you allowed to do?", "Was the password leaked?", "How fast is the network?"],
      answer: 1,
      explanation: "Authorization decides whether an authenticated subject may perform an action."
    },
    {
      id: "q-ac-subject-object",
      prompt: "In access control, a file, database row, or room is usually called what?",
      options: ["Subject", "Object", "Clearance", "Nonce"],
      answer: 1,
      explanation: "Objects are the resources being protected."
    },
    {
      id: "q-ac-dac",
      prompt: "A document owner deciding who can read their file is an example of which model?",
      options: ["DAC", "MAC", "RBAC", "ABAC"],
      answer: 0,
      explanation: "Discretionary access control lets the owner make sharing decisions."
    },
    {
      id: "q-ac-mac",
      prompt: "Security labels such as Confidential and Secret are most closely associated with which model?",
      options: ["DAC", "MAC", "RBAC", "Password hashing"],
      answer: 1,
      explanation: "Mandatory access control often uses labels and clearances."
    },
    {
      id: "q-ac-rbac",
      prompt: "Teaching assistants can grade labs because they hold the TA role. Which model is this?",
      options: ["DAC", "RBAC", "XSS", "CAPTCHA"],
      answer: 1,
      explanation: "Role-based access control grants permissions through roles."
    },
    {
      id: "q-ac-abac",
      prompt: "A policy that depends on role, device health, time, and location is closest to which model?",
      options: ["DAC", "MAC only", "ABAC", "Plain ACL"],
      answer: 2,
      explanation: "Attribute-based access control uses subject, object, and environment attributes."
    },
    {
      id: "q-ac-least-privilege",
      prompt: "Least privilege means access should be what?",
      options: ["Maximum by default", "Only what the task requires", "Equal for all users", "Hidden from logs"],
      answer: 1,
      explanation: "Least privilege grants the smallest sufficient permission set."
    },
    {
      id: "q-ac-acl",
      prompt: "An access control list is usually organized around what?",
      options: ["The object/resource", "The password salt", "The IP packet checksum", "The user's memory"],
      answer: 0,
      explanation: "ACLs live with or describe the object and list who can access it."
    },
    {
      id: "q-ac-capability",
      prompt: "A capability is best understood as what?",
      options: ["A token held by a subject that grants access", "A password complexity rule", "A SQL command", "A biometric false reject"],
      answer: 0,
      explanation: "Capabilities are unforgeable tokens that carry authority."
    },
    {
      id: "q-ac-complete-mediation",
      prompt: "Complete mediation requires what?",
      options: ["Checking every access request", "Only checking the first request", "Never logging decisions", "Letting users own all policies"],
      answer: 0,
      explanation: "Every access must be checked; one unguarded path can defeat the policy."
    }
  ],
  "tc2007b-w3-l1": [
    {
      id: "q-app-sqli",
      prompt: "SQL injection happens when untrusted input is treated as what?",
      options: ["Plain text", "Executable query structure", "A backup", "A password salt"],
      answer: 1,
      explanation: "Injection occurs when data changes the meaning of a command."
    },
    {
      id: "q-app-parameterized",
      prompt: "Parameterized queries defend against SQL injection by doing what?",
      options: ["Deleting all input", "Separating code from data", "Hiding error pages only", "Forcing password rotation"],
      answer: 1,
      explanation: "The database receives user input as values, not SQL syntax."
    },
    {
      id: "q-app-client-validation",
      prompt: "Why is client-side validation alone insufficient?",
      options: ["Browsers cannot show forms", "Attackers can bypass the client and call the server directly", "It prevents all SQL injection", "It encrypts passwords"],
      answer: 1,
      explanation: "The browser is outside your trust boundary."
    },
    {
      id: "q-app-xss",
      prompt: "Cross-site scripting mainly abuses what?",
      options: ["A browser interpreting untrusted content as code", "A database backup schedule", "A biometric scanner", "An offline hash file"],
      answer: 0,
      explanation: "XSS occurs when untrusted content runs as script in a victim's browser."
    },
    {
      id: "q-app-output-encoding",
      prompt: "Rendering a user comment with textContent instead of innerHTML helps prevent what?",
      options: ["SQL injection", "Stored or reflected XSS", "Password reuse", "Packet loss"],
      answer: 1,
      explanation: "textContent treats the comment as text rather than markup."
    },
    {
      id: "q-app-least-privilege-db",
      prompt: "Why should an app's database account have limited privileges?",
      options: ["To limit damage if the app is exploited", "To make queries slower", "To let every user become admin", "To avoid backups"],
      answer: 0,
      explanation: "Least privilege limits blast radius after compromise."
    },
    {
      id: "q-app-errors",
      prompt: "Detailed database error messages shown to users can help attackers by revealing what?",
      options: ["Schema and query clues", "The teacher PIN", "The student's browser theme", "Only the clock time"],
      answer: 0,
      explanation: "Verbose errors can leak table names, fields, and query structure."
    },
    {
      id: "q-app-trust-boundary",
      prompt: "A trust boundary is crossed when data moves between what?",
      options: ["Areas with different trust assumptions", "Two CSS files", "Two identical passwords", "A slide and a projector"],
      answer: 0,
      explanation: "Trust boundaries mark places where assumptions and validation requirements change."
    },
    {
      id: "q-app-owasp",
      prompt: "The OWASP Top 10 is best used as what?",
      options: ["A web application risk awareness guide", "A replacement for testing", "A password manager", "A database engine"],
      answer: 0,
      explanation: "OWASP Top 10 helps frame common web application risk categories."
    },
    {
      id: "q-app-defense-depth",
      prompt: "Which combination best reflects defense in depth for app security?",
      options: ["Client checks only", "Parameters, server validation, output encoding, and least privilege", "Hiding the login page", "Using one admin database account for everything"],
      answer: 1,
      explanation: "Layered defenses reduce the chance that one mistake becomes a breach."
    }
  ],
  "tc2007b-w4-bridge": [
    {
      id: "q-release-block-auth",
      prompt: "Which finding should usually block release for a student-data system?",
      options: ["Missing authentication on a records endpoint", "A typo in helper text", "A button with weak contrast", "A slow animation"],
      answer: 0,
      explanation: "Unauthenticated access to sensitive records is a high-impact access-control failure."
    },
    {
      id: "q-release-sqli-control",
      prompt: "What is the strongest direct defense against SQL injection in application queries?",
      options: ["Parameterized queries", "A longer login page", "A hidden form field", "A public error page"],
      answer: 0,
      explanation: "Parameterized queries separate SQL code from user-supplied data."
    },
    {
      id: "q-release-xss-control",
      prompt: "Rendering untrusted comments as text instead of HTML helps prevent what?",
      options: ["Cross-site scripting", "Diffie-Hellman failure", "Packet loss", "Password rotation"],
      answer: 0,
      explanation: "Text rendering prevents the browser from interpreting untrusted content as script."
    },
    {
      id: "q-release-client-validation",
      prompt: "Why is browser-only validation not enough for security?",
      options: ["Attackers can bypass the browser and call the server directly", "Browsers cannot send requests", "Validation makes encryption impossible", "It prevents all attacks"],
      answer: 0,
      explanation: "Server-side validation is required because the client is outside the trust boundary."
    },
    {
      id: "q-release-dependency",
      prompt: "A known remote-code-execution issue in a production dependency should lead to what?",
      options: ["Patch, replace, or isolate the dependency", "Ignore it because it is third-party code", "Only change the color theme", "Delete all logs"],
      answer: 0,
      explanation: "Known dangerous dependencies must be remediated or isolated before they become a breach path."
    },
    {
      id: "q-release-risk-factor",
      prompt: "Risk triage usually considers which two ideas together?",
      options: ["Likelihood and impact", "Font and color", "Number of slides and room size", "File name and folder name"],
      answer: 0,
      explanation: "Risk combines how likely exploitation is with how much harm it would cause."
    },
    {
      id: "q-release-least-priv-db",
      prompt: "Why should the application database account have limited privileges?",
      options: ["To limit damage if the app is exploited", "To make every query public", "To avoid backups", "To give all users admin access"],
      answer: 0,
      explanation: "Least privilege reduces blast radius after compromise."
    },
    {
      id: "q-release-hidden-endpoint",
      prompt: "Why is hiding a vulnerable link not a real fix?",
      options: ["Attackers can call the endpoint directly", "Hidden links are always encrypted", "It creates too many passwords", "It makes TLS expire"],
      answer: 0,
      explanation: "Security must be enforced by the server, not by hoping nobody sees a link."
    },
    {
      id: "q-release-gate",
      prompt: "A good release gate for a critical fix should include what?",
      options: ["Repair and retest the affected path", "Ship first and hope", "Remove the documentation", "Ask users to avoid the bug"],
      answer: 0,
      explanation: "Critical fixes need verification before deployment."
    },
    {
      id: "q-release-logs-privacy",
      prompt: "Why can security logs create privacy risk?",
      options: ["They may contain identifiers and behavior traces", "They never contain useful data", "They disable authentication", "They remove all risk"],
      answer: 0,
      explanation: "Logs can reveal who did what, when, and from where."
    }
  ],
  "tc2007b-w5-l1": [
    {
      id: "q-crypto-public",
      prompt: "In public-key cryptography, which key is safe to share?",
      options: ["Private key", "Public key", "Session key only", "Password hash"],
      answer: 1,
      explanation: "The public key is designed to be shared; the private key must remain secret."
    },
    {
      id: "q-crypto-confidential",
      prompt: "To send Alice a confidential message, Bob should encrypt with whose key?",
      options: ["Bob's private key", "Bob's public key", "Alice's public key", "Alice's password"],
      answer: 2,
      explanation: "Encrypting with Alice's public key means only Alice's private key should decrypt it."
    },
    {
      id: "q-crypto-sign",
      prompt: "A digital signature is created with which key?",
      options: ["The sender's private key", "The sender's public key", "The receiver's public key", "A shared password"],
      answer: 0,
      explanation: "The signer uses their private key; others verify with the public key."
    },
    {
      id: "q-crypto-dh-purpose",
      prompt: "Diffie-Hellman is mainly used to do what?",
      options: ["Hash passwords", "Agree on a shared secret over an open channel", "Compress data", "Detect malware"],
      answer: 1,
      explanation: "Diffie-Hellman lets two parties derive a shared secret without sending the secret itself."
    },
    {
      id: "q-crypto-mod",
      prompt: "What does 'mod' mean in modular arithmetic?",
      options: ["The remainder after division", "The largest prime number", "The private key", "The browser mode"],
      answer: 0,
      explanation: "Modulo arithmetic keeps the remainder after division."
    },
    {
      id: "q-crypto-rsa-hard",
      prompt: "RSA security relies heavily on the difficulty of what problem?",
      options: ["Factoring large products of primes", "Sorting small arrays", "Finding CSS colors", "Counting packets"],
      answer: 0,
      explanation: "RSA is built around arithmetic where factoring the modulus is hard at real sizes."
    },
    {
      id: "q-crypto-padding",
      prompt: "Why should textbook/raw RSA not be used directly?",
      options: ["It is too randomized", "It needs secure padding and protocol design", "It cannot use public keys", "It only works for images"],
      answer: 1,
      explanation: "Real RSA schemes need safe padding; raw RSA has dangerous structure."
    },
    {
      id: "q-crypto-ecc",
      prompt: "A common advantage of elliptic-curve cryptography is what?",
      options: ["Shorter keys for comparable security", "No need for private keys", "It removes authentication", "It breaks all hashes"],
      answer: 0,
      explanation: "ECC can provide comparable security with smaller keys than classic RSA."
    },
    {
      id: "q-crypto-pq",
      prompt: "Post-quantum cryptography matters because large quantum computers threaten which public-key systems?",
      options: ["Many RSA and elliptic-curve systems", "All one-time pads", "Every backup", "Only HTML"],
      answer: 0,
      explanation: "Shor's algorithm threatens RSA, Diffie-Hellman, and ECC if large quantum computers become practical."
    },
    {
      id: "q-crypto-authenticity",
      prompt: "Encryption alone primarily provides confidentiality. What adds origin authenticity?",
      options: ["A digital signature or MAC", "A larger font", "A public website", "Disabling logs"],
      answer: 0,
      explanation: "Signatures and MACs help prove who created or authorized a message."
    }
  ],
  "tc2007b-w6-bridge": [
    {
      id: "q-sym-aead",
      prompt: "Authenticated encryption provides which combination?",
      options: ["Confidentiality plus tamper detection", "Compression plus backups", "Only public identity", "Only password rotation"],
      answer: 0,
      explanation: "AEAD modes protect secrecy and detect unauthorized modification."
    },
    {
      id: "q-sym-ecb",
      prompt: "Why is ECB mode dangerous for structured data?",
      options: ["It leaks patterns in repeated plaintext blocks", "It is too random", "It requires no key", "It only works with images"],
      answer: 0,
      explanation: "Equal plaintext blocks produce equal ciphertext blocks in ECB."
    },
    {
      id: "q-sym-nonce",
      prompt: "For many modern encryption modes, a nonce used with the same key should be what?",
      options: ["Unique", "Secret forever", "A password", "The same for every file"],
      answer: 0,
      explanation: "Nonce reuse under the same key can break confidentiality or integrity guarantees."
    },
    {
      id: "q-sym-key-repo",
      prompt: "What is wrong with storing production encryption keys in a public code repository?",
      options: ["A leaked key can expose protected data", "Keys must always be public", "It makes hashes slower", "It improves availability only"],
      answer: 0,
      explanation: "If the key leaks, ciphertext protected by it may become readable."
    },
    {
      id: "q-sym-rotation",
      prompt: "After evidence that a key was copied, what should happen?",
      options: ["Rotate the key and re-protect affected data as needed", "Keep using it forever", "Publish it for transparency", "Switch to ECB"],
      answer: 0,
      explanation: "Rotation limits future damage after compromise."
    },
    {
      id: "q-sym-password-hash",
      prompt: "Passwords should be stored with what kind of function?",
      options: ["Slow salted password hash", "Fast unsalted checksum", "Plain AES with the key in the same table", "Base64 encoding"],
      answer: 0,
      explanation: "Slow salted password hashing raises the cost of offline guessing."
    },
    {
      id: "q-sym-hybrid",
      prompt: "Hybrid encryption commonly uses public-key crypto to protect what?",
      options: ["A symmetric session key", "The CSS file", "The user's keyboard", "Only the log format"],
      answer: 0,
      explanation: "The public-key step protects a fresh symmetric key used for efficient data encryption."
    },
    {
      id: "q-sym-at-rest",
      prompt: "Encrypting laptop disks mainly protects data in which situation?",
      options: ["Device lost or stolen while powered off", "A user willingly gives away their password", "A valid admin queries the database", "A page has an XSS bug"],
      answer: 0,
      explanation: "Disk encryption helps when storage media is physically lost or stolen."
    },
    {
      id: "q-sym-integrity",
      prompt: "Encryption without integrity can leave a system vulnerable to what?",
      options: ["Undetected ciphertext modification", "Longer passwords", "Better logging", "More accurate clocks"],
      answer: 0,
      explanation: "Integrity protection is needed to detect tampering."
    },
    {
      id: "q-sym-kms",
      prompt: "A key-management service helps mainly by doing what?",
      options: ["Controlling, auditing, and separating access to keys", "Making all keys public", "Removing the need for authentication", "Turning encryption into compression"],
      answer: 0,
      explanation: "Key-management systems help enforce access control, logging, and rotation."
    }
  ],
  "tc2007b-w7-l1": [
    {
      id: "q-proto-nonce",
      prompt: "What is the main purpose of a nonce in an authentication protocol?",
      options: ["Freshness and replay protection", "Data compression", "Password storage", "Firewall filtering"],
      answer: 0,
      explanation: "A nonce helps prove the message is fresh and not just an old replay."
    },
    {
      id: "q-proto-reflection",
      prompt: "A reflection attack often exploits what protocol design mistake?",
      options: ["Messages valid in both directions", "Too many backups", "Long hash outputs", "Packet fragmentation"],
      answer: 0,
      explanation: "If a message is valid both ways, an attacker may reflect a challenge back to the initiator."
    },
    {
      id: "q-proto-session-key",
      prompt: "Why do protocols commonly establish session keys?",
      options: ["To limit long-term key exposure", "To remove authentication", "To make every packet public", "To replace all logging"],
      answer: 0,
      explanation: "Session keys reduce how often long-term secrets are used."
    },
    {
      id: "q-proto-kdc",
      prompt: "Kerberos relies on what kind of trusted component?",
      options: ["Key Distribution Center", "Web Application Firewall", "DNS cache only", "Packet sniffer"],
      answer: 0,
      explanation: "Kerberos uses a trusted KDC to issue tickets."
    },
    {
      id: "q-hash-preimage",
      prompt: "Preimage resistance means it is hard to do what?",
      options: ["Find a message from its hash", "Find any network port", "Encrypt a file", "Create a firewall rule"],
      answer: 0,
      explanation: "Preimage resistance makes reversing a digest hard."
    },
    {
      id: "q-hash-collision",
      prompt: "Collision resistance means it is hard to find what?",
      options: ["Two different messages with the same hash", "One password with uppercase letters", "A valid IP address", "A public key"],
      answer: 0,
      explanation: "A collision is two distinct inputs with the same digest."
    },
    {
      id: "q-hash-birthday",
      prompt: "The birthday paradox implies that collision search for an n-bit hash takes roughly how much work?",
      options: ["2^(n/2)", "2^n exactly for all cases", "n steps", "One login attempt"],
      answer: 0,
      explanation: "Birthday attacks reduce collision-search work to around 2^(n/2)."
    },
    {
      id: "q-hash-md5",
      prompt: "Why should MD5 and SHA-1 be avoided for collision-sensitive uses?",
      options: ["They have practical collision weaknesses", "They are too slow for all uses", "They require public keys", "They only work on images"],
      answer: 0,
      explanation: "MD5 and SHA-1 are broken for modern collision-resistance needs."
    },
    {
      id: "q-hmac",
      prompt: "HMAC adds what to a hash to authenticate a message?",
      options: ["A shared secret key", "A public font", "A firewall port", "A QR code"],
      answer: 0,
      explanation: "HMAC uses a shared secret plus a hash construction."
    },
    {
      id: "q-hash-password",
      prompt: "Why are fast hashes not ideal for password storage?",
      options: ["They help attackers test guesses quickly", "They make passwords too long", "They cannot verify integrity", "They require a DMZ"],
      answer: 0,
      explanation: "Password hashing should slow offline guessing."
    }
  ],
  "tc2007b-w8-bridge": [
    {
      id: "q-tls-purpose",
      prompt: "TLS for a website mainly provides what?",
      options: ["Encrypted channel plus server authentication", "Only a nicer URL", "Password hashing", "Firewall rule ordering"],
      answer: 0,
      explanation: "TLS protects the channel and helps prove the server identity."
    },
    {
      id: "q-cert-hostname",
      prompt: "A certificate for portal.example.com used on bank.example.com is what kind of problem?",
      options: ["Hostname identity failure", "Password entropy success", "Packet filtering success", "A normal backup"],
      answer: 0,
      explanation: "The certificate name must match the site being visited."
    },
    {
      id: "q-cert-expired",
      prompt: "An expired certificate most directly fails which check?",
      options: ["Validity period", "Font size", "SQL syntax", "Malware family"],
      answer: 0,
      explanation: "Certificates are trusted only within their valid date range."
    },
    {
      id: "q-cert-issuer",
      prompt: "An untrusted certificate issuer means the browser cannot verify what?",
      options: ["A chain to a trusted authority", "The user's favorite color", "The firewall brand", "The hash output length"],
      answer: 0,
      explanation: "The certificate chain needs a trusted root or configured trust anchor."
    },
    {
      id: "q-hsts",
      prompt: "HSTS helps defend against what?",
      options: ["HTTP downgrade and accidental insecure fallback", "SQL injection", "Password reuse by itself", "Disk theft"],
      answer: 0,
      explanation: "HSTS instructs browsers to connect to the site only over HTTPS."
    },
    {
      id: "q-downgrade",
      prompt: "A proxy that forces HTTPS traffic down to HTTP is best treated as what?",
      options: ["An active channel attack", "A harmless visual bug", "A password-strength improvement", "A data backup"],
      answer: 0,
      explanation: "Downgrades remove the security properties users expect from TLS."
    },
    {
      id: "q-vpn",
      prompt: "A VPN or zero-trust access gateway is most useful when users need what?",
      options: ["Authenticated encrypted access to internal services", "A faster hash collision", "A public certificate for every file", "No authorization checks"],
      answer: 0,
      explanation: "Remote access should authenticate users and protect traffic to private services."
    },
    {
      id: "q-ct",
      prompt: "Certificate transparency monitoring can help detect what?",
      options: ["Unexpected certificates issued for a domain", "Every SQL injection", "All phishing emails automatically", "Lost USB drives"],
      answer: 0,
      explanation: "Public certificate logs can reveal suspicious or mistaken issuance."
    },
    {
      id: "q-public-wifi",
      prompt: "On public Wi-Fi, why should students avoid sending credentials over HTTP?",
      options: ["Credentials and content can be intercepted or modified", "HTTP makes passwords longer", "Wi-Fi blocks every attacker", "HTTP automatically signs messages"],
      answer: 0,
      explanation: "HTTP has no TLS protection for confidentiality or integrity."
    },
    {
      id: "q-channel-authn",
      prompt: "A secure channel is weak if encryption is present but endpoint identity is not verified because why?",
      options: ["You may be encrypting to the wrong party", "Encryption stops needing keys", "It fixes all app bugs", "It removes every firewall rule"],
      answer: 0,
      explanation: "Confidentiality only helps if the other endpoint is the intended one."
    }
  ],
  "tc2007b-w9-l1": [
    {
      id: "q-malware-definition",
      prompt: "Malware is software designed primarily to do what?",
      options: ["Violate security goals", "Improve backups", "Patch systems", "Document requirements"],
      answer: 0,
      explanation: "Malware is code designed to violate confidentiality, integrity, availability, or control."
    },
    {
      id: "q-malware-virus",
      prompt: "A virus is usually distinguished by what behavior?",
      options: ["Attaching to host files or programs", "Only filtering packets", "Issuing Kerberos tickets", "Hashing messages"],
      answer: 0,
      explanation: "Viruses infect host code and spread through that host mechanism."
    },
    {
      id: "q-malware-worm",
      prompt: "A worm is especially known for what?",
      options: ["Self-propagating across networks", "Only encrypting backups", "Verifying signatures", "Rendering HTML safely"],
      answer: 0,
      explanation: "Worms spread without needing a user to attach them to a host file."
    },
    {
      id: "q-malware-rootkit",
      prompt: "A rootkit mainly tries to do what?",
      options: ["Hide presence and maintain privileged control", "Make passwords longer", "Open a QR code", "Create a collision-resistant hash"],
      answer: 0,
      explanation: "Rootkits conceal compromise and maintain control."
    },
    {
      id: "q-malware-botnet",
      prompt: "A botnet is best described as what?",
      options: ["Many compromised machines controlled together", "One encrypted file", "A web input form", "A firewall default rule"],
      answer: 0,
      explanation: "Botnets coordinate compromised hosts through command and control."
    },
    {
      id: "q-malware-ransomware",
      prompt: "Ransomware typically harms availability by doing what?",
      options: ["Encrypting or locking files", "Making hashes longer", "Issuing tickets", "Reducing false positives"],
      answer: 0,
      explanation: "Ransomware denies access and demands payment."
    },
    {
      id: "q-malware-apt",
      prompt: "An APT is usually characterized by what?",
      options: ["Persistent, targeted, well-resourced activity", "A single accidental typo", "Only a firewall rule", "A classroom quiz"],
      answer: 0,
      explanation: "Advanced Persistent Threats are targeted and sustained."
    },
    {
      id: "q-malware-fileless",
      prompt: "Fileless malware often abuses what?",
      options: ["Legitimate tools and memory-resident behavior", "Only printed handouts", "Public-key signatures only", "DMZ diagrams"],
      answer: 0,
      explanation: "Fileless malware may live in memory and use trusted system tools."
    },
    {
      id: "q-malware-containment",
      prompt: "What is a good early ransomware response?",
      options: ["Isolate affected systems", "Keep using the infected machine", "Delete all logs", "Pay before investigating"],
      answer: 0,
      explanation: "Containment limits spread and preserves response options."
    },
    {
      id: "q-malware-defense",
      prompt: "Which approach best fits malware defense?",
      options: ["Layered prevention, detection, backups, and recovery", "Only signatures forever", "No patching", "All users as admins"],
      answer: 0,
      explanation: "Modern malware defense needs layered controls."
    }
  ],
  "tc2007b-w10-l1": [
    {
      id: "q-fw-purpose",
      prompt: "A firewall primarily enforces what?",
      options: ["Network access policy", "Password hashing", "Digital signatures", "Student attendance"],
      answer: 0,
      explanation: "Firewalls allow or deny traffic according to policy."
    },
    {
      id: "q-fw-default",
      prompt: "A safer firewall posture is usually what?",
      options: ["Deny by default, allow what is needed", "Allow everything by default", "Disable logs", "Expose databases"],
      answer: 0,
      explanation: "Least privilege applies to network traffic too."
    },
    {
      id: "q-fw-packet",
      prompt: "A basic packet filter commonly examines what?",
      options: ["Addresses, ports, and protocol", "Only user emotion", "Only HTML tags", "Password salts"],
      answer: 0,
      explanation: "Packet filters use header fields such as source, destination, port, and protocol."
    },
    {
      id: "q-fw-stateful",
      prompt: "Stateful inspection adds awareness of what?",
      options: ["Connection state", "Hash collisions", "Biometric fingerprints", "Source code comments"],
      answer: 0,
      explanation: "Stateful firewalls remember whether traffic belongs to an established connection."
    },
    {
      id: "q-fw-waf",
      prompt: "A WAF is designed to inspect what layer most directly?",
      options: ["Web application requests", "Power cables", "Private key storage", "Physical door locks"],
      answer: 0,
      explanation: "A WAF focuses on HTTP/web application behavior."
    },
    {
      id: "q-fw-dmz",
      prompt: "A DMZ is useful for what?",
      options: ["Isolating public-facing services from the internal network", "Storing all passwords in plaintext", "Removing every firewall", "Replacing backups"],
      answer: 0,
      explanation: "A DMZ exposes necessary services while limiting access to internal systems."
    },
    {
      id: "q-fw-bastion",
      prompt: "A bastion host should be what?",
      options: ["Hardened because it is exposed", "Unpatched because it is temporary", "Given every secret", "Hidden inside a student phone"],
      answer: 0,
      explanation: "Bastion hosts face risk and should be hardened."
    },
    {
      id: "q-fw-host",
      prompt: "A host firewall protects what scope?",
      options: ["An individual endpoint", "Only the entire Internet", "Only hash functions", "Only Kerberos tickets"],
      answer: 0,
      explanation: "Host firewalls control local inbound/outbound connections."
    },
    {
      id: "q-fw-ngfw",
      prompt: "A next-generation firewall commonly adds what?",
      options: ["Application/user awareness and threat intelligence", "Less context than a packet filter", "No logging", "Password storage"],
      answer: 0,
      explanation: "NGFWs add richer context beyond simple port rules."
    },
    {
      id: "q-fw-limit",
      prompt: "Which statement is true about firewalls?",
      options: ["They are important but not sufficient alone", "They stop all attacks forever", "They replace secure coding", "They remove the need for detection"],
      answer: 0,
      explanation: "Firewalls are one layer in defense-in-depth."
    }
  ],
  "tc2007b-w11-l1": [
    {
      id: "q-ids-purpose",
      prompt: "Intrusion detection assumes what about prevention?",
      options: ["Prevention is never perfect", "Prevention always catches everything", "Firewalls are useless", "Logs have no value"],
      answer: 0,
      explanation: "IDS exists because some attacks will pass preventive controls."
    },
    {
      id: "q-ids-tp",
      prompt: "An alert on a real attack is called what?",
      options: ["True positive", "False positive", "False negative", "True negative"],
      answer: 0,
      explanation: "The alert is positive and the attack is real."
    },
    {
      id: "q-ids-fp",
      prompt: "An alert on benign activity is called what?",
      options: ["False positive", "True positive", "False negative", "Key exchange"],
      answer: 0,
      explanation: "False positives create analyst workload."
    },
    {
      id: "q-ids-fn",
      prompt: "A real attack with no alert is called what?",
      options: ["False negative", "True negative", "False positive", "Honeypot"],
      answer: 0,
      explanation: "False negatives are missed attacks."
    },
    {
      id: "q-ids-signature",
      prompt: "Signature detection is strongest for what?",
      options: ["Known patterns", "Never-before-seen behavior only", "Physical locks", "Password length"],
      answer: 0,
      explanation: "Signature detection matches known indicators or patterns."
    },
    {
      id: "q-ids-anomaly",
      prompt: "Anomaly detection compares activity against what?",
      options: ["A baseline", "A public key", "A DMZ cable", "A password salt"],
      answer: 0,
      explanation: "Anomaly systems look for deviations from expected behavior."
    },
    {
      id: "q-ids-honeypot",
      prompt: "A honeypot is best described as what?",
      options: ["A decoy system for observing attackers", "A production database with all secrets", "A password hash", "A packet checksum"],
      answer: 0,
      explanation: "Honeypots attract and study suspicious activity."
    },
    {
      id: "q-ids-ips",
      prompt: "An IPS differs from an IDS because it can do what?",
      options: ["Block traffic inline", "Only store passwords", "Never alert", "Remove all firewalls"],
      answer: 0,
      explanation: "Intrusion prevention systems can take blocking action."
    },
    {
      id: "q-ids-base-rate",
      prompt: "The base-rate problem means even accurate detectors can produce many what?",
      options: ["False alarms in low-prevalence environments", "Private keys", "Kerberos tickets", "Backups"],
      answer: 0,
      explanation: "When attacks are rare, false positives can dominate alert queues."
    },
    {
      id: "q-ids-soc",
      prompt: "A SOC should improve alert usefulness by doing what?",
      options: ["Correlating, prioritizing, and adding context", "Alerting on every packet equally", "Deleting all logs", "Ignoring all detections"],
      answer: 0,
      explanation: "SOC work is about turning signals into prioritized investigations."
    }
  ]
};

export function isConfigured() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

export async function createSession(payload) {
  if (isConfigured()) {
    return callFunction("quiz-create-session", payload);
  }

  const code = normalizeCode(payload.session_code) || makeCode();
  const state = readState();
  const startsAt = new Date();
  const lectureId = payload.lecture_id || CONFIG.lectureId;
  state.sessions[code] = {
    session_code: code,
    lecture_id: lectureId,
    title: payload.title || lectureTitle(lectureId),
    question_count: Number(payload.question_count || CONFIG.defaultQuestionCount || 10),
    duration_minutes: Number(payload.duration_minutes || CONFIG.defaultDurationMinutes || 8),
    starts_at: startsAt.toISOString(),
    created_at: startsAt.toISOString(),
    closes_at: new Date(startsAt.getTime() + Number(payload.duration_minutes || 8) * 60000).toISOString(),
    show_explanations: Boolean(payload.show_explanations),
    mode: "demo"
  };
  writeState(state);
  return state.sessions[code];
}

export async function startAttempt(payload) {
  if (isConfigured()) {
    return callFunction("quiz-start-attempt", payload);
  }

  const code = normalizeCode(payload.session_code);
  const studentIdentifier = String(payload.student_identifier || "").trim();
  if (!studentIdentifier) {
    throw new Error("Student ID is required.");
  }
  const state = readState();
  const session = state.sessions[code];
  if (!session) {
    throw new Error("Session not found. Start it from the teacher console first.");
  }
  const selected = shuffle(questionsForLecture(session.lecture_id)).slice(0, Number(session.question_count || 10));
  const attemptId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const attemptQuestions = selected.map((question, index) => {
    const optionRows = question.options.map((text, optionIndex) => ({
      option_id: `${question.id}-o${optionIndex}`,
      text,
      is_correct: optionIndex === question.answer
    }));
    return {
      attempt_question_id: `${attemptId}-${index}`,
      source_question_id: question.id,
      prompt: question.prompt,
      position: index + 1,
      options: shuffle(optionRows).map(({ option_id, text }) => ({ option_id, text }))
    };
  });

  state.attempts[attemptId] = {
    attempt_id: attemptId,
    session_code: code,
    student_name: payload.student_name,
    student_identifier: studentIdentifier,
    started_at: new Date().toISOString(),
    questions: attemptQuestions,
    show_explanations: Boolean(session.show_explanations),
    submitted_at: null,
    score: null,
    total: attemptQuestions.length
  };
  writeState(state);

  return {
    attempt_id: attemptId,
    session_code: code,
    title: session.title,
    closes_at: session.closes_at,
    questions: attemptQuestions.map(({ attempt_question_id, prompt, position, options }) => ({
      attempt_question_id,
      prompt,
      position,
      options
    }))
  };
}

export async function submitAttempt(payload) {
  if (isConfigured()) {
    return callFunction("quiz-submit-attempt", payload);
  }

  const state = readState();
  const attempt = state.attempts[payload.attempt_id];
  if (!attempt) throw new Error("Attempt not found.");
  if (attempt.submitted_at) throw new Error("This attempt was already submitted.");

  const byQuestion = new Map(payload.answers.map((answer) => [answer.attempt_question_id, answer.option_id]));
  let score = 0;
  const details = attempt.questions.map((question) => {
    const source = findDemoQuestion(question.source_question_id);
    const selected = byQuestion.get(question.attempt_question_id);
    const correctOptionId = `${source.id}-o${source.answer}`;
    const correct = selected === correctOptionId;
    if (correct) score += 1;
    return {
      attempt_question_id: question.attempt_question_id,
      prompt: question.prompt,
      correct,
      explanation: attempt.show_explanations ? explanationFor(source) : null
    };
  });

  attempt.answers = payload.answers;
  attempt.score = score;
  attempt.total = attempt.questions.length;
  attempt.submitted_at = new Date().toISOString();
  writeState(state);

  return {
    score,
    total: attempt.total,
    percentage: Math.round((score / attempt.total) * 100),
    details
  };
}

function explanationFor(source) {
  if (source?.explanation) return source.explanation;
  const explanations = {
    "q-cia-goals": "The CIA triad is confidentiality, integrity, and availability.",
    "q-dos": "A denial-of-service attack tries to make a service unusable, so it targets availability.",
    "q-bank-balance": "Integrity is about preventing unauthorized or incorrect modification.",
    "q-password-file": "Confidentiality fails when secrets are disclosed to people who should not see them.",
    "q-value-risk": "The lecture frames security as valuable assets facing meaningful risk.",
    "q-phishing": "Phishing tricks a person into giving up sensitive information or taking a harmful action.",
    "q-spoofing": "Spoofing disguises identity, source, or origin.",
    "q-least-privilege": "Least privilege gives each user or component only the access needed for the task.",
    "q-open-design": "Open design says security should not rely on the design remaining secret.",
    "q-defense-lifecycle": "The lecture sequence is prevention, detection, response, and recovery.",
    "q-policy-mechanism": "Mechanism is the technical how: the way a policy is enforced.",
    "q-balance": "Improving one CIA property can sometimes hurt another, so security is a balancing act."
  };
  return explanations[source?.id] || "Review the lecture section connected to this concept.";
}

export async function sessionSummary(payload) {
  if (isConfigured()) {
    return callFunction("quiz-session-summary", payload);
  }

  const code = normalizeCode(payload.session_code);
  const state = readState();
  const session = state.sessions[code];
  const attempts = Object.values(state.attempts)
    .filter((attempt) => attempt.session_code === code)
    .map((attempt) => ({
      ...attempt,
      ...attemptMetrics(attempt, session)
    }))
    .sort(compareAttempts);
  const submitted = attempts.filter((attempt) => attempt.submitted_at);
  const average = submitted.length
    ? submitted.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0) / submitted.length
    : 0;
  const averageGrade = submitted.length
    ? submitted.reduce((sum, attempt) => sum + Number(attempt.grade_percent || 0), 0) / submitted.length
    : 0;
  const averageAScore = submitted.length
    ? submitted.reduce((sum, attempt) => sum + Number(attempt.a_score || 0), 0) / submitted.length
    : 0;

  return {
    session,
    attempts,
    question_stats: questionStatsForDemo(attempts),
    stats: {
      started: attempts.length,
      submitted: submitted.length,
      average_score: average,
      average_grade_percent: round1(averageGrade),
      average_a_score: round1(averageAScore),
      total: submitted[0] ? submitted[0].total : Number(session?.question_count || CONFIG.defaultQuestionCount || 10)
    }
  };
}

function questionStatsForDemo(attempts) {
  const rows = new Map();
  attempts
    .filter((attempt) => attempt.submitted_at)
    .forEach((attempt) => {
      const selectedByQuestion = new Map((attempt.answers || []).map((answer) => [answer.attempt_question_id, answer.option_id]));
      (attempt.questions || []).forEach((question) => {
        const source = findDemoQuestion(question.source_question_id);
        if (!source) return;
        const key = source.id;
        if (!rows.has(key)) {
          rows.set(key, {
            question_id: key,
            prompt: source.prompt,
            attempts: 0,
            correct: 0,
            missed: 0,
            correct_percent: 0
          });
        }
        const row = rows.get(key);
        const selected = selectedByQuestion.get(question.attempt_question_id);
        const correct = selected === `${source.id}-o${source.answer}`;
        row.attempts += 1;
        row.correct += correct ? 1 : 0;
        row.missed += correct ? 0 : 1;
        row.correct_percent = row.attempts ? round1((row.correct / row.attempts) * 100) : 0;
      });
    });
  return Array.from(rows.values()).sort((a, b) => b.missed - a.missed);
}

function questionsForLecture(lectureId) {
  return demoQuestionBanks[lectureId] || demoQuestionBanks[CONFIG.lectureId] || demoQuestionBanks["tc2007b-w1-l1"];
}

function findDemoQuestion(questionId) {
  return Object.values(demoQuestionBanks)
    .flat()
    .find((question) => question.id === questionId);
}

function lectureTitle(lectureId) {
  return CONFIG.lectures?.[lectureId] || "Quick Quiz";
}

export async function importQuestions(payload) {
  if (!isConfigured()) {
    throw new Error("Connect Supabase in config.js before importing questions.");
  }
  return callFunction("quiz-import-questions", payload);
}

export function attemptMetrics(attempt, session) {
  const score = Number(attempt.score || 0);
  const total = Number(attempt.total || session?.question_count || CONFIG.defaultQuestionCount || 10);
  const submitted = Boolean(attempt.submitted_at);
  const gradePercent = submitted && total ? (score / total) * 100 : null;
  const startedAt = new Date(attempt.started_at || session?.starts_at || session?.created_at || Date.now()).getTime();
  const submittedAt = submitted ? new Date(attempt.submitted_at).getTime() : null;
  const sessionStart = new Date(session?.starts_at || session?.created_at || attempt.started_at || Date.now()).getTime();
  const sessionEnd = new Date(session?.closes_at || (sessionStart + Number(session?.duration_minutes || CONFIG.defaultDurationMinutes || 8) * 60000)).getTime();
  const durationSeconds = Math.max(1, Math.round((sessionEnd - sessionStart) / 1000));
  const elapsedSeconds = submittedAt ? Math.max(0, Math.round((submittedAt - startedAt) / 1000)) : null;
  const accuracyRatio = total ? score / total : 0;
  const remainingRatio = elapsedSeconds == null ? 0 : Math.max(0, 1 - elapsedSeconds / durationSeconds);
  const speedBonus = submitted ? 10 * accuracyRatio * remainingRatio : null;
  const aScore = submitted ? Number(gradePercent || 0) + Number(speedBonus || 0) : null;

  return {
    grade_percent: gradePercent == null ? null : round1(gradePercent),
    elapsed_seconds: elapsedSeconds,
    speed_bonus: speedBonus == null ? null : round1(speedBonus),
    a_score: aScore == null ? null : round1(aScore)
  };
}

export function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function studentLinkFor(sessionCode) {
  const url = new URL("index.html", window.location.href);
  url.searchParams.set("session", normalizeCode(sessionCode));
  return url.toString();
}

async function callFunction(name, payload) {
  const base = CONFIG.supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: CONFIG.supabaseAnonKey,
      Authorization: `Bearer ${CONFIG.supabaseAnonKey}`
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed with status ${response.status}.`);
  }
  return body;
}

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { sessions: {}, attempts: {} };
  } catch (error) {
    return { sessions: {}, attempts: {} };
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function compareAttempts(a, b) {
  const aSubmitted = a.submitted_at ? 1 : 0;
  const bSubmitted = b.submitted_at ? 1 : 0;
  if (aSubmitted !== bSubmitted) return bSubmitted - aSubmitted;
  const aScore = Number(a.a_score ?? -1);
  const bScore = Number(b.a_score ?? -1);
  if (aScore !== bScore) return bScore - aScore;
  const aGrade = Number(a.grade_percent ?? -1);
  const bGrade = Number(b.grade_percent ?? -1);
  if (aGrade !== bGrade) return bGrade - aGrade;
  const aElapsed = Number(a.elapsed_seconds ?? Number.MAX_SAFE_INTEGER);
  const bElapsed = Number(b.elapsed_seconds ?? Number.MAX_SAFE_INTEGER);
  if (aElapsed !== bElapsed) return aElapsed - bElapsed;
  return String(a.started_at).localeCompare(String(b.started_at));
}

function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function shuffle(items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
