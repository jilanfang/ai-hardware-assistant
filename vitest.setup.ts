import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:mock-url";
}

afterEach(() => {
  cleanup();
});
