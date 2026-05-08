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
  projectStartDate: string;
  projectEndDate: string;
  price: number;
  kdv: number;
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
  subscription: number;
  fullname: string;
  phone: string;
  email: string;
  sub_domain: number;
  sub_title: string | null;
  monthly_price: number | null;
  full_price: number | null;
  kdv: number | null;
}

export interface DomainPricing {
  id: number;
  title: string;
  monthly_price: number;
  full_price: number;
  kdv: number;
}
