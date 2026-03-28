// AI assisted development
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';
import { LoginDto } from './dto/login.dto';
import axios from 'axios';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      return null;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return null;
    }
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user.id, user.email, user.role, user.name);
  }

  issueTokens(
    userId: string,
    email: string,
    role: UserRole,
    name?: string | null,
  ) {
    const payload: JwtPayload = { sub: userId, email, role };
    const accessToken = this.jwt.sign(payload);
    return {
      accessToken,
      user: { id: userId, email, role, name: name ?? null },
    };
  }

  getMicrosoftLoginUrl(): string {
    const tenant = this.config.get<string>('MICROSOFT_TENANT_ID', 'common');
    const clientId = this.config.get<string>('MICROSOFT_CLIENT_ID');
    const redirectUri = this.config.get<string>('MICROSOFT_REDIRECT_URI');
    if (!clientId || !redirectUri) {
      throw new BadRequestException('Microsoft OAuth is not configured');
    }
    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'User.Read',
    ].join(' ');
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: scopes,
    });
    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async handleMicrosoftCallback(code: string) {
    const tenant = this.config.get<string>('MICROSOFT_TENANT_ID', 'common');
    const clientId = this.config.get<string>('MICROSOFT_CLIENT_ID');
    const clientSecret = this.config.get<string>('MICROSOFT_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('MICROSOFT_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Microsoft OAuth is not configured');
    }
    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const tokenRes = await axios.post<{
      access_token: string;
      id_token?: string;
    }>(tokenUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const accessToken = tokenRes.data.access_token;
    const graphProfile = await axios.get<{
      id: string;
      mail?: string;
      userPrincipalName: string;
      displayName?: string;
    }>('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const email =
      graphProfile.data.mail ?? graphProfile.data.userPrincipalName;
    const microsoftSub = graphProfile.data.id;
    const name = graphProfile.data.displayName ?? email;
    const envRole = this.config.get<string>('MICROSOFT_DEFAULT_ROLE');
    const defaultRole =
      envRole === 'ADMIN' ? UserRole.ADMIN : UserRole.CLIENT;
    const user = await this.prisma.user.upsert({
      where: { microsoftSub },
      create: {
        email,
        name,
        microsoftSub,
        role: defaultRole,
      },
      update: { email, name },
    });
    return this.issueTokens(user.id, user.email, user.role, user.name);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, name: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
