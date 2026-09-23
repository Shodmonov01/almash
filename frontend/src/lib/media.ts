import { api } from "@/lib/client";
import i18n from "@/lib/i18n";

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
export const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
export const MAX_VIDEO_MB = 50;

export function isVideoUrl(url?: string | null) {
  return !!url && VIDEO_EXT.test(url.split("?")[0]);
}

/** Uploads a photo (watermarked) or a video and returns its /uploads URL. */
export async function uploadMedia(file: File, itemId = "draft"): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      throw new Error(i18n.t("errors.videoTooBig", { mb: MAX_VIDEO_MB }));
    }
    const data = await api<{ url: string }>("/api/upload-video", {
      method: "POST",
      body: fd,
    });
    return data.url;
  }
  fd.append("itemId", itemId);
  const data = await api<{ url: string }>("/api/upload", {
    method: "POST",
    body: fd,
  });
  return data.url;
}
