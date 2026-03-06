import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { RequestContextMiddleware } from "./common/middleware/request-context.middleware";
import { TenantGuard } from "./common/guards/tenant.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { AuthModule } from "./modules/auth/auth.module";
import { AuditModule } from "./modules/audit/audit.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { GoogleFormsModule } from "./modules/google-forms/google-forms.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { QueueModule } from "./modules/queue/queue.module";
import { RateLimitModule } from "./modules/rate-limit/rate-limit.module";
import { CampaignsModule } from "./modules/campaigns/campaigns.module";
import { MetaWebhookModule } from "./modules/meta-webhook/meta-webhook.module";
import { ComplianceModule } from "./modules/compliance/compliance.module";
import { PreferencesModule } from "./modules/preferences/preferences.module";
import { IntegrationHealthModule } from "./modules/integration-health/integration-health.module";

@Module({
  imports: [
    AuthModule,
    AuditModule,
    ContactsModule,
    GoogleFormsModule,
    MessagesModule,
    QueueModule,
    RateLimitModule,
    CampaignsModule,
    MetaWebhookModule,
    ComplianceModule,
    PreferencesModule,
    IntegrationHealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
