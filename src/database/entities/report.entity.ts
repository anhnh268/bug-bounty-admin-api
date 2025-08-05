import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ReportStatus, ReportSeverity } from '../../types/report.types';

@Entity('reports')
@Index(['status', 'createdAt'])
@Index(['severity', 'status'])
@Index(['assignedTo'])
export class ReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url?: string;

  @Column({
    type: 'enum',
    enum: ReportSeverity,
    default: ReportSeverity.LOW,
  })
  severity!: ReportSeverity;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  @Index()
  status!: ReportStatus;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  assignedTo?: string;

  @Column({ type: 'uuid' })
  @Index()
  submittedBy!: string;

  @Column({ type: 'text', nullable: true })
  reproductionSteps?: string;

  @Column({ type: 'text', nullable: true })
  expectedBehavior?: string;

  @Column({ type: 'text', nullable: true })
  actualBehavior?: string;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'integer', default: 1 })
  version!: number;
}
