import { useEffect, useRef } from "react";
const listeners = new Map();
let source = null;
let backoffMs = 1000;
const MAX_BACKOFF_MS = 30000;
function ensureConnection() {
    if (source && source.readyState !== EventSource.CLOSED)
        return;
    try {
        // EventSource sends cookies + Authorization automatically when withCredentials is true,
        // but our mock-auth API doesn't require it; default config is fine.
        source = new EventSource("/api/stream/events");
    }
    catch (err) {
        console.warn("[SSE] open failed", err);
        return;
    }
    source.addEventListener("open", () => {
        backoffMs = 1000;
    });
    source.addEventListener("error", () => {
        // EventSource auto-reconnects, but if the server returned 5xx repeatedly the
        // browser may close it. Re-open with backoff.
        if (source && source.readyState === EventSource.CLOSED) {
            setTimeout(() => {
                source = null;
                backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
                ensureConnection();
            }, backoffMs);
        }
    });
    // Forward every registered event name to its listeners.
    // We have to know event names up front for `addEventListener`, so we register
    // them lazily as `subscribe()` is called and on reconnect we re-register.
    for (const name of listeners.keys()) {
        bindForwarder(name);
    }
}
function bindForwarder(name) {
    if (!source)
        return;
    source.addEventListener(name, (evt) => {
        let payload;
        try {
            payload = JSON.parse(evt.data);
        }
        catch {
            payload = evt.data;
        }
        const set = listeners.get(name);
        if (!set)
            return;
        for (const fn of set) {
            try {
                fn(payload);
            }
            catch (err) {
                console.warn(`[SSE] listener for ${name} threw`, err);
            }
        }
    });
}
/** Register a listener. Returns an unsubscribe function. */
export function subscribe(eventName, listener) {
    let set = listeners.get(eventName);
    if (!set) {
        set = new Set();
        listeners.set(eventName, set);
    }
    set.add(listener);
    ensureConnection();
    // Always (re-)bind the forwarder; addEventListener dedupes identical handlers
    // but we get a fresh `evt -> dispatch` closure per binding, so do it once.
    if (set.size === 1)
        bindForwarder(eventName);
    return () => {
        set.delete(listener);
        if (set.size === 0)
            listeners.delete(eventName);
    };
}
/**
 * React hook: subscribe to one event for the lifetime of the component.
 */
export function useEventStream(eventName, listener) {
    const ref = useRef(listener);
    ref.current = listener;
    useEffect(() => {
        const unsub = subscribe(eventName, (data) => ref.current(data));
        return unsub;
    }, [eventName]);
}
