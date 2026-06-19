import { lectures, readLocalTickets, submitExitTicket } from "./reflection-api.js";

const form = document.getElementById("ticketForm");
const lectureId = document.getElementById("lectureId");
const studentName = document.getElementById("studentName");
const studentIdentifier = document.getElementById("studentIdentifier");
const confidence = document.getElementById("confidence");
const confidenceLabel = document.getElementById("confidenceLabel");
const focusQuestion = document.getElementById("focusQuestion");
const focusStarter = document.getElementById("focusStarter");
const oneThing = document.getElementById("oneThing");
const muddyPoint = document.getElementById("muddyPoint");
const nextAction = document.getElementById("nextAction");
const ticketStatus = document.getElementById("ticketStatus");
const ticketCount = document.getElementById("ticketCount");
const ticketList = document.getElementById("ticketList");

const reflectionPrompts = {
  "tc2007b-w1-l1": ["Which asset, harm, and CIA property can you now separate clearly?", "Start with: The system I would protect is... The first harm would be..."],
  "tc2007b-w1-l2": ["Where is the line between technical ability and authorization?", "Start with: I would stop before... because..."],
  "tc2007b-w2-l1": ["Which authentication choice is strongest once usability is included?", "Start with: I would choose... but the usability cost is..."],
  "tc2007b-w2-l2": ["Which permission would you remove first from an overpowered role?", "Start with: This role should not be able to... because..."],
  "tc2007b-w3-l1": ["Where is the trust boundary in today’s vulnerable example?", "Start with: The server must not trust... because..."],
  "tc2007b-w4-bridge": ["Which secure-coding risk should block release?", "Start with: I would block release if... because the impact is..."],
  "tc2007b-w5-l1": ["Which key operation still feels easiest to mix up?", "Start with: To encrypt/sign/verify, the key used is..."],
  "tc2007b-w6-bridge": ["What must be unique, secret, rotated, or slow in today’s data-protection choices?", "Start with: The mistake I would watch for is..."],
  "tc2007b-w7-l1": ["What proves a protocol message is fresh and from the right role?", "Start with: A replay would be detected because..."],
  "tc2007b-w8-bridge": ["Which channel warning would change your behavior immediately?", "Start with: I would not continue when... because..."],
  "tc2007b-w9-l1": ["What is the first safe move after suspected malware?", "Start with: I would first... to prevent..."],
  "tc2007b-w10-l1": ["Which traffic should be allowed, denied, or isolated?", "Start with: My default rule would be... except..."],
  "tc2007b-w11-l1": ["Which alert would you escalate first, and what evidence would you need?", "Start with: I would escalate... if I also saw..."]
};
const identity = readIdentity();

populateLectures();

const params = new URLSearchParams(window.location.search);
if (params.get("lecture") && lectures[params.get("lecture")]) {
  lectureId.value = params.get("lecture");
}
studentName.value = identity.student_name || "";
studentIdentifier.value = identity.student_id || "";
renderReflectionPrompt();

confidence.addEventListener("input", () => {
  confidenceLabel.textContent = confidence.value;
});

lectureId.addEventListener("change", renderReflectionPrompt);
studentIdentifier.addEventListener("input", () => {
  studentIdentifier.value = normalizeStudentId(studentIdentifier.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Saving...", "");
  form.querySelector("button").disabled = true;

  try {
    const result = await submitExitTicket({
      lecture_id: lectureId.value,
      student_name: studentName.value,
      student_identifier: normalizeStudentId(studentIdentifier.value),
      confidence: Number(confidence.value),
      one_thing: oneThing.value,
      muddy_point: muddyPoint.value,
      next_action: nextAction.value
    });
    saveIdentity(studentName.value, studentIdentifier.value);
    setStatus(result.mode === "supabase" ? "Saved for your teacher." : "Saved locally on this browser.", "good");
    oneThing.value = "";
    muddyPoint.value = "";
    renderTickets();
  } catch (error) {
    setStatus(error.message, "danger");
  } finally {
    form.querySelector("button").disabled = false;
  }
});

renderTickets();

function populateLectures() {
  lectureId.innerHTML = "";
  Object.entries(lectures).forEach(([id, title]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = title;
    lectureId.appendChild(option);
  });
}

function renderTickets() {
  const tickets = readLocalTickets();
  ticketCount.textContent = String(tickets.length);
  ticketList.innerHTML = "";
  if (!tickets.length) {
    ticketList.innerHTML = `<div class="ticket-item"><strong>No tickets yet</strong><p>Submit one after lecture to build your learning journal.</p></div>`;
    return;
  }

  tickets.slice(0, 6).forEach((ticket) => {
    const item = document.createElement("article");
    item.className = "ticket-item";
    item.innerHTML = `
      <strong></strong>
      <span></span>
      <p></p>
    `;
    item.querySelector("strong").textContent = ticket.lecture_title || ticket.lecture_id;
    item.querySelector("span").textContent = `${new Date(ticket.created_at).toLocaleString()} · confidence ${ticket.confidence}/5`;
    item.querySelector("p").textContent = ticket.muddy_point ? `Question: ${ticket.muddy_point}` : ticket.one_thing;
    ticketList.appendChild(item);
  });
}

function renderReflectionPrompt() {
  const [question, starter] = reflectionPrompts[lectureId.value] || [
    "What security decision changed for you today?",
    "Use the boxes below to name one idea, one uncertainty, and one next action."
  ];
  focusQuestion.textContent = question;
  focusStarter.textContent = starter;
  oneThing.placeholder = starter;
  muddyPoint.placeholder = "What still feels unclear or fragile?";
}

function setStatus(message, tone) {
  ticketStatus.textContent = message;
  if (tone) ticketStatus.dataset.tone = tone;
  else ticketStatus.removeAttribute("data-tone");
}

function normalizeStudentId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "")
    .slice(0, 40);
}

function readIdentity() {
  try {
    return JSON.parse(localStorage.getItem("tc2007b-student-identity")) || {};
  } catch (_error) {
    return {};
  }
}

function saveIdentity(name, id) {
  localStorage.setItem("tc2007b-student-identity", JSON.stringify({
    student_name: String(name || "").trim(),
    student_id: normalizeStudentId(id)
  }));
}
