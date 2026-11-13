import type { UserData } from "@tokioapp/overlay";

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
