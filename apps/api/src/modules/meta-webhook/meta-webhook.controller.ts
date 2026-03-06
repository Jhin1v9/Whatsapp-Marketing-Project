import { Body, Controller, Get, Headers, Post, Query, Req } from "@nestjs/common";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { ContextRequest, RequestContext } from "../../common/types/request-context";
import { MetaWebhookService, type MetaWebhookPayload } from "./meta-webhook.service";

@Controller("integrations/meta")
export class MetaWebhookController {
  constructor(private readonly metaWebhookService: MetaWebhookService) {}

  @Get("webhook")
  verify(
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") verifyToken?: string,
    @Query("hub.challenge") challenge?: string,
  ) {
    return this.metaWebhookService.verifyChallenge(mode, verifyToken, challenge);
  }

  @Post("webhook")
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER", "ANALYST")
  incoming(
    @CurrentContext() context: RequestContext,
    @Body() payload: MetaWebhookPayload,
    @Req() request: ContextRequest,
    @Headers("x-hub-signature-256") signature?: string,
  ) {
    return this.metaWebhookService.processIncoming(context, payload, request.rawBody, signature);
  }
}
