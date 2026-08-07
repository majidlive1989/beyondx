import type { PlatformEvent } from "@beyondx/core";
import { describe, expect, it, vi } from "vitest";
import { TypedEventBus } from "../src/index.js";

interface Events {
  "platform.started": { uptime: number };
}

type StartedEvent = Required<PlatformEvent<Events["platform.started"]>>;

describe("TypedEventBus", () => {
  it("publishes typed events and supports unsubscribe", async () => {
    const bus = new TypedEventBus<Events>();
    const listener = vi.fn<(event: StartedEvent) => void>();
    const unsubscribe = bus.subscribe("platform.started", listener);

    await bus.publish({
      name: "platform.started",
      version: 1,
      payload: { uptime: 10 },
    });
    unsubscribe();
    await bus.publish({
      name: "platform.started",
      version: 1,
      payload: { uptime: 20 },
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
