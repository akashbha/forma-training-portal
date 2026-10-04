import { PrismaClient, Role, GoalScope, GoalMetric, AttendanceStatus, AuditAction } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seed with Goals, Attendance & Audit Logs...');
  const passwordHash = await bcrypt.hash('formaPassword123!', 10);

  // 1. Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@forma.internal' },
    update: { name: 'Dr. Evelyn Reed', passwordHash, role: Role.ADMIN },
    create: {
      email: 'admin@forma.internal',
      name: 'Dr. Evelyn Reed',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  // 2. Create 3 Trainers
  const trainersData = [
    { email: 'trainer.sarah@forma.internal', name: 'Sarah Connor', role: Role.TRAINER },
    { email: 'trainer.marcus@forma.internal', name: 'Marcus Vance', role: Role.TRAINER },
    { email: 'trainer.elena@forma.internal', name: 'Elena Rostova', role: Role.TRAINER },
  ];

  const trainers = await Promise.all(
    trainersData.map((t) =>
      prisma.user.upsert({
        where: { email: t.email },
        update: { name: t.name, passwordHash, role: t.role },
        create: {
          email: t.email,
          name: t.name,
          passwordHash,
          role: t.role,
        },
      })
    )
  );

  // 3. Create 6 Topics
  const topicNames = [
    'Python Programming',
    'SQL & Relational Databases',
    'React & Frontend Architecture',
    'Node.js & API Design',
    'Docker & Containerization',
    'CI/CD & Cloud Deployment',
  ];

  const topics = await Promise.all(
    topicNames.map((name) =>
      prisma.topic.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  // 4. Create 4 Batches
  const now = new Date();
  const fourMonthsAgo = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
  const oneMonthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const batchesData = [
    {
      name: 'FS-2026A: Full-Stack Web Immersion',
      program: 'Full-Stack Web Engineering',
      trainerId: trainers[0].id,
      startDate: fourMonthsAgo,
      endDate: oneMonthAhead,
    },
    {
      name: 'DE-2026A: Data Engineering & Analytics',
      program: 'Data & Analytics Engineering',
      trainerId: trainers[1].id,
      startDate: new Date(fourMonthsAgo.getTime() + 5 * 24 * 60 * 60 * 1000),
      endDate: oneMonthAhead,
    },
    {
      name: 'CA-2026A: Cloud Native Architecture',
      program: 'Cloud Architecture & DevOps',
      trainerId: trainers[2].id,
      startDate: new Date(fourMonthsAgo.getTime() + 10 * 24 * 60 * 60 * 1000),
      endDate: oneMonthAhead,
    },
    {
      name: 'RN-2026A: Mobile & React Native',
      program: 'Mobile Systems Engineering',
      trainerId: trainers[0].id,
      startDate: new Date(fourMonthsAgo.getTime() + 15 * 24 * 60 * 60 * 1000),
      endDate: oneMonthAhead,
    },
  ];

  const batches = [];
  for (const b of batchesData) {
    let batch = await prisma.batch.findFirst({
      where: { name: b.name },
    });
    if (batch) {
      batch = await prisma.batch.update({
        where: { id: batch.id },
        data: b,
      });
    } else {
      batch = await prisma.batch.create({
        data: b,
      });
    }
    batches.push(batch);
  }

  // 5. Create 40 Trainees (10 per batch)
  const traineeNames = [
    'Alex Rivera',
    'Beatrice Thorne',
    'Carlos Mendoza',
    'Diana Prince',
    'Evan Wright',
    'Fiona Gallagher',
    'George Clark',
    'Hannah Abbott',
    'Ian Malcolm',
    'Julia Roberts',
    'Kevin Flynn',
    'Laura Croft',
    'Michael Scott',
    'Nora Valkyrie',
    'Oliver Queen',
    'Pam Beesly',
    'Quinn Fabray',
    'Ron Weasley',
    'Samus Aran',
    'Tony Stark',
    'Uma Thurman',
    'Victor Stone',
    'Wanda Maximoff',
    'Xavier Thorpe',
    'Ygritte Snow',
    'Zack Fair',
    'Arthur Pendragon',
    'Buffy Summers',
    'Clint Barton',
    'Donna Noble',
    'Ethan Hunt',
    'Fox Mulder',
    'Gwen Stacy',
    'Harry Potter',
    'Iris West',
    'Jack Reacher',
    'Katniss Everdeen',
    'Luke Skywalker',
    'Monique Dubois',
    'Nathan Drake',
  ];

  const traineeRecords = [];
  for (let i = 0; i < traineeNames.length; i++) {
    const name = traineeNames[i];
    const email = `trainee.${name.toLowerCase().replace(/\s+/g, '.')}@forma.internal`;
    const batch = batches[Math.floor(i / 10)];

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, role: Role.TRAINEE },
      create: {
        email,
        name,
        passwordHash,
        role: Role.TRAINEE,
      },
    });

    const trainee = await prisma.trainee.upsert({
      where: { userId: user.id },
      update: { batchId: batch.id },
      create: { userId: user.id, batchId: batch.id },
    });

    traineeRecords.push({ user, trainee, archetypeIndex: i % 10 });
  }

  // 6. Create 8 Sessions per Batch over 4 months
  const sessionTemplates = [
    { title: 'Session 01: Core Syntax & Data Structures', topicOffset: 0 },
    { title: 'Session 02: Relational Schemas & Indexing', topicOffset: 1 },
    { title: 'Session 03: Component Lifecycles & State Management', topicOffset: 2 },
    { title: 'Session 04: RESTful APIs & Middleware Security', topicOffset: 3 },
    { title: 'Session 05: Container Build Optimization', topicOffset: 4 },
    { title: 'Session 06: Automated Test Suites & Code Coverage', topicOffset: 0 },
    { title: 'Session 07: Pipeline Integration & Deployment', topicOffset: 5 },
    { title: 'Session 08: Capstone Assessment & Performance Audit', topicOffset: 3 },
  ];

  let totalResults = 0;
  let totalAttendances = 0;

  for (let bIndex = 0; bIndex < batches.length; bIndex++) {
    const batch = batches[bIndex];
    const batchTrainees = traineeRecords.filter((_, idx) => Math.floor(idx / 10) === bIndex);

    for (let sIndex = 0; sIndex < sessionTemplates.length; sIndex++) {
      const tmpl = sessionTemplates[sIndex];
      const topic = topics[tmpl.topicOffset % topics.length];
      
      const heldOn = new Date(batch.startDate.getTime() + (sIndex * 13 + 3) * 24 * 60 * 60 * 1000);

      let session = await prisma.session.findFirst({
        where: { batchId: batch.id, title: tmpl.title },
      });

      if (session) {
        session = await prisma.session.update({
          where: { id: session.id },
          data: { topicId: topic.id, heldOn, passMark: 70 },
        });
      } else {
        session = await prisma.session.create({
          data: {
            batchId: batch.id,
            topicId: topic.id,
            title: tmpl.title,
            heldOn,
            passMark: 70,
          },
        });
      }

      // 7. Results and Attendance per Trainee
      for (const tRec of batchTrainees) {
        const archetype = tRec.archetypeIndex;
        let score = 75;
        let errors = 3;
        let timeSeconds = 2400; // 40 mins
        let notes: string | null = null;
        let attendanceStatus: AttendanceStatus = AttendanceStatus.PRESENT;

        if (archetype === 0) {
          // Steadily improving
          score = Math.min(100, Math.round(54 + sIndex * 5.8 + (Math.sin(sIndex) * 2)));
          errors = Math.max(0, Math.round(9 - sIndex * 1.1));
          timeSeconds = Math.round(3300 - sIndex * 190);
          notes = sIndex > 5 ? 'Exceptional improvement and mastery of edge cases.' : 'Solid effort, improving cadence.';
          attendanceStatus = sIndex === 2 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
        } else if (archetype === 1) {
          // Strong outlier / top performer
          score = Math.round(95 + (sIndex % 3) * 2);
          errors = sIndex % 4 === 0 ? 1 : 0;
          timeSeconds = 1450 + (sIndex % 3) * 60;
          notes = 'Exemplary execution, flawless architecture.';
          attendanceStatus = AttendanceStatus.PRESENT;
        } else if (archetype === 2) {
          // Carlos archetype: Struggling / high errors, correlated with absences
          score = Math.max(38, Math.round(80 - sIndex * 5.2 - (sIndex % 2) * 4));
          errors = Math.round(2 + sIndex * 1.5);
          timeSeconds = Math.round(2100 + sIndex * 180);
          notes = sIndex >= 4 ? 'Significant compilation & logic errors detected.' : 'Initial session completed.';
          if (sIndex === 3 || sIndex === 6) {
            attendanceStatus = AttendanceStatus.ABSENT;
          } else if (sIndex === 5) {
            attendanceStatus = AttendanceStatus.LATE;
          }
        } else if (archetype === 3) {
          // Declining
          score = Math.max(52, Math.round(89 - sIndex * 3.8));
          errors = Math.round(1 + sIndex * 0.8);
          timeSeconds = Math.round(2000 + sIndex * 110);
          notes = 'Pacing dropped in later modules.';
          if (sIndex === 4) attendanceStatus = AttendanceStatus.EXCUSED;
        } else if (archetype === 4) {
          // Flat steady
          score = 73 + ((sIndex * 3) % 6);
          errors = 3 + (sIndex % 2);
          timeSeconds = 2300 + (sIndex % 3) * 50;
          notes = 'Consistent performance aligned with baseline.';
        } else {
          const base = 68 + (archetype * 4);
          score = Math.min(96, Math.max(50, Math.round(base + Math.sin(sIndex + archetype) * 8)));
          errors = Math.max(0, Math.round(4 - Math.sin(sIndex) * 2));
          timeSeconds = Math.round(2200 + ((sIndex * archetype * 37) % 600));
          notes = score >= 85 ? 'High standard met.' : score < 70 ? 'Below pass mark; review suggested.' : null;
          if (archetype === 7 && sIndex === 4) attendanceStatus = AttendanceStatus.LATE;
        }

        await prisma.result.upsert({
          where: {
            sessionId_traineeId: {
              sessionId: session.id,
              traineeId: tRec.trainee.id,
            },
          },
          update: {
            score,
            errors,
            timeSeconds,
            notes,
          },
          create: {
            sessionId: session.id,
            traineeId: tRec.trainee.id,
            score,
            errors,
            timeSeconds,
            notes,
          },
        });
        totalResults++;

        await prisma.attendance.upsert({
          where: {
            sessionId_traineeId: {
              sessionId: session.id,
              traineeId: tRec.trainee.id,
            },
          },
          update: {
            status: attendanceStatus,
          },
          create: {
            sessionId: session.id,
            traineeId: tRec.trainee.id,
            status: attendanceStatus,
          },
        });
        totalAttendances++;
      }
    }
  }

  // 8. Create Goals (Batch, Topic, Trainee)
  const dueDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

  const goalsToSeed = [
    {
      scope: GoalScope.BATCH,
      scopeId: batches[0].id,
      metric: GoalMetric.SCORE,
      targetValue: 88.0,
      dueDate,
      createdBy: admin.id,
    },
    {
      scope: GoalScope.BATCH,
      scopeId: batches[1].id,
      metric: GoalMetric.ERRORS,
      targetValue: 2.0,
      dueDate,
      createdBy: trainers[1].id,
    },
    {
      scope: GoalScope.BATCH,
      scopeId: batches[2].id,
      metric: GoalMetric.TIME,
      targetValue: 2100,
      dueDate,
      createdBy: trainers[2].id,
    },
    {
      scope: GoalScope.TOPIC,
      scopeId: topics[2].id, // React & Frontend Architecture
      metric: GoalMetric.SCORE,
      targetValue: 85.0,
      dueDate,
      createdBy: admin.id,
    },
    {
      scope: GoalScope.TRAINEE,
      scopeId: traineeRecords[0].trainee.id, // Alex Rivera
      metric: GoalMetric.SCORE,
      targetValue: 90.0,
      dueDate,
      createdBy: trainers[0].id,
    },
    {
      scope: GoalScope.TRAINEE,
      scopeId: traineeRecords[2].trainee.id, // Carlos Mendoza
      metric: GoalMetric.ERRORS,
      targetValue: 3.0,
      dueDate,
      createdBy: trainers[0].id,
    },
  ];

  for (const g of goalsToSeed) {
    const existing = await prisma.goal.findFirst({
      where: { scope: g.scope, scopeId: g.scopeId, metric: g.metric },
    });
    if (!existing) {
      await prisma.goal.create({ data: g });
    }
  }

  // 9. Create Initial Audit Log Entries
  const auditLogs = [
    {
      actorId: admin.id,
      action: AuditAction.LOGIN,
      entity: 'Auth',
      entityId: admin.id,
      after: JSON.stringify({ email: admin.email, role: 'ADMIN' }),
      ip: '127.0.0.1',
    },
    {
      actorId: admin.id,
      action: AuditAction.CREATE,
      entity: 'Batch',
      entityId: batches[0].id,
      after: JSON.stringify({ name: batches[0].name, program: batches[0].program }),
      ip: '127.0.0.1',
    },
    {
      actorId: trainers[0].id,
      action: AuditAction.CREATE,
      entity: 'Goal',
      entityId: traineeRecords[0].trainee.id,
      after: JSON.stringify({ scope: 'TRAINEE', targetValue: 90, metric: 'SCORE' }),
      ip: '127.0.0.1',
    },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: log });
  }

  console.log('\n================================================================');
  console.log('✅ SEED COMPLETED SUCCESSFULLY');
  console.log(`- 1 Admin: ${admin.email}`);
  console.log(`- ${trainers.length} Trainers`);
  console.log(`- ${batches.length} Batches`);
  console.log(`- ${topics.length} Topics`);
  console.log(`- ${traineeRecords.length} Trainees`);
  console.log(`- ${totalResults} Results seeded`);
  console.log(`- ${totalAttendances} Attendance records seeded`);
  console.log(`- ${goalsToSeed.length} Goals seeded with progress tracking`);
  console.log(`- ${auditLogs.length} Audit log transactions registered`);
  console.log('----------------------------------------------------------------');
  console.log('🔑 CREDENTIALS FOR TESTING:');
  console.log('  Password for all seed accounts: formaPassword123!');
  console.log('  Admin:   admin@forma.internal');
  console.log('  Trainer: trainer.sarah@forma.internal');
  console.log('  Trainer: trainer.marcus@forma.internal');
  console.log('  Trainer: trainer.elena@forma.internal');
  console.log('  Trainee: trainee.alex.rivera@forma.internal');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
