import { randomUUID } from "node:crypto";

import {
  createAnalysisJobStore,
  resolveAnalysisJobStoreDirectory,
  type AnalysisJobStore
} from "@/lib/analysis-store";
import { analyzePdfBuffer } from "@/lib/server-analysis";
import type {
  AnalysisJobDocumentMeta,
  AnalysisJobResult,
  RecentAnalysisJob,
  AnalysisJobSnapshot,
  FollowUpMessage
} from "@/lib/types";

type AnalysisJobInput = {
  fileName: string;
  taskName: string;
  chipName: string;
  buffer: Uint8Array;
  initialPageCount?: number;
};

type AnalysisJobDependencies = {
  analyze?: (input: AnalysisJobInput & { onProgress?: (snapshot: AnalysisJobResult) => void }) => Promise<AnalysisJobResult>;
  createId?: () => string;
  store?: AnalysisJobStore;
};

const storeCache = new Map<string, AnalysisJobStore>();
const knownStoreDirectories = new Set<string>();
const jobStoreDirectoryIndex = new Map<string, string>();

function getStore(storeDirectory = resolveAnalysisJobStoreDirectory()) {
  knownStoreDirectories.add(storeDirectory);
  const existing = storeCache.get(storeDirectory);
  if (existing) {
    return existing;
  }

  const created = createAnalysisJobStore(storeDirectory);
  storeCache.set(storeDirectory, created);
  return created;
}

function withUpdatedAt(snapshot: Omit<AnalysisJobSnapshot, "updatedAt"> & { updatedAt?: string }): AnalysisJobSnapshot {
  return {
    ...snapshot,
    updatedAt: snapshot.updatedAt ?? new Date().toISOString()
  };
}

function resolveSnapshotPageCount(result?: AnalysisJobResult | null, fallbackPageCount = 1) {
  const preparationPageCount = result?.analysis?.preparationMeta?.pageCount;
  if (typeof preparationPageCount === "number" && Number.isFinite(preparationPageCount) && preparationPageCount > 0) {
    return preparationPageCount;
  }

  return fallbackPageCount;
}

export function createAnalysisJob(
  input: AnalysisJobInput,
  dependencies: AnalysisJobDependencies = {}
): AnalysisJobSnapshot {
  const storeDirectory = dependencies.store ? null : resolveAnalysisJobStoreDirectory();
  const store = dependencies.store ?? getStore(storeDirectory ?? undefined);
  const jobId = dependencies.createId?.() ?? randomUUID();
  const processing: AnalysisJobSnapshot = {
    jobId,
    status: "processing",
    warnings: [],
    followUpMessages: [],
    updatedAt: new Date().toISOString()
  };

  if (storeDirectory) {
    jobStoreDirectoryIndex.set(jobId, storeDirectory);
  }

  store.set(withUpdatedAt(processing));
  store.setPdf(jobId, input.buffer);
  store.setDocumentMeta(jobId, {
    fileName: input.fileName,
    taskName: input.taskName,
    chipName: input.chipName,
    pageCount: input.initialPageCount && input.initialPageCount > 0 ? input.initialPageCount : 1
  });

  const handleProgress = (progress: AnalysisJobResult) => {
    const existingMeta = store.getDocumentMeta(jobId);
    store.setDocumentMeta(jobId, {
      fileName: input.fileName,
      taskName: input.taskName,
      chipName: input.chipName,
      pageCount: resolveSnapshotPageCount(progress, existingMeta?.pageCount ?? input.initialPageCount ?? 1)
    });
    store.set({
      jobId,
      followUpMessages: store.get(jobId)?.followUpMessages ?? [],
      updatedAt: new Date().toISOString(),
      ...progress
    });
  };

  const analysisPromise = dependencies.analyze
    ? dependencies.analyze({
        ...input,
        onProgress: handleProgress
      })
    : analyzePdfBuffer(input, {
        onProgress: handleProgress
      });

  void analysisPromise
    .then((result) => {
      const existingMeta = store.getDocumentMeta(jobId);
      store.setDocumentMeta(jobId, {
        fileName: input.fileName,
        taskName: input.taskName,
        chipName: input.chipName,
        pageCount: resolveSnapshotPageCount(result, existingMeta?.pageCount ?? input.initialPageCount ?? 1)
      });
      store.set({
        jobId,
        followUpMessages: [],
        updatedAt: new Date().toISOString(),
        ...result
      });
    })
    .catch(() => {
      store.set({
        jobId,
        status: "failed",
        warnings: ["当前解析失败，请稍后重试。"],
        followUpMessages: [],
        updatedAt: new Date().toISOString()
      });
    });

  return withUpdatedAt(processing);
}

export function getAnalysisJobPdf(jobId: string) {
  const indexedDirectory = jobStoreDirectoryIndex.get(jobId);
  if (indexedDirectory) {
    const indexedPdf = getStore(indexedDirectory).getPdf(jobId);
    if (indexedPdf) {
      return indexedPdf;
    }
  }

  const directories = new Set<string>([
    ...knownStoreDirectories,
    ...storeCache.keys(),
    resolveAnalysisJobStoreDirectory()
  ]);

  for (const storeDirectory of directories) {
    const store = getStore(storeDirectory);
    const buffer = store.getPdf(jobId);
    if (buffer) {
      jobStoreDirectoryIndex.set(jobId, storeDirectory);
      return buffer;
    }
  }

  return null;
}

