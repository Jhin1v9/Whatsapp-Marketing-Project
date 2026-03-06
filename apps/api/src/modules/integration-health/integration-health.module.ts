import { Module } from "@nestjs/common";
import { IntegrationHealthController } from "./integration-health.controller";
import { IntegrationHealthService } from "./integration-health.service";

@Module({
  controllers: [IntegrationHealthController],
  providers: [IntegrationHealthService],
})
export class IntegrationHealthModule {}

