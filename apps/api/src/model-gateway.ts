import {
  AnthropicProvider,
  InCountryProvider,
  MockProvider,
  ModelGateway,
  type Provider,
  RedisWordingCache,
} from "@amil/gateway";
import type { Redis } from "ioredis";
import type { Config } from "./config";

/**
 * The model gateway as configured for this deployment. Without ANTHROPIC_API_KEY the offline mock
 * provider is used, so the demo works fully offline. Shared by the API server and the worker.
 */
export function buildModelGateway(config: Config, redis: Redis) {
  const redactedProvider: Provider = config.ANTHROPIC_API_KEY
    ? new AnthropicProvider({
        apiKey: config.ANTHROPIC_API_KEY,
        model: config.AMIL_ANTHROPIC_MODEL,
      })
    : new MockProvider();
  const inCountryProvider = config.IN_COUNTRY_MODEL_URL
    ? new InCountryProvider({
        baseUrl: config.IN_COUNTRY_MODEL_URL,
        model: config.IN_COUNTRY_MODEL,
        ...(config.IN_COUNTRY_API_KEY ? { apiKey: config.IN_COUNTRY_API_KEY } : {}),
      })
    : undefined;
  const gateway = new ModelGateway({
    redactedProvider,
    ...(inCountryProvider ? { inCountryProvider } : {}),
    cache: new RedisWordingCache(redis),
    timeoutMs: config.MODEL_TIMEOUT_MS,
  });
  return { gateway, redactedProvider, inCountry: Boolean(inCountryProvider) };
}
