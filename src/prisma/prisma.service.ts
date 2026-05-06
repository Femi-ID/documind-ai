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
      // host: 'localhost',
      // port: 5432,
      // database: 'documind-db',
      // user: 'postgres',
      // password: '#Newbread24',

      // DOCKER CONFIG
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'docker_documind_db',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'Newbread25',
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
