import { AppDataSource, initializeDatabase } from '../config/database.config';
import { ReportEntity } from '../entities/report.entity';
import { UserEntity, UserRole } from '../entities/user.entity';
import { ReportStatus, ReportSeverity } from '../../types/report.types';

const seedUsers = async () => {
  const userRepository = AppDataSource.getRepository(UserEntity);

  const users = [
    {
      email: 'admin@bugbounty.com',
      name: 'System Administrator',
      role: UserRole.ADMIN,
      isActive: true,
    },
    {
      email: 'triager@bugbounty.com',
      name: 'Bug Triager',
      role: UserRole.TRIAGER,
      isActive: true,
    },
    {
      email: 'user@bugbounty.com',
      name: 'Regular User',
      role: UserRole.USER,
      isActive: true,
    },
  ];

  for (const userData of users) {
    const existingUser = await userRepository.findOne({ where: { email: userData.email } });
    if (!existingUser) {
      const user = userRepository.create(userData);
      await userRepository.save(user);
      console.log(`Created user: ${userData.email}`);
    }
  }
};

const seedReports = async () => {
  const reportRepository = AppDataSource.getRepository(ReportEntity);
  const userRepository = AppDataSource.getRepository(UserEntity);

  const adminUser = await userRepository.findOne({ where: { email: 'admin@bugbounty.com' } });
  const triagerUser = await userRepository.findOne({ where: { email: 'triager@bugbounty.com' } });
  const regularUser = await userRepository.findOne({ where: { email: 'user@bugbounty.com' } });

  if (!adminUser || !triagerUser || !regularUser) {
    throw new Error('Required users not found for seeding reports');
  }

  const reports = [
    {
      title: 'SQL Injection in User Login',
      description: 'The login endpoint is vulnerable to SQL injection attacks.',
      url: 'https://example.com/login',
      severity: ReportSeverity.CRITICAL,
      status: ReportStatus.PENDING,
      submittedBy: regularUser.id,
      reproductionSteps:
        '1. Navigate to login page\n2. Enter malicious SQL payload\n3. Observe database error',
      expectedBehavior: 'Login should fail with generic error message',
      actualBehavior: 'Database error message reveals internal structure',
      tags: ['sql-injection', 'authentication', 'security'],
    },
    {
      title: 'XSS Vulnerability in Comments',
      description: 'User comments are not properly sanitized, allowing XSS attacks.',
      url: 'https://example.com/comments',
      severity: ReportSeverity.HIGH,
      status: ReportStatus.IN_PROGRESS,
      assignedTo: triagerUser.id,
      submittedBy: regularUser.id,
      reproductionSteps:
        '1. Post a comment with JavaScript payload\n2. View the comment\n3. Script executes',
      expectedBehavior: 'Script tags should be escaped or removed',
      actualBehavior: 'JavaScript code executes in browser',
      tags: ['xss', 'frontend', 'security'],
    },
    {
      title: 'Insecure Direct Object Reference',
      description: "Users can access other users' data by manipulating IDs in URLs.",
      url: 'https://example.com/profile',
      severity: ReportSeverity.MEDIUM,
      status: ReportStatus.RESOLVED,
      assignedTo: triagerUser.id,
      submittedBy: regularUser.id,
      resolvedAt: new Date(Date.now() - 86400000), // 1 day ago
      reproductionSteps:
        "1. Login as user A\n2. Navigate to /profile/123\n3. Change ID to different user ID\n4. Access other user's profile",
      expectedBehavior: 'Should show access denied or redirect to own profile',
      actualBehavior: "Shows other user's private information",
      tags: ['idor', 'authorization', 'security'],
    },
    {
      title: 'Missing Rate Limiting on API',
      description: 'API endpoints lack proper rate limiting, allowing brute force attacks.',
      url: 'https://api.example.com/auth',
      severity: ReportSeverity.MEDIUM,
      status: ReportStatus.PENDING,
      submittedBy: regularUser.id,
      reproductionSteps:
        '1. Send multiple requests to /auth endpoint\n2. No rate limiting applied\n3. Can attempt brute force',
      expectedBehavior: 'Rate limiting should be applied after X requests',
      actualBehavior: 'Unlimited requests allowed',
      tags: ['rate-limiting', 'api', 'security'],
    },
    {
      title: 'Sensitive Data in JavaScript',
      description: 'API keys and sensitive configuration exposed in client-side JavaScript.',
      url: 'https://example.com/app.js',
      severity: ReportSeverity.HIGH,
      status: ReportStatus.RESOLVED,
      assignedTo: adminUser.id,
      submittedBy: regularUser.id,
      resolvedAt: new Date(Date.now() - 172800000), // 2 days ago
      reproductionSteps: '1. View page source\n2. Check app.js file\n3. Find exposed API keys',
      expectedBehavior: 'Sensitive data should not be in client-side code',
      actualBehavior: 'API keys visible in JavaScript bundle',
      tags: ['data-exposure', 'frontend', 'security'],
    },
  ];

  for (const reportData of reports) {
    const existingReport = await reportRepository.findOne({ where: { title: reportData.title } });
    if (!existingReport) {
      const report = reportRepository.create(reportData);
      await reportRepository.save(report);
      console.log(`Created report: ${reportData.title}`);
    }
  }
};

export const runSeeders = async () => {
  try {
    await initializeDatabase();

    console.log('Starting database seeding...');

    await seedUsers();
    await seedReports();

    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Error during database seeding:', error);
    throw error;
  }
};

// Run seeders if this file is executed directly
if (require.main === module) {
  runSeeders()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
