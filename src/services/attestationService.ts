import api from '@/api/axios';

export type AttestationDocumentType =
  | 'ATTESTATION_TRAVAIL_CDI'
  | 'ATTESTATION_TRAVAIL_CDD'
  | 'ATTESTATION_CONGES'
  | 'DOMICILIATION_CDI'
  | 'DOMICILIATION_CDD';

export type AttestationStatus = 'PENDING' | 'GENERATED' | 'PROCESSED' | 'REJECTED';

export interface AttestationRequest {
  id: number;
  document_type: AttestationDocumentType;
  document_type_display: string;
  status: AttestationStatus;
  extra_data: Record<string, string>;
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
}

// Mêmes types et mêmes champs à renseigner que sur la plateforme web.
export const DOC_TYPES: { type: AttestationDocumentType; label: string; desc: string }[] = [
  { type: 'ATTESTATION_TRAVAIL_CDI', label: 'Attestation de travail — CDI', desc: 'Confirme votre emploi en contrat à durée indéterminée' },
  { type: 'ATTESTATION_TRAVAIL_CDD', label: 'Attestation de travail — CDD', desc: 'Confirme votre emploi en contrat à durée déterminée' },
  { type: 'ATTESTATION_CONGES', label: 'Attestation de congés', desc: 'Atteste votre période de congés payés' },
  { type: 'DOMICILIATION_CDI', label: 'Domiciliation de salaire — CDI', desc: 'Ordre irrévocable de domiciliation bancaire — CDI' },
  { type: 'DOMICILIATION_CDD', label: 'Domiciliation de salaire — CDD', desc: 'Ordre irrévocable de domiciliation bancaire — CDD' },
];

export const EXTRA_FIELDS: Record<AttestationDocumentType, { key: string; label: string; type: 'date' | 'text'; required: boolean }[]> = {
  ATTESTATION_TRAVAIL_CDI: [],
  ATTESTATION_TRAVAIL_CDD: [],
  ATTESTATION_CONGES: [
    { key: 'date_debut_conges', label: 'Date de début de congés', type: 'date', required: true },
    { key: 'date_fin_conges', label: 'Date de fin de congés', type: 'date', required: true },
    { key: 'date_reprise', label: 'Date de reprise de service', type: 'date', required: true },
  ],
  DOMICILIATION_CDI: [
    { key: 'salaire_net_lettre', label: 'Salaire net (en lettres)', type: 'text', required: true },
    { key: 'salaire_net_chiffre', label: 'Salaire net (en chiffres)', type: 'text', required: true },
    { key: 'date_retraite', label: 'Date prévisionnelle de retraite', type: 'date', required: false },
  ],
  DOMICILIATION_CDD: [
    { key: 'salaire_net_lettre', label: 'Salaire net (en lettres)', type: 'text', required: true },
    { key: 'salaire_net_chiffre', label: 'Salaire net (en chiffres)', type: 'text', required: true },
  ],
};

export async function getMyAttestations(employeeId: number): Promise<AttestationRequest[]> {
  const { data } = await api.get('/api/employees/attestations/', { params: { employee_id: employeeId } });
  return Array.isArray(data) ? data : data?.results ?? [];
}

export async function createAttestation(payload: {
  document_type: AttestationDocumentType;
  extra_data: Record<string, string>;
}): Promise<AttestationRequest> {
  const { data } = await api.post<AttestationRequest>('/api/employees/attestations/', payload);
  return data;
}
