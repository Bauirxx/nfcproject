import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { emitUnauthorized } from '@/shared/api/events';
import { clearSessionExpired, isSessionExpired, sessionQueryKey, watchSession } from './session-events';

afterEach(() => clearSessionExpired());

describe('watchSession', () => {
  it('marca expiração quando havia sessão e limpa a sessão em cache', () => {
    const client = new QueryClient();
    const stop = watchSession(client);
    client.setQueryData(sessionQueryKey, { id: 'u_ana' });

    emitUnauthorized();

    expect(isSessionExpired()).toBe(true);
    expect(client.getQueryData(sessionQueryKey)).toBeNull();
    stop();
  });

  it('não marca expiração quando nunca houve sessão', () => {
    const client = new QueryClient();
    const stop = watchSession(client);

    emitUnauthorized();

    expect(isSessionExpired()).toBe(false);
    expect(client.getQueryData(sessionQueryKey)).toBeNull();
    stop();
  });

  it('deixa de reagir depois de cancelado', () => {
    const client = new QueryClient();
    const stop = watchSession(client);
    stop();
    client.setQueryData(sessionQueryKey, { id: 'u_ana' });

    emitUnauthorized();

    expect(isSessionExpired()).toBe(false);
    expect(client.getQueryData(sessionQueryKey)).toEqual({ id: 'u_ana' });
  });
});
