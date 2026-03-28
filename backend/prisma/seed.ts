// AI assisted development
import { PrismaClient, UserRole, RiskLevel } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('ChangeMeNow!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Internal Admin',
      role: UserRole.ADMIN,
      passwordHash,
    },
  });
  const client = await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: {},
    create: {
      email: 'client@example.com',
      name: 'Acme Client',
      role: UserRole.CLIENT,
      passwordHash,
    },
  });
  const p1 = await prisma.project.upsert({
    where: { id: 'seed-project-alpha' },
    update: {},
    create: {
      id: 'seed-project-alpha',
      name: 'Alpha Digital Workplace',
      description: 'Rollout of collaboration tools and governance.',
      startDate: new Date('2026-01-05'),
      targetEndDate: new Date('2026-06-30'),
      githubOwner: 'octocat',
      githubRepo: 'Hello-World',
    },
  });
  const p2 = await prisma.project.upsert({
    where: { id: 'seed-project-beta' },
    update: {},
    create: {
      id: 'seed-project-beta',
      name: 'Beta Data Platform',
      description: 'Analytics warehouse and reporting modernization.',
      startDate: new Date('2026-02-01'),
      targetEndDate: new Date('2026-09-15'),
    },
  });
  await prisma.projectMember.upsert({
    where: {
      userId_projectId: { userId: client.id, projectId: p1.id },
    },
    update: {},
    create: { userId: client.id, projectId: p1.id },
  });
  await prisma.riskSnapshot.deleteMany({ where: { projectId: p1.id } });
  await prisma.riskSnapshot.create({
    data: {
      projectId: p1.id,
      level: RiskLevel.MEDIUM,
      score: 32,
      factors: [
        {
          code: 'SAMPLE',
          message: 'Sample risk snapshot for charting.',
          weight: 10,
        },
      ],
    },
  });
  // eslint-disable-next-line no-console
  console.log('Seed complete.', { admin: admin.email, client: client.email });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
