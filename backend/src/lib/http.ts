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

type MultipartBodyValue = {
  type?: string;
  value?: unknown;
  filename?: string;
  mimetype?: string;
  toBuffer?: () => Promise<Buffer>;
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
      const body = (req.body || {}) as Record<string, MultipartBodyValue | unknown>;

      // Режим 1: attachFieldsToBody — файл(ы) уже лежат в req.body как объекты с toBuffer()
      let foundFileInBody = false;
      for (const [key, raw] of Object.entries(body)) {
        const val = raw as MultipartBodyValue;
        if (val && typeof val === "object" && typeof val.toBuffer === "function") {
          foundFileInBody = true;
          const buf = await val.toBuffer();
          fd.append(
              key,
              new File([buf], val.filename || "upload.jpg", {
                type: val.mimetype || "image/jpeg",
              }),
          );
        } else if (val && typeof val === "object" && "value" in val) {
          fd.append(key, String((val as { value: unknown }).value));
        } else if (val != null) {
          fd.append(key, String(val));
        }
      }

      // Режим 2: req.file() — используется, если поле не пришло через body
      if (!foundFileInBody) {
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
      }

      return fd;
    },
  };
}