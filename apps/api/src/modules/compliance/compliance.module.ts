import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ContactsModule } from "../contacts/contacts.module";
import { MessagesModule } from "../messages/messages.module";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";

@Module({
  imports: [ContactsModule, MessagesModule, AuditModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
})
export class ComplianceModule {}
