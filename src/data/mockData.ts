export interface Order {
  id: string;
  customerName: string;
  item: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  stage: 'sales' | 'production' | 'instore' | 'logistics' | 'delivered';
  paymentMethod: 'mpesa' | 'card';
  deliveryMethod: 'uber' | 'courier' | 'pickup';
  assignedTo: string;
  createdAt: Date;
  updatedAt: Date;
  stageHistory: Array<{
    stage: string;
    timestamp: Date;
    duration?: number;
  }>;
}

export const mockOrders: Order[] = [
  {
    id: 'ORD001',
    customerName: 'Alice Cooper',
    item: 'Cotton T-Shirt',
    color: 'Black',
    size: 'M',
    quantity: 2,
    price: 2500,
    status: 'in_progress',
    stage: 'production',
    paymentMethod: 'mpesa',
    deliveryMethod: 'uber',
    assignedTo: 'Mike Chen',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-16'),
    stageHistory: [
      { stage: 'sales', timestamp: new Date('2025-01-15'), duration: 120 },
      { stage: 'production', timestamp: new Date('2025-01-16') }
    ]
  },
  {
    id: 'ORD002',
    customerName: 'Bob Smith',
    item: 'Denim Jeans',
    color: 'Blue',
    size: 'L',
    quantity: 1,
    price: 4500,
    status: 'completed',
    stage: 'delivered',
    paymentMethod: 'card',
    deliveryMethod: 'courier',
    assignedTo: 'David Brown',
    createdAt: new Date('2025-01-14'),
    updatedAt: new Date('2025-01-17'),
    stageHistory: [
      { stage: 'sales', timestamp: new Date('2025-01-14'), duration: 90 },
      { stage: 'production', timestamp: new Date('2025-01-15'), duration: 1440 },
      { stage: 'logistics', timestamp: new Date('2025-01-16'), duration: 240 },
      { stage: 'delivered', timestamp: new Date('2025-01-17') }
    ]
  },
  {
    id: 'ORD003',
    customerName: 'Carol Martinez',
    item: 'Summer Dress',
    color: 'White',
    size: 'S',
    quantity: 1,
    price: 3500,
    status: 'pending',
    stage: 'sales',
    paymentMethod: 'mpesa',
    deliveryMethod: 'pickup',
    assignedTo: 'Sarah Johnson',
    createdAt: new Date('2025-01-18'),
    updatedAt: new Date('2025-01-18'),
    stageHistory: [
      { stage: 'sales', timestamp: new Date('2025-01-18') }
    ]
  }
];

export const mockStaff = [
  { id: '2', name: 'Sarah Johnson', role: 'sales', email: 'sales@clothiq.com', ordersCompleted: 45, avgResponseTime: 15 },
  { id: '3', name: 'Mike Chen', role: 'production', email: 'production@clothiq.com', ordersCompleted: 38, avgResponseTime: 120 },
  { id: '4', name: 'Emma Wilson', role: 'instore', email: 'store@clothiq.com', ordersCompleted: 52, avgResponseTime: 10 },
  { id: '5', name: 'David Brown', role: 'logistics', email: 'logistics@clothiq.com', ordersCompleted: 41, avgResponseTime: 30 }
];
