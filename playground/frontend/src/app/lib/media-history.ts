const STORAGE_KEY = "sam-audio-media-history";
const MAX_ITEMS = 12;

export interface MediaHistoryItem {
  file_id: string;
  filename: string;
  has_video: boolean;
  thumbnail: string | null; // data URL for videos, null for audio
  duration: number;
  waveform: number[];
  added_at: number;
}

export function getMediaHistory(): MediaHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToMediaHistory(item: Omit<MediaHistoryItem, "added_at">) {
  const history = getMediaHistory();
  // Remove duplicate if same file_id exists
  const filtered = history.filter((h) => h.file_id !== item.file_id);
  // Prepend new item
  filtered.unshift({ ...item, added_at: Date.now() });
  // Keep only the last MAX_ITEMS
  const trimmed = filtered.slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed;
}

/**
 * Capture a thumbnail from a video URL by loading it in a hidden video element,
 * seeking to 1 second, and drawing it to a canvas.
 */
export function captureVideoThumbnail(videoUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.onloadeddata = () => {
      // Seek to 1s or 10% of duration, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          cleanup();
          resolve(dataUrl);
        } else {
          cleanup();
          resolve(null);
        }
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    // Timeout after 5 seconds
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);

    video.src = videoUrl;
  });
}
