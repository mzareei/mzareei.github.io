import { lectures, readLocalTickets, submitExitTicket } from "./reflection-api.js";

const form = document.getElementById("ticketForm");
const lectureId = document.getElementById("lectureId");
const studentName = document.getElementById("studentName");
const studentIdentifier = document.getElementById("studentIdentifier");
const confidence = document.getElementById("confidence");
const confidenceLabel = document.getElementById("confidenceLabel");
const oneThing = document.getElementById("oneThing");
const muddyPoint = document.getElementById("muddyPoint");
const nextAction = document.getElementById("nextAction");
const ticketStatus = document.getElementById("ticketStatus");
const ticketCount = document.getElementById("ticketCount");
const ticketList = document.getElementById("ticketList");

populateLectures();

const params = new URLSearchParams(window.location.search);
if (params.get("lecture") && lectures[params.get("lecture")]) {
  lectureId.value = params.get("lecture");
}

confidence.addEventListener("input", () => {
  confidenceLabel.textContent = confidence.value;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Saving...", "");
  form.querySelector("button").disabled = true;

  try {
    const result = await submitExitTicket({
      lecture_id: lectureId.value,
      student_name: studentName.value,
      student_identifier: studentIdentifier.value,
      confidence: Number(confidence.value),
      one_thing: oneThing.value,
      muddy_point: muddyPoint.value,
      next_action: nextAction.value
    });
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

function setStatus(message, tone) {
  ticketStatus.textContent = message;
  if (tone) ticketStatus.dataset.tone = tone;
  else ticketStatus.removeAttribute("data-tone");
}
