import {
  IskuBixi,
  PayPalPaymentProviderFactory,
  PayPalWebhookAdapter,
  StripePaymentProviderFactory,
  StripeWebhookAdapter,
  type IskuBixi as IskuBixiInstance,
  type WebhookHeaders
} from "iskubixi";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createProviderSdkFromEnvironment(): IskuBixiInstance {
  const paypalEnvironment = requiredEnvironment("PAYPAL_ENVIRONMENT");
  if (paypalEnvironment !== "sandbox" && paypalEnvironment !== "live") {
    throw new Error("PAYPAL_ENVIRONMENT must be sandbox or live.");
  }

  const paypalCredentials = {
    clientId: requiredEnvironment("PAYPAL_CLIENT_ID"),
    clientSecret: requiredEnvironment("PAYPAL_CLIENT_SECRET")
  };
  return new IskuBixi({
    bixiyeyaasha: {
      stripe: { apiKey: requiredEnvironment("STRIPE_SECRET_KEY") },
      paypal: paypalCredentials
    },
    laqabsadayaasha: {
      stripe: new StripePaymentProviderFactory(),
      paypal: new PayPalPaymentProviderFactory({
        environment: paypalEnvironment
      })
    },
    laqabsadayaashaWebhook: {
      stripe: new StripeWebhookAdapter({
        secret: requiredEnvironment("STRIPE_WEBHOOK_SECRET")
      }),
      paypal: new PayPalWebhookAdapter(paypalCredentials, {
        environment: paypalEnvironment,
        webhookId: requiredEnvironment("PAYPAL_WEBHOOK_ID")
      })
    }
  });
}

export async function createProviderExamples(
  sdk: IskuBixiInstance
): Promise<void> {
  await sdk.lacag.samee({
    qadarka: 25,
    lacagta: "USD",
    bixiye: "stripe",
    tixraac: "ORDER-STRIPE-1003",
    furahaIdempotency: "stripe-order-1003-attempt-1"
  });
  await sdk.lacag.samee({
    qadarka: 25,
    lacagta: "USD",
    bixiye: "paypal",
    tixraac: "ORDER-PAYPAL-1003",
    furahaIdempotency: "paypal-order-1003-attempt-1"
  });
}

export async function processStripeWebhook(
  sdk: IskuBixiInstance,
  rawBody: Uint8Array,
  headers: WebhookHeaders
): Promise<void> {
  await sdk.webhook.kaShaqee({
    bixiye: "stripe",
    rawBody,
    headers
  });
}

export { createProviderSdkFromEnvironment };
