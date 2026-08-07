export interface PlatformEvent<TPayload = unknown> {
  name: string;
  version: number;
  payload: TPayload;
  occurredAt?: Date;
}

export type PlatformEventHandler<TPayload = unknown> = (
  event: Required<PlatformEvent<TPayload>>,
) => Promise<void> | void;

export interface EventPublisher {
  publish(event: PlatformEvent): Promise<void>;
}

export interface EventBus extends EventPublisher {
  subscribe(name: string, handler: PlatformEventHandler): () => void;
}
