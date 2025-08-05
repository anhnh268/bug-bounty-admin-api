import { DataSource, DataSourceOptions } from 'typeorm';
import { ReportEntity } from '../entities/report.entity';
import { UserEntity } from '../entities/user.entity';

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

export const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || (isTest ? 'bug_bounty_test' : 'bug_bounty'),
  entities: [ReportEntity, UserEntity],
  migrations: ['src/database/migrations/*.ts'],
  migrationsRun: !isDevelopment,
  synchronize: isDevelopment || isTest,
  logging: isDevelopment ? ['query', 'error'] : ['error'],
  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : false,
  extra: {
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '600000'),
  },
  cache: {
    type: 'redis',
    options: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    },
    duration: 30000, // 30 seconds
  },
};

export const AppDataSource = new DataSource(databaseConfig);

export const initializeDatabase = async (): Promise<DataSource> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('Database connection initialized successfully');
    }
    return AppDataSource;
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('Database connection closed');
  }
};
