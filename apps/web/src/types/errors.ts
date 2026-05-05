export enum ErrorType {
  VALIDATION = 'VALIDATION',      // 400 - field-level
  CONFLICT = 'CONFLICT',          // 409 - business rule
  NOT_FOUND = 'NOT_FOUND',        // 404
  UNAUTHORIZED = 'UNAUTHORIZED',  // 401/403
  SERVER = 'SERVER',              // 5xx
  NETWORK = 'NETWORK',            // No response
}

export interface ApiError {
  type: ErrorType;
  message: string;
  code: number;
  field?: string;              // For validation errors
  details?: Record<string, string>;
}

export function classifyError(err: any): ApiError {
  const status = err.response?.status;
  const data = err.response?.data;

  if (!status) {
    return {
      type: ErrorType.NETWORK,
      message: 'Network error - check connection',
      code: 0,
    };
  }

  if (status === 400) {
    return {
      type: ErrorType.VALIDATION,
      message: data?.error || 'Invalid input',
      code: 400,
      details: data?.details,
    };
  }

  if (status === 409) {
    return {
      type: ErrorType.CONFLICT,
      message: data?.error || 'Action conflicts with current state',
      code: 409,
    };
  }

  if (status === 404) {
    return {
      type: ErrorType.NOT_FOUND,
      message: 'Unit not found',
      code: 404,
    };
  }

  if (status === 401 || status === 403) {
    return {
      type: ErrorType.UNAUTHORIZED,
      message: 'You do not have permission',
      code: status,
    };
  }

  return {
    type: ErrorType.SERVER,
    message: data?.error || 'Server error - try again',
    code: status,
  };
}
