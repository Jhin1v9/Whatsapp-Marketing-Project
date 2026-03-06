import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestContext } from "../../common/types/request-context";
import { CampaignsService } from "./campaigns.service";
import { ApproveCampaignDto } from "./dto/approve-campaign.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { GenerateAiDraftDto } from "./dto/generate-ai-draft.dto";
import { RunCampaignDto } from "./dto/run-campaign.dto";

@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @Roles("OWNER", "ADMIN", "MARKETING_MANAGER")
  create(@CurrentContext() context: RequestContext, @Body() payload: CreateCampaignDto) {
    return this.campaignsService.create(context, payload);
  }

  @Get()
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER", "ANALYST")
  list(@CurrentContext() context: RequestContext) {
    return this.campaignsService.list(context);
  }

  @Post(":campaignId/ai-drafts")
  @Roles("OWNER", "ADMIN", "MARKETING_MANAGER")
  generateAiDrafts(
    @CurrentContext() context: RequestContext,
    @Param("campaignId") campaignId: string,
    @Body() payload: GenerateAiDraftDto,
  ) {
    return this.campaignsService.generateAiDrafts(context, campaignId, payload);
  }

  @Post(":campaignId/approve")
  @Roles("OWNER", "ADMIN", "MARKETING_MANAGER")
  approve(
    @CurrentContext() context: RequestContext,
    @Param("campaignId") campaignId: string,
    @Body() payload: ApproveCampaignDto,
  ) {
    return this.campaignsService.approve(context, campaignId, payload);
  }

  @Post(":campaignId/run")
  @Roles("OWNER", "ADMIN", "MARKETING_MANAGER")
  run(
    @CurrentContext() context: RequestContext,
    @Param("campaignId") campaignId: string,
    @Body() payload: RunCampaignDto,
  ) {
    return this.campaignsService.run(context, campaignId, payload);
  }
}
