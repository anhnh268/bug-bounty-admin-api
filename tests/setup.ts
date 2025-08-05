process.env.NODE_ENV = 'test';
process.env.API_TOKEN = 'test-api-token-123';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();
  jest.spyOn(console, 'warn').mockImplementation();
});

afterAll(() => {
  jest.restoreAllMocks();
});