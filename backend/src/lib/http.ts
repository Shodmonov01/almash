import type { FastifyRequest } from "fastify";

export type AppRequest = {
  url: string;
  headers: { get(name: string): string | null };
  json(): Promise<any>;
  formData(): Promise<FormData>;
};

type MultipartFile = {
  toBuffer: () => Promise<Buffer>;
  filename: string;
  mimetype: string;
};

export function toAppRequest(req: FastifyRequest): AppRequest {
  const host = String(req.headers.host || "localhost");
  const proto = String(req.headers["x-forwarded-proto"] || "http");

  return {
    url: `${proto}://${host}${req.url}`,
    headers: {
      get(name: string) {
        const v = req.headers[name.toLowerCase()];
        if (Array.isArray(v)) return v[0] ?? null;
        return (v as string | undefined) ?? null;
      },
    },
    async json() {
      return (req.body ?? {}) as any;
    },
    async formData() {
      const fd = new FormData();
      const fileReq = req as FastifyRequest & {
        file?: () => Promise<MultipartFile | undefined>;
      };

      if (typeof fileReq.file === "function") {
        const file = await fileReq.file();
        if (file) {
          const buf = await file.toBuffer();
          fd.append(
            "file",
            new File([buf], file.filename || "upload.jpg", {
              type: file.mimetype || "image/jpeg",
            }),
          );
        }
      }

      const body = (req.body || {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body)) {
        if (key === "file") continue;
        if (value == null) continue;
        if (typeof value === "object" && value !== null && "value" in value) {
          fd.append(key, String((value as { value: unknown }).value));
        } else {
          fd.append(key, String(value));
        }
      }

      return fd;
    },
  };
}
