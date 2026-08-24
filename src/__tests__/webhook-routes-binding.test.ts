/**
 * Regression guard for the webhook `this`-binding bug.
 *
 * WebhookController is a class exported as a singleton. Registering a method by
 * bare reference (`webhookController.handleRetellWebhook`) drops `this`, so any
 * `this.helper()` inside throws "Cannot read properties of undefined" at
 * request time. Nothing caught it because the six handlers that don't use
 * `this` kept working, and the two that do (Retell outbound + inbound) only
 * fail against a live provider — every Retell call 500'd and no transcript,
 * insight or memory ever landed.
 *
 * Asserting on the route stack rather than on behaviour keeps this cheap and
 * makes it fail the moment someone registers a handler unbound again.
 */
import webhookRouter from '../api/routes/webhook.routes';

interface RouteLayer {
  route?: {
    path: string;
    stack: Array<{ handle: (...args: unknown[]) => unknown }>;
  };
}

describe('webhook routes', () => {
  const layers = (webhookRouter as unknown as { stack: RouteLayer[] }).stack.filter(
    (l) => l.route
  );

  it('registers every webhook route', () => {
    expect(layers.length).toBeGreaterThanOrEqual(8);
  });

  it.each(layers.map((l) => [l.route!.path, l.route!.stack[0].handle]))(
    'binds the handler for %s to the controller instance',
    (_path, handle) => {
      // Function.prototype.bind names the result "bound <original>". An unbound
      // method reference keeps its plain name, which is exactly the bug.
      expect((handle as { name: string }).name).toMatch(/^bound /);
    }
  );
});
