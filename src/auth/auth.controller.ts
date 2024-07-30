import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { EmailDto } from './dto';

@Controller('/api/v1/')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/auth/signup/send-email')
  @HttpCode(200)
  sendEmail(@Body() dto: EmailDto) {
    return this.authService.sendEmail(dto);
  }
}