export function getAnalysisJobDocumentMeta(jobId: string): AnalysisJobDocumentMeta | null {
  const indexedDirectory = jobStoreDirectoryIndex.get(jobId);
  if (indexedDirectory) {
    const indexedMeta = getStore(indexedDirectory).getDocumentMeta(jobId);
    if (indexedMeta) {
      return indexedMeta;
    }
  }

  const directories = new Set<string>([
    ...knownStoreDirectories,
    ...storeCache.keys(),
    resolveAnalysisJobStoreDirectory()
  ]);

  for (const storeDirectory of directories) {
    const store = getStore(storeDirectory);
    const meta = store.getDocumentMeta(jobId);
    if (meta) {
      jobStoreDirectoryIndex.set(jobId, storeDirectory);
      return meta;
    }
  }

  return null;
}

export function getAnalysisJob(jobId: string) {
  const indexedDirectory = jobStoreDirectoryIndex.get(jobId);
  if (indexedDirectory) {
    const indexedSnapshot = getStore(indexedDirectory).get(jobId);
    if (indexedSnapshot) {
      return indexedSnapshot;
    }
  }

  const directories = new Set<string>([
    ...knownStoreDirectories,
    ...storeCache.keys(),
    resolveAnalysisJobStoreDirectory()
  ]);

  for (const storeDirectory of directories) {
    const store = getStore(storeDirectory);
    const snapshot = store.get(jobId);
    if (snapshot) {
      jobStoreDirectoryIndex.set(jobId, storeDirectory);
      return snapshot;
    }
  }

  return null;
}

export function listRecentAnalysisJobs(limit = 8): RecentAnalysisJob[] {
  const directories = new Set<string>([
    ...knownStoreDirectories,
    ...storeCache.keys(),
    resolveAnalysisJobStoreDirectory()
  ]);

  const snapshots = new Map<string, AnalysisJobSnapshot>();

  for (const storeDirectory of directories) {
    const store = getStore(storeDirectory);
    for (const snapshot of store.list()) {
      const existing = snapshots.get(snapshot.jobId);
      const snapshotTime = Date.parse(snapshot.updatedAt ?? "");
      const existingTime = existing ? Date.parse(existing.updatedAt ?? "") : Number.NEGATIVE_INFINITY;
      if (!existing || snapshotTime >= existingTime) {
        snapshots.set(snapshot.jobId, withUpdatedAt(snapshot));
        jobStoreDirectoryIndex.set(snapshot.jobId, storeDirectory);
      }
    }
  }

  return Array.from(snapshots.values())
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit)
    .map((snapshot) => ({
      jobId: snapshot.jobId,
      status: snapshot.status,
      updatedAt: snapshot.updatedAt,
      documentMeta: getAnalysisJobDocumentMeta(snapshot.jobId),
      hasAnalysis: Boolean(snapshot.analysis),
      followUpCount: snapshot.followUpMessages?.length ?? 0
    }));
}

export function updateAnalysisJob(
  jobId: string,
  updater: (snapshot: AnalysisJobSnapshot) => AnalysisJobSnapshot
) {
  const indexedDirectory = jobStoreDirectoryIndex.get(jobId);
  if (indexedDirectory) {
    const indexedStore = getStore(indexedDirectory);
    const indexedCurrent = indexedStore.get(jobId);

    if (indexedCurrent) {
      const indexedNext = withUpdatedAt(updater(indexedCurrent));
      indexedStore.set(indexedNext);
      return indexedNext;
    }
  }

  const directories = new Set<string>([
    ...knownStoreDirectories,
    ...storeCache.keys(),
    resolveAnalysisJobStoreDirectory()
  ]);

  for (const storeDirectory of directories) {
    const store = getStore(storeDirectory);
    const current = store.get(jobId);
    if (!current) {
      continue;
    }

    const next = withUpdatedAt(updater(current));
    store.set(next);
    jobStoreDirectoryIndex.set(jobId, storeDirectory);
    return next;
  }

  return null;
}

export function appendAnalysisJobFollowUpMessage(jobId: string, message: FollowUpMessage) {
  return updateAnalysisJob(jobId, (snapshot) => ({
    ...snapshot,
    followUpMessages: [...(snapshot.followUpMessages ?? []), message]
  }));
}

export function resetAnalysisJobs() {
  const activeDirectory = resolveAnalysisJobStoreDirectory();
  knownStoreDirectories.add(activeDirectory);
  const activeStore = storeCache.get(activeDirectory);

  for (const [jobId, storeDirectory] of jobStoreDirectoryIndex.entries()) {
    if (storeDirectory === activeDirectory) {
      jobStoreDirectoryIndex.delete(jobId);
    }
  }

  if (activeStore) {
    activeStore.clear();
    storeCache.delete(activeDirectory);
    knownStoreDirectories.delete(activeDirectory);
    return;
  }

  createAnalysisJobStore(activeDirectory).clear();
  knownStoreDirectories.delete(activeDirectory);
}
