import { Module } from "@nestjs/common";
import { ContactsModule } from "../contacts/contacts.module";
import { MessagesModule } from "../messages/messages.module";
import { MetaWebhookController } from "./meta-webhook.controller";
import { MetaWebhookService } from "./meta-webhook.service";

@Module({
  imports: [ContactsModule, MessagesModule],
  controllers: [MetaWebhookController],
  providers: [MetaWebhookService],
})
export class MetaWebhookModule {}
