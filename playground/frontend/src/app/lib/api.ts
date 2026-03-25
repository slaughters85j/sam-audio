export interface UploadResult {
  file_id: string;
  duration: number;
  sample_rate: number;
  waveform: number[];
  has_video: boolean;
  filename: string;
}

export interface SeparateResult {
  target_waveform: number[];
  residual_waveform: number[];
}

export interface Sample {
  filename: string;
  has_video: boolean;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function separateAudio(
  fileId: string,
  description: string
): Promise<SeparateResult> {
  const res = await fetch("/api/separate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId, description }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listSamples(): Promise<Sample[]> {
  const res = await fetch("/api/samples");
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.samples;
}

export async function loadSample(filename: string): Promise<UploadResult> {
  const res = await fetch(`/api/samples/${encodeURIComponent(filename)}/load`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function audioUrl(fileId: string, track: string): string {
  return `/api/audio/${fileId}/${track}`;
}
