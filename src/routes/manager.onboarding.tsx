import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Store, User, MapPin, FileText, Banknote, Percent, Check, ChevronRight, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ImageUploader } from "@/components/cravio/ImageUploader";
import type { ImageRef } from "@/lib/image-service";
import { listTable } from "@/lib/insforge-crud";
import { cn } from "@/lib/format";
import { getDisplayName } from "@/lib/identity-utils";
import {
  useManager,
  saveOnboardingDraft,
  logOnboardingEvent,
  nextRstCode,
  provisionAccount,
  onboardingStatus,
  ONBOARDING_LABEL,
  ONBOARDING_TONE,
  type ManagedRestaurant,
} from "@/lib/manager-api";
import { submitDoc, fetchDocs, RESTAURANT_DOCS } from "@/lib/verification-api";
import { useAuth } from "@/lib/auth-store";
import { logDuplicateCheck, nextBranchCode } from "@/lib/duplicate-api";
import { requestOwnershipTransfer } from "@/lib/transfers-api";
import { DuplicateDialog, useDuplicateCheck, type DuplicateChoice } from "@/components/cravio/DuplicateCheck";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { insforge } from "@/lib/insforge";

type Search = { id?: string };

export const Route = createFileRoute("/manager/onboarding")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · Onboard a restaurant" },
      { name: "description", content: "Collect restaurant, owner, location, document and payout details." },
    ],
  }),
  component: OnboardingFlow,
});

const STEPS = [
  { key: "business", title: "Restaurant details", icon: Store },
  { key: "owner", title: "Owner & contact", icon: User },
  { key: "location", title: "Location & hours", icon: MapPin },
  { key: "docs", title: "Documents & branding", icon: FileText },
  { key: "bank", title: "Bank & compliance", icon: Banknote },
  { key: "terms", title: "Delivery & commission", icon: Percent },
];

type Form = {
  name: string;
  cuisine: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  city: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  opening_time: string;
  closing_time: string;
  logo_url: string;
  cover_url: string;
  documents: { label: string; url: string }[];
  gst_number: string;
  fssai_number: string;
  pan_number: string;
  aadhaar_number: string;
  bank_holder: string;
  bank_account: string;
  bank_ifsc: string;
  bank_name: string;
  cancelled_cheque_ref: string;
  branch_name: string;
  delivery_radius: string;
  commission: string;
  has_cover: boolean;
  has_gallery: boolean;
};

const EMPTY: Form = {
  name: "", cuisine: "", owner_name: "", owner_email: "", owner_phone: "",
  contact_phone: "", contact_email: "", address: "", city: "", pincode: "",
  latitude: null, longitude: null, opening_time: "10:00", closing_time: "23:00",
  logo_url: "", cover_url: "", documents: [],
  gst_number: "", fssai_number: "", pan_number: "", aadhaar_number: "",
  bank_holder: "", bank_account: "", bank_ifsc: "", bank_name: "",
  cancelled_cheque_ref: "",
  branch_name: "", delivery_radius: "5", commission: "20",
  has_cover: false, has_gallery: false,
};

const DOC_SLOTS = ["FSSAI licence", "GST certificate", "Owner ID proof", "Bank account proof", "Cancelled cheque"];

