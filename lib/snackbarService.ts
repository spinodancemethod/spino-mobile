type Snack = {
  id: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
  duration?: number;
};

const listeners: Array<(s: Snack | null) => void> = [];

export function subscribe(cb: (s: Snack | null) => void) {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function showSnack(message: string, opts?: { actionTitle?: string; onAction?: () => void; duration?: number }) {
  const id = String(Math.random()).slice(2);
  const snack: Snack = { id, message, actionTitle: opts?.actionTitle, onAction: opts?.onAction, duration: opts?.duration ?? 4000 };
  for (const l of listeners) {
    try { l(snack); } catch (e) { /* ignore */ }
  }
  return id;
}

export function clearSnack() {
  for (const l of listeners) {
    try { l(null); } catch (e) { /* ignore */ }
  }
}

export default { subscribe, showSnack, clearSnack };
