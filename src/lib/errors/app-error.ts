export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errors = {
  badRequest: (message: string, details?: unknown) => new AppError("BAD_REQUEST", message, 400, details),
  unauthorized: (message = "Authentication is required.") => new AppError("UNAUTHORIZED", message, 401),
  forbidden: (message = "You do not have permission to perform this action.") => new AppError("FORBIDDEN", message, 403),
  notFound: (message = "The requested resource was not found.") => new AppError("NOT_FOUND", message, 404),
  conflict: (message: string) => new AppError("CONFLICT", message, 409),
  tooManyRequests: (message = "Too many requests. Please try again later.") => new AppError("RATE_LIMITED", message, 429),
};
