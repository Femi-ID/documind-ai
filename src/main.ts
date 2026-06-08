import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { SanitizeInputInterceptor } from './common/interceptors/sanitize-input.interceptor';
import helmet from 'helmet';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  //  Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    Credentials: true,
  });

  // performance
  app.use(compression()); // gzip responses — typically 60-80% size reduction

  //  global prefix with versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1', // routes become /api/v1/
  });

  // Global pipes, filters, interceptors
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new SanitizeInputInterceptor(),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidNonWhitelisted: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger/OpenAPI config
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DocuMind AI')
    .setDescription(
      'A production-grade RAG platform for intelligent document Q&A. ' +
        'User can upload documents, ask natural-language questions and receive cited answers grounded in your on content.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth', 'Registration, login, token refresh')
    .addTag('Users', 'User profile management')
    .addTag('Documents', 'Document upload, listing, and management')
    .addTag('Conversations', 'RAG Q&A conversations and messages')
    .addTag('Collections', 'Document collection management')
    .addTag('System', 'Health checks, metrics, and queue status')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
    customSiteTitle: 'DocuMind AI- API Documentation',
  });

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`Application running on http://localhost:3000`);
  logger.log(`Swagger docs available at http://localhost:3000/api/docs`);
}
bootstrap();
