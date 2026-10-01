export type SagaStatus = "pending" | "completed" | "failed";

export interface SagaRecord {
  sagaId: string;
  orderId: string;
  amount: number;
  status: SagaStatus;
  reason?: string;
  notification?: "success" | "compensated";
  updatedAt: string;
}

const sagas = new Map<string, SagaRecord>();

export function createSaga(record: SagaRecord): void {
  sagas.set(record.sagaId, record);
}

export function getSaga(sagaId: string): SagaRecord | undefined {
  return sagas.get(sagaId);
}

export function updateSaga(sagaId: string, patch: Partial<SagaRecord>): SagaRecord | undefined {
  const existing = sagas.get(sagaId);
  if (!existing) return undefined;
  const updated: SagaRecord = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  sagas.set(sagaId, updated);
  return updated;
}
