import { describe, expect, test } from "vitest";

import { renderPdfPagesToImages } from "@/lib/pdf-images";

describe("pdf image rendering", () => {
  test("renders a simple pdf page into a png data url", async () => {
    const pdfBytes = new TextEncoder().encode(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
72 120 Td
(Hello PDF) Tj
ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF`);

    const pages = await renderPdfPagesToImages({
      buffer: pdfBytes,
      pages: [1]
    });

    expect(pages).toHaveLength(1);
    expect(pages[0]?.page).toBe(1);
    expect(pages[0]?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
