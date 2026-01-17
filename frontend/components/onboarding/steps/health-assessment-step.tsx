'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const ASSESSMENT_QUESTIONS = [
  {
    id: 'current-energy',
    question: 'How would you rate your current energy levels?',
    options: [
      { value: 1, label: 'Very Low', emoji: '😴' },
      { value: 2, label: 'Low', emoji: '😔' },
      { value: 3, label: 'Moderate', emoji: '😐' },
      { value: 4, label: 'Good', emoji: '🙂' },
      { value: 5, label: 'Excellent', emoji: '😄' },
    ],
  },
  {
    id: 'sleep-quality',
    question: 'How well do you typically sleep?',
    options: [
      { value: 1, label: 'Poor', emoji: '😫' },
      { value: 2, label: 'Fair', emoji: '😕' },
      { value: 3, label: 'Good', emoji: '😊' },
      { value: 4, label: 'Very Good', emoji: '😌' },
      { value: 5, label: 'Excellent', emoji: '😴' },
    ],
  },
  {
    id: 'stress-level',
    question: 'What is your typical stress level?',
    options: [
      { value: 1, label: 'Very High', emoji: '😰' },
      { value: 2, label: 'High', emoji: '😟' },
      { value: 3, label: 'Moderate', emoji: '😐' },
      { value: 4, label: 'Low', emoji: '🙂' },
      { value: 5, label: 'Very Low', emoji: '😌' },
    ],
  },
  {
    id: 'physical-activity',
    question: 'How often do you engage in physical activity?',
    options: [
      { value: 1, label: 'Rarely', emoji: '🛋️' },
      { value: 2, label: '1-2x/week', emoji: '🚶' },
      { value: 3, label: '3-4x/week', emoji: '🏃' },
      { value: 4, label: '5-6x/week', emoji: '💪' },
      { value: 5, label: 'Daily', emoji: '🏋️' },
    ],
  },
  {
    id: 'nutrition',
    question: 'How would you rate your nutrition habits?',
    options: [
      { value: 1, label: 'Poor', emoji: '🍔' },
      { value: 2, label: 'Fair', emoji: '🍕' },
      { value: 3, label: 'Good', emoji: '🥗' },
      { value: 4, label: 'Very Good', emoji: '🥑' },
      { value: 5, label: 'Excellent', emoji: '🥕' },
    ],
  },
  {
    id: 'mental-health',
    question: 'How is your overall mental wellbeing?',
    options: [
      { value: 1, label: 'Struggling', emoji: '😢' },
      { value: 2, label: 'Challenging', emoji: '😔' },
      { value: 3, label: 'Okay', emoji: '😐' },
      { value: 4, label: 'Good', emoji: '😊' },
      { value: 5, label: 'Thriving', emoji: '🌟' },
    ],
  },
]

export function HealthAssessmentStep() {
  const [answers, setAnswers] = useState<Record<string, number>>({})

  const handleAnswer = (questionId: string, value: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  // TODO: Save assessment to API when component unmounts or on next

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          This baseline assessment helps Ivy provide personalized coaching and track your transformation over time. All responses are private and confidential.
        </p>
      </div>

      <div className="space-y-8">
        {ASSESSMENT_QUESTIONS.map((q, index) => (
          <div key={q.id} className="space-y-3">
            <Label className="text-base font-semibold">
              {index + 1}. {q.question}
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {q.options.map((option) => (
                <Card
                  key={option.value}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    answers[q.id] === option.value
                      ? 'ring-2 ring-indigo-600 bg-indigo-50'
                      : 'hover:bg-accent/50'
                  }`}
                  onClick={() => handleAnswer(q.id, option.value)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl mb-1">{option.emoji}</div>
                    <p className="text-xs font-medium">{option.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(answers).length === ASSESSMENT_QUESTIONS.length && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-900">Assessment complete!</p>
              <p className="text-sm text-green-800">
                Ivy will use this baseline to personalize your experience and track your progress over the next 8 weeks.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
