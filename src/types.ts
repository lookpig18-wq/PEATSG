export interface Account {
  code: string;
  name: string;
  budgets: {
    [key: string]: number;
  };
}

export interface Disbursement {
  id: string;
  accountCode: string;
  accountName: string;
  costCenter: string;
  date: string;
  description: string;
  price: string;
  tax: string;
  totalPrice: string;
  wht: string;
  netTotal: string;
  payee: string;
  paymentMethod: string;
  status: string;
  attachment?: string | null;
  attachmentName?: string | null;
}

export interface User {
  username: string;
  password?: string;
  role?: string;
}
