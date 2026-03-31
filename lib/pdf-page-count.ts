export async function readPdfPageCount(buffer: Uint8Array) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: Uint8Array.from(buffer),
      isEvalSupported: false,
      useSystemFonts: false,
      verbosity: 0
    });
    const document = await loadingTask.promise;

    try {
      return document.numPages;
    } finally {
      await document.destroy();
    }
  } catch {
    return null;
  }
}
