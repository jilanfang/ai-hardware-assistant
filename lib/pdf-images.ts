import { createCanvas } from "@napi-rs/canvas";

type RenderedPdfPage = {
  page: number;
  dataUrl: string;
};

export async function renderPdfPagesToImages(input: {
  buffer: Uint8Array;
  pages: number[];
  scale?: number;
}): Promise<RenderedPdfPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const normalizedBuffer = Uint8Array.from(input.buffer);
  const loadingTask = pdfjs.getDocument({
    data: normalizedBuffer,
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0
  });
  const document = await loadingTask.promise;
  const scale = input.scale ?? 1.5;
  const rendered: RenderedPdfPage[] = [];

  try {
    for (const pageNumber of input.pages) {
      if (pageNumber < 1 || pageNumber > document.numPages) {
        continue;
      }

      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");

      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport
      }).promise;

      rendered.push({
        page: pageNumber,
        dataUrl: `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`
      });
    }
  } finally {
    await document.destroy();
  }

  return rendered;
}
