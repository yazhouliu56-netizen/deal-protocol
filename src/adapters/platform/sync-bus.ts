export interface SyncBusOptions {
  win?: {
    addEventListener: (type: string, handler: EventListener) => void;
    removeEventListener: (type: string, handler: EventListener) => void;
  };
  doc?: {
    addEventListener: (type: string, handler: EventListener) => void;
    removeEventListener: (type: string, handler: EventListener) => void;
    visibilityState: string;
  };
  debounceMs?: number;
  cooldownMs?: number;
}

export interface SyncBus {
  getOnlineStatus(): boolean;
  subscribeOnlineStatus(callback: (online: boolean) => void): () => void;
  registerSyncTrigger(hook: () => Promise<void> | void): () => void;
  dispose(): void;
}

function noopUnsubscribe(): void {}

export function createSyncBus(opts?: SyncBusOptions): SyncBus {
  const win = opts?.win;
  const doc = opts?.doc;
  const debounceMs = opts?.debounceMs ?? 100;
  const cooldownMs = opts?.cooldownMs ?? 2000;

  const statusListeners = new Set<(online: boolean) => void>();
  const syncHooks = new Set<() => Promise<void> | void>();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let lastTriggerAt = 0;
  let chain: Promise<void> = Promise.resolve();

  function isOnline(): boolean {
    if (!win) return true;
    try {
      return (win as unknown as { navigator?: { onLine?: boolean } }).navigator?.onLine !== false;
    } catch {
      return true;
    }
  }

  function notifyStatus(): void {
    const online = isOnline();
    for (const cb of statusListeners) {
      try { cb(online); } catch { /* 红线 5：不抛 */ }
    }
  }

  function executeHooks(): void {
    const now = Date.now();
    if (now - lastTriggerAt < cooldownMs) return;
    lastTriggerAt = now;
    chain = chain.then(async () => {
      for (const hook of syncHooks) {
        try { await hook(); } catch { /* 红线 5：不抛 */ }
      }
    }).catch(() => {});
  }

  function scheduleTrigger(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      notifyStatus();
      executeHooks();
    }, debounceMs);
  }

  function handleOnline(): void { scheduleTrigger(); }
  function handleOffline(): void { scheduleTrigger(); }
  function handleVisibility(): void {
    if (doc?.visibilityState === "visible") scheduleTrigger();
  }

  if (win) {
    win.addEventListener("online", handleOnline);
    win.addEventListener("offline", handleOffline);
  }
  if (doc) {
    doc.addEventListener("visibilitychange", handleVisibility);
  }

  return {
    getOnlineStatus: isOnline,

    subscribeOnlineStatus(callback: (online: boolean) => void): () => void {
      if (!win) return noopUnsubscribe;
      statusListeners.add(callback);
      return () => { statusListeners.delete(callback); };
    },

    registerSyncTrigger(hook: () => Promise<void> | void): () => void {
      if (!win) return noopUnsubscribe;
      syncHooks.add(hook);
      return () => { syncHooks.delete(hook); };
    },

    dispose(): void {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (win) {
        win.removeEventListener("online", handleOnline);
        win.removeEventListener("offline", handleOffline);
      }
      if (doc) {
        doc.removeEventListener("visibilitychange", handleVisibility);
      }
      statusListeners.clear();
      syncHooks.clear();
    },
  };
}

const defaultBus = typeof window !== "undefined"
  ? createSyncBus({ win: window, doc: document })
  : createSyncBus();
export const syncBus = defaultBus;