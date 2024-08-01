import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CodeDto, EmailDto, SigninDto, SignupDto } from './dto';
import { Request, Response } from 'express';

@Controller('/api/v1/')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/auth/signup/send-email')
  @HttpCode(200)
  sendEmail(@Res({ passthrough: true }) res: Response, @Body() dto: EmailDto) {
    return this.authService.sendEmail(res, dto);
  }

  @Post('/auth/signup/code-verification')
  @HttpCode(200)
  codeVerification(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: CodeDto
  ) {
    return this.authService.codeVerification(req, res, dto);
  }

  @Post('/auth/signup')
  @HttpCode(200)
  signup(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: SignupDto
  ) {
    return this.authService.signup(req, res, dto);
  }

  @Post('/auth/signin')
  @HttpCode(200)
  signin(@Res({ passthrough: true }) res: Response, @Body() dto: SigninDto) {
    return this.authService.signin(res, dto);
  }

  @Post('/auth/refresh')
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.refresh(req, res);
  }
}
