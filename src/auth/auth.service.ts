import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException
} from '@nestjs/common';
import { CodeDto, EmailDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CookieOptions, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService
  ) {}

  async sendEmail(res: Response, dto: EmailDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email }
      });
      if (user) throw new ConflictException('user already exists');

      const code = this.generateCode(6);

      await this.cache.set(dto.email, code);

      await this.mailer.sendMail({
        to: dto.email,
        subject: 'Email verification',
        text: code
      });

      this.addEmailAndStatusToCookie(res, dto.email);
    } catch (error) {
      if (error instanceof ConflictException) throw error;

      this.logger.error('error during email sending: ', error);

      throw new InternalServerErrorException(
        'error during email sending',
        error
      );
    }
  }

  async codeVerification(req: Request, res: Response, dto: CodeDto) {
    try {
      const { email } = req.cookies;

      if (!email)
        throw new UnprocessableEntityException('Email input step was skipped');

      const code = await this.cache.get(email);
      if (code !== dto.code) throw new UnauthorizedException('Invalid Code');

      await this.cache.del(email);

      this.editEmailStatusInCookie(res);
    } catch (error) {
      if (error instanceof UnprocessableEntityException) throw error;

      if (error instanceof UnauthorizedException) throw error;

      this.logger.error('error during code verification: ', error);

      throw new InternalServerErrorException(
        'error during code verification',
        error
      );
    }
  }

  private addEmailAndStatusToCookie(res: Response, email: string) {
    const expiresIn = new Date();
    expiresIn.setMinutes(expiresIn.getMinutes() + 30);

    res.cookie('email', email, this.setCookieOptions(expiresIn));

    res.cookie('verified', false, this.setCookieOptions(expiresIn));
  }

  editEmailStatusInCookie(res: Response) {
    res.cookie('verified', true, this.setCookieOptions());
  }

  removeEmailAndStatusFromCookie(res: Response) {
    res.cookie('email', '', this.setCookieOptions(new Date(0)));

    res.cookie('verified', '', this.setCookieOptions(new Date(0)));
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

  private setCookieOptions(expires?: Date): CookieOptions {
    return {
      httpOnly: true,
      domain: this.config.get('DOMAIN'),
      ...(expires && { expires }),
      secure: true,
      sameSite: 'lax'
    };
  }
}
