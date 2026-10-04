import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signAccessToken } from '../src/utils/jwt.js';

export const testPrisma = new PrismaClient();

export interface TestContext {
  adminUser: any;
  adminToken: string;
  trainer1User: any;
  trainer1Token: string;
  trainer2User: any;
  trainer2Token: string;
  trainee1User: any;
  trainee1Profile: any;
  trainee1Token: string;
  trainee2User: any;
  trainee2Profile: any;
  trainee2Token: string;
  batch1: any;
  batch2: any;
  topic1: any;
  session1: any;
  session2: any;
}

export async function seedTestDatabase(): Promise<TestContext> {
  // Clean tables
  await testPrisma.auditLog.deleteMany();
  await testPrisma.goal.deleteMany();
  await testPrisma.attendance.deleteMany();
  await testPrisma.result.deleteMany();
  await testPrisma.session.deleteMany();
  await testPrisma.topic.deleteMany();
  await testPrisma.trainee.deleteMany();
  await testPrisma.refreshToken.deleteMany();
  await testPrisma.batch.deleteMany();
  await testPrisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('testPassword123!', 10);

  // 1. Admin
  const adminUser = await testPrisma.user.create({
    data: {
      name: 'Test Admin',
      email: 'admin.test@forma.internal',
      passwordHash,
      role: Role.ADMIN,
    },
  });
  const adminToken = signAccessToken({
    userId: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    role: adminUser.role,
  });

  // 2. Trainer 1 & 2
  const trainer1User = await testPrisma.user.create({
    data: {
      name: 'Trainer One',
      email: 'trainer1.test@forma.internal',
      passwordHash,
      role: Role.TRAINER,
    },
  });
  const trainer1Token = signAccessToken({
    userId: trainer1User.id,
    email: trainer1User.email,
    name: trainer1User.name,
    role: trainer1User.role,
  });

  const trainer2User = await testPrisma.user.create({
    data: {
      name: 'Trainer Two',
      email: 'trainer2.test@forma.internal',
      passwordHash,
      role: Role.TRAINER,
    },
  });
  const trainer2Token = signAccessToken({
    userId: trainer2User.id,
    email: trainer2User.email,
    name: trainer2User.name,
    role: trainer2User.role,
  });

  // 3. Batches
  const now = new Date();
  const batch1 = await testPrisma.batch.create({
    data: {
      name: 'Batch Alpha (Trainer 1)',
      program: 'Web Engineering',
      trainerId: trainer1User.id,
      startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const batch2 = await testPrisma.batch.create({
    data: {
      name: 'Batch Beta (Trainer 2)',
      program: 'Data Engineering',
      trainerId: trainer2User.id,
      startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 4. Trainees
  const trainee1User = await testPrisma.user.create({
    data: {
      name: 'Trainee Alice',
      email: 'alice.test@forma.internal',
      passwordHash,
      role: Role.TRAINEE,
    },
  });
  const trainee1Profile = await testPrisma.trainee.create({
    data: {
      userId: trainee1User.id,
      batchId: batch1.id,
    },
  });
  const trainee1Token = signAccessToken({
    userId: trainee1User.id,
    email: trainee1User.email,
    name: trainee1User.name,
    role: trainee1User.role,
    traineeId: trainee1Profile.id,
    batchId: batch1.id,
  });

  const trainee2User = await testPrisma.user.create({
    data: {
      name: 'Trainee Bob',
      email: 'bob.test@forma.internal',
      passwordHash,
      role: Role.TRAINEE,
    },
  });
  const trainee2Profile = await testPrisma.trainee.create({
    data: {
      userId: trainee2User.id,
      batchId: batch2.id,
    },
  });
  const trainee2Token = signAccessToken({
    userId: trainee2User.id,
    email: trainee2User.email,
    name: trainee2User.name,
    role: trainee2User.role,
    traineeId: trainee2Profile.id,
    batchId: batch2.id,
  });

  // 5. Topics
  const topic1 = await testPrisma.topic.create({
    data: { name: 'Full-Stack JavaScript' },
  });

  // 6. Sessions
  const session1 = await testPrisma.session.create({
    data: {
      batchId: batch1.id,
      topicId: topic1.id,
      title: 'Session 1: Node & Express',
      heldOn: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      passMark: 70,
    },
  });

  const session2 = await testPrisma.session.create({
    data: {
      batchId: batch2.id,
      topicId: topic1.id,
      title: 'Session 2: SQL Basics',
      heldOn: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      passMark: 70,
    },
  });

  return {
    adminUser,
    adminToken,
    trainer1User,
    trainer1Token,
    trainer2User,
    trainer2Token,
    trainee1User,
    trainee1Profile,
    trainee1Token,
    trainee2User,
    trainee2Profile,
    trainee2Token,
    batch1,
    batch2,
    topic1,
    session1,
    session2,
  };
}
