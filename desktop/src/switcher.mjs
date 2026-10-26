// Pure transition state: cuts and completed fades swap Preview and Program.
export const BLACK = 'black';
export function transition(state, target, duration, now, effect = 'fade') {
  if (state.fade || state.program === target) return state;
  if (!duration) return { program: target, preview: state.program, fade: null };
  return { ...state, fade: { from: state.program, to: target, start: now, duration, ...(effect==='fade'?{}:{effect}) } };
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

export function sourceWeight(state,id,now){
  if(!state.fade)return state.program===id?1:0;
  const p=progress(state.fade,now);return state.fade.to===id?p:state.fade.from===id?1-p:0;
}
export function transitionRect(effect,p,width,height){
  p=Math.max(0,Math.min(1,p));
  if(effect==='slide')return {x:(1-p)*width,y:0,width,height};
  if(effect==='zoom')return {x:width*(1-p)/2,y:height*(1-p)/2,width:width*p,height:height*p};
  return {x:0,y:0,width,height};
}
