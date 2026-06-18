import { redirect } from 'next/navigation'

// /pricing-v2 was the design prototype for the one-plan stake model.
// Its content now lives at /pricing — keep this path alive as a redirect
// so any stray bookmark or link lands on the real page.
export default function PricingV2Redirect() {
  redirect('/pricing')
}
