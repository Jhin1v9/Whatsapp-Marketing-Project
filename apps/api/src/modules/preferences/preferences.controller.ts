import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestContext } from "../../common/types/request-context";
import type { PreferenceValue } from "./preferences.service";
import { PreferencesService } from "./preferences.service";

type SetPreferenceBody = {
  readonly value: PreferenceValue;
};

@Controller("me/preferences")
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get(":key")
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER", "ANALYST")
  getPreference(@CurrentContext() context: RequestContext, @Param("key") key: string) {
    return {
      key,
      value: this.preferencesService.get(context, key),
    };
  }

  @Put(":key")
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER", "ANALYST")
  setPreference(
    @CurrentContext() context: RequestContext,
    @Param("key") key: string,
    @Body() payload: SetPreferenceBody,
  ) {
    return {
      key,
      value: this.preferencesService.set(context, key, payload.value),
    };
  }
}
