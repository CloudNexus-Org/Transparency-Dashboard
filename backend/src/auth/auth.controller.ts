// AI assisted development
import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }

  @Get('microsoft')
  microsoftLogin(@Res() res: Response) {
    const url = this.auth.getMicrosoftLoginUrl();
    return res.redirect(url);
  }

  @Get('microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    if (error || !code) {
      return res.redirect(`${frontend}/login?error=oauth`);
    }
    const tokens = await this.auth.handleMicrosoftCallback(code);
    const q = new URLSearchParams({ token: tokens.accessToken });
    return res.redirect(`${frontend}/auth/callback?${q.toString()}`);
  }
}
