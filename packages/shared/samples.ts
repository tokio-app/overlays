import type { UserData } from "@tokioapp/overlay";

/** A gift a demo sends. */
export interface SampleGift {
  id: string;
  name: string;
  coins: number;
  image: string;
  /** How often the demo picks it, against the others. */
  weight: number;
  /** The most gifts in one combo. */
  maxCombo: number;
}

// The viewers the demos and Tokio's previews show.
export const SAMPLE_USERS: UserData[] = [
  "Sunny Fox",
  "Pixel Panda",
  "Lucky Tiger",
  "Cosmic Owl",
  "Happy Koala",
  "Neon Wolf",
  "Chill Otter",
  "Brave Lynx",
].map((name, i) => ({
  username: name,
  handle: `@${name.toLowerCase().replace(" ", "_")}`,
  // Offline they don't load, and each overlay shows its placeholder or no picture instead.
  profilePictures: [`https://picsum.photos/seed/tokio${i + 1}/200/200`],
}));
