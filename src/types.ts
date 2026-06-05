export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  stock_quantity: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  notes: string;
  total_amount: number;
  status: 'Pending' | 'Accepted' | 'Preparing' | 'Ready' | 'Completed' | 'Rejected';
  rejection_reason: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}
