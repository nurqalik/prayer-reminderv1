import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../prayer-reminder-backend/src/server/api/root';

/**
 * We omit colliding keys to bypass tRPC's internal check that triggers 
 * when the router contains keys like 'useContext' or 'Provider'.
 * This allows us to maintain type safety for the rest of the procedures.
 */
export const trpc = createTRPCReact<Omit<AppRouter, 'useContext' | 'useUtils' | 'Provider'>>(undefined as any);
