'use client';

import { useEffect, useRef } from 'react';

type KeepOpts = {
    idleMs?: number;
    refreshSkewMs?: number;
    checkEveryMs?: number;
    heartbeatEveryMs?: number;
};

type MLMessage =
    | { type: 'activity'; ts: number }
    | { type: 'token_refreshed' };

type RefreshResponse = { token?: string };

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;

export default function SessionKeeper({
                                          idleMs = 30 * 60 * 1000,
                                          refreshSkewMs = 2 * 60 * 1000,
                                          checkEveryMs = 30 * 1000,
                                          heartbeatEveryMs = 5 * 60 * 1000,
                                      }: KeepOpts) {
    const lastActivity = useRef<number>(Date.now());
    const bc = useRef<BroadcastChannel | null>(null);

    function getAccessExpMs(): number | null {
        const token = localStorage.getItem('jwt') || sessionStorage.getItem('jwt');
        if (!token) return null;
        try {
            const [, payload] = token.split('.');
            const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
            return typeof json.exp === 'number' ? json.exp * 1000 : null;
        } catch {
            return null;
        }
    }

    async function refreshIfNeeded(): Promise<void> {
        const expMs = getAccessExpMs();
        if (!expMs) return;

        const now = Date.now();
        const inactive = now - lastActivity.current > idleMs;
        const isNearExpiry = expMs - now <= refreshSkewMs;

        if (!inactive && isNearExpiry) {
            try {
                const res = await fetch(`${BACKEND}/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });

                const json = (await res
                    .json()
                    .catch<Partial<RefreshResponse>>(() => ({}))) as Partial<RefreshResponse>;

                if (res.ok && json.token) {
                    if (localStorage.getItem('jwt')) {
                        localStorage.setItem('jwt', json.token);
                    } else {
                        sessionStorage.setItem('jwt', json.token);
                    }
                    bc.current?.postMessage({ type: 'token_refreshed' } satisfies MLMessage);
                }
            } catch {
                // ignore; try again on next tick
            }
        }
    }

    function heartbeat(): void {
        try {
            const url = `${BACKEND}/auth/heartbeat`;
            const ok = typeof navigator.sendBeacon === 'function' ? navigator.sendBeacon(url) : false;
            if (!ok) {
                void fetch(url, { method: 'POST', keepalive: true, credentials: 'include' }).catch(() => {});
            }
        } catch {
            // ignore
        }
    }

    useEffect(() => {
        const touch = (): void => {
            lastActivity.current = Date.now();
            bc.current?.postMessage({ type: 'activity', ts: lastActivity.current } satisfies MLMessage);
        };
        const onVisibility = (): void => {
            if (!document.hidden) touch();
        };
        const onFocus = (): void => touch();

        // No `any` here: EventListener is `(evt: Event) => void`
        const handlers: Array<[keyof DocumentEventMap, EventListener]> = [
            ['visibilitychange', onVisibility as EventListener],
            ['keydown', touch as EventListener],
            ['pointerdown', touch as EventListener],
            ['scroll', touch as EventListener],
        ];
        handlers.forEach(([evt, fn]) => document.addEventListener(evt, fn, { passive: true }));

        window.addEventListener('focus', onFocus);

        bc.current = 'BroadcastChannel' in window ? new BroadcastChannel('ml-session') : null;
        bc.current?.addEventListener('message', (ev: MessageEvent<MLMessage>) => {
            if (ev.data?.type === 'activity') {
                lastActivity.current = Math.max(lastActivity.current, Number(ev.data.ts) || Date.now());
            }
            // 'token_refreshed' -> no-op
        });

        const t1 = window.setInterval(refreshIfNeeded, checkEveryMs);
        const t2 = heartbeatEveryMs > 0 ? window.setInterval(heartbeat, heartbeatEveryMs) : null;

        touch(); // count initial navigation as activity

        return () => {
            handlers.forEach(([evt, fn]) => document.removeEventListener(evt, fn));
            window.removeEventListener('focus', onFocus);
            window.clearInterval(t1);
            if (t2) window.clearInterval(t2);
            bc.current?.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkEveryMs, heartbeatEveryMs, idleMs, refreshSkewMs]);

    return null;
}
