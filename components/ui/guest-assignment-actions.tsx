"use client";

import { BedChangeButton } from "@/components/ui/bed-change-button";
import { LockerAssignButton } from "@/components/ui/locker-assign-button";

export type GuestAssignmentGuestRow = {
  guest_id?: string;
  locker_number?: number | null;
  locker_days?: number | null;
  guests?: { full_name?: string } | { full_name?: string }[] | null;
  beds?: { bed_number?: number } | { bed_number?: number }[] | null;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export function parseGuestAssignmentRow(row: GuestAssignmentGuestRow) {
  const bed = unwrapRelation(row.beds);
  const lockerDays = Number(row.locker_days ?? 0);
  const lockerNumber =
    row.locker_number != null && Number(row.locker_number) > 0 ? Number(row.locker_number) : null;

  return {
    guestId: row.guest_id ?? "",
    bedNumber: bed?.bed_number ?? null,
    lockerDays,
    lockerNumber,
    requiresLocker: lockerDays > 0,
  };
}

export function GuestAssignmentActions({
  reservationId,
  guestId,
  bedNumber,
  lockerNumber,
  lockerDays,
  nights,
  returnTo,
}: {
  reservationId: string;
  guestId: string;
  bedNumber: number | null;
  lockerNumber: number | null;
  lockerDays: number;
  nights: number;
  returnTo: string;
}) {
  const requiresLocker = lockerDays > 0;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <BedChangeButton
        reservationId={reservationId}
        guestId={guestId}
        bedNumber={bedNumber}
        returnTo={returnTo}
      />
      {requiresLocker ? (
        <LockerAssignButton
          reservationId={reservationId}
          guestId={guestId}
          lockerNumber={lockerNumber}
          lockerDays={lockerDays}
          nights={nights}
          returnTo={returnTo}
          mode="assign"
        />
      ) : (
        <LockerAssignButton
          reservationId={reservationId}
          guestId={guestId}
          lockerNumber={null}
          lockerDays={0}
          nights={nights}
          returnTo={returnTo}
          mode="include"
        />
      )}
    </span>
  );
}

export function GuestAssignmentCell({
  guests,
  reservationId,
  nights = 1,
  returnTo = "/dashboard/reservations",
}: {
  guests: GuestAssignmentGuestRow[];
  reservationId: string;
  nights?: number;
  returnTo?: string;
}) {
  if (!guests.length) {
    return <span className="text-xs text-text-muted">—</span>;
  }

  if (guests.length === 1) {
    const parsed = parseGuestAssignmentRow(guests[0]);
    return (
      <GuestAssignmentActions
        reservationId={reservationId}
        guestId={parsed.guestId}
        bedNumber={parsed.bedNumber}
        lockerNumber={parsed.lockerNumber}
        lockerDays={parsed.lockerDays}
        nights={nights}
        returnTo={returnTo}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      {guests.map((guest, index) => {
        const parsed = parseGuestAssignmentRow(guest);
        const guestInfo = unwrapRelation(guest.guests);
        return (
          <div key={parsed.guestId || index} className="flex flex-wrap items-center gap-1.5">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-text-muted">
              H{index + 1}
              {guestInfo?.full_name ? ` · ${guestInfo.full_name.split(/\s+/)[0]}` : ""}
            </span>
            <GuestAssignmentActions
              reservationId={reservationId}
              guestId={parsed.guestId}
              bedNumber={parsed.bedNumber}
              lockerNumber={parsed.lockerNumber}
              lockerDays={parsed.lockerDays}
              nights={nights}
              returnTo={returnTo}
            />
          </div>
        );
      })}
    </div>
  );
}
