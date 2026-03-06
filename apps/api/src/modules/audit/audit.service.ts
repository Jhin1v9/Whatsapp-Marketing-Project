import { Injectable } from "@nestjs/common";

type AuditMetadata = {
  readonly requestId: string;
  readonly role: string;
};

export type AuditRecordInput = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly metadata: AuditMetadata;
};

export type AuditRecord = AuditRecordInput & {
  readonly id: string;
  readonly createdAt: string;
};

@Injectable()
export class AuditService {
  private readonly records: AuditRecord[] = [];

  record(input: AuditRecordInput): AuditRecord {
    const item: AuditRecord = {
      ...input,
      id: `audit_${this.records.length + 1}`,
      createdAt: new Date().toISOString(),
    };
    this.records.unshift(item);
    return item;
  }

  listByTenant(tenantId: string): readonly AuditRecord[] {
    return this.records.filter((item) => item.tenantId === tenantId);
  }
}
