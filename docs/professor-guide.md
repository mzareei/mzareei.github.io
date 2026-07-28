# Running a class on the course platform

**App:** https://course-platform-3ko.pages.dev

This is the operating guide for the class-day flow. It describes what the
platform does today, not what is planned.

---

## Signing in

**You (instructor):** enter your institutional email, click *Email me a sign-in
link*, then either open the link or type the 6-digit code. Test sign-in is
deliberately refused for instructor accounts.

**A student:** enters their institutional email and does the same. During the
testing period there is also a *Sign in without email* button, which works for
anyone already on the roster — that button disappears before the semester starts.

To try the student side yourself, use a second browser (or a private window) and
the QA account `zarei.1982@gmail.com` with the testing button. `test.student@tec.mx`
works too, if you want two students at once.

---

## Class day

Everything happens on one screen. From **Home**, click **Run class** on today's
session.

### 1. Ask questions during the lecture

Pick which lecture you're teaching and, optionally, a difficulty — or leave
*Surprise me*. Click **Pick a question**: the platform draws one from that
lecture's generated bank and shows you the answer. Not the one you want? Click
**Pick a different one**.

**Send to the class** puts it on every student's phone within a few seconds. You
watch the votes arrive live. **Show the answer** reveals the correct option on
your screen and on theirs — each student sees whether they were right and the
point they earned. **Close the question** puts the room back to waiting.

Repeat as often as you like. It's graded: answering earns partial credit,
answering correctly earns full credit. Questions already asked this class are
tracked so you don't repeat one by accident.

### 2. The end-of-class quiz

Scroll to **End-of-class quiz** and click **Start the quiz**. There is nothing to
write — the platform picks a mixed set of easy, medium and hard questions from
today's lecture bank.

Students get them one at a time, each with its own countdown (roughly 20 seconds
for short easy ones, up to 45 for harder ones). It moves on by itself when a
question's time runs out, and submits automatically after the last one. There is
no going back to a previous question.

You watch the submitted count climb. **Close the quiz** when you're ready; the
class average appears, and students move on to the reflection.

You can run more than one quiz in a class — after closing one, the button
becomes **Start another quiz**.

### 3. Reflections

Once the quiz closes, each student writes one paragraph (50–100 words) on what
they learned. They appear on your screen as they arrive, with names, and keep
arriving for a few minutes after class.

### 4. End the class

Click **End the class**. This closes any open question and any running quiz, and
stops students being offered *Join class*. Reflections stay open for a short
grace window afterwards. This is the only irreversible button on the screen, so
it asks first.

---

## What students see

- **Today** — what's released right now. During class, a large **Join class**
  button.
- **In class** — the live screen: questions, then the quiz, then the reflection,
  then "that's everything for today". They never navigate; it follows you.
- **Review** — everything released so far, to revisit.
- **My Grades** — weighted total, category breakdown, and each graded item.

---

## Building a lecture from a PDF

**Content → New lecture from a PDF.** Export your slides to PDF, give the
lecture a title, and upload. The platform reads the PDF, writes a bilingual web
deck, and writes a tiered question bank (6 easy / 6 medium / 6 hard) from the
same material.

It shows plain-language progress while it works, and you can leave the page.
When it's ready, **Review it**: you see the deck and every question with its
correct answer marked. **Approve** puts it in your library as a *draft* —
students still see nothing until you release it for a class.

> **Setup required.** This needs an Anthropic API key on the backend:
>
> ```
> npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
> ```
>
> Until that's set, uploading works but generation fails with a clear message.
> Optional: `ANTHROPIC_MODEL` (defaults to `claude-sonnet-5`) and
> `GENERATION_WORKER_SECRET` to lock the worker endpoint.

---

## Other screens

- **Gradebook** — the semester matrix and category weights.
- **People** — the roster with roles and sections, adding one person at a time,
  and external-access guests.

---

## If something looks wrong

Everything the students see is driven by the class session's own state, so the
two things worth checking first are:

1. Is the session actually live? Home shows a **Live** pill next to it.
2. Did the student reload? The live screen polls every few seconds on its own,
   but a reload never hurts.

Nothing a student does is lost if their phone sleeps or their connection drops —
answers and quiz submissions are recorded server-side the moment they're made.
