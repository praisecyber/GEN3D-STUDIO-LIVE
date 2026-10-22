// Pure transition state: cuts and completed fades swap Preview and Program.
export const BLACK = 'black';
export function transition(state, target, duration, now) {
  if (state.fade || state.program === target) return state;
  if (!duration) return { program: target, preview: state.program, fade: null };
  return { ...state, fade: { from: state.program, to: target, start: now, duration } };
}
export function advance(state, now) {
  if (!state.fade) return state;
  if (now - state.fade.start < state.fade.duration) return state;
  return { program: state.fade.to, preview: state.fade.from, fade: null };
}
export function progress(fade, now) {
  return Math.min(1, Math.max(0, (now - fade.start) / fade.duration));
}
export function removeSource(state, id) {
  // A source disappearing mid-transition cancels the transition to avoid stale frames.
  return { program: state.program === id ? BLACK : state.program,
    preview: state.preview === id ? BLACK : state.preview,
    fade: state.fade && [state.fade.from, state.fade.to].includes(id) ? null : state.fade };
}
