import {
  siBluesky,
  siCashapp,
  siDiscord,
  siFacebook,
  siGithub,
  siInstagram,
  siKick,
  siKofi,
  siLinktree,
  siPatreon,
  siPaypal,
  siPinterest,
  siReddit,
  siSnapchat,
  siSoundcloud,
  siSpotify,
  siSteam,
  siTelegram,
  siThreads,
  siTwitch,
  siVenmo,
  siWhatsapp,
  siX,
  siYoutube,
  type SimpleIcon,
} from "simple-icons";
import { GLOBE } from "./icons";

export interface Platform {
  title: string;
  icon: string;
}

// The icons come from Simple Icons (CC0). The brands belong to their owners.
const brands: SimpleIcon[] = [
  siInstagram,
  siYoutube,
  siX,
  siTwitch,
  siKick,
  siFacebook,
  siDiscord,
  siSnapchat,
  siThreads,
  siBluesky,
  siReddit,
  siPinterest,
  siSpotify,
  siSoundcloud,
  siPatreon,
  siKofi,
  siPaypal,
  siCashapp,
  siVenmo,
  siSteam,
  siLinktree,
  siWhatsapp,
  siTelegram,
  siGithub,
];

// A Map, so an id like "constructor" can't match.
const platforms = new Map<string, Platform>([
  ...brands.map((brand): [string, Platform] => [
    brand.slug,
    {
      title: brand.title,
      icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${brand.path}"/></svg>`,
    },
  ]),
  ["website", { title: "Website", icon: GLOBE }],
]);

/** The platform for a config id. An unknown one shows the globe, named by its raw id. */
export function platformOf(id: string): Platform {
  return platforms.get(id) ?? { title: id, icon: GLOBE };
}
