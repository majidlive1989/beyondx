import {
  AppError,
  type EventBus,
  type PlatformEvent,
  type PlatformEventHandler,
} from "@beyondx/core";

export type EventMap = Record<string, unknown>;

export class TypedEventBus<TEvents extends object = EventMap> implements EventBus {
  readonly #listeners = new Map<string, Set<PlatformEventHandler<unknown>>>();

  subscribe<TKey extends keyof TEvents & string>(
    name: TKey,
    handler: PlatformEventHandler<TEvents[TKey]>,
  ): () => void;
  subscribe(name: string, handler: PlatformEventHandler): () => void;
  subscribe(name: string, handler: PlatformEventHandler): () => void {
    const handlers = this.#listeners.get(name) ?? new Set<PlatformEventHandler<unknown>>();
    handlers.add(handler);
    this.#listeners.set(name, handlers);

    return () => {
      handlers.delete(handler);
    };
  }

  async publish<TKey extends keyof TEvents & string>(
    event: PlatformEvent<TEvents[TKey]> & { name: TKey },
  ): Promise<void>;
  async publish(event: PlatformEvent): Promise<void>;
  async publish(event: PlatformEvent): Promise<void> {
    if (!event.name.trim() || !Number.isInteger(event.version) || event.version < 1) {
      throw new AppError({
        code: "EVENTS_INVALID_EVENT",
        message: "Events require a name and a positive integer version",
      });
    }

    const normalized: Required<PlatformEvent> = {
      ...event,
      occurredAt: event.occurredAt ?? new Date(),
    };
    const handlers = [...(this.#listeners.get(event.name) ?? [])];
    const outcomes = await Promise.allSettled(
      handlers.map((handler) =>
        Promise.resolve().then(() => handler(normalized)),
      ),
    );
    const failures = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
    );

    if (failures.length > 0) {
      const reasons: unknown[] = [];
      for (const failure of failures) reasons.push(failure.reason);
      throw new AggregateError(
        reasons,
        `Event ${event.name} failed in ${failures.length} handler(s)`,
      );
    }
  }

  listenerCount(name: string): number {
    return this.#listeners.get(name)?.size ?? 0;
  }
}
