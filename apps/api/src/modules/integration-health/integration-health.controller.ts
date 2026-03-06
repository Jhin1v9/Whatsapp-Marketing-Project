import { Body, Controller, Param, Post } from "@nestjs/common";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestContext } from "../../common/types/request-context";
import { IntegrationHealthService, type IntegrationProvider } from "./integration-health.service";

type IntegrationHealthPayload = {
  readonly appId?: string;
  readonly verifyToken?: string;
  readonly webhookUrl?: string;
  readonly accessToken?: string;
  readonly secretKey?: string;
  readonly reviewUrl?: string;
  readonly endpointUrl?: string;
};

@Controller("integrations/health")
export class IntegrationHealthController {
  constructor(private readonly integrationHealthService: IntegrationHealthService) {}

  @Post(":provider")
  @Roles("OWNER", "ADMIN", "MARKETING_MANAGER", "AGENT", "ANALYST")
  test(
    @CurrentContext() context: RequestContext,
    @Param("provider") provider: string,
    @Body() payload: IntegrationHealthPayload,
  ) {
    return this.integrationHealthService.testProvider(
      context,
      provider as IntegrationProvider,
      payload,
    );
  }
}

