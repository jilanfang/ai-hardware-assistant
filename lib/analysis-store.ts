import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { AnalysisJobDocumentMeta, AnalysisJobSnapshot } from "@/lib/types";

export type AnalysisJobStore = {
  get(jobId: string): AnalysisJobSnapshot | null;
  set(snapshot: AnalysisJobSnapshot): void;
  list(): AnalysisJobSnapshot[];
  setPdf(jobId: string, buffer: Uint8Array): void;
  getPdf(jobId: string): Uint8Array | null;
  setDocumentMeta(jobId: string, meta: AnalysisJobDocumentMeta): void;
  getDocumentMeta(jobId: string): AnalysisJobDocumentMeta | null;
  clear(): void;
};

export function resolveAnalysisJobStoreDirectory() {
  return process.env.ANALYSIS_JOB_STORE_DIR || join(process.cwd(), ".analysis-jobs");
}

export function createAnalysisJobStore(storeDirectory = resolveAnalysisJobStoreDirectory()): AnalysisJobStore {

  function jobPath(jobId: string) {
    return join(storeDirectory, `${jobId}.json`);
  }

  function pdfPath(jobId: string) {
    return join(storeDirectory, `${jobId}.pdf`);
  }

  function metaPath(jobId: string) {
    return join(storeDirectory, `${jobId}.meta.json`);
  }

  function ensureStoreDirectory() {
    mkdirSync(storeDirectory, { recursive: true });
  }

  return {
    get(jobId) {
      const filePath = jobPath(jobId);
      if (!existsSync(filePath)) {
        return null;
      }

      return JSON.parse(readFileSync(filePath, "utf8")) as AnalysisJobSnapshot;
    },
    set(snapshot) {
      ensureStoreDirectory();
      writeFileSync(jobPath(snapshot.jobId), JSON.stringify(snapshot), "utf8");
    },
    list() {
      if (!existsSync(storeDirectory)) {
        return [];
      }

      return readdirSync(storeDirectory)
        .filter((entry) => entry.endsWith(".json") && !entry.endsWith(".meta.json"))
        .map((entry) => JSON.parse(readFileSync(join(storeDirectory, entry), "utf8")) as AnalysisJobSnapshot);
    },
    setPdf(jobId, buffer) {
      ensureStoreDirectory();
      writeFileSync(pdfPath(jobId), Buffer.from(buffer));
    },
    getPdf(jobId) {
      const filePath = pdfPath(jobId);
      if (!existsSync(filePath)) {
        return null;
      }

      return new Uint8Array(readFileSync(filePath));
    },
    setDocumentMeta(jobId, meta) {
      ensureStoreDirectory();
      writeFileSync(metaPath(jobId), JSON.stringify(meta), "utf8");
    },
    getDocumentMeta(jobId) {
      const filePath = metaPath(jobId);
      if (!existsSync(filePath)) {
        return null;
      }

      return JSON.parse(readFileSync(filePath, "utf8")) as AnalysisJobDocumentMeta;
    },
    clear() {
      rmSync(storeDirectory, { recursive: true, force: true });
    }
  };
}
