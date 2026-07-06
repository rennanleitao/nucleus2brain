export type TaskExecutionComplexity = "easy" | "medium" | "hard";

export const TASK_EXECUTION_COMPLEXITIES: TaskExecutionComplexity[] = ["easy", "medium", "hard"];

export const taskExecutionComplexityLabels: Record<TaskExecutionComplexity, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};

export const taskExecutionComplexityDurationReference: Record<TaskExecutionComplexity, string> = {
  easy: "até 30 min",
  medium: "31-60 min",
  hard: "acima de 60 min",
};

export const taskExecutionComplexityOrder: Record<TaskExecutionComplexity, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export function getTaskExecutionComplexityLabel(value?: string | null) {
  return taskExecutionComplexityLabels[(value || "medium") as TaskExecutionComplexity] || taskExecutionComplexityLabels.medium;
}

export function getTaskExecutionComplexityDurationReference(value?: string | null) {
  return taskExecutionComplexityDurationReference[(value || "medium") as TaskExecutionComplexity] || taskExecutionComplexityDurationReference.medium;
}

export function getTaskExecutionComplexityOrder(value?: string | null) {
  return taskExecutionComplexityOrder[(value || "medium") as TaskExecutionComplexity] || taskExecutionComplexityOrder.medium;
}
