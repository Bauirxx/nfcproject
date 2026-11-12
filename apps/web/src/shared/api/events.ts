// Aviso de sessão perdida: o cliente da API emite-o quando um 401 não pôde ser resolvido com a renovação.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitUnauthorized(): void {
  for (const listener of [...listeners]) listener();
}
