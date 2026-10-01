import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PactV3, MatchersV3 } from "@pact-foundation/pact";

const { string, regex } = MatchersV3;
const dir = path.dirname(fileURLToPath(import.meta.url));

const provider = new PactV3({
  consumer: "order-client",
  provider: "gateway",
  dir: path.resolve(dir, "pacts"),
});

test("POST /orders creates a pending order", async () => {
  provider
    .given("the gateway accepts new orders")
    .uponReceiving("a request to create an order")
    .withRequest({
      method: "POST",
      path: "/orders",
      headers: { "Content-Type": "application/json" },
      body: { amount: 250 },
    })
    .willRespondWith({
      status: 202,
      headers: { "Content-Type": regex(/application\/json.*/, "application/json; charset=utf-8") },
      body: {
        orderId: string("11111111-1111-1111-1111-111111111111"),
        sagaId: string("22222222-2222-2222-2222-222222222222"),
        status: "pending",
      },
    });

  await provider.executeTest(async (mockserver) => {
    const res = await fetch(`${mockserver.url}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 250 }),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.status, "pending");
  });
});

test("GET /sagas/:id 404s for an unknown saga", async () => {
  provider
    .given("no saga exists with the given id")
    .uponReceiving("a request for an unknown saga")
    .withRequest({ method: "GET", path: regex(/\/sagas\/.+/, "/sagas/unknown-id") })
    .willRespondWith({
      status: 404,
      headers: { "Content-Type": regex(/application\/json.*/, "application/json; charset=utf-8") },
      body: { error: string("saga not found") },
    });

  await provider.executeTest(async (mockserver) => {
    const res = await fetch(`${mockserver.url}/sagas/unknown-id`);
    assert.equal(res.status, 404);
  });
});
