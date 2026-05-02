'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-10 h-10 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <CardTitle className="text-3xl">Checkout Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <p className="text-lg text-muted-foreground">
              Your payment was not processed.
            </p>
            <p className="text-sm text-muted-foreground">
              No charges have been made to your card. You can try again whenever you're ready.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Need help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              If you encountered any issues during checkout, please don't hesitate to reach out to our support team.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-blue-600">•</span>
                <span>Email: support@tryivy.com</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-600">•</span>
                <span>Live chat available 9am-5pm GMT</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/pricing" className="flex-1">
              <Button size="lg" className="w-full">
                Try Again
              </Button>
            </Link>
            <Link href="/dashboard" className="flex-1">
              <Button size="lg" variant="outline" className="w-full">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
