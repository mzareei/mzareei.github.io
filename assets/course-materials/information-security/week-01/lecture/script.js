const slides = [
  {
    layout: "compact",
    title: { en: "Security in applications and networks", es: "Seguridad en aplicaciones y redes" },
    subtitle: { en: "A first class about assets, risks, attacks, and the CIA triad.", es: "Una primera clase sobre activos, riesgos, ataques y la tríada CIA." },
    body: `
      <div class="equation">
        <div class="eq"><strong data-en="Value" data-es="Valor"></strong><span data-en="something matters" data-es="algo importa"></span></div>
        <div class="op">+</div>
        <div class="eq"><strong data-en="Risk" data-es="Riesgo"></strong><span data-en="it can be harmed" data-es="puede ser dañado"></span></div>
        <div class="op">=</div>
        <div class="eq"><strong data-en="Security" data-es="Seguridad"></strong><span data-en="protection is needed" data-es="se necesita protección"></span></div>
      </div>`
  },
  {
    title: { en: "Today’s roadmap", es: "Ruta de hoy" },
    subtitle: { en: "The lecture moves from intuition to vocabulary, then to requirements.", es: "La clase pasa de intuición a vocabulario y luego a requisitos." },
    body: `
      <div class="flow">
        <div class="node"><strong data-en="Why security?" data-es="¿Por qué seguridad?"></strong><span data-en="value and risk" data-es="valor y riesgo"></span></div>
        <div class="node"><strong data-en="Threat model" data-es="Modelo de amenaza"></strong><span data-en="actors, weaknesses, attacks" data-es="actores, debilidades, ataques"></span></div>
        <div class="node"><strong data-en="Real case" data-es="Caso real"></strong><span data-en="map concepts to incidents" data-es="mapear conceptos a incidentes"></span></div>
        <div class="node"><strong data-en="CIA" data-es="CIA"></strong><span data-en="security requirements" data-es="requisitos de seguridad"></span></div>
        <div class="node"><strong data-en="Design" data-es="Diseño"></strong><span data-en="reduce vulnerabilities" data-es="reducir vulnerabilidades"></span></div>
      </div>`
  },
  {
    title: { en: "Before the technical part", es: "Antes de la parte técnica" },
    body: `
      <div class="grid-2">
        <div>
          <h2 data-en="Class norms" data-es="Normas de clase"></h2>
          <ul>
            <li data-en="Devices only when the activity requires them." data-es="Dispositivos solo cuando la actividad los requiere."></li>
            <li data-en="There is usually one short break." data-es="Normalmente hay un descanso corto."></li>
            <li data-en="If you are lost, ask." data-es="Si te pierdes, pregunta."></li>
          </ul>
        </div>
        <div class="box soft">
          <h3 data-en="AI policy" data-es="Política de IA"></h3>
          <p data-en="Use AI as a thinking aid, not as a substitute for understanding. If you use it, you must be able to explain it." data-es="Usa IA como apoyo para pensar, no como sustituto de comprensión. Si la usas, debes poder explicarla."></p>
        </div>
      </div>`
  },
  {
    title: { en: "What is computer security?", es: "¿Qué es seguridad informática?" },
    subtitle: { en: "NIST frames it as protection for automated information systems.", es: "NIST la plantea como protección para sistemas automatizados de información." },
    body: `
      <p class="lead" data-en="The goal is to preserve the applicable objectives of confidentiality, integrity, and availability for system resources." data-es="El objetivo es preservar confidencialidad, integridad y disponibilidad en los recursos del sistema."></p>
      <div class="triangle-wrap">
        <div class="triangle"></div>
        <div class="tri-label top" data-en="Confidentiality" data-es="Confidencialidad"></div>
        <div class="tri-label left" data-en="Integrity" data-es="Integridad"></div>
        <div class="tri-label right" data-en="Availability" data-es="Disponibilidad"></div>
      </div>`
  },
  {
    title: { en: "Security mindset", es: "Mentalidad de seguridad" },
    subtitle: { en: "Good security starts with better questions.", es: "La buena seguridad empieza con mejores preguntas." },
    body: `
      <div class="grid-2">
        <div>
          <h2 data-en="Three questions" data-es="Tres preguntas"></h2>
          <ul>
            <li data-en="Why is cybersecurity important?" data-es="¿Por qué importa la ciberseguridad?"></li>
            <li data-en="How do we understand cybersecurity?" data-es="¿Cómo entendemos la ciberseguridad?"></li>
            <li data-en="What should we do about it?" data-es="¿Qué debemos hacer al respecto?"></li>
          </ul>
        </div>
        <div class="box blue">
          <h3 data-en="Main habit" data-es="Hábito principal"></h3>
          <p data-en="Ask what has value, how it can be harmed, and who benefits from that harm." data-es="Pregunta qué tiene valor, cómo puede dañarse y quién se beneficia de ese daño."></p>
        </div>
      </div>`
  },
  {
    title: { en: "Who is safe?", es: "¿Quién está a salvo?" },
    subtitle: { en: "Large breaches show that exposure is widespread.", es: "Las grandes brechas muestran que la exposición es amplia." },
    body: `
      <div class="grid-2">
        <div class="dots"><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i></div>
        <div>
          <ul>
            <li data-en="Individuals store sensitive data online." data-es="Las personas guardan datos sensibles en línea."></li>
            <li data-en="If stolen, criminals can profit from it." data-es="Si se roban, los criminales pueden obtener ganancias."></li>
            <li data-en="Businesses, governments, and infrastructure also depend on cyber systems." data-es="Empresas, gobiernos e infraestructura también dependen de sistemas cibernéticos."></li>
          </ul>
        </div>
      </div>`
  },
  {
    title: { en: "From value to risk", es: "Del valor al riesgo" },
    subtitle: { en: "A cyber asset becomes a security concern when harm is plausible.", es: "Un activo cibernético se vuelve preocupación de seguridad cuando el daño es posible." },
    body: `
      <div class="flow">
        <div class="node"><strong data-en="Asset" data-es="Activo"></strong><span data-en="what matters" data-es="lo que importa"></span></div>
        <div class="node"><strong data-en="Threat" data-es="Amenaza"></strong><span data-en="source of possible harm" data-es="fuente de posible daño"></span></div>
        <div class="node"><strong data-en="Vulnerability" data-es="Vulnerabilidad"></strong><span data-en="weakness" data-es="debilidad"></span></div>
        <div class="node"><strong data-en="Attack" data-es="Ataque"></strong><span data-en="exploitation" data-es="explotación"></span></div>
        <div class="node"><strong data-en="Impact" data-es="Impacto"></strong><span data-en="what fails" data-es="qué falla"></span></div>
      </div>`
  },
  {
    title: { en: "Important questions", es: "Preguntas importantes" },
    body: `
      <div class="grid-2">
        <ul>
          <li data-en="What is of value in this context?" data-es="¿Qué tiene valor en este contexto?"></li>
          <li data-en="Where do threats come from?" data-es="¿De dónde vienen las amenazas?"></li>
          <li data-en="What kind of risk are we talking about?" data-es="¿De qué tipo de riesgo hablamos?"></li>
        </ul>
        <ul>
          <li data-en="Who is the source of the threat?" data-es="¿Quién es la fuente de la amenaza?"></li>
          <li data-en="What security measures can we take?" data-es="¿Qué medidas de seguridad podemos tomar?"></li>
        </ul>
      </div>`
  },
  {
    title: { en: "Threat actors exploit vulnerabilities", es: "Los actores explotan vulnerabilidades" },
    subtitle: { en: "Attacks can lead to compromise or a security breach.", es: "Los ataques pueden llevar a compromiso o brecha de seguridad." },
    body: `
      <div class="flow">
        <div class="node"><strong data-en="Threat actor" data-es="Actor"></strong><span data-en="who wants harm" data-es="quién quiere dañar"></span></div>
        <div class="node"><strong data-en="Vulnerability" data-es="Vulnerabilidad"></strong><span data-en="software, networks, humans" data-es="software, redes, humanos"></span></div>
        <div class="node"><strong data-en="Attack" data-es="Ataque"></strong><span data-en="exploit the weakness" data-es="explotar la debilidad"></span></div>
        <div class="node"><strong data-en="Compromise" data-es="Compromiso"></strong><span data-en="security property lost" data-es="se pierde una propiedad"></span></div>
        <div class="node"><strong data-en="Breach" data-es="Brecha"></strong><span data-en="visible failure" data-es="falla visible"></span></div>
      </div>`
  },
  {
    title: { en: "Threat actors", es: "Actores de amenaza" },
    subtitle: { en: "Different actors have different motivations.", es: "Distintos actores tienen distintas motivaciones." },
    body: `
      <div class="grid-3">
        <div class="box soft"><h3 data-en="Cybercriminals" data-es="Cibercriminales"></h3><p data-en="Profit from sensitive data." data-es="Buscan ganancias con datos sensibles."></p></div>
        <div class="box blue"><h3 data-en="Hacktivists" data-es="Hacktivistas"></h3><p data-en="Act for a cause, protest, or pressure." data-es="Actúan por una causa, protesta o presión."></p></div>
        <div class="box red"><h3 data-en="Nation-states" data-es="Estados nación"></h3><p data-en="Seek advantage, espionage, or influence." data-es="Buscan ventaja, espionaje o influencia."></p></div>
      </div>`
  },
  {
    title: { en: "Vulnerabilities are everywhere", es: "Las vulnerabilidades están en todas partes" },
    subtitle: { en: "It is very hard to remove them completely.", es: "Es muy difícil eliminarlas por completo." },
    body: `
      <div class="grid-3">
        <div class="box"><h3 data-en="Software" data-es="Software"></h3><p data-en="Bugs, missing patches, insecure logic." data-es="Errores, parches faltantes, lógica insegura."></p></div>
        <div class="box"><h3 data-en="Networks" data-es="Redes"></h3><p data-en="Misconfiguration, exposure, weak protocols." data-es="Mala configuración, exposición, protocolos débiles."></p></div>
        <div class="box"><h3 data-en="Humans" data-es="Humanos"></h3><p data-en="Mistakes, deception, social engineering." data-es="Errores, engaño, ingeniería social."></p></div>
      </div>`
  },
  {
    title: { en: "A breach is a chain", es: "Una brecha es una cadena" },
    subtitle: { en: "A visible failure usually has earlier causes.", es: "Una falla visible normalmente tiene causas anteriores." },
    body: `
      <div class="flow">
        <div class="node"><strong data-en="Entry" data-es="Entrada"></strong><span data-en="how in?" data-es="¿cómo entra?"></span></div>
        <div class="node"><strong data-en="Access" data-es="Acceso"></strong><span data-en="what can be reached?" data-es="¿qué alcanza?"></span></div>
        <div class="node"><strong data-en="Movement" data-es="Movimiento"></strong><span data-en="where next?" data-es="¿a dónde sigue?"></span></div>
        <div class="node"><strong data-en="Objective" data-es="Objetivo"></strong><span data-en="what for?" data-es="¿para qué?"></span></div>
        <div class="node"><strong data-en="Impact" data-es="Impacto"></strong><span data-en="who is harmed?" data-es="¿quién resulta dañado?"></span></div>
      </div>`
  },
  {
    title: { en: "A real case: Target", es: "Un caso real: Target" },
    subtitle: { en: "Use the case to practice the vocabulary, not just to tell a story.", es: "Usa el caso para practicar vocabulario, no solo para contar una historia." },
    body: `
      <div class="grid-2">
        <div>
          <h2 data-en="Case canvas" data-es="Lienzo del caso"></h2>
          <ul>
            <li data-en="What assets matter?" data-es="¿Qué activos importan?"></li>
            <li data-en="Who could benefit from harm?" data-es="¿Quién se beneficia del daño?"></li>
            <li data-en="Which vulnerability made the path possible?" data-es="¿Qué vulnerabilidad hizo posible el camino?"></li>
          </ul>
        </div>
        <div class="box soft">
          <h3 data-en="Discussion rule" data-es="Regla de discusión"></h3>
          <p data-en="Do not stop at 'there was a breach'. Name the asset, threat, vulnerability, attack, and security property affected." data-es="No te detengas en 'hubo una brecha'. Nombra activo, amenaza, vulnerabilidad, ataque y propiedad afectada."></p>
        </div>
      </div>`
  },
  {
    title: { en: "The core concept map", es: "El mapa conceptual central" },
    body: `
      <div class="flow">
        <div class="node"><strong data-en="Value" data-es="Valor"></strong><span data-en="why we care" data-es="por qué importa"></span></div>
        <div class="node"><strong data-en="Threat" data-es="Amenaza"></strong><span data-en="possible harm" data-es="daño posible"></span></div>
        <div class="node"><strong data-en="Weakness" data-es="Debilidad"></strong><span data-en="how harm enters" data-es="cómo entra el daño"></span></div>
        <div class="node"><strong data-en="Attack" data-es="Ataque"></strong><span data-en="harm attempted" data-es="daño intentado"></span></div>
        <div class="node"><strong data-en="Risk" data-es="Riesgo"></strong><span data-en="potential loss" data-es="pérdida potencial"></span></div>
      </div>`
  },
  {
    title: { en: "What should we protect?", es: "¿Qué debemos proteger?" },
    subtitle: { en: "The CIA triad is the first security requirements framework.", es: "La tríada CIA es el primer marco de requisitos de seguridad." },
    body: `
      <div class="triangle-wrap">
        <div class="triangle"></div>
        <div class="tri-label top" data-en="Confidentiality" data-es="Confidencialidad"></div>
        <div class="tri-label left" data-en="Integrity" data-es="Integridad"></div>
        <div class="tri-label right" data-en="Availability" data-es="Disponibilidad"></div>
      </div>`
  },
  {
    title: { en: "CIA is not everything", es: "CIA no lo es todo" },
    subtitle: { en: "Other security components often appear with CIA.", es: "Otros componentes de seguridad suelen aparecer junto con CIA." },
    body: `
      <div class="grid-3">
        <div class="box soft"><h3 data-en="Authentication" data-es="Autenticación"></h3><p data-en="Are you who you claim to be?" data-es="¿Eres quien dices ser?"></p></div>
        <div class="box blue"><h3 data-en="Authorization" data-es="Autorización"></h3><p data-en="What are you allowed to access?" data-es="¿A qué tienes permitido acceder?"></p></div>
        <div class="box red"><h3 data-en="Non-repudiation" data-es="No repudio"></h3><p data-en="Can you deny the validity of an action?" data-es="¿Puedes negar la validez de una acción?"></p></div>
      </div>`
  },
  {
    title: { en: "Threats vs. requirements", es: "Amenazas vs. requisitos" },
    subtitle: { en: "Sometimes it is easier to think in terms of threats.", es: "A veces es más fácil pensar en términos de amenazas." },
    body: `
      <div class="matrix">
        <div class="row"><span data-en="Information disclosure" data-es="Divulgación de información"></span><strong data-en="Confidentiality" data-es="Confidencialidad"></strong></div>
        <div class="row"><span data-en="Denial of service" data-es="Denegación de servicio"></span><strong data-en="Availability" data-es="Disponibilidad"></strong></div>
        <div class="row"><span data-en="Tampering with information" data-es="Manipulación de información"></span><strong data-en="Integrity" data-es="Integridad"></strong></div>
        <div class="row"><span data-en="Unauthorized access" data-es="Acceso no autorizado"></span><strong data-en="Authorization" data-es="Autorización"></strong></div>
        <div class="row"><span data-en="Phishing" data-es="Phishing"></span><strong data-en="Authentication" data-es="Autenticación"></strong></div>
      </div>`
  },
  {
    title: { en: "Phishing vs. spoofing", es: "Phishing vs. spoofing" },
    subtitle: { en: "They often work together, but they are not the same.", es: "A menudo trabajan juntos, pero no son lo mismo." },
    body: `
      <div class="compare">
        <div>
          <h2 data-en="Phishing" data-es="Phishing"></h2>
          <ul>
            <li data-en="Tricks a person into giving sensitive information." data-es="Engaña a una persona para entregar información sensible."></li>
            <li><span class="mark" data-en="retrieval" data-es="obtención"></span></li>
          </ul>
        </div>
        <div>
          <h2 data-en="Spoofing" data-es="Spoofing"></h2>
          <ul>
            <li data-en="Pretends to be a trusted source." data-es="Finge ser una fuente confiable."></li>
            <li><span class="mark" data-en="delivery" data-es="entrega"></span></li>
          </ul>
        </div>
      </div>`
  },
  {
    title: { en: "Confidentiality", es: "Confidencialidad" },
    subtitle: { en: "Unauthorized users cannot read information.", es: "Usuarios no autorizados no pueden leer información." },
    body: `
      <div class="flow">
        <div class="node"><strong data-en="Identity" data-es="Identidad"></strong><span data-en="who are you?" data-es="¿quién eres?"></span></div>
        <div class="node"><strong data-en="Authentication" data-es="Autenticación"></strong><span data-en="prove it" data-es="demuéstralo"></span></div>
        <div class="node"><strong data-en="Access control" data-es="Control de acceso"></strong><span data-en="who can access what?" data-es="¿quién accede a qué?"></span></div>
        <div class="node"><strong data-en="Need to know" data-es="Necesidad de saber"></strong><span data-en="limit exposure" data-es="limitar exposición"></span></div>
        <div class="node"><strong data-en="Confidentiality" data-es="Confidencialidad"></strong><span data-en="no unauthorized reading" data-es="sin lectura no autorizada"></span></div>
      </div>`
  },
  {
    title: { en: "Integrity", es: "Integridad" },
    subtitle: { en: "Integrity is concerned with unauthorized modification of assets.", es: "La integridad se relaciona con modificaciones no autorizadas de activos." },
    body: `
      <div class="grid-2">
        <div>
          <h2 data-en="Integrity is harder to measure" data-es="La integridad es más difícil de medir"></h2>
          <ul>
            <li data-en="Not simply binary." data-es="No es simplemente binaria."></li>
            <li data-en="Exists in degrees." data-es="Existe en grados."></li>
            <li data-en="Context-dependent." data-es="Depende del contexto."></li>
          </ul>
        </div>
        <div class="box soft">
          <h3 data-en="Examples" data-es="Ejemplos"></h3>
          <p data-en="A bank account and a medical record both need integrity, but 'correct' means different things." data-es="Una cuenta bancaria y un expediente médico necesitan integridad, pero 'correcto' significa cosas distintas."></p>
        </div>
      </div>`
  },
  {
    title: { en: "Availability", es: "Disponibilidad" },
    subtitle: { en: "Available means usable in the intended way.", es: "Disponible significa usable de la forma prevista." },
    body: `
      <div class="grid-3">
        <div class="box"><h3 data-en="Timely" data-es="Oportuna"></h3><p data-en="Requests receive responses." data-es="Las solicitudes reciben respuesta."></p></div>
        <div class="box"><h3 data-en="Fair" data-es="Justa"></h3><p data-en="No starvation of resources." data-es="Sin inanición de recursos."></p></div>
        <div class="box"><h3 data-en="Fault tolerant" data-es="Tolerante a fallas"></h3><p data-en="No total breakdown." data-es="Sin colapso total."></p></div>
      </div>`
  },
  {
    title: { en: "CIA must be balanced", es: "CIA debe balancearse" },
    subtitle: { en: "Improving one property can weaken another.", es: "Mejorar una propiedad puede debilitar otra." },
    body: `
      <div class="compare">
        <div class="box soft">
          <h3 data-en="More confidentiality" data-es="Más confidencialidad"></h3>
          <p data-en="Disconnecting a computer may reduce exposure, but availability and updates suffer." data-es="Desconectar una computadora puede reducir exposición, pero sufren disponibilidad y actualizaciones."></p>
        </div>
        <div class="box red">
          <h3 data-en="More integrity checks" data-es="Más revisiones de integridad"></h3>
          <p data-en="Extensive checks can improve integrity, but may slow access and expose data." data-es="Revisiones extensas pueden mejorar integridad, pero frenan acceso y exponen datos."></p>
        </div>
      </div>`
  },
  {
    title: { en: "What should the good guys do?", es: "¿Qué deben hacer los buenos?" },
    subtitle: { en: "Security work is a cycle.", es: "El trabajo de seguridad es un ciclo." },
    body: `
      <div class="cycle">
        <div class="box soft"><h3 data-en="Prevention" data-es="Prevención"></h3></div>
        <div class="box blue"><h3 data-en="Detection" data-es="Detección"></h3></div>
        <div class="box red"><h3 data-en="Response" data-es="Respuesta"></h3></div>
        <div class="box"><h3 data-en="Recovery" data-es="Recuperación"></h3></div>
      </div>
      <p class="subtitle" data-en="Policy says what should happen. Mechanism says how it is enforced." data-es="La política dice qué debe ocurrir. El mecanismo dice cómo se aplica."></p>`
  },
  {
    title: { en: "Secure design principles", es: "Principios de diseño seguro" },
    subtitle: { en: "Reduce vulnerabilities by making systems easier to reason about.", es: "Reduce vulnerabilidades haciendo sistemas más fáciles de razonar." },
    body: `
      <div class="grid-3">
        <div class="box"><h3 data-en="Economy" data-es="Economía"></h3><p data-en="Complexity is the enemy." data-es="La complejidad es el enemigo."></p></div>
        <div class="box"><h3 data-en="Fail-safe defaults" data-es="Valores seguros"></h3><p data-en="Default situation is no access." data-es="Por defecto no hay acceso."></p></div>
        <div class="box"><h3 data-en="Least privilege" data-es="Menor privilegio"></h3><p data-en="Give only what is needed." data-es="Da solo lo necesario."></p></div>
      </div>`
  },
  {
    title: { en: "Lesson summary", es: "Resumen de la clase" },
    subtitle: { en: "A security mindset connects value, threats, vulnerabilities, attacks, and requirements.", es: "La mentalidad de seguridad conecta valor, amenazas, vulnerabilidades, ataques y requisitos." },
    body: `
      <div class="flow">
        <div class="node"><strong data-en="Assets" data-es="Activos"></strong><span data-en="what matters" data-es="lo que importa"></span></div>
        <div class="node"><strong data-en="Threats" data-es="Amenazas"></strong><span data-en="who can harm it" data-es="quién puede dañarlo"></span></div>
        <div class="node"><strong data-en="Weaknesses" data-es="Debilidades"></strong><span data-en="how attacks succeed" data-es="cómo tienen éxito los ataques"></span></div>
        <div class="node"><strong data-en="CIA" data-es="CIA"></strong><span data-en="what must hold" data-es="qué debe mantenerse"></span></div>
        <div class="node"><strong data-en="Assurance" data-es="Confianza"></strong><span data-en="how confident we are" data-es="qué tanta confianza tenemos"></span></div>
      </div>`
  }
];

