import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { Verifier } from "@pact-foundation/pact";
import type { Channel } from "@event-demo/shared";
import { createApp } from "../src/app.js";

const dir = path.dirname(fileURLToPath(import.meta.url));

test("gateway satisfies the order-client contract", async () => {
  const app = createApp({
    channel: {} as Channel,
    publish: async () => {
      // No real broker in a provider-verification run; the contract only covers the HTTP shape.
    },
  });

  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  try {
    await new Verifier({
      provider: "gateway",
      providerBaseUrl: `http://localhost:${port}`,
      pactUrls: [path.resolve(dir, "pacts/order-client-gateway.json")],
      stateHandlers: {
        "the gateway accepts new orders": async () => ({ description: "no setup needed" }),
        "no saga exists with the given id": async () => ({ description: "no setup needed" }),
      },
    }).verifyProvider();
  } finally {
    server.close();
  }
});
