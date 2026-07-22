import { Serwist } from "serwist";

type SWScope = typeof globalThis & { __SW_MANIFEST: Array<{ url: string; revision: string | null }> };

declare const self: SWScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
});

serwist.addEventListeners();
