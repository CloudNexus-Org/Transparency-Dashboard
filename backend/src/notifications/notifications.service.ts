// AI assisted development
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!n) {
      return null;
    }
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async createForProjectMembers(
    projectId: string,
    type: string,
    title: string,
    body: string,
  ) {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
    });
    for (const m of members) {
      await this.prisma.notification.create({
        data: {
          userId: m.userId,
          projectId,
          type,
          title,
          body,
        },
      });
    }
  }

  async notifyAdmins(type: string, title: string, body: string) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
    });
    for (const a of admins) {
      await this.prisma.notification.create({
        data: { userId: a.id, type, title, body },
      });
    }
  }
}
