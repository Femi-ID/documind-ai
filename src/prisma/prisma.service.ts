import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/generated/prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // const adapter = new PrismaPg({
    //   connectionString: process.env.DATABASE_URL as string,
    // });
    // super({ adapter });

    const pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'documind-db',
      user: 'postgres',
      password: '#Newbread24',
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect()
      .then(() => console.log('Connected to the prisma DB'))
      .catch((err) => console.log(err));
  }
}
