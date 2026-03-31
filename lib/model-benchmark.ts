export type BenchmarkFactRule = {
  id: string;
  points: number;
  mode: "all" | "any";
  phrases: string[];
};

export type BenchmarkPenaltyRule = {
  id: string;
  penalty: number;
  patterns: string[];
  allowIfAnyOf?: string[];
};

export type BenchmarkQualityScenario = {
  id: string;
  baseline: {
    provider: string;
    model: string;
    score: number;
  };
  requiredFacts: BenchmarkFactRule[];
  hallucinationChecks: BenchmarkPenaltyRule[];
};

export type BenchmarkQualityInput = {
  provider: string;
  model: string;
  text: string;
};

export type BenchmarkResponseMetrics = {
  ok: boolean;
  status: number | null;
  elapsedMs: number | null;
  textLength: number;
};

export type BenchmarkQualityResult = {
  provider: string;
  model: string;
  targetId: string;
  scenarioId: string;
  score: number;
  normalizedScore: number;
  factHits: Array<{
    id: string;
    points: number;
    matched: boolean;
  }>;
  penalties: Array<{
    id: string;
    points: number;
  }>;
};

export type BenchmarkRunSummaryInput = {
  provider: string;
  model: string;
  response: BenchmarkResponseMetrics;
  qualityInput: {
    text: string;
  };
};

export type BenchmarkRunSummary = {
  provider: string;
  model: string;
  targetId: string;
  response: BenchmarkResponseMetrics;
  quality: BenchmarkQualityResult;
};

export type BenchmarkAggregateSummary = {
  baseline: {
    provider: string;
    model: string;
    targetId: string;
    score: number;
  };
  runs: BenchmarkRunSummary[];
  responseRanking: BenchmarkRunSummary[];
  qualityRanking: BenchmarkRunSummary[];
};

function includesPhrase(text: string, phrase: string) {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

export function buildProviderModelId(provider: string, model: string) {
  return `${provider}/${model}`;
}

function matchesFact(text: string, rule: BenchmarkFactRule) {
  if (rule.mode === "all") {
    return rule.phrases.every((phrase) => includesPhrase(text, phrase));
  }

  return rule.phrases.some((phrase) => includesPhrase(text, phrase));
}

export function normalizeBenchmarkScore(rawScore: number, baselineScore: number) {
  if (baselineScore <= 0) {
    return Math.max(0, rawScore);
  }

  return Math.max(0, Math.min(100, Math.round((rawScore / baselineScore) * 100)));
}

export function evaluateBenchmarkQuality(
  scenario: BenchmarkQualityScenario,
  input: BenchmarkQualityInput
): BenchmarkQualityResult {
  const factHits = scenario.requiredFacts.map((rule) => ({
    id: rule.id,
    points: rule.points,
    matched: matchesFact(input.text, rule)
  }));

  const penalties = scenario.hallucinationChecks.flatMap((rule) => {
    const hasPenaltyPattern = rule.patterns.some((pattern) => includesPhrase(input.text, pattern));
    const hasAllowedContext = (rule.allowIfAnyOf ?? []).some((pattern) => includesPhrase(input.text, pattern));

    if (!hasPenaltyPattern || hasAllowedContext) {
      return [];
    }

    return [{ id: rule.id, points: rule.penalty }];
  });

  const rawScore =
    factHits.reduce((sum, rule) => sum + (rule.matched ? rule.points : 0), 0) -
    penalties.reduce((sum, rule) => sum + rule.points, 0);

  const isBaseline =
    input.provider === scenario.baseline.provider && input.model === scenario.baseline.model;

  return {
    provider: input.provider,
    model: input.model,
    targetId: buildProviderModelId(input.provider, input.model),
    scenarioId: scenario.id,
    score: isBaseline ? scenario.baseline.score : Math.max(0, rawScore),
    normalizedScore: isBaseline
      ? 100
      : normalizeBenchmarkScore(Math.max(0, rawScore), scenario.baseline.score),
    factHits,
    penalties
  };
}

export function buildBenchmarkSummary(
  scenario: BenchmarkQualityScenario,
  runs: BenchmarkRunSummaryInput[]
): BenchmarkAggregateSummary {
  const evaluatedRuns = runs.map((run) => ({
    provider: run.provider,
    model: run.model,
    targetId: buildProviderModelId(run.provider, run.model),
    response: run.response,
    quality: evaluateBenchmarkQuality(scenario, {
      provider: run.provider,
      model: run.model,
      text: run.qualityInput.text
    })
  }));

  return {
    baseline: {
      provider: scenario.baseline.provider,
      model: scenario.baseline.model,
      targetId: buildProviderModelId(scenario.baseline.provider, scenario.baseline.model),
      score: scenario.baseline.score
    },
    runs: evaluatedRuns,
    responseRanking: [...evaluatedRuns].sort((left, right) => {
      if (left.response.ok !== right.response.ok) {
        return left.response.ok ? -1 : 1;
      }

      const leftElapsed = left.response.elapsedMs ?? Number.POSITIVE_INFINITY;
      const rightElapsed = right.response.elapsedMs ?? Number.POSITIVE_INFINITY;
      if (leftElapsed !== rightElapsed) {
        return leftElapsed - rightElapsed;
      }

      return left.targetId.localeCompare(right.targetId);
    }),
    qualityRanking: [...evaluatedRuns].sort((left, right) => {
      if (left.quality.normalizedScore !== right.quality.normalizedScore) {
        return right.quality.normalizedScore - left.quality.normalizedScore;
      }

      const leftElapsed = left.response.elapsedMs ?? Number.POSITIVE_INFINITY;
      const rightElapsed = right.response.elapsedMs ?? Number.POSITIVE_INFINITY;
      if (leftElapsed !== rightElapsed) {
        return leftElapsed - rightElapsed;
      }

      return left.targetId.localeCompare(right.targetId);
    })
  };
}
