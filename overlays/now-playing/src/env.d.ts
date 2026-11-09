/// <reference types="vite/client" />
import type { ConfigData } from "@tokioapp/overlay";

declare global {
  interface Window {
    // Written by Tokio into the setup block in index.html.
    __OVERLAY_ID__: string;
    __OVERLAY_CONFIG__: ConfigData;
  }
}
