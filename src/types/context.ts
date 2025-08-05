import { IUser } from './index';

export interface IRequestContext {
  user: IUser;
  requestId: string;
  timestamp: Date;
  ip?: string;
  sessionId?: string;
  traceId?: string;
}

declare global {
  namespace Express {
    interface Request {
      context?: IRequestContext;
    }
  }
}
