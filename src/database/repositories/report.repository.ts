import { Repository, SelectQueryBuilder } from 'typeorm';
import { ReportEntity } from '../entities/report.entity';
import { IReportRepository } from '../../interfaces/report.repository.interface';
import { Report, ReportStatus, ReportSeverity, CreateReportDto } from '../../types/report.types';
import {
  FindOptions,
  PaginatedResponse,
  FilterParams,
  SortParams,
} from '../../types/utility.types';
import { AppDataSource } from '../config/database.config';
import { MetricsCollector } from '../../monitoring/metrics';
import { StructuredLogger } from '../../utils/structured-logger';

export class DatabaseReportRepository implements IReportRepository {
  private repository: Repository<ReportEntity>;
  private metricsCollector = MetricsCollector.getInstance();
  private logger = new StructuredLogger();

  constructor() {
    this.repository = AppDataSource.getRepository(ReportEntity);
  }

  private async executeWithMetrics<T>(operation: string, queryFn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    let success = true;

    try {
      const result = await queryFn();
      return result;
    } catch (error) {
      success = false;
      this.logger.error(`Database ${operation} failed`, error as Error, {
        operation,
        table: 'reports',
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.metricsCollector.recordDatabaseQuery(operation, 'reports', duration, success);
      this.logger.databaseQuery(operation, 'reports', duration);
    }
  }

  async create(data: CreateReportDto): Promise<Report> {
    return this.executeWithMetrics('CREATE', async () => {
      // Handle reproductionSteps conversion
      const reproductionSteps = Array.isArray(data.reproductionSteps) 
        ? data.reproductionSteps.join('\n') 
        : data.reproductionSteps;

      const entity = this.repository.create({
        title: data.title,
        description: data.description,
        url: data.url,
        severity: data.severity as ReportSeverity,
        reproductionSteps,
        expectedBehavior: data.expectedBehavior,
        actualBehavior: data.actualBehavior,
        tags: data.tags,
        metadata: data.metadata,
        submittedBy: 'system',
      });

      const savedEntity = await this.repository.save(entity);
      return this.entityToModel(savedEntity);
    });
  }

  async findById(id: string): Promise<Report | null> {
    return this.executeWithMetrics('SELECT_BY_ID', async () => {
      const entity = await this.repository.findOne({
        where: { id },
        cache: 30000, // 30 seconds
      });

      return entity ? this.entityToModel(entity) : null;
    });
  }

  async findAll(options?: FindOptions<Report>): Promise<PaginatedResponse<Report>> {
    return this.executeWithMetrics('SELECT_ALL', async () => {
      const queryBuilder = this.repository.createQueryBuilder('report');

      this.applyFilters(queryBuilder, options?.where);
      this.applySorting(queryBuilder, options?.orderBy);

      const page = options?.pagination?.page || 1;
      const limit = options?.pagination?.limit || 10;
      const offset = (page - 1) * limit;

      queryBuilder.skip(offset).take(limit);

      const [entities, total] = await queryBuilder.getManyAndCount();
      const items = entities.map((entity: ReportEntity) => this.entityToModel(entity));

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    });
  }

  async update(id: string, data: Partial<Report>): Promise<Report | null> {
    return this.executeWithMetrics('UPDATE', async () => {
      const existingEntity = await this.repository.findOne({ where: { id } });
      if (!existingEntity) return null;

      // Optimistic locking
      const updateData = {
        ...data,
        version: (existingEntity as any).version ? (existingEntity as any).version + 1 : 1,
        updatedAt: new Date(),
      };

      const result = await this.repository.update(
        { id, version: (existingEntity as any).version || 0 },
        updateData as any,
      );

      if (result.affected === 0) {
        throw new Error('Concurrent modification detected. Please refresh and try again.');
      }

      const updatedEntity = await this.repository.findOne({ where: { id } });
      return updatedEntity ? this.entityToModel(updatedEntity) : null;
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.executeWithMetrics('DELETE', async () => {
      const result = await this.repository.delete(id);
      return (result.affected ?? 0) > 0;
    });
  }

  async assign(id: string, assigneeId: string): Promise<Report | null> {
    return this.update(id, {
      assignedTo: assigneeId,
      status: ReportStatus.IN_PROGRESS,
    });
  }

  async findByStatus(status: ReportStatus, options?: FindOptions<Report>): Promise<Report[]> {
    const result = await this.findAll({
      ...options,
      where: { ...options?.where, status: { eq: status } },
    });
    return result.items;
  }

  async findByAssignee(assigneeId: string, options?: FindOptions<Report>): Promise<Report[]> {
    const result = await this.findAll({
      ...options,
      where: { ...options?.where, assignedTo: { eq: assigneeId } },
    });
    return result.items;
  }

  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<ReportStatus, number>;
    bySeverity: Record<string, number>;
  }> {
    const [total, statusStats, severityStats] = await Promise.all([
      this.repository.count(),
      this.repository
        .createQueryBuilder('report')
        .select('status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('status')
        .getRawMany(),
      this.repository
        .createQueryBuilder('report')
        .select('severity')
        .addSelect('COUNT(*)', 'count')
        .groupBy('severity')
        .getRawMany(),
    ]);

    const byStatus = statusStats.reduce(
      (acc: Record<ReportStatus, number>, stat: any) => {
        acc[stat.status as ReportStatus] = parseInt(stat.count);
        return acc;
      },
      {} as Record<ReportStatus, number>,
    );

    const bySeverity = severityStats.reduce(
      (acc: Record<string, number>, stat: any) => {
        acc[stat.severity] = parseInt(stat.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    return { total, byStatus, bySeverity };
  }

  async countByStatus(status: ReportStatus): Promise<number> {
    return this.executeWithMetrics('COUNT_BY_STATUS', async () => {
      return await this.repository.count({
        where: { status },
        cache: 30000, // 30 seconds
      });
    });
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<ReportEntity>,
    filters?: FilterParams<Report>,
  ): void {
    if (!filters) return;

    Object.entries(filters).forEach(([field, filter]) => {
      if (typeof filter === 'object' && filter !== null) {
        Object.entries(filter).forEach(([operator, value]) => {
          const paramName = `${field}_${operator}`;

          switch (operator) {
            case 'eq':
              queryBuilder.andWhere(`report.${field} = :${paramName}`, { [paramName]: value });
              break;
            case 'ne':
              queryBuilder.andWhere(`report.${field} != :${paramName}`, { [paramName]: value });
              break;
            case 'gt':
              queryBuilder.andWhere(`report.${field} > :${paramName}`, { [paramName]: value });
              break;
            case 'gte':
              queryBuilder.andWhere(`report.${field} >= :${paramName}`, { [paramName]: value });
              break;
            case 'lt':
              queryBuilder.andWhere(`report.${field} < :${paramName}`, { [paramName]: value });
              break;
            case 'lte':
              queryBuilder.andWhere(`report.${field} <= :${paramName}`, { [paramName]: value });
              break;
            case 'in':
              queryBuilder.andWhere(`report.${field} IN (:...${paramName})`, {
                [paramName]: value,
              });
              break;
            case 'like':
              queryBuilder.andWhere(`report.${field} ILIKE :${paramName}`, {
                [paramName]: `%${value}%`,
              });
              break;
          }
        });
      } else {
        // Simple equality filter
        queryBuilder.andWhere(`report.${field} = :${field}`, { [field]: filter });
      }
    });
  }

  private applySorting(
    queryBuilder: SelectQueryBuilder<ReportEntity>,
    sort?: SortParams<Report>,
  ): void {
    if (sort) {
      queryBuilder.orderBy(
        `report.${sort.sortBy as string}`,
        sort.sortOrder.toUpperCase() as 'ASC' | 'DESC',
      );
    } else {
      queryBuilder.orderBy('report.createdAt', 'DESC');
    }
  }

  private entityToModel(entity: ReportEntity): Report {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      url: entity.url,
      severity: entity.severity,
      status: entity.status,
      assignedTo: entity.assignedTo,
      submittedBy: entity.submittedBy,
      reproductionSteps: entity.reproductionSteps,
      expectedBehavior: entity.expectedBehavior,
      actualBehavior: entity.actualBehavior,
      tags: entity.tags,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      resolvedAt: entity.resolvedAt,
    };
  }
}
