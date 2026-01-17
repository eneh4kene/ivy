import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ivy API Documentation',
      version: '1.0.0',
      description: `
        # Ivy - AI-Powered Wellness Accountability Platform

        Complete REST API for the Ivy wellness platform with AI voice calls,
        donation tracking, and tier-based subscriptions.

        ## Features
        - 🔐 JWT Authentication with magic links
        - 👥 User management with role-based access
        - 💳 Stripe subscription management (FREE, PRO, ELITE, CONCIERGE, B2B)
        - 🏋️ Workout tracking and completion
        - 📞 AI voice calls via Retell integration
        - ❤️ Donation tracking per workout
        - 📊 Transformation scores and statistics
        - 🏢 B2B company management with admin dashboards
        - 🔔 Webhooks for Stripe and Retell events

        ## Authentication
        Most endpoints require a valid JWT token in the Authorization header:
        \`Authorization: Bearer <token>\`

        ## Subscription Tiers
        - **FREE**: Basic workouts and donations
        - **PRO**: Energy/mood tracking (£29/month)
        - **ELITE**: Health confidence, Ivy Circle, calendar sync (£49/month)
        - **CONCIERGE**: Human review, strategy calls, life markers (£99/month)
        - **B2B**: Company-wide programs with admin dashboard (£53/employee/month)

        ## Rate Limiting
        - Authentication endpoints: 5 requests per 15 minutes
        - General API: 100 requests per 15 minutes
      `,
      contact: {
        name: 'Ivy Support',
        email: 'support@tryivy.com',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://api.tryivy.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token from the /auth/verify endpoint',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Invalid input data',
                },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
            subscriptionTier: {
              type: 'string',
              enum: ['FREE', 'PRO', 'ELITE', 'CONCIERGE', 'B2B'],
              example: 'PRO',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'superadmin'],
              example: 'user',
            },
            currentTrack: {
              type: 'string',
              enum: ['fitness', 'focus', 'sleep', 'balance'],
              example: 'fitness',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Workout: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            type: {
              type: 'string',
              enum: ['cardio', 'strength', 'flexibility', 'mindfulness'],
              example: 'strength',
            },
            duration: {
              type: 'integer',
              description: 'Duration in minutes',
              example: 30,
            },
            completed: {
              type: 'boolean',
              example: true,
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        TransformationScore: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            energyLevel: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              example: 7,
            },
            mood: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              example: 8,
            },
            healthConfidence: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              example: 6,
            },
            recordedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Donation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            workoutId: {
              type: 'string',
              format: 'uuid',
            },
            amount: {
              type: 'number',
              format: 'float',
              example: 1.0,
              description: 'Amount in GBP',
            },
            charityId: {
              type: 'string',
              format: 'uuid',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Magic link authentication endpoints',
      },
      {
        name: 'Users',
        description: 'User management and profile operations',
      },
      {
        name: 'Workouts',
        description: 'Workout tracking and management',
      },
      {
        name: 'Stats',
        description: 'Statistics and transformation scores',
      },
      {
        name: 'Donations',
        description: 'Donation tracking and charity management',
      },
      {
        name: 'Webhooks',
        description: 'Webhook endpoints for Stripe and Retell',
      },
    ],
  },
  apis: ['./src/api/controllers/*.ts', './src/api/routes/*.ts'], // Path to the API routes
}

const swaggerSpec = swaggerJsdoc(options)

export default swaggerSpec
