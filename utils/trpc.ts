import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../prayer-reminder-backend/src/server/api/root';

export const trpc = createTRPCReact<AppRouter>();
