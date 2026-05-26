export interface User {
  id: number;
  username: string;
  fullname: string;
  level: number;
  phone?: string;
  email?: string;
}

export interface Job {
  id: number;
  title: string;
}

export interface Client {
  id: number;
  title: string;
  vk_number?: string | null;
  vk_name?: string | null;
  address?: string | null;
  fullname: string;
  phone?: string | null;
  email?: string | null;
  image?: string | null;
  create_date?: string;
}

export interface LeadTag {
  id: number;
  name: string;
  color: string;
  usage_count?: number;
}

export interface LeadRow {
  id: number;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  service_interest: string | null;
  source: string | null;
  estimated_value: number | null;
  stage: string;
  temperature: string;
  next_follow_up_date: string | null;
  notes?: string | null;
  notes_preview?: string | null;
  lost_reason: string | null;
  converted_client_id: number | null;
  converted_offer_id: number | null;
  create_date: string;
  updated_at: string;
  client_title: string | null;
  offer_id: number | null;
  last_activity_date: string | null;
  activity_count: number;
  tags?: LeadTag[];
}

export interface LeadActivity {
  id: number;
  lead_id: number;
  activity_type: string;
  description: string;
  activity_date: string;
  next_action_date: string | null;
  user_name: string | null;
}

export interface LeadOffer {
  id: number;
  offer_id: number;
  offer_status: number;
  offer_title: string;
  offer_date: string;
  final_date: string;
}

export interface OfferMatter {
  id?: number;
  ordering?: number;
  offer_id?: number;
  matter_title: string;
  matter_description: string;
  matter_extra?: string;
  matter_unit: number;
  matter_old_price?: number | null;
  matter_price: number;
  included?: boolean;
}

export interface OfferRow {
  id: number;
  offerID: number;
  mainOfferID: number | null;
  offerStatus: number;
  offerType: number;
  offerTitle: string;
  offerText: string;
  offerDate: string;
  offerFinalDate: string;
  clientTitle: string | null;
  clientID: number | null;
  leadID?: number | null;
}

export interface Offer {
  id: number;
  client_id: number;
  offer_id: number;
  offer_status: number;
  offer_type: number;
  offer_title: string;
  offer_text: string;
  offer_date: string;
  final_date: string;
  user_id: number | null;
  main_offer_id: number | null;
  create_date: string;
}

export interface AgreementRow {
  id: number;
  offerID: number;
  agreementStatus: number;
  agreementType: number;
  agreementTitle: string;
  agreementText: string | null;
  agreementStartDate: string;
  agreementEndDate: string;
  price: number | null;
  kdv: number;
  clientTitle: string | null;
  clientID: number | null;
}

export interface ProjectRow {
  id: number;
  offerID: number;
  status: number;
  type: number;
  title: string;
  description: string | null;
  priority: number;
  progress: number;
  createDate: string;
  updatedAt: string;
  completedAt: string | null;
  projectStartDate: string;
  projectEndDate: string;
  price: number;
  kdv: number;
  paid: number;
  total: number;
  clientTitle: string | null;
  clientID: number | null;
  personelName: string | null;
  personelID: number | null;
}

export interface Personel {
  id: number;
  fullname: string;
  email?: string;
  phone?: string;
}

export interface DomainRow {
  id: number;
  name: string;
  status: number;
  base_id: number;
  pay_status: number;
  create_date: string;
  expires_at: string | null;
  subscription: number;
  registrar: string | null;
  registrar_account: string | null;
  auto_renew: number;
  notes: string | null;
  fullname: string;
  phone: string;
  email: string;
  sub_domain: number;
  sub_title: string | null;
  monthly_price: number | null;
  full_price: number | null;
  kdv: number | null;
}

export interface OfferTemplateRow {
  id: number;
  title: string;
  description: string | null;
  offerType: number | null;
  offerTypeTitle: string | null;
  defaultOfferTitle: string | null;
  defaultOfferText: string | null;
  defaultValidityDays: number;
  isActive: number;
  createDate: string;
  matterCount: number;
  totalPrice: number;
}

export interface OfferTemplate {
  id: number;
  title: string;
  description: string | null;
  offer_type: number | null;
  default_offer_title: string | null;
  default_offer_text: string | null;
  default_validity_days: number;
  is_active: number;
  create_date: string;
}

export interface OfferTemplateMatter {
  id?: number;
  template_id?: number;
  ordering?: number;
  matter_title: string;
  matter_description: string;
  matter_extra?: string;
  matter_unit: number;
  matter_old_price?: number | null;
  matter_price: number;
}

export interface DomainPricing {
  id: number;
  title: string;
  monthly_price: number;
  full_price: number;
  kdv: number;
}
