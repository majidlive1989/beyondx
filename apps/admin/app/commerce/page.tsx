"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  adjustCommerceStock,
  cancelCommerceOrder,
  confirmCommerceOrder,
  createCommerceWarehouse,
  listCatalogProducts,
  listCommerceOrders,
  listCommercePrices,
  listCommerceStock,
  listCommerceWarehouses,
  setCommercePrice,
} from "@/lib/api";
import type {
  CatalogProduct,
  CommerceOrder,
  CommercePrice,
  CommerceStockLevel,
  CommerceWarehouse,
} from "@/lib/types";

interface VariantOption {
  id: string;
  label: string;
}

export default function CommercePage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [prices, setPrices] = useState<CommercePrice[]>([]);
  const [warehouses, setWarehouses] = useState<CommerceWarehouse[]>([]);
  const [stock, setStock] = useState<CommerceStockLevel[]>([]);
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const variants = useMemo<VariantOption[]>(
    () => products.flatMap((product) => product.variants.map((variant) => ({
      id: variant.id,
      label: `${product.name} — ${variant.title} (${variant.sku})`,
    }))),
    [products],
  );

  async function load() {
    try {
      const [productPage, priceItems, warehouseItems, stockItems, orderItems] = await Promise.all([
        listCatalogProducts({ page: 1, pageSize: 100 }),
        listCommercePrices(),
        listCommerceWarehouses(),
        listCommerceStock(),
        listCommerceOrders(),
      ]);
      setProducts(productPage.items);
      setPrices(priceItems);
      setWarehouses(warehouseItems);
      setStock(stockItems);
      setOrders(orderItems);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load commerce data");
    }
  }

  useEffect(() => { void load(); }, []);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Commerce operation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Commerce plugin</span>
          <h1>Commerce</h1>
          <p>Manage prices, warehouses, stock reservations and order lifecycle. Amounts are stored as integer minor units.</p>
        </div>
      </header>
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="dashboard-grid">
        <PricePanel variants={variants} prices={prices} busy={busy} run={run} />
        <WarehousePanel warehouses={warehouses} busy={busy} run={run} />
        <StockPanel variants={variants} warehouses={warehouses} stock={stock} busy={busy} run={run} />
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="section-heading">
          <div><span className="eyebrow">Orders</span><h2>Checkout orders</h2></div>
          <span>{orders.length} orders</span>
        </div>
        {orders.length === 0 ? <p>No orders yet. Use the Commerce API to create a guest cart and checkout.</p> : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Order</th><th>Status</th><th>Total</th><th>Items</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>{orders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.orderNumber}</strong></td>
                  <td>{order.status}</td>
                  <td>{order.currency} {order.totalAmount} minor</td>
                  <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                  <td>{new Date(order.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="button-row">
                      {order.status === "PENDING_PAYMENT" ? <>
                        <button className="secondary-button" disabled={busy} onClick={() => void run(() => confirmCommerceOrder(order.id))} type="button">Confirm</button>
                        <button className="danger-button" disabled={busy} onClick={() => void run(() => cancelCommerceOrder(order.id))} type="button">Cancel</button>
                      </> : null}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function PricePanel({ variants, prices, busy, run }: { variants: VariantOption[]; prices: CommercePrice[]; busy: boolean; run: (action: () => Promise<unknown>) => Promise<void> }) {
  const [variantId, setVariantId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [unitAmount, setUnitAmount] = useState("0");
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(() => setCommercePrice({ variantId, currency, unitAmount: Number(unitAmount) }));
  }
  return <section className="panel"><span className="eyebrow">Pricing</span><h2>Variant price</h2>
    <form className="stacked-form" onSubmit={(event) => void submit(event)}>
      <label>Variant<select value={variantId} onChange={(event) => setVariantId(event.target.value)} required><option value="">Select variant</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}</select></label>
      <label>Currency<input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} required /></label>
      <label>Amount in minor units<input type="number" min="0" step="1" value={unitAmount} onChange={(event) => setUnitAmount(event.target.value)} required /></label>
      <button className="primary-button" disabled={busy || !variantId} type="submit">Save price</button>
    </form>
    <small>{prices.length} configured prices</small>
  </section>;
}

function WarehousePanel({ warehouses, busy, run }: { warehouses: CommerceWarehouse[]; busy: boolean; run: (action: () => Promise<unknown>) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(() => createCommerceWarehouse({ code, name }));
    setCode(""); setName("");
  }
  return <section className="panel"><span className="eyebrow">Inventory</span><h2>Warehouses</h2>
    <form className="stacked-form" onSubmit={(event) => void submit(event)}>
      <label>Code<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="MAIN" required /></label>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Main warehouse" required /></label>
      <button className="primary-button" disabled={busy} type="submit">Create warehouse</button>
    </form>
    <small>{warehouses.length} warehouses</small>
  </section>;
}

function StockPanel({ variants, warehouses, stock, busy, run }: { variants: VariantOption[]; warehouses: CommerceWarehouse[]; stock: CommerceStockLevel[]; busy: boolean; run: (action: () => Promise<unknown>) => Promise<void> }) {
  const [warehouseId, setWarehouseId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [delta, setDelta] = useState("1");
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(() => adjustCommerceStock({ warehouseId, variantId, quantityDelta: Number(delta), reason: "Admin adjustment" }));
  }
  return <section className="panel"><span className="eyebrow">Stock</span><h2>Adjust stock</h2>
    <form className="stacked-form" onSubmit={(event) => void submit(event)}>
      <label>Warehouse<select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required><option value="">Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
      <label>Variant<select value={variantId} onChange={(event) => setVariantId(event.target.value)} required><option value="">Select variant</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}</select></label>
      <label>Quantity delta<input type="number" step="1" value={delta} onChange={(event) => setDelta(event.target.value)} required /></label>
      <button className="primary-button" disabled={busy || !warehouseId || !variantId} type="submit">Adjust</button>
    </form>
    <small>{stock.length} stock levels</small>
  </section>;
}
