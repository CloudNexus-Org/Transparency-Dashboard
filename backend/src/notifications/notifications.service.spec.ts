// AI assisted development
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let prisma: {
    notification: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    projectMember: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      projectMember: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
    };
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  it('listForUser delegates to prisma', async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: '1' }]);
    await expect(service.listForUser('u1')).resolves.toEqual([{ id: '1' }]);
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('markRead returns null when not found', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);
    await expect(service.markRead('u1', 'n1')).resolves.toBeNull();
  });

  it('markRead updates when found', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
    prisma.notification.update.mockResolvedValue({ id: 'n1', read: true });
    await expect(service.markRead('u1', 'n1')).resolves.toEqual({
      id: 'n1',
      read: true,
    });
  });

  it('createForProjectMembers creates per member', async () => {
    prisma.projectMember.findMany.mockResolvedValue([
      { userId: 'a', projectId: 'p' },
      { userId: 'b', projectId: 'p' },
    ]);
    prisma.notification.create.mockResolvedValue({});
    await service.createForProjectMembers('p', 'T', 'title', 'body');
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it('notifyAdmins creates for each admin', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'ad1' }, { id: 'ad2' }]);
    prisma.notification.create.mockResolvedValue({});
    await service.notifyAdmins('A', 't', 'b');
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });
});
