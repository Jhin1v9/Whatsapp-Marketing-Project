import { Module } from "@nestjs/common";
import { ContactsModule } from "../contacts/contacts.module";
import { MessagesModule } from "../messages/messages.module";
import { QueueModule } from "../queue/queue.module";
import { RateLimitModule } from "../rate-limit/rate-limit.module";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";

@Module({
  imports: [ContactsModule, MessagesModule, QueueModule, RateLimitModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
