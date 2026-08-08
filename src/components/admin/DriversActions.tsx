'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, Upload } from '@/components/icons';
import { CreateEntityModal, type EntityField } from './CreateEntityModal';
import { SheetImporter } from './SheetImporter';
import { z } from 'zod';
import { phoneSchema } from '@/lib/schemas';
import { inviteDriverAction } from '@/lib/actions/admin';
import { useQueryClient } from '@tanstack/react-query';
import { DRIVER_KEYS } from '@/hooks/staff/useStaff';

// Driver invite schema
const driverInviteSchema = z.object({
  first_name:    z.string().trim().min(1, 'First name is required').max(60),
  last_name:     z.string().trim().min(1, 'Last name is required').max(60),
  email:         z.string().email('Enter a valid email'),
  phone:         phoneSchema,
  vehicle_plate: z.string().trim().min(3, 'Vehicle plate is required').max(20),
  vehicle_type:  z.string().trim().min(1, 'Vehicle type is required').max(40),
  region:        z.string().trim().min(2, 'Region is required').max(80),
});

export type DriverInviteInput = z.infer<typeof driverInviteSchema>;

const FIELDS: EntityField[] = [
  { name: 'first_name',    label: 'First name',    required: true, placeholder: 'Musa' },
  { name: 'last_name',     label: 'Last name',     required: true, placeholder: 'Bello' },
  { name: 'email',         label: 'Work email',    type: 'email',  required: true, placeholder: 'driver@envolvepharm.com.ng', full: true },
  { name: 'phone',         label: 'Phone',         type: 'tel',    required: true, placeholder: '08012345678' },
  { name: 'vehicle_plate', label: 'Vehicle plate', required: true, placeholder: 'ABJ-148-XK' },
  {
    name: 'vehicle_type',
    label: 'Vehicle type',
    type: 'select',
    required: true,
    options: [
      { value: 'Van',        label: 'Van' },
      { value: 'Motorcycle', label: 'Motorcycle' },
      { value: 'Truck',      label: 'Truck' },
      { value: 'Car',        label: 'Car' },
    ],
  },
  { name: 'region', label: 'Delivery region', required: true, placeholder: 'Abuja FCT', full: true },
];

const COLUMNS = [
  { key: 'first_name',    label: 'First name',    required: true  },
  { key: 'last_name',     label: 'Last name',     required: true  },
  { key: 'email',         label: 'Email',         required: true  },
  { key: 'phone',         label: 'Phone',         required: true  },
  { key: 'vehicle_plate', label: 'Vehicle plate', required: true  },
  { key: 'vehicle_type',  label: 'Vehicle type',  required: true  },
  { key: 'region',        label: 'Region',        required: true  },
];

export function DriversActions({ onImported }: { onImported?: () => void }) {
  const queryClient = useQueryClient();
  const [invite, setInvite]       = useState(false);
  const [importing, setImporting] = useState(false);

  async function importDriversAction(rows: DriverInviteInput[]) {
    // Build FormData with an XLSX blob so the bulk-upload endpoint can parse it
    const XLSX = await import('xlsx');
    const wsData = [
      ['first_name', 'last_name', 'email', 'phone', 'vehicle_plate', 'vehicle_type', 'region', 'role'],
      ...rows.map((r) => [r.first_name, r.last_name, r.email, r.phone, r.vehicle_plate, r.vehicle_type, r.region, 'DRIVER']),
    ];
    const ws  = XLSX.utils.aoa_to_sheet(wsData);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Drivers');
    const buf  = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const fd = new FormData();
    fd.append('file', blob, 'drivers.xlsx');

    const res  = await fetch('/api/staff/bulk-upload?force_role=DRIVER', { method: 'POST', body: fd, credentials: 'include' });
    const json = await res.json() as { data?: { successful?: number; failed?: number } };

    if (res.ok) {
      void queryClient.invalidateQueries({ queryKey: DRIVER_KEYS.all });
      onImported?.();
      return { ok: true as const, data: { imported: json.data?.successful ?? 0, failed: json.data?.failed ?? 0 } };
    }

    const msg = (json as { message?: string }).message ?? 'Bulk import failed. Please try again.';
    return { ok: false as const, message: msg };
  }

  return (
    <>
      <Button variant="secondary" leadingIcon={<Upload size={14} />} onClick={() => setImporting(true)}>
        Import
      </Button>
      <Button leadingIcon={<Plus size={14} />} onClick={() => setInvite(true)}>
        Add driver
      </Button>

      <CreateEntityModal
        open={invite}
        onClose={() => setInvite(false)}
        title="Onboard a driver"
        description="The driver will receive an email invite to set their password and access their delivery console."
        fields={FIELDS}
        schema={driverInviteSchema}
        action={inviteDriverAction}
        submitLabel="Send invite"
        successTitle="Driver invited"
        size="xl"
      />

      <SheetImporter<DriverInviteInput>
        open={importing}
        onClose={() => setImporting(false)}
        title="Import drivers"
        columns={COLUMNS}
        schema={driverInviteSchema}
        action={importDriversAction}
        templateName="drivers_template.xlsx"
      />
    </>
  );
}
