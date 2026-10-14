export const bus = new Map();
export function broadcast(sessionId, event) {
  for (const write of bus.get(sessionId) || []) write(event);
}
