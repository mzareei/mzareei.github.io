function positive(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}

function publicOption(value) {
  const option = value && typeof value === "object" ? value : {};
  return {
    key: String(option.key || ""),
    text: String(option.text || ""),
    text_es: option.text_es ? String(option.text_es) : null
  };
}

function publicPulse(value, reveal) {
  if (!value || typeof value !== "object") return null;
  const pulse = value;
  const options = (Array.isArray(pulse.options) ? pulse.options : []).map(publicOption);
  const base = {
    round_id: String(pulse.round_id || ""),
    prompt: String(pulse.prompt || ""),
    prompt_es: pulse.prompt_es ? String(pulse.prompt_es) : null,
    options,
    state: reveal ? "revealed" : "open",
    submitted: Math.max(0, Number(pulse.submitted) || 0),
    eligible: Math.max(0, Number(pulse.eligible) || 0)
  };
  if (reveal) {
    const correctKey = String(pulse.correct_key || "");
    base.correct_option = options.find((option) => option.key === correctKey) || null;
    base.explanation = pulse.explanation ? String(pulse.explanation) : null;
    base.explanation_es = pulse.explanation_es ? String(pulse.explanation_es) : null;
  }
  return base;
}

function checkpoint(state) {
  const key = String(state.checkpoint_key || "").trim();
  const afterSlide = Number(state.checkpoint_after_slide);
  return key && Number.isInteger(afterSlide) && afterSlide >= 1
    ? { key, after_slide: afterSlide }
    : null;
}

export function projectorView(input) {
  const state = input.state || {};
  const pulse = input.pulse || null;
  const revealed = String(pulse?.state || "") === "revealed";
  return {
    session_id: String(input.session_id || state.class_session_id || ""),
    revision: Math.max(0, Number(state.revision) || 0),
    requested_slide: positive(state.requested_slide),
    phase: String(state.phase || "lecture"),
    checkpoint: checkpoint(state),
    pulse: publicPulse(pulse, revealed)
  };
}

export function controllerView(input) {
  const state = input.state || {};
  const pulse = input.pulse || null;
  return {
    session_id: String(input.session_id || state.class_session_id || ""),
    revision: Math.max(0, Number(state.revision) || 0),
    requested_slide: positive(state.requested_slide),
    acknowledged_slide: positive(state.acknowledged_slide),
    phase: String(state.phase || "lecture"),
    checkpoint: checkpoint(state),
    projector_seen_at: state.projector_seen_at ? String(state.projector_seen_at) : null,
    controller_seen_at: state.controller_seen_at ? String(state.controller_seen_at) : null,
    pulse: pulse
      ? {
          round_id: String(pulse.round_id || ""),
          prompt: String(pulse.prompt || ""),
          prompt_es: pulse.prompt_es ? String(pulse.prompt_es) : null,
          options: (Array.isArray(pulse.options) ? pulse.options : []).map(publicOption),
          state: String(pulse.state || "open"),
          submitted: Math.max(0, Number(pulse.submitted) || 0),
          eligible: Math.max(0, Number(pulse.eligible) || 0),
          correct_key: pulse.correct_key ? String(pulse.correct_key) : null,
          explanation: pulse.explanation ? String(pulse.explanation) : null,
          explanation_es: pulse.explanation_es ? String(pulse.explanation_es) : null
        }
      : null
  };
}
