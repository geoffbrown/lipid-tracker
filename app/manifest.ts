import type { MetadataRoute } from "next";

/** Names the installed app. Without this the install prompt and the iOS
 *  home-screen label fall back to the document title or the hostname. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LipidLog",
    short_name: "LipidLog",
    description: "Longitudinal cholesterol tracking with calculated LDL and ApoB.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#f4f4f5",
  };
}
