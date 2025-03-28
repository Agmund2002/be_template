import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException
} from '@nestjs/common';
import { CodeDto, EmailDto, SigninDto, SignupDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CookieOptions, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as argon from 'argon2';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService
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

      const expiresIn = new Date();
      expiresIn.setMinutes(expiresIn.getMinutes() + 30);

      res.cookie('email', dto.email, this.setCookieOptions(expiresIn));
      res.cookie('verified', false, this.setCookieOptions(expiresIn));
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
        throw new UnprocessableEntityException('email input step was skipped');

      const code = await this.cache.get(email);
      if (code !== dto.code) throw new UnauthorizedException('invalid code');

      await this.cache.del(email);

      res.cookie('verified', true, this.setCookieOptions());
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

  async signup(req: Request, res: Response, dto: SignupDto) {
    try {
      const { email, verified } = req.cookies;
      const { password, ...data } = dto;

      if (!email)
        throw new UnprocessableEntityException('email input step was skipped');

      if (verified !== 'true')
        throw new UnauthorizedException('email not verified');

      const { passwordHash, ...user } = await this.prisma.user.create({
        data: {
          email,
          passwordHash: await argon.hash(password),
          ...data
        }
      });

      const { accessToken, refreshToken } = await this.issueTokens(user.id);

      res.cookie('email', '', this.setCookieOptions(new Date(0)));
      res.cookie('verified', '', this.setCookieOptions(new Date(0)));

      this.addRefreshTokenToResponse(res, refreshToken);

      return { user, accessToken };
    } catch (error) {
      if (error instanceof UnprocessableEntityException) throw error;

      if (error instanceof UnauthorizedException) throw error;

      if (error.code === 'P2002')
        throw new ConflictException('user already exists');

      this.logger.error('error during signup: ', error);

      throw new InternalServerErrorException('error during signup', error);
    }
  }

  async signin(res: Response, dto: SigninDto) {
    try {
      const { passwordHash, ...user } = await this.prisma.user.findUnique({
        where: { email: dto.email }
      });
      if (!user) throw new UnauthorizedException('credentials incorrect');

      const passwordMatches = await argon.verify(passwordHash, dto.password);
      if (!passwordMatches)
        throw new UnauthorizedException('credentials incorrect');

      const { accessToken, refreshToken } = await this.issueTokens(user.id);

      this.addRefreshTokenToResponse(res, refreshToken);

      return { user, accessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      this.logger.error('error during signin: ', error);

      throw new InternalServerErrorException('error during signin', error);
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.cookies;

      if (!refreshToken)
        throw new UnauthorizedException('invalid refresh token');

      const { id } = await this.jwt.verifyAsync(refreshToken);
      if (!id) throw new UnauthorizedException('invalid refresh token');

      const { passwordHash, ...user } = await this.prisma.user.findUnique({
        where: { id }
      });
      if (!user) throw new UnauthorizedException('invalid refresh token');

      const { accessToken, refreshToken: newRefreshToken } =
        await this.issueTokens(user.id);

      this.addRefreshTokenToResponse(res, newRefreshToken);

      return { user, accessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      this.logger.error('error during refresh: ', error);

      throw new InternalServerErrorException('error during refresh', error);
    }
  }

  logout(res: Response) {
    this.removeRefreshTokenFromResponse(res);
  }

  private async issueTokens(id: number) {
    const payload = { id };

    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: '30m'
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      expiresIn: '7d'
    });

    return { accessToken, refreshToken };
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

  private addRefreshTokenToResponse(res: Response, refreshToken: string) {
    const expiresIn = new Date();
    expiresIn.setDate(expiresIn.getDate() + 7);

    res.cookie('refreshToken', refreshToken, this.setCookieOptions(expiresIn));
  }

  private removeRefreshTokenFromResponse(res: Response) {
    res.cookie('refreshToken', '', this.setCookieOptions(new Date(0)));
  }
}
