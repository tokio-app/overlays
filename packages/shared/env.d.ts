/// <reference types="vite/client" />
import type { ConfigData } from "@tokioapp/overlay";

// The same globals each overlay's src/env.d.ts declares, for checking this package on its own.
declare global {
  interface Window {
    // Written by Tokio into the setup block in index.html.
    __OVERLAY_ID__: string;
    __OVERLAY_CONFIG__: ConfigData;
  }
}
