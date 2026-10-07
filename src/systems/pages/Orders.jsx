import React from 'react';
import OrdersPanel from '../../features/orders/OrdersPanel';

// Every order across the marketplace (operators can read all orders — v19).
const Orders = () => (
  <div className="sys-page sys-orders">
    <header className="sys-page__head">
      <p className="sys-eyebrow">Orders</p>
      <h1>Marketplace orders</h1>
      <p className="sys-muted">Card sales and order requests from every shop, updating live.</p>
    </header>
    <OrdersPanel />
  </div>
);

export default Orders;
