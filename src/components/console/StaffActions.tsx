'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, Upload } from '@/components/icons';
import { CreateEntityModal, type EntityField } from './CreateEntityModal';
import { SheetImporter } from './SheetImporter';
import { staffInviteSchema, staffImportRowSchema, type StaffInviteInput } from '@/lib/schemas';
import { inviteStaffAction, importStaffAction } from '@/lib/actions/console';
import { DEPARTMENTS } from '@/lib/data/staff';

const FIELDS: EntityField[] = [
  { name: 'first_name', label: 'First name', required: true, placeholder: 'Ngozi' },
  { name: 'middle_name', label: 'Middle name', placeholder: 'Optional' },
  { name: 'last_name', label: 'Last name', required: true, placeholder: 'Umeh' },
  { name: 'email', label: 'Work email', type: 'email', required: true, placeholder: 'name@envolvepharm.com.ng', full: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: true, placeholder: '+234 800 000 0000' },
  {
    name: 'department',
    label: 'Department',
    type: 'select',
    required: true,
    options: DEPARTMENTS.map((d) => ({ value: d, label: d })),
  },
  { name: 'job_title', label: 'Job title', required: true, placeholder: 'Procurement Lead', full: true },
];

const COLUMNS = [
  { key: 'first_name', label: 'First name', required: true },
  { key: 'middle_name', label: 'Middle name' },
  { key: 'last_name', label: 'Last name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'department', label: 'Department', required: true },
  { key: 'job_title', label: 'Job title', required: true },
];

export function StaffActions() {
  const [invite, setInvite] = useState(false);
  const [importing, setImporting] = useState(false);

  return (
    <>
      <Button variant="secondary" leadingIcon={<Upload size={14} />} onClick={() => setImporting(true)}>
        Import
      </Button>
      <Button leadingIcon={<Plus size={14} />} onClick={() => setInvite(true)}>
        Add staff
      </Button>

      <CreateEntityModal
        open={invite}
        onClose={() => setInvite(false)}
        title="Add a staff member"
        description="They'll get an email invite to set their own password and access the console."
        fields={FIELDS}
        schema={staffInviteSchema}
        action={inviteStaffAction}
        submitLabel="Send invite"
        successTitle="Staff invited"
        size="xl"
      />

      <SheetImporter<StaffInviteInput>
        open={importing}
        onClose={() => setImporting(false)}
        title="Import staff"
        columns={COLUMNS}
        schema={staffImportRowSchema}
        action={importStaffAction}
        templateName="staff_template.xlsx"
      />
    </>
  );
}