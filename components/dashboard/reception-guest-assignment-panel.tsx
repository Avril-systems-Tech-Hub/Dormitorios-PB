"use client";

import { ReceptionBedPicker } from "@/components/dashboard/reception-bed-picker";
import type { ReceptionSearchGuest } from "@/lib/reception-check-in";

export type GuestAssignmentDraft = {
  bedId: string | null;
  lockerNumber: string;
};

export function buildGuestAssignmentDrafts(
  guests: ReceptionSearchGuest[],
): Record<string, GuestAssignmentDraft> {
  return Object.fromEntries(
    guests.map((guest) => [
      guest.guestId,
      {
        bedId: guest.bedId,
        lockerNumber: guest.lockerNumber ? String(guest.lockerNumber) : "",
      },
    ]),
  );
}

export function validateGuestAssignmentDrafts(
  guests: ReceptionSearchGuest[],
  drafts: Record<string, GuestAssignmentDraft>,
): string | null {
  for (const guest of guests) {
    const draft = drafts[guest.guestId];
    if (!draft?.bedId) {
      return `Asigna una cama para ${guest.fullName}.`;
    }
    if (guest.lockerDays > 0 && !draft.lockerNumber.trim()) {
      return `Indica el locker para ${guest.fullName}.`;
    }
  }
  return null;
}

type ReceptionGuestAssignmentPanelProps = {
  guests: ReceptionSearchGuest[];
  drafts: Record<string, GuestAssignmentDraft>;
  onDraftChange: (guestId: string, patch: Partial<GuestAssignmentDraft>) => void;
  disabled?: boolean;
};

export function ReceptionGuestAssignmentPanel({
  guests,
  drafts,
  onDraftChange,
  disabled,
}: ReceptionGuestAssignmentPanelProps) {
  return (
    <div className="space-y-4">
      {guests.map((guest, index) => {
        const draft = drafts[guest.guestId] ?? { bedId: null, lockerNumber: "" };
        const requiresLocker = guest.lockerDays > 0;

        return (
          <section
            key={guest.guestId}
            className="rounded-xl border border-border-soft bg-surface-soft/30 p-4"
          >
            <div className="mb-3">
              <p className="text-sm font-semibold text-text-main">
                Huésped {index + 1}: {guest.fullName}
              </p>
              {requiresLocker ? (
                <p className="text-xs text-text-muted">Locker incluido · {guest.lockerDays} día(s)</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-2 text-sm text-text-muted">Cama</p>
                <ReceptionBedPicker
                  selectedBedId={draft.bedId}
                  allowBedId={guest.bedId}
                  onSelect={(bedId) => onDraftChange(guest.guestId, { bedId })}
                  disabled={disabled}
                />
              </div>

              {requiresLocker ? (
                <label className="flex flex-col gap-1 text-sm text-text-muted">
                  Número de locker
                  <input
                    type="number"
                    min={1}
                    value={draft.lockerNumber}
                    onChange={(e) =>
                      onDraftChange(guest.guestId, { lockerNumber: e.target.value })
                    }
                    placeholder="Ej. 12"
                    disabled={disabled}
                    className="h-10 rounded-lg border border-border-soft bg-white px-3 text-text-main"
                  />
                </label>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
