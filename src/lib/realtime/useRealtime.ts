"use client";
import { useEffect, useRef } from "react";
import { getSocket } from "./client";

type Handlers = Record<string, (payload: any) => void>;

/** Subscribe to socket events for the lifetime of a component. */
export function useRealtime(handlers: Handlers, deps: unknown[] = []) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const socket = getSocket();
    const entries = Object.keys(ref.current);
    const bound: [string, (p: any) => void][] = entries.map((ev) => {
      const fn = (p: any) => ref.current[ev]?.(p);
      socket.on(ev, fn);
      return [ev, fn];
    });
    return () => { for (const [ev, fn] of bound) socket.off(ev, fn); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Join/leave an encounter room for live combat updates. */
export function useWatchEncounter(encounterId: string | null) {
  useEffect(() => {
    if (!encounterId) return;
    const socket = getSocket();
    socket.emit("watch:encounter", encounterId);
    return () => { socket.emit("unwatch:encounter", encounterId); };
  }, [encounterId]);
}
