// The sample gifters and gifts of the demo, which Tokio's preview plays until the first gift.
import type { UserData } from "@tokioapp/overlay";

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

// Real gifts, as in the jars' demo. Their pictures load from TikTok's CDN, so offline the drawn
// gift box shows instead.
export const SAMPLE_GIFTS: SampleGift[] = [
  {
    id: "5655",
    name: "Rose",
    coins: 1,
    image:
      "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp",
    weight: 4,
    maxCombo: 12,
  },
  {
    id: "13651",
    name: "Go Popular",
    coins: 1,
    image:
      "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b342e28d73dac6547e0b3e2ad57f6597.png~tplv-obj.webp",
    weight: 3,
    maxCombo: 8,
  },
  {
    id: "5660",
    name: "Hand Heart",
    coins: 100,
    image:
      "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/374dfe46d5b09ce1db19be06202d34f5.png~tplv-obj.webp",
    weight: 2,
    maxCombo: 3,
  },
  {
    id: "6149",
    name: "Interstellar",
    coins: 10000,
    image:
      "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/8520d47b59c202a4534c1560a355ae06~tplv-obj.webp",
    weight: 1,
    maxCombo: 1,
  },
];

export const SAMPLE_USERS: UserData[] = [
  "Sunny Fox",
  "Pixel Panda",
  "Lucky Tiger",
  "Cosmic Owl",
  "Happy Koala",
  "Neon Wolf",
].map((name, i) => ({
  username: name,
  handle: `@${name.toLowerCase().replace(" ", "_")}`,
  // The placeholder shows instead when offline.
  profilePictures: [`https://picsum.photos/seed/tokio${i + 1}/200/200`],
}));
