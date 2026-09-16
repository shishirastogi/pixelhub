export { prisma, Prisma } from "@pixelhub/db";

import type { Prisma } from "@prisma/client";

/** Either the root client or a transaction client — repository functions accept both. */
export type Db = Prisma.TransactionClient;
