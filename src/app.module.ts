import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { MinioModule } from './minio/minio.module';
import { DocumentModule } from './document/document.module';
import { QueueModule } from './queue/queue.module';
import { ConversationModule } from './conversation/conversation.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    PrismaModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      expandVariables: true,
    }),
    MinioModule,
    DocumentModule,
    QueueModule,
    ConversationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
