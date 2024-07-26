import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, { abortOnError: false });

    app.use(cookieParser());

    app.enableCors({
      credentials: true,
      exposedHeaders: 'set-cookie'
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true
      })
    );

    const config = new DocumentBuilder()
      .setTitle('TEMPLATE')
      .setVersion('0.0.1')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    const env = app.get(ConfigService);

    await app.listen(env.get('PORT'), () =>
      console.log(`Server running. Use our API on port: ${env.get('PORT')}`)
    );
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
bootstrap();
