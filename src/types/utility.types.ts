/**
 * Advanced TypeScript utility types for the Bug Bounty Admin API
 */

// Basic utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & RequiredByKey<T, K>;
export type RequiredByKey<T, K extends keyof T> = T & { [P in K]-?: T[P] };

// Deep utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// Branded types for type safety
export type Brand<T, B> = T & { readonly __brand: B };
export type ReportId = Brand<string, 'ReportId'>;
export type UserId = Brand<string, 'UserId'>;
export type Email = Brand<string, 'Email'>;
export type JWTToken = Brand<string, 'JWTToken'>;

// API Response helpers
export type ApiSuccess<T = unknown> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiError = {
  success: false;
  error: string;
  message: string;
  stack?: string;
};

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// Pagination types
export type PaginationParams = {
  page: number;
  limit: number;
};

export type SortParams<T> = {
  sortBy: keyof T;
  sortOrder: 'asc' | 'desc';
};

export type PaginatedRequest<T> = PaginationParams & SortParams<T>;

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

// Filtering types
export type FilterOperators = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';

export type FilterValue<T> = {
  [K in FilterOperators]?: T;
};

export type FilterParams<T> = {
  [K in keyof T]?: FilterValue<T[K]> | T[K];
};

// Event system types
export type EventType =
  | 'report.created'
  | 'report.updated'
  | 'report.assigned'
  | 'report.status_changed'
  | 'user.authenticated'
  | 'security.rate_limit_exceeded';

export type EventPayload<T extends EventType> = T extends 'report.created'
  ? { reportId: ReportId; userId: UserId }
  : T extends 'report.updated'
    ? { reportId: ReportId; userId: UserId; changes: Record<string, unknown> }
    : T extends 'report.assigned'
      ? { reportId: ReportId; assigneeId: UserId; assignedBy: UserId }
      : T extends 'report.status_changed'
        ? { reportId: ReportId; oldStatus: string; newStatus: string; userId: UserId }
        : T extends 'user.authenticated'
          ? { userId: UserId; method: 'jwt' | 'api_key' }
          : T extends 'security.rate_limit_exceeded'
            ? { ip: string; path: string; limit: number }
            : never;

export type DomainEvent<T extends EventType = EventType> = {
  id: string;
  type: T;
  payload: EventPayload<T>;
  timestamp: Date;
  version: number;
};

// Repository pattern types
export type RepositoryOptions = {
  include?: string[];
  exclude?: string[];
  cache?: boolean;
  timeout?: number;
};

export type CreateOptions = RepositoryOptions & {
  validate?: boolean;
  skipDefaults?: boolean;
};

export type UpdateOptions = RepositoryOptions & {
  partial?: boolean;
  version?: number;
};

export type FindOptions<T = unknown> = RepositoryOptions & {
  where?: FilterParams<T>;
  orderBy?: SortParams<T>;
  pagination?: PaginationParams;
};

// Service layer types
export type ServiceContext = {
  userId?: UserId;
  requestId: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
};

export type ServiceResult<T, E = Error> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: E;
    };

// Validation types
export type ValidationRule<T> = {
  field: keyof T;
  rule: 'required' | 'email' | 'uuid' | 'min' | 'max' | 'pattern';
  value?: unknown;
  message?: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
};

// Configuration types
export type EnvironmentConfig = {
  readonly NODE_ENV: 'development' | 'test' | 'production';
  readonly PORT: number;
  readonly API_TOKEN: string;
  readonly JWT_ACCESS_SECRET: string;
  readonly JWT_REFRESH_SECRET: string;
};

// Type guards
export const isApiSuccess = <T>(response: ApiResponse<T>): response is ApiSuccess<T> => {
  return response.success === true;
};

export const isApiError = <T>(response: ApiResponse<T>): response is ApiError => {
  return response.success === false;
};

// Nominal types for IDs
export const createReportId = (id: string): ReportId => id as ReportId;
export const createUserId = (id: string): UserId => id as UserId;
export const createEmail = (email: string): Email => email as Email;
export const createJWTToken = (token: string): JWTToken => token as JWTToken;

// Type assertions with validation
export const assertReportId = (value: unknown): asserts value is ReportId => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Invalid ReportId');
  }
};

export const assertUserId = (value: unknown): asserts value is UserId => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Invalid UserId');
  }
};

// Conditional types for advanced patterns
export type NonNullable<T> = T extends null | undefined ? never : T;

export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;

export type OmitByType<T, U> = Omit<T, KeysOfType<T, U>>;

// Function overloading types
export type Overload<T> = T extends {
  (...args: infer A1): infer R1;
  (...args: infer A2): infer R2;
  (...args: infer A3): infer R3;
}
  ? {
      (...args: A1): R1;
      (...args: A2): R2;
      (...args: A3): R3;
    }
  : T extends {
        (...args: infer A1): infer R1;
        (...args: infer A2): infer R2;
      }
    ? {
        (...args: A1): R1;
        (...args: A2): R2;
      }
    : T;
