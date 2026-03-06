"use client";

import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { resolveActionIntent, routeByIntent } from "../lib/actionEngine";
import { exportContactsCsv, exportOperationalSnapshot, importContactsFromCsv, importContactsFromXlsx } from "../lib/quickActions";

type ActionEngine = {
  readonly busy: boolean;
  readonly status: string;
  readonly runAction: (label: string) => Promise<void>;
  readonly onCsvInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  readonly onXlsxInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  readonly triggerCsvInput: () => void;
  readonly triggerXlsxInput: () => void;
  readonly csvInputRef: RefObject<HTMLInputElement>;
  readonly xlsxInputRef: RefObject<HTMLInputElement>;
  readonly clearStatus: () => void;
};

export function useActionEngine(): ActionEngine {
  const router = useRouter();
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const xlsxInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const clearStatus = (): void => setStatus("");

  const triggerCsvInput = (): void => {
    csvInputRef.current?.click();
  };

  const triggerXlsxInput = (): void => {
    xlsxInputRef.current?.click();
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

  const runAction = async (label: string): Promise<void> => {
    const intent = resolveActionIntent(label);
    const route = routeByIntent(intent);

    if (intent === "refresh") {
      router.refresh();
      setStatus("Dados atualizados.");
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

    if (route) {
      router.push(route);
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
    triggerCsvInput,
    triggerXlsxInput,
    csvInputRef,
    xlsxInputRef,
    clearStatus,
  };
}
