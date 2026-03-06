import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestContext } from "../../common/types/request-context";
import { ContactsService } from "./contacts.service";
import { CreateConsentDto } from "./dto/create-consent.dto";
import { CreateContactDto } from "./dto/create-contact.dto";
import { ImportXlsxDto } from "./dto/import-xlsx.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER")
  create(@CurrentContext() context: RequestContext, @Body() payload: CreateContactDto) {
    return this.contactsService.create(context, payload);
  }

  @Post("import-xlsx")
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER")
  importXlsx(@CurrentContext() context: RequestContext, @Body() payload: ImportXlsxDto) {
    return this.contactsService.importFromXlsx(context, payload);
  }

  @Get()
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER", "ANALYST")
  list(@CurrentContext() context: RequestContext) {
    return this.contactsService.list(context);
  }

  @Get(":contactId")
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER", "ANALYST")
  details(@CurrentContext() context: RequestContext, @Param("contactId") contactId: string) {
    return this.contactsService.details(context, contactId);
  }

  @Patch(":contactId")
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER")
  update(
    @CurrentContext() context: RequestContext,
    @Param("contactId") contactId: string,
    @Body() payload: UpdateContactDto,
  ) {
    return this.contactsService.update(context, contactId, payload);
  }

  @Post(":contactId/consents")
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER")
  addConsent(
    @CurrentContext() context: RequestContext,
    @Param("contactId") contactId: string,
    @Body() payload: CreateConsentDto,
  ) {
    return this.contactsService.addConsent(context, contactId, payload);
  }

  @Patch(":contactId/opt-out")
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER")
  optOut(@CurrentContext() context: RequestContext, @Param("contactId") contactId: string) {
    return this.contactsService.optOut(context, contactId);
  }
}
