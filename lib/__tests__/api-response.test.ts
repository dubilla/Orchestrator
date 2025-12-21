import { successResponse, errorResponse } from '../api-response';

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      status: init?.status || 200,
      json: async () => body,
      headers: new Headers(),
    })),
  },
}));

describe('api-response utilities', () => {
  describe('successResponse', () => {
    it('should create a successful response with default status 200', () => {
      const data = { id: '1', name: 'Test' };
      const response = successResponse(data);

      expect(response.status).toBe(200);
    });

    it('should create a successful response with custom status', () => {
      const data = { id: '1', name: 'Test' };
      const response = successResponse(data, 201);

      expect(response.status).toBe(201);
    });

    it('should include success flag and data in response body', async () => {
      const data = { id: '1', name: 'Test' };
      const response = successResponse(data);
      const body = await response.json();

      expect(body).toEqual({
        success: true,
        data: { id: '1', name: 'Test' },
      });
    });
  });

  describe('errorResponse', () => {
    it('should create an error response with default status 500', () => {
      const response = errorResponse('Something went wrong');

      expect(response.status).toBe(500);
    });

    it('should create an error response with custom status', () => {
      const response = errorResponse('Not found', 404);

      expect(response.status).toBe(404);
    });

    it('should include success flag and error message in response body', async () => {
      const response = errorResponse('Invalid input', 400);
      const body = await response.json();

      expect(body).toEqual({
        success: false,
        error: 'Invalid input',
      });
    });
  });
});
