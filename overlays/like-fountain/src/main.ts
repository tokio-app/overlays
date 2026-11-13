import { SAMPLE_USERS } from "@tokio-overlays/shared/samples";
import { find, randomInt } from "@tokio-overlays/shared/util";
import { tokio, TOKIO_EVENTS, type ConfigData } from "@tokioapp/overlay";
import { Fountain, isOrigin } from "./fountain";
import "./style.css";

const params = new URLSearchParams(location.search);
// Tokio fills in the ID. While developing, open the page with ?id=<test ID>, made on Tokio's
// Tools page, or with ?demo for the sample viewers.
const overlayId = window.__OVERLAY_ID__ || params.get("id") || "";
// Tokio's Overlays page previews the overlay in an iframe with this name. There, and with ?demo,
// sample viewers keep liking until the first real like, so the preview doesn't sit empty.
const preview = window.name === `TOKIO_APP-${overlayId}`;
const demo = preview || params.has("demo");

const fountain = new Fountain(find("fountain", HTMLCanvasElement));
applyConfig(window.__OVERLAY_CONFIG__);
fit();
addEventListener("resize", fit);
let stopSample = demo ? playSample() : undefined;

// Sent when the streamer saves the overlay's settings.
tokio.on(TOKIO_EVENTS.CONFIG, applyConfig);

tokio.on(TOKIO_EVENTS.LIKE, (data) => {
  // The first like replaces the sample viewers.
  if (stopSample) {
    stopSample();
    stopSample = undefined;
  }
  fountain.add(data.user, data.likeCount);
});

tokio.connect(overlayId);

// The keys are the field ids in config.yaml.
function applyConfig(config: ConfigData) {
  const options = { ...fountain.options };
  if (isOrigin(config.origin)) options.origin = config.origin;
  if (typeof config.heart_size === "number" && config.heart_size > 0) {
    options.size = config.heart_size;
  }
  if (typeof config.show_pictures === "boolean") {
    options.pictures = config.show_pictures;
  }
  const [heart, second] = options.colors;
  options.colors = [
    typeof config.heart_color === "string" ? config.heart_color : heart,
    typeof config.second_color === "string" ? config.second_color : second,
  ];
  fountain.setOptions(options);
}

function fit() {
  fountain.resize(innerWidth, innerHeight, devicePixelRatio);
}

// Sample viewers send batches of 1 to 15 likes at uneven times, as on a LIVE. Returns a function
// that stops it.
function playSample() {
  let timer: ReturnType<typeof setTimeout>;
  const tick = () => {
    const user = SAMPLE_USERS[randomInt(0, SAMPLE_USERS.length - 1)];
    fountain.add(user, randomInt(1, 15));
    timer = setTimeout(tick, randomInt(200, 800));
  };
  timer = setTimeout(tick, 300);
  return () => clearTimeout(timer);
}
