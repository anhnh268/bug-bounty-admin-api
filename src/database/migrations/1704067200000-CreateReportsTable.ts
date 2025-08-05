import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateReportsTable1704067200000 implements MigrationInterface {
  name = 'CreateReportsTable1704067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'severity',
            type: 'enum',
            enum: ['low', 'medium', 'high', 'critical'],
            default: "'low'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['open', 'in_progress', 'resolved', 'closed'],
            default: "'open'",
            isNullable: false,
          },
          {
            name: 'assignedTo',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'submittedBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'reproductionSteps',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'expectedBehavior',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'actualBehavior',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'metadata',
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
            name: 'resolvedAt',
            type: 'timestamptz',
            isNullable: true,
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

    // Create indexes for better query performance
    await queryRunner.createIndex('reports', new TableIndex({
      name: 'IDX_reports_title',
      columnNames: ['title']
    }));

    await queryRunner.createIndex('reports', new TableIndex({
      name: 'IDX_reports_status',
      columnNames: ['status']
    }));

    await queryRunner.createIndex('reports', new TableIndex({
      name: 'IDX_reports_assignedTo',
      columnNames: ['assignedTo']
    }));

    await queryRunner.createIndex('reports', new TableIndex({
      name: 'IDX_reports_submittedBy',
      columnNames: ['submittedBy']
    }));

    await queryRunner.createIndex('reports', new TableIndex({
      name: 'IDX_reports_status_createdAt',
      columnNames: ['status', 'createdAt']
    }));

    await queryRunner.createIndex('reports', new TableIndex({
      name: 'IDX_reports_severity_status',
      columnNames: ['severity', 'status']
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reports');
  }
}
