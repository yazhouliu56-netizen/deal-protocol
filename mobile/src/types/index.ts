export type UserRole = 'user' | 'provider';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  creditScore: number;
  avatar?: string;
}

export interface OrderCategory {
  id: string;
  name: string;
  icon: string;
}

export interface OrderItem {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  description: string;
  status: OrderStatus;
  providerId?: string;
  price?: number;
  createdAt: string;
  sosTriggered: boolean;
  location?: GeoLocation;
}

export type OrderStatus = 'pending' | 'grabbed' | 'in_progress' | 'completed' | 'cancelled';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  address: string;
}

export interface SchemaField {
  type: string
  label: string
  required?: boolean
  options?: string[]
  min?: number
  max?: number
}

export interface SchemaDef {
  core_fields?: Record<string, SchemaField>
  category_fields?: Record<string, SchemaField>
}

export interface DiagnosisResult {
  summary: string;
  category: string;
  confidence: number;
  suggestedProviders: string[];
  riskTier?: string;
  schema?: SchemaDef;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface Provider {
  id: string;
  name: string;
  rating: number;
  completedOrders: number;
  tags: string[];
}
