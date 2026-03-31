import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

describe("app icon asset", () => {
  test("provides an svg icon for the app shell", () => {
    const iconPath = path.join(process.cwd(), "app", "icon.svg");

    expect(fs.existsSync(iconPath)).toBe(true);
    expect(fs.readFileSync(iconPath, "utf8")).toContain("<svg");
  });
});
