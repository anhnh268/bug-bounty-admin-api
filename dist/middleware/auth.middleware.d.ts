import { Request, Response, NextFunction } from 'express';
import { IUser } from '../types';
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => void;
export declare const authorize: (...allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map