function OnboardingFlow() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { manager, loading: managerLoading } = useManager();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [record, setRecord] = useState<ManagedRestaurant | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const dup = useDuplicateCheck();
  const [dupOpen, setDupOpen] = useState(false);
  const { user, hydrationComplete } = useAuth();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listTable<ManagedRestaurant>("restaurants", { id: `eq.${id}`, limit: 1 }, { fresh: true });
        const r = rows[0];
        if (cancelled || !r) { setLoading(false); return; }
        setRecord(r);
        const docs = Array.isArray((r as any).documents) ? ((r as any).documents as Form["documents"]) : [];
        const hasGallery = docs.some(d => d.label === "Gallery / Guest Image");
        const coverUrl = (r as any).cover_url || (r as any).cover_image || "";
        
        setForm({
          ...EMPTY,
          name: r.name ?? "",
          cuisine: r.cuisine ?? "",
          owner_name: r.owner_name ?? "",
          owner_email: r.owner_email ?? "",
          owner_phone: r.owner_phone ?? "",
          contact_phone: r.contact_phone ?? "",
          contact_email: r.contact_email ?? "",
          address: r.address ?? "",
          city: r.city ?? "",
          pincode: r.pincode ?? "",
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
          opening_time: r.opening_time ?? "10:00",
          closing_time: r.closing_time ?? "23:00",
          logo_url: (r as any).logo_url || (r as any).logo || "",
          cover_url: coverUrl,
          documents: docs,
          bank_holder: r.bank_holder ?? "",
          bank_account: r.bank_account ?? "",
          bank_ifsc: r.bank_ifsc ?? "",
          bank_name: r.bank_name ?? "",
          gst_number: r.gst_number ?? "",
          fssai_number: r.fssai_number ?? "",
          pan_number: "", 
          aadhaar_number: "",
          cancelled_cheque_ref: "",
          branch_name: "",
          delivery_radius: String(r.delivery_radius ?? 5),
          commission: String(r.commission ?? 20),
          has_cover: !!coverUrl,
          has_gallery: hasGallery,
        });
        // Load compliance identifiers from restaurant_kyc
        try {
          const kycRows = await fetchDocs("restaurant", r.id);
          const panRow = kycRows.find(row => row.doc_type === 'pan');
          const aadhaarRow = kycRows.find(row => row.doc_type === 'aadhaar');
          const chqRow = kycRows.find(row => row.doc_type === 'cancelled_cheque');
          
          setForm(prev => ({
            ...prev,
            pan_number: panRow?.doc_number || "",
            aadhaar_number: aadhaarRow?.doc_number || "",
            cancelled_cheque_ref: chqRow?.doc_number || "",
          }));
        } catch (kycErr) {
          console.error("[LOAD_KYC_ERROR]", kycErr);
        }

        setLoading(false);
      } catch (err: any) {
        console.error("[LOAD_ERROR]", err);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const payload = useMemo(
    () => ({
      name: form.name.trim(),
      cuisine: form.cuisine.trim() || null,
      owner_name: form.owner_name.trim() || null,
      owner_email: form.owner_email.trim().toLowerCase() || null,
      owner_phone: form.owner_phone.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      contact_email: form.contact_email.trim().toLowerCase() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      pincode: form.pincode.trim() || null,
      latitude: form.latitude,
      longitude: form.longitude,
      opening_time: form.opening_time || null,
      closing_time: form.closing_time || null,
      logo_url: form.logo_url || null,
      cover_url: form.cover_url || null,
      documents: form.documents,
      bank_holder: form.bank_holder.trim() || null,
      bank_account: form.bank_account.trim() || null,
      bank_ifsc: form.bank_ifsc.trim().toUpperCase() || null,
      bank_name: form.bank_name.trim() || null,
      gst_number: form.gst_number.trim().toUpperCase() || null,
      fssai_number: form.fssai_number.trim() || null,
      pan_number: form.pan_number.trim().toUpperCase(),
      aadhaar_number: form.aadhaar_number.trim(),
      cancelled_cheque_ref: form.cancelled_cheque_ref.trim(),
      delivery_radius: Number(form.delivery_radius) || 5,
      commission: Number(form.commission) || 20,
      manager_id: manager?.id ?? null,
      onboarded_by: manager?.id ?? null,
    }),
    [form, manager?.id],
  );

  const persist = async (extra: Record<string, unknown>, statusLabel: string) => {
    if (!form.name.trim()) {
      toast.error("Restaurant name is required");
      return null;
    }
    
    // Authoritative manager resolution before write
    const { requireAuthenticatedInsforgeUser } = await import("@/lib/insforge");
    let authoritativeManagerId: string;
    
    try {
      authoritativeManagerId = await requireAuthenticatedInsforgeUser();
    } catch (err: any) {
      console.error("[ONBOARDING_SUBMIT] Auth resolution failed:", err);
      toast.error(err.message || "Your manager session has expired. Please sign in again.");
      return null;
    }

    setBusy(true);
    try {
      // 1. Await all doc slots that are currently uploading (ImageUploader handles individual states)
      // For Scoobix, we assume if the URL is in form, the upload finished or we're using the existing one.
      
      const rst = record?.rst_code || (await nextRstCode());
      console.info(`[ONBOARDING_SUBMIT] Persisting record. RST: ${rst}, Manager: ${authoritativeManagerId}`);
      
      // 1. Authorize and Save main restaurant record
      const { pan_number, aadhaar_number, cancelled_cheque_ref, ...sanitizedPayload } = payload;
      if (!form.has_cover) (sanitizedPayload as any).cover_url = null;
      (sanitizedPayload as any).documents = form.documents;
      (sanitizedPayload as any).logo_url = form.logo_url;
      
      const saved = await saveOnboardingDraft(record?.id ?? id ?? null, {
        ...sanitizedPayload,
        rst_code: rst,
        manager_id: authoritativeManagerId,
        onboarded_by: authoritativeManagerId,
        ...extra,
      });

      if (saved && saved.id) {
        setRecord(saved);
        if (id !== saved.id) {
          navigate({ to: "/manager/onboarding", search: { id: saved.id }, replace: true });
        }

        // 2. Authoritatively persist documents to Verification table (restaurant_kyc)
        // This ensures the Admin Verification centre sees them.
        try {
          const currentKyc = await fetchDocs("restaurant", saved.id);
          const docPromises = RESTAURANT_DOCS.map(async (def) => {
            const formLine = form.documents.find(d => d.label === def.label);
            const existingRow = currentKyc.find(r => r.doc_type === def.type);
            
            // Map form fields to doc numbers
            let docNumber: string | null = null;
            if (def.type === 'fssai') docNumber = form.fssai_number;
            if (def.type === 'pan') docNumber = form.pan_number;
            if (def.type === 'bank_account') docNumber = form.bank_account;
            if (def.type === 'aadhaar') docNumber = form.aadhaar_number;
            if (def.type === 'gst') docNumber = form.gst_number;
            if (def.type === 'cancelled_cheque') docNumber = form.cancelled_cheque_ref;

            // Save if we have a URL OR if we have a number that needs updating
            // RELIABLE REPAIR: Always upsert if a value exists, matching the Admin Verification requirement
            if (formLine?.url || docNumber) {
              await submitDoc(
                "restaurant",
                saved.id,
                def,
                { 
                  file_url: formLine?.url || existingRow?.file_url || null,
                  doc_number: docNumber || existingRow?.doc_number || null
                },
                existingRow || null,
                { id: authoritativeManagerId, name: manager?.name, role: "manager" }
              );
            }
          });
          await Promise.all(docPromises);
        } catch (docErr) {
          console.error("[ONBOARDING_SUBMIT] KYC persistence failed:", docErr);
          // Don't fail the whole flow if docs fail, but log it
        }

        await logOnboardingEvent({
          restaurantId: saved.id,
          managerId: authoritativeManagerId,
          status: String(extra.onboarding_status ?? "draft"),
          note: statusLabel,
        });
      }
      return saved;
    } catch (err: any) {
      console.error("[ONBOARDING_SUBMIT_ERROR]", err);
      toast.error(err.message || "Failed to save restaurant details");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    const missingDocs = form.documents.length < DOC_SLOTS.length;
    const saved = await persist(
      { onboarding_status: missingDocs ? "document_pending" : "draft", status: "pending" },
      missingDocs ? "Saved with documents pending" : "Draft saved",
    );
    if (saved) toast.success(`Draft saved · ${saved.rst_code}`);
  };

  const candidate = useMemo(
    () => ({
      restaurantId: record?.id ?? id ?? null,
      name: form.name,
      phone: form.owner_phone || form.contact_phone,
      email: form.owner_email || form.contact_email,
      gst: form.gst_number,
      fssai: form.fssai_number,
      pan: form.pan_number,
      bankAccount: form.bank_account,
      latitude: form.latitude,
      longitude: form.longitude,
      address: [form.address, form.city].filter(Boolean).join(", "),
      city: form.city,
    }),
    [form, record?.id, id],
  );

  const finalizeSubmit = async (extra: Record<string, unknown> = {}) => {
    if (busy) return;
    setBusy(true);
    
    try {
      console.info("[ONBOARDING_SUBMIT] Provisioning restaurant account:", form.owner_email);
      const account = await provisionAccount({
        email: form.owner_email,
        name: form.owner_name || form.name,
        phone: form.owner_phone,
        role: "RESTAURANT",
      });

      if (!account.ok) {
        console.error("[ONBOARDING_SUBMIT] Account provision failed:", account.message);
        toast.error(account.message ?? "Could not create the restaurant account");
        return;
      }

      const userId = account.userId;
      if (!userId) {
        console.error("[ONBOARDING_SUBMIT] Account created but userId missing in result object");
        toast.error("Account created without an identifier. Please contact support.");
        return;
      }

      console.info("[ONBOARDING_SUBMIT] Account provisioned. ID:", userId);

      const saved = await persist(
        {
          onboarding_status: "submitted",
          status: "pending",
          owner_id: userId,
          submitted_at: new Date().toISOString(),
          ...extra,
        },
        "Submitted for admin approval",
      );


      if (!saved || !saved.id) {
        console.error("[ONBOARDING_SUBMIT] Final persist failed or returned no ID");
        return;
      }


      console.info("[ONBOARDING_SUBMIT] Success:", saved.rst_code);
      toast.success(`Submitted · ${saved.rst_code}`, {
        description: `Your application has been submitted successfully for admin approval. Owner login: ${form.owner_email} · temporary password ${account.password}`,
        duration: 12000,
      });
      navigate({ to: "/manager/restaurants", search: { id: saved.id } });
    } catch (err: any) {
      console.error("[ONBOARDING_SUBMIT_FATAL]", err);
      toast.error("A fatal error occurred during submission. Please check your internet connection.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!form.owner_email.trim()) {
      toast.error("Owner email is required to create the restaurant account");
      return;
    }
    if (form.documents.length < DOC_SLOTS.length) {
      toast.error("Upload all required documents before submitting");
      return;
    }
    setBusy(true);
    const res = await dup.run(candidate);
    setBusy(false);
    if (res.level === "none") {
      await logDuplicateCheck({
        candidate,
        result: res,
        restaurantId: record?.id ?? id ?? null,
        attemptedBy: manager?.id ?? null,
        attemptedByName: manager?.name ?? null,
        action: "submit",
        decision: "clear",
      });
      await finalizeSubmit();
      return;
    }
    setDupOpen(true);
  };

  const resolveDuplicate = async (choice: DuplicateChoice) => {
    const res = dup.result;
    if (!res) return;
    const log = (action: string, justification?: string, decision?: string) =>
      logDuplicateCheck({
        candidate,
        result: res,
        restaurantId: record?.id ?? id ?? null,
        attemptedBy: manager?.id ?? null,
        attemptedByName: manager?.name ?? null,
        action,
        justification,
        decision,
      });

    if (choice.kind === "cancel") {
      await log("cancelled", undefined, "cancelled_by_manager");
      setDupOpen(false);
      toast.info("Onboarding cancelled — the duplicate check was logged.");
      return;
    }

    if (choice.kind === "report") {
      await log("reported", choice.reason, "pending");
      setDupOpen(false);
      toast.success("Duplicate listing reported to admin.");
      return;
    }

    if (choice.kind === "transfer") {
      await log("transfer_requested", choice.reason, "pending");
      const created = await requestOwnershipTransfer({
        restaurant: {
          id: choice.match.id,
          name: choice.match.name,
          rst_code: choice.match.rst_code,
          manager_id: choice.match.manager_id,
          manager_name: choice.match.manager_name,
        },
        toManager: manager ? { id: manager.id, name: manager.name ?? null } : null,
        requestedBy: manager?.id ?? null,
        requestedByName: manager?.name ?? null,
        reason: choice.reason,
      });
      setDupOpen(false);
      toast[created ? "success" : "error"](
        created ? "Ownership transfer requested — admin will review it." : "Could not send the transfer request",
      );
      return;
    }

    if (choice.kind === "branch") {
      await log("continued_as_branch", choice.justification, "pending");
      const parent = choice.match;
      const branchCode = await nextBranchCode({ id: parent.id, rst_code: parent.rst_code });
      setDupOpen(false);
      await finalizeSubmit({
        is_branch: true,
        parent_restaurant_id: parent.id,
        branch_code: branchCode,
        branch_name: form.branch_name.trim() || form.city.trim() || form.name.trim(),
        duplicate_flag: "branch_pending",
      });
      return;
    }

    // continue with justification
    await log("continued", choice.justification, "pending");
    setDupOpen(false);
    await finalizeSubmit({ duplicate_flag: `flagged_${dup.result?.level ?? "possible"}` });
  };


  const StepIcon = STEPS[step].icon;
  const last = step === STEPS.length - 1;
  const current = record ? onboardingStatus(record) : "draft";

  if (loading || (managerLoading && !manager)) {
    return (
      <div className="mx-auto max-w-[520px] px-5 py-20 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Initializing manager session...</p>
      </div>
    );
  }

  if (!manager && hydrationComplete) {
    return (
      <div className="mx-auto max-w-[520px] px-5 py-20 text-center">
        <h2 className="text-xl font-bold">Manager access required</h2>
        <p className="mt-2 text-muted-foreground">You must be logged in as a Merchant Manager to access this page.</p>
        <Button className="mt-6 rounded-full" onClick={() => navigate({ to: "/login", search: { portal: "manager" } })}>
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[520px] pb-8">
      <PageHeader
        title={record?.name || getDisplayName(user) || "New restaurant"}
        subtitle={record?.rst_code ?? "ID assigned on first save"}
        right={
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${ONBOARDING_TONE[current]}`}>
            {ONBOARDING_LABEL[current]}
          </span>
        }
      />

      <div className="px-5 pt-4">
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              className={cn("h-1.5 flex-1 rounded-full transition-all", i <= step ? "bg-primary" : "bg-foreground/10")}
              aria-label={s.title}
            />
          ))}
        </div>

        <div className="mt-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          <StepIcon className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">{STEPS[step].title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Step {step + 1} of {STEPS.length} · everything is saved to your Scoobix account.
        </p>

        <div className="mt-5 space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          {step === 0 && (
            <>
              <Field label="Restaurant name" value={form.name} onChange={(v) => set({ name: v })} placeholder="Trattoria Verde" />
              <Field label="Branch / outlet name (optional)" value={form.branch_name} onChange={(v) => set({ branch_name: v })} placeholder="Indiranagar outlet" />
              <Field label="Cuisine" value={form.cuisine} onChange={(v) => set({ cuisine: v })} placeholder="Italian · Pizza · Pasta" />
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Owner name" value={form.owner_name} onChange={(v) => set({ owner_name: v })} placeholder="Marco Bianchi" />
              <Field label="Owner email (becomes the login)" value={form.owner_email} onChange={(v) => set({ owner_email: v })} placeholder="owner@restaurant.com" />
              <Field label="Owner phone" value={form.owner_phone} onChange={(v) => set({ owner_phone: v })} placeholder="+91 98xxxxxx02" />
              <Field label="Support phone" value={form.contact_phone} onChange={(v) => set({ contact_phone: v })} placeholder="+91 98xxxxxx03" />
              <Field label="Support email" value={form.contact_email} onChange={(v) => set({ contact_email: v })} placeholder="hello@restaurant.com" />
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Street address" value={form.address} onChange={(v) => set({ address: v })} placeholder="12 Hearth Lane" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" value={form.city} onChange={(v) => set({ city: v })} placeholder="Mumbai" />
                <Field label="Pincode" value={form.pincode} onChange={(v) => set({ pincode: v })} placeholder="400001" />
              </div>
                <LocationPicker
                  latitude={form.latitude}
                  longitude={form.longitude}
                  address={form.address}
                  onChange={(lat: number, lng: number, addr: string) => set({ latitude: lat, longitude: lng, address: addr })}
                />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Opens at" value={form.opening_time} onChange={(v) => set({ opening_time: v })} placeholder="10:00" />
                <Field label="Closes at" value={form.closing_time} onChange={(v) => set({ closing_time: v })} placeholder="23:00" />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <ImageUploader
                type="logo"
                label="Restaurant Logo"
                value={form.logo_url ? ({ image_url: form.logo_url } as ImageRef) : null}
                onChange={(ref) => set({ logo_url: ref?.image_url ?? "" })}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-secondary/30 p-4 ring-1 ring-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Cover image</Label>
                    <p className="text-[11px] text-muted-foreground text-wrap max-w-[200px]">Optional landscape photo for the restaurant header.</p>
                  </div>
                  <button
                    onClick={() => set({ has_cover: !form.has_cover })}
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                      form.has_cover ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  >
                    <span className={cn(
                      "absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform",
                      form.has_cover ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>
                {form.has_cover && (
                  <ImageUploader
                    type="cover"
                    label="Cover image"
                    aspect="aspect-[16/9]"
                    value={form.cover_url ? ({ image_url: form.cover_url } as ImageRef) : null}
                    onChange={(ref) => set({ cover_url: ref?.image_url ?? "" })}
                  />
                )}

                <div className="flex items-center justify-between rounded-2xl bg-secondary/30 p-4 ring-1 ring-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Guest / Gallery image</Label>
                    <p className="text-[11px] text-muted-foreground text-wrap max-w-[200px]">Optional photo of the dining area or guest experience.</p>
                  </div>
                  <button
                    onClick={() => set({ has_gallery: !form.has_gallery })}
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                      form.has_gallery ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  >
                    <span className={cn(
                      "absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform",
                      form.has_gallery ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>
                {form.has_gallery && (
                  <ImageUploader
                    type="banner"
                    label="Gallery / Guest Image"
                    aspect="aspect-[16/10]"
                    value={form.documents.find(d => d.label === "Gallery / Guest Image") ? ({ image_url: form.documents.find(d => d.label === "Gallery / Guest Image")?.url } as ImageRef) : null}
                    onChange={(ref) =>
                      set({
                        documents: ref?.image_url
                          ? [...form.documents.filter((d) => d.label !== "Gallery / Guest Image"), { label: "Gallery / Guest Image", url: ref.image_url }]
                          : form.documents.filter((d) => d.label !== "Gallery / Guest Image"),
                      })
                    }
                  />
                )}
              </div>

              <div className="mt-6 space-y-3">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">Required documents</Label>
                {DOC_SLOTS.map((label) => {
                  const doc = form.documents.find((d) => d.label === label);
                  return (
                    <ImageUploader
                      key={label}
                      type="banner"
                      label={label}
                      aspect="aspect-[16/10]"
                      value={doc ? ({ image_url: doc.url } as ImageRef) : null}
                      onChange={(ref) =>
                        set({
                          documents: ref?.image_url
                            ? [...form.documents.filter((d) => d.label !== label), { label, url: ref.image_url }]
                            : form.documents.filter((d) => d.label !== label),
                        })
                      }
                    />
                  );
                })}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <Field label="Account holder" value={form.bank_holder} onChange={(v) => set({ bank_holder: v })} placeholder="Trattoria Verde LLP" />
              <Field label="Bank account number" value={form.bank_account} onChange={(v) => set({ bank_account: v })} placeholder="000123456789" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="IFSC" value={form.bank_ifsc} onChange={(v) => set({ bank_ifsc: v })} placeholder="HDFC0001234" />
                <Field label="Bank name" value={form.bank_name} onChange={(v) => set({ bank_name: v })} placeholder="HDFC Bank" />
              </div>
              <Field label="GSTIN" value={form.gst_number} onChange={(v) => set({ gst_number: v })} placeholder="27ABCDE1234F1Z5" />
              <Field label="FSSAI licence number" value={form.fssai_number} onChange={(v) => set({ fssai_number: v })} placeholder="11223344556677" />
              <Field label="PAN number" value={form.pan_number} onChange={(v) => set({ pan_number: v })} placeholder="ABCDE1234F" />
              <Field label="Aadhaar number" value={form.aadhaar_number} onChange={(v) => set({ aadhaar_number: v })} placeholder="1234 5678 9012" />
              <Field label="Cancelled cheque / Reference no." value={form.cancelled_cheque_ref} onChange={(v) => set({ cancelled_cheque_ref: v })} placeholder="CHQ-001" />
            </>
          )}

          {step === 5 && (
            <>
              <Field label="Delivery radius (km)" value={form.delivery_radius} onChange={(v) => set({ delivery_radius: v })} placeholder="5" />
              <Field label="Commission (%)" value={form.commission} onChange={(v) => set({ commission: v })} placeholder="20" />
              <p className="rounded-2xl bg-secondary/60 px-3 py-2.5 text-[12px] text-muted-foreground">
                On submit, Scoobix creates the restaurant account, issues a temporary password and
                sends the application to admin for approval.
              </p>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {step > 0 && (
            <Button variant="ghost" className="rounded-full" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() => void saveDraft()}
          >
            <Save className="mr-1.5 h-4 w-4" /> Save draft
          </Button>
          <Button
            className="ml-auto h-12 rounded-full gradient-primary px-6 text-sm font-bold text-primary-foreground shadow-glow"
            disabled={busy}
            onClick={() => (last ? void submit() : setStep(step + 1))}
          >
            {last ? <>Submit for approval <Check className="ml-1 h-4 w-4" /></> : <>Continue <ChevronRight className="ml-1 h-4 w-4" /></>}
          </Button>
        </div>
      </div>

      <DuplicateDialog
        open={dupOpen}
        onOpenChange={setDupOpen}
        result={dup.result}
        onView={(m) => window.open(`/restaurant/${m.id}`, "_blank")}
        onResolve={resolveDuplicate}
      />
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-2xl bg-secondary/50"
      />
    </div>
  );
}
