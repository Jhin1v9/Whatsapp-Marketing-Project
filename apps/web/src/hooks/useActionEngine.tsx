"use client";

import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { resolveActionIntent, routeByIntent } from "../lib/actionEngine";
import { exportContactsCsv, exportOperationalSnapshot, importContactsFromCsv, importContactsFromVcf, importContactsFromXlsx } from "../lib/quickActions";
import { setUserPreference } from "../lib/apiClient";

type ActionEngine = {
  readonly busy: boolean;
  readonly status: string;
  readonly runAction: (label: string) => Promise<void>;
  readonly onCsvInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  readonly onXlsxInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  readonly onVcfInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  readonly triggerCsvInput: () => void;
  readonly triggerXlsxInput: () => void;
  readonly triggerVcfInput: () => void;
  readonly csvInputRef: RefObject<HTMLInputElement>;
  readonly xlsxInputRef: RefObject<HTMLInputElement>;
  readonly vcfInputRef: RefObject<HTMLInputElement>;
  readonly clearStatus: () => void;
};

export function useActionEngine(): ActionEngine {
  const router = useRouter();
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const xlsxInputRef = useRef<HTMLInputElement | null>(null);
  const vcfInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const clearStatus = (): void => setStatus("");

  const createIcsAndDownload = (): void => {
    const now = new Date();
    const later = new Date(now.getTime() + 30 * 60 * 1000);
    const toUtcStamp = (value: Date): string =>
      value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//WhatsApp Marketing SaaS//Agenda//PT-BR",
      "BEGIN:VEVENT",
      `UID:agenda-${now.getTime()}@whatsapp-marketing-project`,
      `DTSTAMP:${toUtcStamp(now)}`,
      `DTSTART:${toUtcStamp(now)}`,
      `DTEND:${toUtcStamp(later)}`,
      "SUMMARY:Follow-up comercial",
      "DESCRIPTION:Evento exportado pelo painel de agenda.",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `agenda-${now.toISOString().slice(0, 10)}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const triggerCsvInput = (): void => {
    csvInputRef.current?.click();
  };

  const triggerXlsxInput = (): void => {
    xlsxInputRef.current?.click();
  };

  const triggerVcfInput = (): void => {
    vcfInputRef.current?.click();
  };

  const onCsvInputChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus(`Importando ${file.name}...`);

    try {
      const result = await importContactsFromCsv(file);
      setStatus(`Importacao concluida: ${result.created} criados, ${result.failed} falhas.`);
      router.refresh();
    } catch (error) {
      setStatus(`Falha na importacao CSV: ${String(error)}`);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const onXlsxInputChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus(`Importando ${file.name}...`);
    try {
      const result = await importContactsFromXlsx(file);
      const updated = result.updated ?? 0;
      setStatus(`Importacao XLSX concluida: ${result.created} criados, ${updated} atualizados, ${result.failed} falhas.`);
      router.refresh();
    } catch (error) {
      setStatus(`Falha na importacao XLSX: ${String(error)}`);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const onVcfInputChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus(`Importando ${file.name}...`);
    try {
      const result = await importContactsFromVcf(file);
      const updated = result.updated ?? 0;
      setStatus(`Importacao VCF concluida: ${result.created} criados, ${updated} atualizados, ${result.failed} falhas.`);
      router.refresh();
    } catch (error) {
      setStatus(`Falha na importacao VCF: ${String(error)}`);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const runAction = async (label: string): Promise<void> => {
    const intent = resolveActionIntent(label);
    const route = routeByIntent(intent);

    if (intent === "refresh") {
      router.refresh();
      setStatus("Dados atualizados.");
      return;
    }

    if (intent === "go_back") {
      router.back();
      setStatus("Voltando para a tela anterior.");
      return;
    }

    if (intent === "import_csv") {
      triggerCsvInput();
      return;
    }

    if (intent === "import_xlsx") {
      triggerXlsxInput();
      return;
    }

    if (intent === "import_vcf") {
      triggerVcfInput();
      return;
    }

    if (intent === "export_csv") {
      setBusy(true);
      setStatus("Gerando CSV...");
      try {
        const total = await exportContactsCsv();
        setStatus(`CSV exportado com ${total} contatos.`);
      } catch (error) {
        setStatus(`Falha ao exportar CSV: ${String(error)}`);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (intent === "export_json") {
      setBusy(true);
      setStatus("Gerando snapshot...");
      try {
        const result = await exportOperationalSnapshot();
        setStatus(`Snapshot pronto (${result.contacts} contatos, ${result.campaigns} campanhas, ${result.messages} mensagens).`);
      } catch (error) {
        setStatus(`Falha ao exportar snapshot: ${String(error)}`);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (intent === "export_ical") {
      createIcsAndDownload();
      setStatus("Arquivo iCal exportado.");
      return;
    }

    if (intent === "share_link") {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setStatus("Link da pagina copiado.");
      } catch {
        setStatus("Nao foi possivel copiar o link automaticamente.");
      }
      return;
    }

    if (intent === "save_checkpoint") {
      try {
        const key = `checkpoint_${window.location.pathname.replaceAll("/", "_") || "home"}`;
        await setUserPreference(key, {
          action: label,
          savedAt: new Date().toISOString(),
        });
        setStatus(`Estado salvo para "${label}".`);
      } catch (error) {
        setStatus(`Falha ao salvar estado: ${String(error)}`);
      }
      return;
    }

    if (intent === "open_google") {
      window.open("https://calendar.google.com", "_blank", "noopener,noreferrer");
      setStatus("Google Calendar aberto em nova aba.");
      return;
    }

    if (route) {
      router.push(route);
      setStatus(`Abrindo: ${label}`);
      return;
    }

    setStatus(`Acao "${label}" ainda sem fluxo dedicado.`);
  };

  return {
    busy,
    status,
    runAction,
    onCsvInputChange,
    onXlsxInputChange,
    onVcfInputChange,
    triggerCsvInput,
    triggerXlsxInput,
    triggerVcfInput,
    csvInputRef,
    xlsxInputRef,
    vcfInputRef,
    clearStatus,
  };
}
