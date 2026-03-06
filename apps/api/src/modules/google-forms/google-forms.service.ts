import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { RequestContext } from "../../common/types/request-context";
import { ContactsService } from "../contacts/contacts.service";
import type { GoogleFormSubmissionDto } from "./dto/google-form-submission.dto";

type GoogleFormImportResult = {
  readonly contactId: string;
  readonly consentLogged: boolean;
  readonly normalizedPhoneNumber: string;
};

@Injectable()
export class GoogleFormsService {
  constructor(private readonly contactsService: ContactsService) {}

  importSubmission(
    context: RequestContext,
    payload: GoogleFormSubmissionDto,
    providedSecret?: string,
  ): GoogleFormImportResult {
    this.validateSecret(providedSecret);

    const normalizedPhoneNumber = this.normalizePhoneNumber(payload.phoneNumber ?? payload.phone);
    if (!normalizedPhoneNumber) {
      throw new BadRequestException("Phone number is required and must be valid");
    }

    const name = this.resolveName(payload);

    const contactPayload = {
      phoneNumber: normalizedPhoneNumber,
      firstName: name.firstName,
      tags: payload.tags ?? [],
      source: payload.source?.trim().length ? payload.source.trim() : "google_forms",
      ...(name.lastName ? { lastName: name.lastName } : {}),
    };

    const contact = this.contactsService.create(context, contactPayload);

    let consentLogged = false;
    if (payload.consentGranted) {
      const textVersion = payload.consentTextVersion?.trim();
      if (!textVersion) {
        throw new BadRequestException("consentTextVersion is required when consentGranted is true");
      }

      this.contactsService.addConsent(context, contact.id, {
        textVersion,
        source: "google_forms",
        proof: payload.consentProof?.trim().length ? payload.consentProof.trim() : "google_forms_submission",
        status: "GRANTED",
      });
      consentLogged = true;
    }

    return {
      contactId: contact.id,
      consentLogged,
      normalizedPhoneNumber,
    };
  }

  private validateSecret(providedSecret?: string): void {
    const expected = process.env.GOOGLE_FORMS_WEBHOOK_SECRET?.trim();
    if (!expected) {
      return;
    }

    if (!providedSecret || providedSecret !== expected) {
      throw new UnauthorizedException("Invalid Google Forms webhook secret");
    }
  }

  private resolveName(payload: GoogleFormSubmissionDto): { readonly firstName: string; readonly lastName?: string } {
    const firstName = payload.firstName?.trim();
    const lastName = payload.lastName?.trim();

    if (firstName) {
      return {
        firstName,
        ...(lastName ? { lastName } : {}),
      };
    }

    const fullName = payload.fullName?.trim();
    if (fullName) {
      const parts = fullName.split(/\s+/).filter((part) => part.length > 0);
      const first = parts[0] ?? "Lead";
      const rest = parts.slice(1).join(" ");
      return {
        firstName: first,
        ...(rest ? { lastName: rest } : {}),
      };
    }

    return { firstName: "Lead" };
  }

  private normalizePhoneNumber(input?: string): string | null {
    if (!input) {
      return null;
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");

    if (hasPlus) {
      if (!/^[1-9]\d{7,14}$/.test(digits)) {
        return null;
      }
      return `+${digits}`;
    }

    // Heuristic for BR local forms without country code.
    if (/^\d{10,11}$/.test(digits)) {
      return `+55${digits}`;
    }

    if (/^[1-9]\d{7,14}$/.test(digits)) {
      return `+${digits}`;
    }

    return null;
  }
}
