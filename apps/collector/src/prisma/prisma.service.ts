import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const CONNECT_ATTEMPTS = 10;
const CONNECT_DELAY_MS = 1_000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < CONNECT_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, CONNECT_DELAY_MS));
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Prisma failed to connect');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
