import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { IRequestContext } from '../types/context';

export const requestContext = (req: Request, _res: Response, next: NextFunction): void => {
  const context: IRequestContext = {
    user: req.user!,
    requestId: uuidv4(),
    timestamp: new Date(),
    ip: req.ip || req.socket.remoteAddress,
  };

  req.context = context;
  next();
};
