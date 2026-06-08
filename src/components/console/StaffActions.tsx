'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, Upload } from '@/components/icons';
import { CreateEntityModal, type EntityField } from './CreateEntityModal';
import { SheetImporter } from './SheetImporter';
import { agentInviteSchema, agentImportRowSchema, type AgentInviteInput } from '@/lib/schemas';
import { inviteAgentAction, importAgentsAction } from '@/lib/actions/console';

const FIELDS: EntityField[] = [
  { name: 'first_name', label: 'First name', required: true, placeholder: 'Ngozi' },
  { name: 'last_name',  label: 'Last name',  required: true, placeholder: 'Umeh' },
  { name: 'email', label: 'Work email', type: 'email', required: true, placeholder: 'name@envolvepharm.com.ng', full: true },
  { name: 'phone',  label: 'Phone',  type: 'tel', required: true, placeholder: '+234 800 000 0000' },
  { name: 'region', label: 'Region', placeholder: 'Abuja FCT', full: true },
];

const COLUMNS = [
  { key: 'first_name', label: 'First name', required: true },
  { key: 'last_name',  label: 'Last name',  required: true },
  { key: 'email',      label: 'Email',      required: true },
  { key: 'phone',      label: 'Phone',      required: true },
  { key: 'region',     label: 'Region' },
];

export function StaffActions() {
  const [invite,    setInvite]    = useState(false);
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
        title="Invite a staff member"
        description="They'll get an email invite to set their password. Role defaults to Sales Rep — you can change it after they join."
        fields={FIELDS}
        schema={agentInviteSchema}
        action={inviteAgentAction}
        submitLabel="Send invite"
        successTitle="Staff invited"
        size="lg"
      />

      <SheetImporter<AgentInviteInput>
        open={importing}
        onClose={() => setImporting(false)}
        title="Import staff"
        columns={COLUMNS}
        schema={agentImportRowSchema}
        action={importAgentsAction}
        templateName="staff_template.xlsx"
      />
    </>
  );
}
