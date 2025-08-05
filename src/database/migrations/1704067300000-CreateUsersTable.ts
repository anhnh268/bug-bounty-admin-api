import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUsersTable1704067300000 implements MigrationInterface {
  name = 'CreateUsersTable1704067300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'avatar',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['user', 'admin', 'triager'],
            default: "'user'",
            isNullable: false,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'lastLoginAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'preferences',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'version',
            type: 'integer',
            default: 1,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex('users', new TableIndex({
      name: 'IDX_users_email',
      columnNames: ['email'],
      isUnique: true
    }));

    // Insert default admin user
    await queryRunner.query(`
      INSERT INTO users (email, name, role, "isActive") 
      VALUES ('admin@bugbounty.com', 'System Admin', 'admin', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
