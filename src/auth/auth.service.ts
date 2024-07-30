import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { EmailDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class AuthService {
  private readonly logger = new Logger();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService
  ) {}

  async sendEmail(dto: EmailDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email }
      });
      if (user) throw new ConflictException('user already exists');

      const code = this.generateCode(6);

      await this.cache.set(code, dto.email);

      await this.mailer.sendMail({
        to: dto.email,
        subject: 'Email verification',
        text: code
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;

      this.logger.error('error during email sending: ', error);

      throw new InternalServerErrorException(
        'error during email sending',
        error
      );
    }
  }

  private generateCode(length: number) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let result = '';

    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }

    return result;
  }
}
