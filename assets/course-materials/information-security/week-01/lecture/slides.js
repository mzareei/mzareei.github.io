const tx = (en, es) => ({ en, es });
const item = (title, text = "", pos = "") => ({ title, text, pos });

window.LECTURE_SLIDES = [
  {
    section: tx("Opening", "Apertura"),
    title: tx("Security in applications and networks", "Seguridad en aplicaciones y redes"),
    subtitle: tx("Week 01: learning how to think like a security analyst.", "Semana 01: aprender a pensar como analista de seguridad."),
    visual: "word",
    word: tx("SECURITY", "SEGURIDAD"),
    wordSub: tx("value under risk", "valor bajo riesgo"),
    points: [
      tx("Security is not only tools.", "La seguridad no son solo herramientas."),
      tx("Security is a way to reason about **value, risk, and protection**.", "La seguridad es una forma de razonar sobre **valor, riesgo y protección**."),
      tx("Today we build the vocabulary for the rest of the course.", "Hoy construimos el vocabulario para el resto del curso.")
    ]
  },
  {
    section: tx("Opening", "Apertura"),
    title: tx("The central question", "La pregunta central"),
    subtitle: tx("When should we worry about security?", "¿Cuándo debemos preocuparnos por la seguridad?"),
    visual: "equation",
    items: [
      item(tx("Value", "Valor"), tx("Something matters.", "Algo importa.")),
      item(tx("Risk", "Riesgo"), tx("It can be harmed.", "Puede ser dañado.")),
      item(tx("Security", "Seguridad"), tx("Protection is needed.", "Se necesita protección."))
    ],
    points: [
      tx("Start with what has value.", "Empieza con lo que tiene valor."),
      tx("Then ask how it could be harmed.", "Luego pregunta cómo podría ser dañado."),
      tx("Only then choose a security measure.", "Solo después elige una medida de seguridad.")
    ]
  },
  {
    section: tx("Instructor", "Profesor"),
    title: tx("A little bit about me", "Un poco sobre mí"),
    subtitle: tx("Keep this factual and personal to your course.", "Mantén esta parte factual y personal para tu curso."),
    visual: "cards",
    items: [
      item(tx("Research", "Investigación"), tx("Information security and computing systems.", "Seguridad informática y sistemas computacionales.")),
      item(tx("Teaching", "Docencia"), tx("Concepts, cases, and practice.", "Conceptos, casos y práctica.")),
      item(tx("Class style", "Estilo de clase"), tx("Ask, reason, discuss.", "Preguntar, razonar, discutir."))
    ],
    points: [
      tx("Use your verified professional background here.", "Usa aquí tu información profesional verificada."),
      tx("Do not overload the first lecture with biography.", "No satures la primera clase con biografía."),
      tx("Connect who you are to how the class will work.", "Conecta quién eres con cómo funcionará la clase.")
    ]
  },
  {
    section: tx("Instructor", "Profesor"),
    title: tx("How this class works", "Cómo funciona esta clase"),
    subtitle: tx("Security is learned by reasoning through situations.", "La seguridad se aprende razonando situaciones."),
    visual: "flow",
    items: [
      item(tx("Concept", "Concepto"), tx("Define the idea.", "Definir la idea.")),
      item(tx("Example", "Ejemplo"), tx("See it in context.", "Verla en contexto.")),
      item(tx("Question", "Pregunta"), tx("Test assumptions.", "Probar supuestos.")),
      item(tx("Discussion", "Discusión"), tx("Compare answers.", "Comparar respuestas.")),
      item(tx("Judgment", "Juicio"), tx("Decide what matters.", "Decidir qué importa."))
    ],
    points: [
      tx("Definitions are useful only when students can apply them.", "Las definiciones sirven solo si los estudiantes pueden aplicarlas."),
      tx("The classroom should be active.", "La clase debe ser activa."),
      tx("A wrong first answer is often a good start for discussion.", "Una primera respuesta incorrecta suele ser un buen inicio de discusión.")
    ]
  },
  {
    section: tx("Class opening", "Inicio de clase"),
    title: tx("Introduce yourself", "Preséntate"),
    subtitle: tx("Start with technology, consequences, and experience.", "Empieza con tecnología, consecuencias y experiencia."),
    visual: "questions",
    items: [
      item(tx("Your name", "Tu nombre"), tx("Who are you?", "¿Quién eres?")),
      item(tx("Uninvent one invention", "Desinventar algo"), tx("What would you remove, and why?", "¿Qué quitarías y por qué?")),
      item(tx("Cyber incident", "Incidente cibernético"), tx("Have you been affected?", "¿Te ha afectado alguno?")),
      item(tx("One sentence", "Una frase"), tx("Keep it brief.", "Sé breve."))
    ],
    points: [
      tx("Technology always has consequences.", "La tecnología siempre tiene consecuencias."),
      tx("Cybersecurity is not abstract; people experience it.", "La ciberseguridad no es abstracta; las personas la viven."),
      tx("Students share only what is appropriate.", "Los estudiantes comparten solo lo que sea apropiado.")
    ]
  },
  {
    section: tx("Class norms", "Normas de clase"),
    title: tx("Before we continue", "Antes de continuar"),
    subtitle: tx("Attention is part of the learning environment.", "La atención es parte del ambiente de aprendizaje."),
    visual: "word",
    word: tx("FOCUS", "ENFOQUE"),
    wordSub: tx("shared attention makes discussion possible", "la atención compartida permite discutir"),
    points: [
      tx("We set expectations before technical content.", "Definimos expectativas antes del contenido técnico."),
      tx("The goal is not control; the goal is learning.", "El objetivo no es controlar; el objetivo es aprender."),
      tx("Security lectures need participation.", "Las clases de seguridad necesitan participación.")
    ]
  },
  {
    section: tx("Course frame", "Marco del curso"),
    title: tx("Security has layers", "La seguridad tiene capas"),
    subtitle: tx("People, applications, networks, data, and infrastructure interact.", "Personas, aplicaciones, redes, datos e infraestructura interactúan."),
    visual: "flow",
    items: [
      item(tx("People", "Personas"), tx("Users and attackers.", "Usuarios y atacantes.")),
      item(tx("Apps", "Apps"), tx("Business logic.", "Lógica de negocio.")),
      item(tx("Networks", "Redes"), tx("Communication paths.", "Rutas de comunicación.")),
      item(tx("Data", "Datos"), tx("Stored or transmitted.", "Guardados o transmitidos.")),
      item(tx("Infrastructure", "Infraestructura"), tx("Systems society needs.", "Sistemas que la sociedad necesita."))
    ],
    points: [
      tx("Application security and network security are connected.", "La seguridad de aplicaciones y de redes están conectadas."),
      tx("People are part of the system.", "Las personas son parte del sistema."),
      tx("The same vocabulary works across layers.", "El mismo vocabulario funciona en distintas capas.")
    ]
  },
  {
    section: tx("Class norms", "Normas de clase"),
    title: tx("Rules protect attention", "Las reglas protegen la atención"),
    subtitle: tx("Devices are useful when they serve the activity.", "Los dispositivos son útiles cuando sirven a la actividad."),
    visual: "cards",
    items: [
      item(tx("Devices away", "Dispositivos guardados"), tx("Unless an activity needs them.", "A menos que una actividad los necesite.")),
      item(tx("One break", "Un descanso"), tx("Usually short.", "Normalmente corto.")),
      item(tx("Ask", "Pregunta"), tx("If you are lost, say it.", "Si te pierdes, dilo."))
    ],
    points: [
      tx("Phones, tablets, and laptops are not used during lecture unless required.", "Celulares, tabletas y laptops no se usan durante la clase salvo que se requieran."),
      tx("There is usually one short break.", "Normalmente hay un descanso corto."),
      tx("If you are lost, ask for help.", "Si te pierdes, pide ayuda.")
    ]
  },
  {
    section: tx("AI policy", "Política de IA"),
    title: tx("AI is a tool, not a substitute", "La IA es herramienta, no sustituto"),
    subtitle: tx("If you use it, you must understand what it produced.", "Si la usas, debes entender lo que produjo."),
    visual: "flow",
    items: [
      item(tx("Use", "Usar"), tx("Allowed if it helps.", "Permitido si ayuda.")),
      item(tx("Check", "Revisar"), tx("Verify claims.", "Verifica afirmaciones.")),
      item(tx("Understand", "Entender"), tx("Own the reasoning.", "Haz tuyo el razonamiento.")),
      item(tx("Explain", "Explicar"), tx("Be ready verbally.", "Prepárate para explicarlo.")),
      item(tx("Consequence", "Consecuencia"), tx("Mismatch may be zero.", "La contradicción puede valer cero."))
    ],
    points: [
      tx("AI can support learning.", "La IA puede apoyar el aprendizaje."),
      tx("Your comprehension may be checked verbally.", "Tu comprensión puede revisarse verbalmente."),
      tx("Use AI as a thinking aid.", "Usa IA como apoyo para pensar.")
    ]
  },
  {
    section: tx("Class norms", "Normas de clase"),
    title: tx("How to say my name", "Cómo decir mi nombre"),
    subtitle: tx("Small details make class interaction easier.", "Los detalles pequeños facilitan la interacción en clase."),
    visual: "cards",
    items: [
      item(tx("Mahdi", "Mahdi"), tx("Ma - h - di", "Ma - h - di")),
      item(tx("Madi", "Madi"), tx("Close enough.", "Bastante cercano.")),
      item(tx("Max", "Max"), tx("Easy and acceptable.", "Fácil y aceptable."))
    ],
    points: [
      tx("Invite students to address you comfortably.", "Invita a los estudiantes a dirigirse a ti con comodidad."),
      tx("Keep this quick.", "Mantén esto breve."),
      tx("Then move into questions and acknowledgments.", "Luego pasa a preguntas y agradecimientos.")
    ]
  },
  {
    section: tx("Acknowledgment", "Agradecimiento"),
    title: tx("Questions before we start?", "¿Preguntas antes de empezar?"),
    subtitle: tx("Original material acknowledges Georgia Tech and CS 6035.", "El material original reconoce a Georgia Tech y CS 6035."),
    visual: "cards",
    items: [
      item(tx("Questions", "Preguntas"), tx("Pause before definitions.", "Pausa antes de definir.")),
      item(tx("Acknowledgment", "Agradecimiento"), tx("Wenke Lee and Mustaque Ahamad.", "Wenke Lee y Mustaque Ahamad.")),
      item(tx("Course source", "Curso fuente"), tx("CS 6035 Introduction to Information Security.", "CS 6035 Introduction to Information Security."))
    ],
    points: [
      tx("Ask for doubts before technical content.", "Pregunta si hay dudas antes del contenido técnico."),
      tx("Preserve the acknowledgment.", "Conserva el agradecimiento."),
      tx("Make clear this is adapted for your class.", "Aclara que esto está adaptado a tu clase.")
    ]
  },
  {
    section: tx("Definition", "Definición"),
    title: tx("Computer security protects system resources", "La seguridad informática protege recursos"),
    subtitle: tx("NIST frames security around confidentiality, integrity, and availability.", "NIST define la seguridad alrededor de confidencialidad, integridad y disponibilidad."),
    visual: "triangle",
    items: [
      item(tx("Confidentiality", "Confidencialidad"), "", "top"),
      item(tx("Integrity", "Integridad"), "", "left"),
      item(tx("Availability", "Disponibilidad"), "", "right")
    ],
    points: [
      tx("Protection applies to automated information systems.", "La protección aplica a sistemas automatizados de información."),
      tx("Resources include hardware, software, data, and telecommunications.", "Los recursos incluyen hardware, software, datos y telecomunicaciones."),
      tx("CIA becomes the first framework.", "CIA se convierte en el primer marco de análisis.")
    ]
  },
  {
    section: tx("Mindset", "Mentalidad"),
    title: tx("Security starts with questions", "La seguridad empieza con preguntas"),
    subtitle: tx("Why is cybersecurity important? How do we understand it? What should we do?", "¿Por qué importa? ¿Cómo la entendemos? ¿Qué debemos hacer?"),
    visual: "questions",
    items: [
      item(tx("Why?", "¿Por qué?"), tx("What could be harmed?", "¿Qué podría dañarse?")),
      item(tx("How?", "¿Cómo?"), tx("How do attacks succeed?", "¿Cómo tienen éxito los ataques?")),
      item(tx("What?", "¿Qué?"), tx("What can reduce risk?", "¿Qué reduce el riesgo?")),
      item(tx("Who?", "¿Quién?"), tx("Who benefits from harm?", "¿Quién se beneficia del daño?"))
    ],
    points: [
      tx("A security mindset is a questioning habit.", "La mentalidad de seguridad es un hábito de preguntar."),
      tx("Questions reveal assumptions.", "Las preguntas revelan supuestos."),
      tx("Good questions come before good controls.", "Las buenas preguntas vienen antes que los buenos controles.")
    ]
  },
  {
    section: tx("Mindset", "Mentalidad"),
    title: tx("Value + risk = security concern", "Valor + riesgo = preocupación de seguridad"),
    subtitle: tx("We worry when something valuable could be harmed.", "Nos preocupamos cuando algo valioso puede ser dañado."),
    visual: "equation",
    items: [
      item(tx("Value", "Valor"), tx("Data, money, identity, infrastructure.", "Datos, dinero, identidad, infraestructura.")),
      item(tx("Risk", "Riesgo"), tx("A plausible path to harm.", "Un camino posible al daño.")),
      item(tx("Concern", "Preocupación"), tx("A reason to protect.", "Una razón para proteger."))
    ],
    points: [
      tx("Security is not automatic; it is motivated by value.", "La seguridad no es automática; la motiva el valor."),
      tx("Risk makes the value vulnerable.", "El riesgo vuelve vulnerable ese valor."),
      tx("Protection should match the kind of harm.", "La protección debe corresponder al tipo de daño.")
    ]
  },
  {
    section: tx("Motivation", "Motivación"),
    title: tx("Who is safe?", "¿Quién está a salvo?"),
    subtitle: tx("Breach data shows that exposure is widespread.", "Los datos de brechas muestran que la exposición es amplia."),
    visual: "dots",
    layout: "full",
    points: [
      tx("Each dot represents a possible large-scale failure.", "Cada punto representa una posible falla a gran escala."),
      tx("Ask students what patterns they notice.", "Pregunta a los estudiantes qué patrones observan."),
      tx("Targets, data types, frequency, and impact all matter.", "Importan los objetivos, tipos de datos, frecuencia e impacto.")
    ]
  },
  {
    section: tx("Motivation", "Motivación"),
    title: tx("People store sensitive data online", "Las personas guardan datos sensibles en línea"),
    subtitle: tx("If stolen, criminals can profit from it.", "Si se roban, los criminales pueden obtener ganancias."),
    visual: "cards",
    items: [
      item(tx("Identity", "Identidad"), tx("Names, IDs, credentials.", "Nombres, IDs, credenciales.")),
      item(tx("Money", "Dinero"), tx("Cards and bank data.", "Tarjetas y datos bancarios.")),
      item(tx("Private life", "Vida privada"), tx("Messages, health, location.", "Mensajes, salud, ubicación."))
    ],
    points: [
      tx("Sensitive data is valuable.", "Los datos sensibles tienen valor."),
      tx("Criminals can convert data into money.", "Los criminales pueden convertir datos en dinero."),
      tx("The harm affects real people.", "El daño afecta a personas reales.")
    ]
  },
  {
    section: tx("Motivation", "Motivación"),
    title: tx("Black market values create incentive", "El mercado negro crea incentivos"),
    subtitle: tx("Data has value because it can be reused, sold, or abused.", "Los datos tienen valor porque pueden reutilizarse, venderse o abusarse."),
    visual: "flow",
    items: [
      item(tx("Data", "Datos"), tx("Stolen asset.", "Activo robado.")),
      item(tx("Access", "Acceso"), tx("Credentials or sessions.", "Credenciales o sesiones.")),
      item(tx("Fraud", "Fraude"), tx("Abuse at scale.", "Abuso a escala.")),
      item(tx("Money", "Dinero"), tx("Profit motive.", "Motivo económico.")),
      item(tx("Repeat", "Repetir"), tx("Attackers try again.", "Los atacantes repiten."))
    ],
    points: [
      tx("Attackers often have economic motivation.", "Los atacantes suelen tener motivación económica."),
      tx("Stolen data can become access.", "Los datos robados pueden convertirse en acceso."),
      tx("Access can become fraud or disruption.", "El acceso puede convertirse en fraude o interrupción.")
    ]
  },
  {
    section: tx("Motivation", "Motivación"),
    title: tx("Cyber risk reaches infrastructure", "El riesgo cibernético llega a la infraestructura"),
    subtitle: tx("Organizations and societies depend on connected systems.", "Organizaciones y sociedades dependen de sistemas conectados."),
    visual: "flow",
    items: [
      item(tx("Business", "Empresa"), tx("Proprietary data.", "Datos propietarios.")),
      item(tx("Government", "Gobierno"), tx("Political impact.", "Impacto político.")),
      item(tx("Smart grid", "Red eléctrica"), tx("Cyber control.", "Control cibernético.")),
      item(tx("Community", "Comunidad"), tx("Shared dependence.", "Dependencia compartida.")),
      item(tx("Society", "Sociedad"), tx("Internet reliance.", "Dependencia de internet."))
    ],
    points: [
      tx("Business and government information can be exposed.", "La información empresarial y gubernamental puede exponerse."),
      tx("Smart grids rely on cyber systems.", "Las redes inteligentes dependen de sistemas cibernéticos."),
      tx("Cybersecurity becomes a societal issue.", "La ciberseguridad se vuelve un asunto social.")
    ]
  },
  {
    section: tx("Risk", "Riesgo"),
    title: tx("Cyber assets at risk", "Activos cibernéticos en riesgo"),
    subtitle: tx("Risk analysis needs a security mindset.", "El análisis de riesgo necesita mentalidad de seguridad."),
    visual: "flow",
    items: [
      item(tx("Asset", "Activo"), tx("What matters?", "¿Qué importa?")),
      item(tx("Risk", "Riesgo"), tx("How can it be harmed?", "¿Cómo puede dañarse?")),
      item(tx("Mindset", "Mentalidad"), tx("How do we reason?", "¿Cómo razonamos?")),
      item(tx("Threat", "Amenaza"), tx("Where from?", "¿De dónde viene?")),
      item(tx("Attack", "Ataque"), tx("How does it happen?", "¿Cómo ocurre?"))
    ],
    points: [
      tx("Online information and systems can be assets.", "La información y los sistemas en línea pueden ser activos."),
      tx("We need to understand risk before choosing controls.", "Necesitamos entender el riesgo antes de elegir controles."),
      tx("Threats, vulnerabilities, and attacks are the next concepts.", "Amenazas, vulnerabilidades y ataques son los siguientes conceptos.")
    ]
  },
  {
    section: tx("Risk", "Riesgo"),
    title: tx("Important questions", "Preguntas importantes"),
    subtitle: tx("Good analysis begins before the control.", "Un buen análisis empieza antes del control."),
    visual: "questions",
    items: [
      item(tx("What is valuable?", "¿Qué tiene valor?"), tx("Asset.", "Activo.")),
      item(tx("Where are threats?", "¿Dónde están las amenazas?"), tx("Source.", "Fuente.")),
      item(tx("What kind of risk?", "¿Qué tipo de riesgo?"), tx("Harm.", "Daño.")),
      item(tx("Who is the threat?", "¿Quién amenaza?"), tx("Actor.", "Actor.")),
      item(tx("What can we do?", "¿Qué podemos hacer?"), tx("Measure.", "Medida."))
    ],
    points: [
      tx("Name the value.", "Nombra el valor."),
      tx("Name the source of harm.", "Nombra la fuente del daño."),
      tx("Name the possible measure.", "Nombra la posible medida.")
    ]
  },
  {
    section: tx("Transition", "Transición"),
    title: tx("From questions to an attack model", "De preguntas a un modelo de ataque"),
    subtitle: tx("Connect actor, weakness, action, and consequence.", "Conecta actor, debilidad, acción y consecuencia."),
    visual: "flow",
    items: [
      item(tx("Actor", "Actor"), tx("Who?", "¿Quién?")),
      item(tx("Weakness", "Debilidad"), tx("What can be used?", "¿Qué puede usarse?")),
      item(tx("Action", "Acción"), tx("How?", "¿Cómo?")),
      item(tx("Breach", "Brecha"), tx("What fails?", "¿Qué falla?")),
      item(tx("Impact", "Impacto"), tx("Who is harmed?", "¿Quién resulta dañado?"))
    ],
    points: [
      tx("This is the bridge into vulnerabilities and attacks.", "Este es el puente hacia vulnerabilidades y ataques."),
      tx("A breach is not magic; it has a path.", "Una brecha no es magia; tiene un camino."),
      tx("Students should learn to reconstruct that path.", "Los estudiantes deben aprender a reconstruir ese camino.")
    ]
  },
  {
    section: tx("Threat model", "Modelo de amenaza"),
    title: tx("Threat actors exploit vulnerabilities", "Los actores explotan vulnerabilidades"),
    subtitle: tx("Attacks can lead to compromise or breach.", "Los ataques pueden llevar a compromiso o brecha."),
    visual: "flow",
    items: [
      item(tx("Threat actor", "Actor"), tx("Source of harm.", "Fuente de daño.")),
      item(tx("Vulnerability", "Vulnerabilidad"), tx("Weakness.", "Debilidad.")),
      item(tx("Attack", "Ataque"), tx("Exploitation.", "Explotación.")),
      item(tx("Compromise", "Compromiso"), tx("Loss of assurance.", "Pérdida de confianza.")),
      item(tx("Breach", "Brecha"), tx("Security failure.", "Falla de seguridad."))
    ],
    points: [
      tx("Actors exploit weaknesses.", "Los actores explotan debilidades."),
      tx("Attacks produce compromise.", "Los ataques producen compromiso."),
      tx("Vulnerabilities can exist in software, networks, and humans.", "Las vulnerabilidades pueden existir en software, redes y humanos.")
    ]
  },
  {
    section: tx("Threat model", "Modelo de amenaza"),
    title: tx("Threat actors have motives", "Los actores tienen motivos"),
    subtitle: tx("Different actors want different outcomes.", "Distintos actores buscan distintos resultados."),
    visual: "actors",
    items: [
      item(tx("Cybercriminals", "Cibercriminales"), tx("Financial gain.", "Ganancia económica.")),
      item(tx("Hacktivists", "Hacktivistas"), tx("Cause or protest.", "Causa o protesta.")),
      item(tx("Nation-states", "Estados nación"), tx("Espionage or advantage.", "Espionaje o ventaja."))
    ],
    points: [
      tx("Cybercriminals often want profit.", "Los cibercriminales suelen buscar ganancia."),
      tx("Hacktivists act from political or social motives.", "Los hacktivistas actúan por motivos políticos o sociales."),
      tx("Nation-states may seek espionage or strategic advantage.", "Los estados nación pueden buscar espionaje o ventaja estratégica.")
    ]
  },
  {
    section: tx("Threat model", "Modelo de amenaza"),
    title: tx("Vulnerabilities never disappear completely", "Las vulnerabilidades nunca desaparecen por completo"),
    subtitle: tx("Software, networks, and humans all create weaknesses.", "Software, redes y humanos crean debilidades."),
    visual: "flow",
    items: [
      item(tx("Threat", "Amenaza"), tx("Potential harm.", "Daño potencial.")),
      item(tx("Vulnerability", "Vulnerabilidad"), tx("Weak point.", "Punto débil.")),
      item(tx("Exploit", "Explotar"), tx("Use the weakness.", "Usar la debilidad.")),
      item(tx("Attack", "Ataque"), tx("Action occurs.", "Ocurre la acción.")),
      item(tx("Breach", "Brecha"), tx("Damage appears.", "Aparece el daño."))
    ],
    points: [
      tx("It is hard to remove all vulnerabilities.", "Es difícil eliminar todas las vulnerabilidades."),
      tx("Humans can be the weak link.", "Los humanos pueden ser el eslabón débil."),
      tx("Security reduces risk; it rarely removes all risk.", "La seguridad reduce el riesgo; rara vez elimina todo el riesgo.")
    ]
  },
  {
    section: tx("Threat model", "Modelo de amenaza"),
    title: tx("A vulnerability is not yet an attack", "Una vulnerabilidad aún no es un ataque"),
    subtitle: tx("It is a condition that makes an attack possible.", "Es una condición que hace posible un ataque."),
    visual: "cards",
    items: [
      item(tx("Unpatched code", "Código sin parche"), tx("Technical weakness.", "Debilidad técnica.")),
      item(tx("Weak password", "Contraseña débil"), tx("Human or policy weakness.", "Debilidad humana o de política.")),
      item(tx("Misconfiguration", "Mala configuración"), tx("Operational weakness.", "Debilidad operativa."))
    ],
    points: [
      tx("Do not confuse weakness with exploitation.", "No confundas debilidad con explotación."),
      tx("The attacker still needs a path.", "El atacante aún necesita un camino."),
      tx("Defenders can interrupt the path.", "Los defensores pueden interrumpir el camino.")
    ]
  },
  {
    section: tx("Threat model", "Modelo de amenaza"),
    title: tx("A few hours later...", "Unas horas después..."),
    subtitle: tx("Weakness becomes risk when someone can use it.", "La debilidad se vuelve riesgo cuando alguien puede usarla."),
    visual: "flow",
    items: [
      item(tx("Discover", "Descubrir"), tx("Find weakness.", "Encontrar debilidad.")),
      item(tx("Prepare", "Preparar"), tx("Choose method.", "Elegir método.")),
      item(tx("Execute", "Ejecutar"), tx("Try exploit.", "Intentar explotación.")),
      item(tx("Move", "Moverse"), tx("Expand access.", "Expandir acceso.")),
      item(tx("Impact", "Impacto"), tx("Cause harm.", "Causar daño."))
    ],
    points: [
      tx("Attackers iterate over time.", "Los atacantes iteran con el tiempo."),
      tx("Small weaknesses can become serious.", "Debilidades pequeñas pueden volverse graves."),
      tx("Monitoring matters before failure is obvious.", "Monitorear importa antes de que la falla sea obvia.")
    ]
  },
  {
    section: tx("Threat model", "Modelo de amenaza"),
    title: tx("FAIL is late", "FAIL llega tarde"),
    subtitle: tx("The visible failure is usually not the first event.", "La falla visible normalmente no es el primer evento."),
    visual: "word",
    word: tx("FAIL", "FALLA"),
    wordSub: tx("a symptom, not the root cause", "un síntoma, no la causa raíz"),
    points: [
      tx("Work backward from failure.", "Trabaja hacia atrás desde la falla."),
      tx("Find the earlier weakness.", "Encuentra la debilidad anterior."),
      tx("Ask why the system allowed the path.", "Pregunta por qué el sistema permitió el camino.")
    ]
  },
  {
    section: tx("Threat model", "Modelo de amenaza"),
    title: tx("An attack is a chain", "Un ataque es una cadena"),
    subtitle: tx("Each link is a chance to defend.", "Cada eslabón es una oportunidad para defender."),
    visual: "flow",
    items: [
      item(tx("Entry", "Entrada"), tx("How in?", "¿Cómo entra?")),
      item(tx("Privilege", "Privilegio"), tx("What access?", "¿Qué acceso?")),
      item(tx("Movement", "Movimiento"), tx("Where next?", "¿A dónde sigue?")),
      item(tx("Objective", "Objetivo"), tx("What for?", "¿Para qué?")),
      item(tx("Evidence", "Evidencia"), tx("What reveals it?", "¿Qué lo revela?"))
    ],
    points: [
      tx("Do not analyze attacks as isolated moments.", "No analices ataques como momentos aislados."),
      tx("Find the chain.", "Encuentra la cadena."),
      tx("Break the chain where possible.", "Rompe la cadena donde sea posible.")
    ]
  },
  {
    section: tx("Threat model", "Modelo de amenaza"),
    title: tx("Consequences map to CIA", "Las consecuencias se mapean a CIA"),
    subtitle: tx("What failed: secrecy, correctness, or access?", "¿Qué falló: secreto, corrección o acceso?"),
    visual: "cards",
    items: [
      item(tx("Data exposure", "Exposición de datos"), tx("Confidentiality.", "Confidencialidad.")),
      item(tx("Data change", "Cambio de datos"), tx("Integrity.", "Integridad.")),
      item(tx("Service disruption", "Interrupción"), tx("Availability.", "Disponibilidad."))
    ],
    points: [
      tx("Consequences make the technical failure meaningful.", "Las consecuencias dan sentido a la falla técnica."),
      tx("CIA gives language to classify harm.", "CIA da lenguaje para clasificar el daño."),
      tx("This prepares the case discussion.", "Esto prepara el caso de discusión.")
    ]
  },
  {
    section: tx("Case", "Caso"),
    title: tx("Real-world example: Target", "Ejemplo real: Target"),
    subtitle: tx("Use the case to practice the vocabulary, not just to tell a story.", "Usa el caso para practicar vocabulario, no solo para contar una historia."),
    visual: "cards",
    items: [
      item(tx("Organization", "Organización"), tx("Large retailer.", "Gran minorista.")),
      item(tx("Assets", "Activos"), tx("Customer data and operations.", "Datos de clientes y operaciones.")),
      item(tx("Question", "Pregunta"), tx("What could be vulnerable?", "¿Qué podría ser vulnerable?"))
    ],
    points: [
      tx("The source slide introduces Target Corporation.", "La diapositiva fuente introduce Target Corporation."),
      tx("Start by identifying assets.", "Empieza identificando activos."),
      tx("Then ask what could go wrong.", "Después pregunta qué podría salir mal.")
    ]
  },
  {
    section: tx("Case", "Caso"),
    title: tx("Analyze the case", "Analiza el caso"),
    subtitle: tx("Use the same chain every time.", "Usa siempre la misma cadena."),
    visual: "flow",
    items: [
      item(tx("Asset", "Activo"), tx("What matters?", "¿Qué importa?")),
      item(tx("Actor", "Actor"), tx("Who benefits?", "¿Quién se beneficia?")),
      item(tx("Weakness", "Debilidad"), tx("What fails?", "¿Qué falla?")),
      item(tx("Attack", "Ataque"), tx("How?", "¿Cómo?")),
      item(tx("Breach", "Brecha"), tx("What property is lost?", "¿Qué propiedad se pierde?"))
    ],
    points: [
      tx("A real incident should be mapped to concepts.", "Un incidente real debe mapearse a conceptos."),
      tx("Do not jump straight to conclusions.", "No saltes directo a conclusiones."),
      tx("Make students name each part.", "Haz que los estudiantes nombren cada parte.")
    ]
  },
  {
    section: tx("Case", "Caso"),
    title: tx("Which requirement failed?", "¿Qué requisito falló?"),
    subtitle: tx("Cases become clearer when mapped to security requirements.", "Los casos son más claros cuando se mapean a requisitos."),
    visual: "matrix",
    items: [
      item(tx("Sensitive data exposed", "Datos sensibles expuestos"), tx("Confidentiality", "Confidencialidad")),
      item(tx("Records changed", "Registros cambiados"), tx("Integrity", "Integridad")),
      item(tx("Systems unavailable", "Sistemas no disponibles"), tx("Availability", "Disponibilidad")),
      item(tx("Wrong access granted", "Acceso incorrecto"), tx("Authorization", "Autorización"))
    ],
    points: [
      tx("A breach is not the final explanation.", "Una brecha no es la explicación final."),
      tx("Ask what property failed.", "Pregunta qué propiedad falló."),
      tx("This builds precision.", "Esto construye precisión.")
    ]
  },
  {
    section: tx("Concept map", "Mapa conceptual"),
    title: tx("The key relationships", "Las relaciones clave"),
    subtitle: tx("Value, threat, vulnerability, attack, and risk belong together.", "Valor, amenaza, vulnerabilidad, ataque y riesgo van juntos."),
    visual: "flow",
    items: [
      item(tx("Value", "Valor"), tx("What matters.", "Lo que importa.")),
      item(tx("Threat", "Amenaza"), tx("Possible harm.", "Daño posible.")),
      item(tx("Vulnerability", "Vulnerabilidad"), tx("Weakness.", "Debilidad.")),
      item(tx("Attack", "Ataque"), tx("Action.", "Acción.")),
      item(tx("Risk", "Riesgo"), tx("Potential loss.", "Pérdida potencial."))
    ],
    points: [
      tx("This is the summary map of the first half.", "Este es el mapa resumen de la primera mitad."),
      tx("Each word has a role.", "Cada palabra tiene un papel."),
      tx("Students should be able to explain the arrows.", "Los estudiantes deben poder explicar las flechas.")
    ]
  },
  {
    section: tx("Requirements", "Requisitos"),
    title: tx("What should we do?", "¿Qué debemos hacer?"),
    subtitle: tx("Reduce vulnerabilities and meet core security requirements.", "Reducir vulnerabilidades y cumplir requisitos básicos."),
    visual: "triangle",
    items: [
      item(tx("Confidentiality", "Confidencialidad"), "", "top"),
      item(tx("Integrity", "Integridad"), "", "left"),
      item(tx("Availability", "Disponibilidad"), "", "right")
    ],
    points: [
      tx("Make threats less profitable.", "Hacer que las amenazas sean menos rentables."),
      tx("Reduce vulnerabilities.", "Reducir vulnerabilidades."),
      tx("Protect confidentiality, integrity, and availability.", "Proteger confidencialidad, integridad y disponibilidad.")
    ]
  },
  {
    section: tx("Requirements", "Requisitos"),
    title: tx("CIA is not everything", "CIA no lo es todo"),
    subtitle: tx("Authentication, authorization, and non-repudiation also matter.", "Autenticación, autorización y no repudio también importan."),
    visual: "cards",
    items: [
      item(tx("Authentication", "Autenticación"), tx("Who are you?", "¿Quién eres?")),
      item(tx("Authorization", "Autorización"), tx("What can you access?", "¿A qué puedes acceder?")),
      item(tx("Non-repudiation", "No repudio"), tx("You cannot deny validity.", "No puedes negar validez."))
    ],
    points: [
      tx("Authentication verifies identity.", "La autenticación verifica identidad."),
      tx("Authorization determines access levels.", "La autorización determina niveles de acceso."),
      tx("Non-repudiation prevents denial of valid actions.", "El no repudio evita negar acciones válidas.")
    ]
  },
  {
    section: tx("Requirements", "Requisitos"),
    title: tx("Threats map to requirements", "Las amenazas se mapean a requisitos"),
    subtitle: tx("Sometimes threat language is easier than requirement language.", "A veces el lenguaje de amenazas es más fácil que el de requisitos."),
    visual: "matrix",
    items: [
      item(tx("Information disclosure", "Divulgación de información"), tx("Confidentiality", "Confidencialidad")),
      item(tx("Denial of service", "Denegación de servicio"), tx("Availability", "Disponibilidad")),
      item(tx("Tampering", "Manipulación"), tx("Integrity", "Integridad")),
      item(tx("Unauthorized access", "Acceso no autorizado"), tx("Authorization", "Autorización")),
      item(tx("Phishing", "Phishing"), tx("Authentication", "Autenticación"))
    ],
    points: [
      tx("Start with the threat if that is clearer.", "Empieza con la amenaza si eso es más claro."),
      tx("Then translate it into the security requirement.", "Luego tradúcela al requisito de seguridad."),
      tx("This is a useful exam and case-analysis skill.", "Esto sirve para exámenes y análisis de casos.")
    ]
  },
  {
    section: tx("Requirements", "Requisitos"),
    title: tx("Phishing vs spoofing", "Phishing vs spoofing"),
    subtitle: tx("One retrieves information; the other helps deliver deception.", "Uno obtiene información; el otro ayuda a entregar el engaño."),
    visual: "compare",
    items: [
      item(tx("Phishing", "Phishing"), tx("Tricks you into giving sensitive information.", "Te engaña para entregar información sensible.")),
      item(tx("Spoofing", "Spoofing"), tx("Pretends to be a trusted source.", "Finge ser una fuente confiable."))
    ],
    points: [
      tx("Phishing is a retrieval method.", "Phishing es un método de obtención."),
      tx("Spoofing is a delivery mechanism.", "Spoofing es un mecanismo de entrega."),
      tx("They often work together.", "A menudo trabajan juntos.")
    ]
  },
  {
    section: tx("CIA", "CIA"),
    title: tx("Confidentiality", "Confidencialidad"),
    subtitle: tx("Access is based on need to know.", "El acceso se basa en necesidad de saber."),
    visual: "flow",
    items: [
      item(tx("Identity", "Identidad"), tx("Who claims access?", "¿Quién pide acceso?")),
      item(tx("Authentication", "Autenticación"), tx("Verify identity.", "Verificar identidad.")),
      item(tx("Access control", "Control de acceso"), tx("Who can access what?", "¿Quién accede a qué?")),
      item(tx("Need to know", "Necesidad de saber"), tx("Limit access.", "Limitar acceso.")),
      item(tx("Confidentiality", "Confidencialidad"), tx("No unauthorized reading.", "Sin lectura no autorizada."))
    ],
    points: [
      tx("Confidentiality prevents unauthorized reading.", "La confidencialidad evita lectura no autorizada."),
      tx("Access control specifies who can access what.", "El control de acceso especifica quién accede a qué."),
      tx("It is often assessed as yes/no.", "A menudo se evalúa como sí/no.")
    ]
  },
  {
    section: tx("CIA", "CIA"),
    title: tx("Integrity", "Integridad"),
    subtitle: tx("Integrity is about unauthorized modification.", "La integridad trata de modificaciones no autorizadas."),
    visual: "cards",
    items: [
      item(tx("Access", "Acceso"), tx("Confidentiality asks who can see.", "Confidencialidad pregunta quién puede ver.")),
      item(tx("Modification", "Modificación"), tx("Integrity asks who can change.", "Integridad pregunta quién puede cambiar.")),
      item(tx("Context", "Contexto"), tx("Bank account and medical record differ.", "Cuenta bancaria y expediente médico difieren."))
    ],
    points: [
      tx("Integrity is not simply binary.", "La integridad no es simplemente binaria."),
      tx("It has degrees.", "Tiene grados."),
      tx("It depends on context.", "Depende del contexto.")
    ]
  },
  {
    section: tx("CIA", "CIA"),
    title: tx("Availability is contextual", "La disponibilidad es contextual"),
    subtitle: tx("Available for what, for whom, and within what time?", "¿Disponible para qué, para quién y en qué tiempo?"),
    visual: "cards",
    items: [
      item(tx("Useful", "Útil"), tx("The asset serves its purpose.", "El activo cumple su propósito.")),
      item(tx("Capacity", "Capacidad"), tx("Enough resources exist.", "Hay recursos suficientes.")),
      item(tx("Pace", "Ritmo"), tx("Progress is acceptable.", "El progreso es aceptable.")),
      item(tx("Completion", "Finalización"), tx("Finished in time.", "Termina a tiempo."))
    ],
    points: [
      tx("Availability is more than uptime.", "La disponibilidad es más que tiempo activo."),
      tx("It may involve capacity, pace, and usefulness.", "Puede involucrar capacidad, ritmo y utilidad."),
      tx("It depends on the service context.", "Depende del contexto del servicio.")
    ]
  },
  {
    section: tx("CIA", "CIA"),
    title: tx("Availability has operational properties", "La disponibilidad tiene propiedades operativas"),
    subtitle: tx("The resource must be usable in the intended way.", "El recurso debe poder usarse de la forma prevista."),
    visual: "cards",
    items: [
      item(tx("Timely response", "Respuesta oportuna"), tx("Requests do not wait forever.", "Las solicitudes no esperan para siempre.")),
      item(tx("Fair allocation", "Asignación justa"), tx("No starvation.", "Sin inanición de recursos.")),
      item(tx("Fault tolerance", "Tolerancia a fallas"), tx("No total breakdown.", "Sin colapso total.")),
      item(tx("Usability", "Usabilidad"), tx("Intended use remains possible.", "El uso previsto sigue siendo posible.")),
      item(tx("Concurrency", "Concurrencia"), tx("Shared use is controlled.", "El uso compartido se controla."))
    ],
    points: [
      tx("Availability includes timely response.", "La disponibilidad incluye respuesta oportuna."),
      tx("It includes fair resource allocation.", "Incluye asignación justa de recursos."),
      tx("It includes fault tolerance and controlled concurrency.", "Incluye tolerancia a fallas y concurrencia controlada.")
    ]
  },
  {
    section: tx("Tradeoffs", "Compensaciones"),
    title: tx("CIA must be balanced", "CIA debe balancearse"),
    subtitle: tx("Improving one property can weaken another.", "Mejorar una propiedad puede debilitar otra."),
    visual: "compare",
    items: [
      item(tx("More confidentiality", "Más confidencialidad"), tx("Disconnecting can reduce exposure but hurt availability.", "Desconectar reduce exposición pero daña disponibilidad.")),
      item(tx("More integrity checks", "Más revisiones de integridad"), tx("Verification can slow access and expose data.", "Verificar puede frenar acceso y exponer datos."))
    ],
    points: [
      tx("Disconnecting from the internet can increase confidentiality.", "Desconectar de internet puede aumentar confidencialidad."),
      tx("But availability and updates may suffer.", "Pero la disponibilidad y las actualizaciones pueden sufrir."),
      tx("Extensive checks can improve integrity but reduce speed and privacy.", "Revisiones extensas mejoran integridad pero reducen velocidad y privacidad.")
    ]
  },
  {
    section: tx("Defense", "Defensa"),
    title: tx("What should the good guys do?", "¿Qué deben hacer los buenos?"),
    subtitle: tx("Security is a cycle, not a single control.", "La seguridad es un ciclo, no un solo control."),
    visual: "loop",
    items: [
      item(tx("Prevention", "Prevención")),
      item(tx("Detection", "Detección")),
      item(tx("Response", "Respuesta")),
      item(tx("Recovery", "Recuperación"))
    ],
    points: [
      tx("Prevention tries to stop harm.", "La prevención intenta detener el daño."),
      tx("Detection finds evidence of harm.", "La detección encuentra evidencia de daño."),
      tx("Response and recovery reduce impact.", "Respuesta y recuperación reducen impacto.")
    ]
  },
  {
    section: tx("Secure design", "Diseño seguro"),
    title: tx("Design principles reduce vulnerabilities", "Los principios de diseño reducen vulnerabilidades"),
    subtitle: tx("Complexity is the enemy.", "La complejidad es el enemigo."),
    visual: "principles",
    items: [
      item(tx("Economy", "Economía"), tx("Keep mechanisms simple.", "Mantén mecanismos simples.")),
      item(tx("Fail-safe", "Falla segura"), tx("Default is no access.", "Por defecto no hay acceso.")),
      item(tx("Mediation", "Mediación"), tx("Check every access.", "Revisa cada acceso.")),
      item(tx("Open design", "Diseño abierto"), tx("Do not rely on secrecy.", "No dependas del secreto.")),
      item(tx("Least privilege", "Menor privilegio"), tx("Give only what is needed.", "Da solo lo necesario.")),
      item(tx("Acceptability", "Aceptabilidad"), tx("Security must be usable.", "La seguridad debe ser usable."))
    ],
    points: [
      tx("Economy of mechanism means simpler designs are safer to reason about.", "Economía de mecanismo significa que diseños simples son más fáciles de razonar."),
      tx("Fail-safe defaults reduce accidental exposure.", "Valores por defecto seguros reducen exposición accidental."),
      tx("Least privilege and usability matter together.", "Menor privilegio y usabilidad importan juntos.")
    ]
  },
  {
    section: tx("Summary", "Resumen"),
    title: tx("Security mindset", "Mentalidad de seguridad"),
    subtitle: tx("Know the assets, threats, vulnerabilities, attacks, and tradeoffs.", "Conoce activos, amenazas, vulnerabilidades, ataques y compensaciones."),
    visual: "flow",
    items: [
      item(tx("Assets", "Activos"), tx("What matters?", "¿Qué importa?")),
      item(tx("Threats", "Amenazas"), tx("Who can harm it?", "¿Quién puede dañarlo?")),
      item(tx("Weaknesses", "Debilidades"), tx("How can they succeed?", "¿Cómo pueden lograrlo?")),
      item(tx("Requirements", "Requisitos"), tx("What must hold?", "¿Qué debe mantenerse?")),
      item(tx("Assurance", "Confianza"), tx("How confident are we?", "¿Qué tanta confianza tenemos?"))
    ],
    points: [
      tx("Cybersecurity is a huge problem for people, companies, governments, and society.", "La ciberseguridad es un gran problema para personas, empresas, gobiernos y sociedad."),
      tx("Security improves assurance.", "La seguridad mejora el nivel de confianza."),
      tx("Next classes build on this vocabulary.", "Las siguientes clases construyen sobre este vocabulario.")
    ]
  }
];