let current = 0;
let lang = localStorage.getItem("week01-language") || "en";

const deck = document.getElementById("deck");
const footer = document.getElementById("footer");
const prev = document.getElementById("prev");
const next = document.getElementById("next");
const langButtons = [...document.querySelectorAll(".lang-switch button")];

function text(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.en || "";
}

function localize(root) {
  root.querySelectorAll("[data-en]").forEach((node) => {
    node.textContent = node.dataset[lang] || node.dataset.en || "";
  });
}

function render() {
  const s = slides[current];
  deck.innerHTML = `
    <section class="slide ${s.layout || ""}">
      ${s.kicker ? `<div class="kicker">${text(s.kicker)}</div>` : ""}
      <header>
        <h1>${text(s.title)}</h1>
        ${s.subtitle ? `<p class="subtitle">${text(s.subtitle)}</p>` : ""}
      </header>
      ${s.body}
    </section>
  `;
  localize(deck);
  footer.textContent = `Week 01 · Information Security · ${current + 1}/${slides.length}`;
  prev.disabled = current === 0;
  next.disabled = current === slides.length - 1;
  langButtons.forEach((button) => button.classList.toggle("active", button.dataset.lang === lang));
  document.documentElement.lang = lang;
  const hash = `#/${current + 1}/0`;
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

function go(delta) {
  current = Math.max(0, Math.min(slides.length - 1, current + delta));
  render();
}

function readHash() {
  const match = location.hash.match(/^#\/(\d+)/);
  if (match) current = Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1));
}

prev.addEventListener("click", () => go(-1));
next.addEventListener("click", () => go(1));

langButtons.forEach((button) => {
  button.addEventListener("click", () => {
    lang = button.dataset.lang;
    localStorage.setItem("week01-language", lang);
    render();
  });
});

document.addEventListener("keydown", (event) => {
  if (["ArrowRight", "PageDown", " ", "Enter"].includes(event.key)) {
    event.preventDefault();
    go(1);
  }
  if (["ArrowLeft", "PageUp", "Backspace"].includes(event.key)) {
    event.preventDefault();
    go(-1);
  }
  if (event.key.toLowerCase() === "f") {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  }
});

window.addEventListener("hashchange", () => {
  readHash();
  render();
});

readHash();
render();
