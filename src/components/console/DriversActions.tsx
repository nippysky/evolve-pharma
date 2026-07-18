'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, Upload } from '@/components/icons';
import { CreateEntityModal, type EntityField } from './CreateEntityModal';
import { SheetImporter } from './SheetImporter';
import { z } from 'zod';
import { phoneSchema } from '@/lib/schemas';

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
  { name: 'email',         label: 'Work email',    type: 'email',  required: true, placeholder: 'driver@ece.envolvepharm.com.ng', full: true },
  { name: 'phone',         label: 'Phone',         type: 'tel',    required: true, placeholder: '+234 800 000 0000' },
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

// Stub actions — replace with real server actions when backend is ready.
// CreateEntityModal expects (formData: FormData) => Promise<ActionResult>.
async function inviteDriverAction(fd: FormData) {
  await new Promise((r) => setTimeout(r, 900));
  void fd;
  return { ok: true as const };
}

async function importDriversAction(_rows: DriverInviteInput[]) {
  await new Promise((r) => setTimeout(r, 1200));
  return { ok: true as const, imported: 0, failed: 0 };
}

export function DriversActions() {
  const [invite, setInvite]     = useState(false);
  const [importing, setImporting] = useState(false);

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
