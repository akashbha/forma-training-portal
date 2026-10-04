export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'forma - Training Analytics Portal API',
    version: '1.0.0',
    description:
      'Production-grade REST API for tracking trainee session evaluations, computing SQL analytics, and managing academy operations.',
  },
  servers: [
    {
      url: '/api',
      description: 'Main API Gateway',
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Validation failed for one or more fields' },
              fields: {
                type: 'object',
                additionalProperties: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
            required: ['code', 'message'],
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['ADMIN', 'TRAINER', 'TRAINEE'] },
        },
      },
      Batch: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          program: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          trainerId: { type: 'string' },
        },
      },
      Result: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          sessionId: { type: 'string' },
          traineeId: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 100 },
          errors: { type: 'integer', minimum: 0 },
          timeSeconds: { type: 'integer', minimum: 1 },
          notes: { type: 'string', nullable: true },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'Service Health Check',
        responses: {
          '200': { description: 'Service and DB healthy' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Authentication successful, sets httpOnly cookie' },
          '401': { description: 'Invalid email or password' },
          '429': { description: 'Too many attempts' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Refresh access token',
        responses: {
          '200': { description: 'Token refreshed' },
          '401': { description: 'Invalid or expired refresh token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Revoke refresh token and clear cookies',
        responses: {
          '200': { description: 'Logged out' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current authenticated user profile',
        responses: {
          '200': { description: 'Current user data' },
        },
      },
    },
    '/v1/batches': {
      get: {
        summary: 'List batches',
        responses: { '200': { description: 'List of batches' } },
      },
      post: {
        summary: 'Create a batch (ADMIN / TRAINER)',
        responses: { '201': { description: 'Batch created' } },
      },
    },
    '/v1/trainees': {
      get: {
        summary: 'List trainees with pagination and filters',
        responses: { '200': { description: 'List of trainees' } },
      },
      post: {
        summary: 'Create a trainee user and profile (ADMIN / TRAINER)',
        responses: { '201': { description: 'Trainee created' } },
      },
    },
    '/v1/topics': {
      get: {
        summary: 'List training topics',
        responses: { '200': { description: 'List of topics' } },
      },
      post: {
        summary: 'Create a training topic (ADMIN / TRAINER)',
        responses: { '201': { description: 'Topic created' } },
      },
    },
    '/v1/sessions': {
      get: {
        summary: 'List training sessions',
        responses: { '200': { description: 'List of sessions' } },
      },
      post: {
        summary: 'Create a session (ADMIN / TRAINER)',
        responses: { '201': { description: 'Session created' } },
      },
    },
    '/v1/results': {
      post: {
        summary: 'Create single result (ADMIN / TRAINER)',
        responses: { '201': { description: 'Result created' } },
      },
    },
    '/v1/results/bulk': {
      post: {
        summary: 'Bulk create session results atomically (ADMIN / TRAINER)',
        responses: { '201': { description: 'Results processed' } },
      },
    },
    '/v1/analytics/overview': {
      get: {
        summary: 'SQL Computed Overview with period deltas',
        parameters: [
          { name: 'batchId', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': { description: 'Overview metrics with deltas' } },
      },
    },
    '/v1/analytics/trend': {
      get: {
        summary: 'SQL Computed Trend series',
        parameters: [
          { name: 'batchId', in: 'query', schema: { type: 'string' } },
          { name: 'groupBy', in: 'query', schema: { type: 'string', enum: ['week', 'session'] } },
        ],
        responses: { '200': { description: 'Trend time series' } },
      },
    },
    '/v1/analytics/batches/compare': {
      get: {
        summary: 'Multi-batch comparison row aggregates (ADMIN / TRAINER)',
        responses: { '200': { description: 'Comparison matrix' } },
      },
    },
    '/v1/analytics/trainees/{id}': {
      get: {
        summary: 'Trainee individual performance analytics and history',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Trainee analytics' } },
      },
    },
    '/v1/analytics/heatmap': {
      get: {
        summary: 'Batch Trainee x Session performance matrix',
        parameters: [{ name: 'batchId', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Heatmap matrix' } },
      },
    },
  },
};
