import { expect, type APIRequestContext } from '@playwright/test';

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  icon: string;
  description: string;
}

export interface Cart {
  items: { productId: number; name: string; price: number; qty: number; sum: number; stock: number }[];
  count: number;
  subtotal: number;
  discount: number;
  promo: { code: string; title: string } | null;
  total: number;
}

export interface OrderInput {
  name: string;
  phone: string;
  delivery: 'courier' | 'pickup';
  address?: string;
  payment: 'card' | 'cash';
  comment?: string;
}

/**
 * Тонкий клиент REST API магазина.
 * Используется для подготовки состояния (arrange) и проверок, которые неудобно делать через UI.
 * Если передать page.request — cookie сессии общие с браузером, т.е. корзина та же самая.
 */
export class ShopApi {
  constructor(private readonly request: APIRequestContext) {}

  async products(params: Record<string, string> = {}): Promise<Product[]> {
    const res = await this.request.get('/api/products', { params });
    expect(res, 'GET /api/products').toBeOK();
    return res.json();
  }

  async product(id: number): Promise<Product> {
    const res = await this.request.get(`/api/products/${id}`);
    expect(res, `GET /api/products/${id}`).toBeOK();
    return res.json();
  }

  async cart(): Promise<Cart> {
    const res = await this.request.get('/api/cart');
    expect(res).toBeOK();
    return res.json();
  }

  async addToCart(productId: number, qty = 1): Promise<Cart> {
    const res = await this.request.post('/api/cart/items', { data: { productId, qty } });
    expect(res, `POST /api/cart/items ${productId}×${qty}: ${await res.text()}`).toBeOK();
    return res.json();
  }

  /** Наполнить корзину: { [productId]: qty } */
  async fillCart(items: Record<number, number>): Promise<Cart> {
    let cart = await this.cart();
    for (const [id, qty] of Object.entries(items)) cart = await this.addToCart(Number(id), qty);
    return cart;
  }

  async applyPromo(code: string): Promise<Cart> {
    const res = await this.request.post('/api/cart/promo', { data: { code } });
    expect(res, `promo ${code}: ${await res.text()}`).toBeOK();
    return res.json();
  }

  async register(user: { email: string; password: string; name: string }) {
    const res = await this.request.post('/api/auth/register', { data: user });
    expect(res, `register ${user.email}: ${await res.text()}`).toBeOK();
    return res.json();
  }

  async placeOrder(order: OrderInput) {
    const res = await this.request.post('/api/orders', { data: order });
    expect(res, `POST /api/orders: ${await res.text()}`).toBeOK();
    return res.json() as Promise<{ id: number; total: number; shipping: number }>;
  }
}
