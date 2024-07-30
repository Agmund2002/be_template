import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from './prisma/prisma.module';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 300_000 // 5m
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get<string>('SMTP_HOST'),
          port: 465,
          secure: true,
          auth: {
            user: config.get<string>('SMTP_USERNAME'),
            pass: config.get<string>('SMTP_PASSWORD')
          }
        },
        defaults: {
          from: config.get<string>('SMTP_FROM')
        }
      })
    }),
    AuthModule,
    PrismaModule
  ],
  controllers: [AppController]
})
export class AppModule {}
