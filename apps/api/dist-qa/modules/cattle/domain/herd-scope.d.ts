import { Prisma } from '@prisma/client';
export declare const activeHerd: (farmId: string) => Prisma.CattleWhereInput;
export declare const notDeleted: (farmId: string) => Prisma.CattleWhereInput;
export declare const anyRecord: (farmId: string) => Prisma.CattleWhereInput;
