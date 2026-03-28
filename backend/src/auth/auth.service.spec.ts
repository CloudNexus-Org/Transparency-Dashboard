// AI assisted development
import {
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import axios from 'axios';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let jwt: jest.Mocked<Pick<JwtService, 'sign'>>;
  let config: jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    jwt = { sign: jest.fn().mockReturnValue('jwt-token') };

    config = {
      get: jest.fn(),
    } as unknown as jest.Mocked<Pick<ConfigService, 'get'>>;

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  describe('validateUser', () => {
    it('returns null when user missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.validateUser('a@b.com', 'password'),
      ).resolves.toBeNull();
    });

    it('returns null when no password hash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        passwordHash: null,
        role: UserRole.CLIENT,
      } as never);
      await expect(
        service.validateUser('a@b.com', 'x'),
      ).resolves.toBeNull();
    });

    it('returns null when password wrong', async () => {
      const hash = await bcrypt.hash('right', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        passwordHash: hash,
        role: UserRole.CLIENT,
      } as never);
      await expect(
        service.validateUser('a@b.com', 'wrong'),
      ).resolves.toBeNull();
    });

    it('returns user when password ok', async () => {
      const hash = await bcrypt.hash('secretpass', 4);
      const user = {
        id: 'u1',
        email: 'a@b.com',
        passwordHash: hash,
        role: UserRole.ADMIN,
      };
      prisma.user.findUnique.mockResolvedValue(user as never);
      await expect(
        service.validateUser('a@b.com', 'secretpass'),
      ).resolves.toEqual(user);
    });
  });

  describe('login', () => {
    it('throws when invalid', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);
      await expect(
        service.login({ email: 'a@b.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens when valid', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue({
        id: 'u1',
        email: 'e@e.com',
        role: UserRole.CLIENT,
        name: 'N',
      } as never);
      const out = await service.login({
        email: 'e@e.com',
        password: 'p',
      });
      expect(out.accessToken).toBe('jwt-token');
      expect(out.user).toMatchObject({
        id: 'u1',
        email: 'e@e.com',
        role: UserRole.CLIENT,
        name: 'N',
      });
      expect(jwt.sign).toHaveBeenCalled();
    });
  });

  describe('issueTokens', () => {
    it('includes name in user payload', () => {
      const out = service.issueTokens(
        'id',
        'e@e.com',
        UserRole.ADMIN,
        'Alice',
      );
      expect(out.user.name).toBe('Alice');
    });
  });

  describe('getMicrosoftLoginUrl', () => {
    it('throws when oauth not configured', () => {
      config.get.mockImplementation((key: string, def?: string) => {
        if (key === 'MICROSOFT_TENANT_ID') {
          return def ?? 'common';
        }
        return undefined;
      });
      expect(() => service.getMicrosoftLoginUrl()).toThrow(BadRequestException);
    });

    it('returns authorize URL', () => {
      config.get.mockImplementation((key: string, def?: string) => {
        const map: Record<string, string> = {
          MICROSOFT_TENANT_ID: 'tenant',
          MICROSOFT_CLIENT_ID: 'cid',
          MICROSOFT_REDIRECT_URI: 'https://app/cb',
        };
        return map[key] ?? def;
      });
      const url = service.getMicrosoftLoginUrl();
      expect(url).toContain('login.microsoftonline.com/tenant/oauth2/v2.0/authorize');
      expect(url).toContain('client_id=cid');
    });
  });

  describe('handleMicrosoftCallback', () => {
    it('throws when secrets missing', async () => {
      config.get.mockReturnValue(undefined);
      await expect(service.handleMicrosoftCallback('code')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('upserts user with ADMIN default role when env set', async () => {
      config.get.mockImplementation((key: string, def?: string) => {
        const map: Record<string, string> = {
          MICROSOFT_TENANT_ID: 't',
          MICROSOFT_CLIENT_ID: 'cid',
          MICROSOFT_CLIENT_SECRET: 'sec',
          MICROSOFT_REDIRECT_URI: 'https://cb',
          MICROSOFT_DEFAULT_ROLE: 'ADMIN',
        };
        return map[key] ?? def;
      });
      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'ms-token' },
      } as never);
      mockedAxios.get.mockResolvedValue({
        data: {
          id: 'ms-2',
          userPrincipalName: 'upn@x.com',
          displayName: 'Admin User',
        },
      } as never);
      prisma.user.upsert.mockResolvedValue({
        id: 'db-admin',
        email: 'upn@x.com',
        role: UserRole.ADMIN,
        name: 'Admin User',
      } as never);
      const out = await service.handleMicrosoftCallback('code');
      expect(out.user.role).toBe(UserRole.ADMIN);
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ role: UserRole.ADMIN }),
        }),
      );
    });

    it('upserts user and returns tokens', async () => {
      config.get.mockImplementation((key: string, def?: string) => {
        const map: Record<string, string> = {
          MICROSOFT_TENANT_ID: 't',
          MICROSOFT_CLIENT_ID: 'cid',
          MICROSOFT_CLIENT_SECRET: 'sec',
          MICROSOFT_REDIRECT_URI: 'https://cb',
        };
        return map[key] ?? def;
      });
      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'ms-token' },
      } as never);
      mockedAxios.get.mockResolvedValue({
        data: {
          id: 'ms-sub',
          mail: 'user@contoso.com',
          userPrincipalName: 'upn',
          displayName: 'DN',
        },
      } as never);
      prisma.user.upsert.mockResolvedValue({
        id: 'db-id',
        email: 'user@contoso.com',
        role: UserRole.CLIENT,
        name: 'DN',
      } as never);

      const out = await service.handleMicrosoftCallback('auth-code');
      expect(out.accessToken).toBe('jwt-token');
      expect(prisma.user.upsert).toHaveBeenCalled();
    });

    it('prefers mail but falls back to userPrincipalName', async () => {
      config.get.mockImplementation((key: string, def?: string) => {
        const map: Record<string, string> = {
          MICROSOFT_TENANT_ID: 't',
          MICROSOFT_CLIENT_ID: 'cid',
          MICROSOFT_CLIENT_SECRET: 'sec',
          MICROSOFT_REDIRECT_URI: 'https://cb',
        };
        return map[key] ?? def;
      });
      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'ms-token' },
      } as never);
      mockedAxios.get.mockResolvedValue({
        data: {
          id: 'ms-3',
          userPrincipalName: 'only-upn@x.com',
          displayName: undefined,
        },
      } as never);
      prisma.user.upsert.mockResolvedValue({
        id: 'id',
        email: 'only-upn@x.com',
        role: UserRole.CLIENT,
        name: 'only-upn@x.com',
      } as never);
      await service.handleMicrosoftCallback('c');
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            email: 'only-upn@x.com',
            name: 'only-upn@x.com',
          }),
        }),
      );
    });
  });

  describe('me', () => {
    it('throws when user missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.me('x')).rejects.toThrow(UnauthorizedException);
    });

    it('returns profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'e@e.com',
        role: UserRole.CLIENT,
        name: 'X',
      } as never);
      await expect(service.me('1')).resolves.toEqual({
        id: '1',
        email: 'e@e.com',
        role: UserRole.CLIENT,
        name: 'X',
      });
    });
  });
});
