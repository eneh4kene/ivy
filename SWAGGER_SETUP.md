# Swagger API Documentation Setup

## Overview

Comprehensive Swagger/OpenAPI 3.0 documentation has been added to the Ivy API.

## Access Documentation

**Local Development**:
- Swagger UI: `http://localhost:3001/api-docs`
- OpenAPI JSON: `http://localhost:3001/api-docs.json`

**Production**:
- Swagger UI: `https://api.tryivy.com/api-docs`
- OpenAPI JSON: `https://api.tryivy.com/api-docs.json`

## What Was Added

### 1. Dependencies

Installed packages:
```bash
npm install swagger-jsdoc swagger-ui-express
npm install --save-dev @types/swagger-jsdoc @types/swagger-ui-express
```

### 2. Configuration File

**File**: `src/config/swagger.ts`

- OpenAPI 3.0 specification
- API info and description
- Server configurations (dev/prod)
- Security schemes (JWT Bearer authentication)
- Reusable schemas (User, Workout, TransformationScore, Donation, Error)
- Tags for endpoint organization
- Comprehensive API description

### 3. App Integration

**File**: `src/app.ts`

Added Swagger UI middleware:
- `/api-docs` - Interactive Swagger UI
- `/api-docs.json` - Raw OpenAPI specification
- Custom CSS to hide topbar
- Custom site title

### 4. Controller Documentation

**File**: `src/api/controllers/auth.controller.ts`

Added JSDoc comments with Swagger annotations for:
- `POST /api/auth/magic-link` - Send magic link
- `POST /api/auth/verify` - Verify token
- `GET /api/auth/me` - Get current user

Each endpoint includes:
- Summary and description
- Request body schemas
- Response schemas
- Error responses
- Security requirements
- Examples

### 5. API Documentation

**File**: `API_DOCUMENTATION.md`

Comprehensive markdown documentation including:
- All endpoints with descriptions
- Request/response examples
- Authentication flow
- Error codes
- Rate limiting info
- Integration guide
- cURL examples

## Features

### Interactive Testing

The Swagger UI allows you to:
- ✅ View all endpoints and their schemas
- ✅ Test endpoints directly in the browser
- ✅ Authenticate with JWT tokens
- ✅ See request/response examples
- ✅ Download OpenAPI specification
- ✅ Generate client code

### Security

- JWT Bearer authentication configured
- Token can be set globally in Swagger UI
- Protected endpoints show lock icon
- Clear auth requirements for each endpoint

### Organization

Endpoints organized by tags:
- **Authentication** - Magic link and JWT endpoints
- **Users** - User management and profiles
- **Workouts** - Workout tracking
- **Stats** - Transformation scores and analytics
- **Donations** - Donation tracking
- **Webhooks** - Stripe and Retell webhooks

## Using Swagger UI

### 1. Start the Server

```bash
npm run dev
```

### 2. Open Swagger UI

Navigate to: `http://localhost:3001/api-docs`

### 3. Authenticate

1. Click the "Authorize" button (lock icon)
2. Enter your JWT token: `Bearer <your-token>`
3. Click "Authorize"
4. All protected endpoints will now use this token

### 4. Test an Endpoint

1. Expand an endpoint (e.g., `GET /api/auth/me`)
2. Click "Try it out"
3. Fill in any required parameters
4. Click "Execute"
5. View the response

## Adding Documentation to New Endpoints

### Template

```typescript
/**
 * @swagger
 * /api/endpoint-path:
 *   post:
 *     summary: Short endpoint description
 *     description: Detailed description of what this endpoint does
 *     tags: [TagName]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - field1
 *             properties:
 *               field1:
 *                 type: string
 *                 example: "example value"
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *       400:
 *         description: Error response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async methodName(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Implementation
}
```

### Best Practices

1. **Be Descriptive**: Use clear summaries and descriptions
2. **Include Examples**: Provide example values for all fields
3. **Document Errors**: List all possible error responses
4. **Use Schemas**: Reference reusable schemas with `$ref`
5. **Add Tags**: Organize endpoints with appropriate tags
6. **Security**: Specify `security: []` for public endpoints

## Next Steps

### TODO: Add Documentation for Remaining Controllers

The following controllers need Swagger annotations:

1. **User Controller** (`src/api/controllers/user.controller.ts`)
   - GET /api/users/profile
   - PUT /api/users/profile
   - GET /api/users/preferences
   - PUT /api/users/preferences
   - POST /api/users/onboarding
   - GET /api/users/subscription

2. **Workout Controller** (`src/api/controllers/workout.controller.ts`)
   - GET /api/workouts
   - POST /api/workouts
   - GET /api/workouts/:id
   - PUT /api/workouts/:id
   - POST /api/workouts/:id/complete
   - GET /api/workouts/week/:weekNumber
   - GET /api/workouts/stats

3. **Stats Controller** (`src/api/controllers/stats.controller.ts`)
   - GET /api/stats/dashboard
   - GET /api/stats/transformation-scores
   - POST /api/stats/transformation-scores
   - GET /api/stats/life-markers
   - POST /api/stats/life-markers
   - GET /api/stats/weekly-summary

4. **Donation Controller** (`src/api/controllers/donation.controller.ts`)
   - GET /api/donations
   - GET /api/donations/total
   - GET /api/donations/charities
   - PUT /api/donations/charity

5. **Webhook Controller** (`src/api/controllers/webhook.controller.ts`)
   - POST /webhooks/stripe
   - POST /webhooks/retell

### Adding New Schemas

To add reusable schemas, edit `src/config/swagger.ts`:

```typescript
components: {
  schemas: {
    NewSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'Example' },
      },
    },
  },
}
```

Then reference it in endpoints:
```yaml
schema:
  $ref: '#/components/schemas/NewSchema'
```

## Resources

- [Swagger/OpenAPI 3.0 Spec](https://swagger.io/specification/)
- [swagger-jsdoc Documentation](https://github.com/Surnet/swagger-jsdoc)
- [swagger-ui-express Documentation](https://github.com/scottie1984/swagger-ui-express)

---

**Status**: ✅ Core documentation complete, ready for expansion
**Last Updated**: 2026-01-17
