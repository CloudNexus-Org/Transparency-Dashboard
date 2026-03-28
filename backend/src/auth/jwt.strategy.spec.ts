// AI assisted development
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { JwtStrategy, type JwtPayload } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

describe('JwtStrategy', () => {
  it('constructor throws without JWT_SECRET', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const prisma = {} as PrismaService;
    expect(
      () => new JwtStrategy(config as unknown as ConfigService, prisma),
    ).toThrow('JWT_SECRET is required');
  });
});

describe('JwtStrategy validate', () => {
  const payload: JwtPayload = {
    sub: 'user-1',
    email: 'e@e.com',
    role: UserRole.CLIENT,
  };

  it('throws when user not in database', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const validate = JwtStrategy.prototype.validate.bind({
      prisma,
    } as unknown as JwtStrategy);
    await expect(validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('returns normalized payload', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'e@e.com',
          role: UserRole.ADMIN,
        }),
      },
    } as unknown as PrismaService;
    const validate = JwtStrategy.prototype.validate.bind({
      prisma,
    } as unknown as JwtStrategy);
    await expect(validate(payload)).resolves.toEqual({
      sub: 'user-1',
      email: 'e@e.com',
      role: UserRole.ADMIN,
    });
  });
});
