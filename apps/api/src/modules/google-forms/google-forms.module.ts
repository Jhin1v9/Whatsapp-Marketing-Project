import { Module } from "@nestjs/common";
import { ContactsModule } from "../contacts/contacts.module";
import { GoogleFormsController } from "./google-forms.controller";
import { GoogleFormsService } from "./google-forms.service";

@Module({
  imports: [ContactsModule],
  controllers: [GoogleFormsController],
  providers: [GoogleFormsService],
})
export class GoogleFormsModule {}
