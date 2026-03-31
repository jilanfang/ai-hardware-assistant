import { describe, expect, test } from "vitest";

import nextConfig from "@/next.config";

describe("next config", () => {
  test("keeps native canvas and pdfjs as server external packages", () => {
    expect(nextConfig.serverExternalPackages).toEqual(
      expect.arrayContaining(["@napi-rs/canvas", "pdfjs-dist"])
    );
  });
});
