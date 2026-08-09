import type { Role } from '@prisma/client';

/**
 * Request augmentation for the authenticated principal.
 *
 * Declared centrally so no middleware needs to cast `req` to `any` to read the user.
 * `req.user` is populated by the auth middleware and is `undefined` on public routes.
 */
declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      email: string;
      role: Role;
    }

    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
