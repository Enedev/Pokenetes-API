import { FlujoMessage } from './types';

const flujos = new Map<string, FlujoMessage>();

export function saveFlujo(message: FlujoMessage): FlujoMessage {
  flujos.set(message.trace_id, message);
  return message;
}

export function getFlujo(traceId: string): FlujoMessage | undefined {
  return flujos.get(traceId);
}

export function listFlujos(): FlujoMessage[] {
  return [...flujos.values()];
}

export function clearFlujos(): void {
  flujos.clear();
}
