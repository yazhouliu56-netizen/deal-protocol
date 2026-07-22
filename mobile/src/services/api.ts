import {
  OrderItem,
  OrderCategory,
  DiagnosisResult,
  ChatMessage,
  Provider,
  GeoLocation,
  User,
} from '../types';

const MOCK_USER: User = {
  id: 'u1',
  name: '张三',
  phone: '13800138000',
  role: 'user',
  creditScore: 850,
};

const MOCK_PROVIDER_USER: User = {
  id: 'p1',
  name: '李师傅',
  phone: '13900139000',
  role: 'provider',
  creditScore: 920,
};

const MOCK_CATEGORIES: OrderCategory[] = [
  { id: 'c1', name: '家电维修', icon: '🔧' },
  { id: 'c2', name: '水管疏通', icon: '🔨' },
  { id: 'c3', name: '电工服务', icon: '⚡' },
  { id: 'c4', name: '清洁服务', icon: '🧹' },
  { id: 'c5', name: '搬运输送', icon: '📦' },
  { id: 'c6', name: '其他', icon: '📋' },
];

let mockOrders: OrderItem[] = [
  {
    id: 'o1',
    userId: 'u1',
    categoryId: 'c1',
    title: '空调不制冷',
    description: '家里空调开了不制冷，需要上门检查维修',
    status: 'pending',
    createdAt: new Date().toISOString(),
    sosTriggered: false,
  },
  {
    id: 'o2',
    userId: 'u2',
    categoryId: 'c2',
    title: '厨房水池堵塞',
    description: '厨房下水道堵塞，需要疏通',
    status: 'grabbed',
    providerId: 'p1',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    sosTriggered: false,
  },
  {
    id: 'o3',
    userId: 'u3',
    categoryId: 'c3',
    title: '更换插座',
    description: '客厅插座坏了需要更换',
    status: 'in_progress',
    providerId: 'p2',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    sosTriggered: false,
  },
];

const MOCK_PROVIDERS: Provider[] = [
  { id: 'p1', name: '李师傅', rating: 4.8, completedOrders: 156, tags: ['家电', '维修'] },
  { id: 'p2', name: '王师傅', rating: 4.6, completedOrders: 98, tags: ['水电', '安装'] },
  { id: 'p3', name: '赵师傅', rating: 4.9, completedOrders: 203, tags: ['电工', '维修'] },
];

let mockMessages: Record<string, ChatMessage[]> = {
  o1: [
    { id: 'm1', orderId: 'o1', senderId: 'u1', text: '师傅你好，空调不制冷了', timestamp: new Date(Date.now() - 60000).toISOString() },
    { id: 'm2', orderId: 'o1', senderId: 'p1', text: '好的，我马上过来看看', timestamp: new Date(Date.now() - 30000).toISOString() },
  ],
};

async function delay(ms: number = 300): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getCurrentUser(): Promise<User> {
  await delay();
  return MOCK_USER;
}

export async function getProviderUser(): Promise<User> {
  await delay();
  return MOCK_PROVIDER_USER;
}

export async function getCategories(): Promise<OrderCategory[]> {
  await delay();
  return MOCK_CATEGORIES;
}

export async function createOrder(params: {
  categoryId: string;
  title: string;
  description: string;
  location?: GeoLocation;
}): Promise<OrderItem> {
  await delay(500);
  const newOrder: OrderItem = {
    id: `o${Date.now()}`,
    userId: MOCK_USER.id,
    categoryId: params.categoryId,
    title: params.title,
    description: params.description,
    status: 'pending',
    createdAt: new Date().toISOString(),
    sosTriggered: false,
    location: params.location,
  };
  mockOrders.unshift(newOrder);
  return newOrder;
}

export async function diagnoseOrder(text: string): Promise<DiagnosisResult> {
  await delay(800);
  return {
    summary: `检测到问题描述：${text.substring(0, 50)}... 建议联系专业维修人员上门处理。`,
    category: '家电维修',
    confidence: 0.92,
    suggestedProviders: ['李师傅', '王师傅'],
  };
}

export async function getOrders(): Promise<OrderItem[]> {
  await delay();
  return mockOrders;
}

export async function getMyOrders(userId: string): Promise<OrderItem[]> {
  await delay();
  return mockOrders.filter((o) => o.userId === userId || o.providerId === userId);
}

export async function getOrderById(orderId: string): Promise<OrderItem | undefined> {
  await delay();
  return mockOrders.find((o) => o.id === orderId);
}

export async function grabOrder(orderId: string, providerId: string): Promise<boolean> {
  await delay(500);
  const order = mockOrders.find((o) => o.id === orderId);
  if (!order || order.status !== 'pending') return false;
  order.status = 'grabbed';
  order.providerId = providerId;
  return true;
}

export async function updateOrderStatus(orderId: string, status: OrderItem['status']): Promise<boolean> {
  await delay();
  const order = mockOrders.find((o) => o.id === orderId);
  if (!order) return false;
  order.status = status;
  return true;
}

export async function getProviders(): Promise<Provider[]> {
  await delay();
  return MOCK_PROVIDERS;
}

export async function getMessages(orderId: string): Promise<ChatMessage[]> {
  await delay();
  return mockMessages[orderId] || [];
}

export async function sendMessage(orderId: string, senderId: string, text: string): Promise<ChatMessage> {
  await delay();
  const msg: ChatMessage = {
    id: `m${Date.now()}`,
    orderId,
    senderId,
    text,
    timestamp: new Date().toISOString(),
  };
  if (!mockMessages[orderId]) mockMessages[orderId] = [];
  mockMessages[orderId].push(msg);
  return msg;
}

export async function triggerSOS(orderId: string, location?: GeoLocation): Promise<boolean> {
  await delay();
  const order = mockOrders.find((o) => o.id === orderId);
  if (!order) return false;
  order.sosTriggered = true;
  return true;
}
