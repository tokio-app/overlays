import { tokio, TOKIO_EVENTS, type ConfigData } from "@tokioapp/overlay";
import "./style.css";

const title = document.getElementById("title")!;
const likes = document.getElementById("likes")!;

// The keys are the field ids in config.yaml.
function apply(config: ConfigData) {
  if (typeof config.title === "string") title.textContent = config.title;
  if (typeof config.main_color === "string") {
    title.style.color = config.main_color;
  }
}

apply(window.__OVERLAY_CONFIG__);
// Sent when the streamer saves the overlay's settings.
tokio.on(TOKIO_EVENTS.CONFIG, apply);

tokio.on(TOKIO_EVENTS.LIKE, (data) => {
  likes.textContent = data.totalLikes.toLocaleString();
});

// Tokio fills in the ID. While developing, open the page with ?id=<test ID>, made on
// Tokio's Tools page.
tokio.connect(
  window.__OVERLAY_ID__ || new URLSearchParams(location.search).get("id") || "",
);
