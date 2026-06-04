import { useState, useEffect, useRef } from "react";
import api from "../api/axios";

export default function PlaceOrder() {
  const PRICE_PER_KW = 55000;

  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [customerType, setCustomerType] = useState("new");

  // Existing customer search
  const [nameSearch, setNameSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const [form, setForm] = useState({
    customer_id: "",
    customer_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    system_size_kw: "",
    total_amount: "",
    notes: ""
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search customers by name as user types
  useEffect(() => {
    if (customerType !== "existing") return;
    if (!nameSearch.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const delay = setTimeout(async () => {
      try {
        setSearching(true);
        // Fetch all customers and filter by name client-side
        const res = await api.get("/customers");
        const filtered = res.data.filter((c) =>
          c.name.toLowerCase().includes(nameSearch.toLowerCase())
        );
        setSearchResults(filtered);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delay);
  }, [nameSearch, customerType]);

  // When user picks a customer from dropdown
  const selectCustomer = (c) => {
    setCustomer(c);
    setNameSearch(c.name);
    setShowDropdown(false);
    setForm((prev) => ({
      ...prev,
      customer_id: c.customer_id,
      customer_name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      address: c.address || "",
      city: c.city || ""
    }));
  };

  // Reset existing customer selection
  const clearCustomer = () => {
    setCustomer(null);
    setNameSearch("");
    setSearchResults([]);
    setForm((prev) => ({
      ...prev,
      customer_id: "",
      customer_name: "",
      email: "",
      phone: "",
      address: "",
      city: ""
    }));
  };

  const handleKWChange = (e) => {
    const kw = Number(e.target.value);
    setForm((prev) => ({
      ...prev,
      system_size_kw: kw,
      total_amount: kw * PRICE_PER_KW
    }));
  };

  const placeOrder = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      let customerId;

      if (customerType === "new") {
        let customerRes;
        try {
          customerRes = await api.post("/customers", {
            name: form.customer_name,
            email: form.email,
            phone: form.phone,
            address: form.address,
            city: form.city
          });
        } catch (custErr) {
          throw new Error(
            custErr?.response?.data?.message || "Failed to create customer"
          );
        }

        customerId = customerRes.data.customer_id;

        if (!customerId) {
          throw new Error("Customer creation succeeded but returned no ID");
        }
      } else {
        customerId = form.customer_id;

        if (!customerId) {
          throw new Error("Please select a customer first");
        }
      }

      const orderRes = await api.post("/orders", {
        customer_id: Number(customerId),
        system_size_kw: Number(form.system_size_kw),
        total_amount: Number(form.total_amount),
        notes: form.notes
      });

      alert(
        `Order Placed Successfully\n\nCustomer: ${form.customer_name}\nCustomer ID: ${customerId}\nOrder ID: ${orderRes.data.order_id}`
      );

      // Reset everything
      setCustomer(null);
      setNameSearch("");
      setSearchResults([]);
      setForm({
        customer_id: "",
        customer_name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        system_size_kw: "",
        total_amount: "",
        notes: ""
      });
    } catch (err) {
      console.error(err);
      alert(err?.message || err?.response?.data?.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "#f9f9f9"
  };

  const readOnlyStyle = {
    ...inputStyle,
    background: "#f0f0f0",
    color: "#555",
    cursor: "not-allowed"
  };

  const labelStyle = {
    display: "block",
    marginBottom: "6px",
    fontWeight: "600",
    fontSize: "14px",
    color: "#333"
  };

  const fieldStyle = { marginBottom: "18px" };

  return (
    <section
      style={{
        maxWidth: "900px",
        margin: "50px auto",
        padding: "30px",
        background: "#fff",
        borderRadius: "12px"
      }}
    >
      <h2 style={{ marginBottom: "20px" }}>Place Solar Order</h2>

      {/* Radio buttons */}
      <div style={{ marginBottom: "25px", display: "flex", alignItems: "center", gap: "30px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", margin: 0 }}>
          <input
            type="radio"
            checked={customerType === "new"}
            onChange={() => { setCustomerType("new"); clearCustomer(); }}
            style={{ width: "16px", height: "16px", cursor: "pointer", margin: 0 }}
          />
          <span>New Customer</span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", margin: 0 }}>
          <input
            type="radio"
            checked={customerType === "existing"}
            onChange={() => { setCustomerType("existing"); clearCustomer(); }}
            style={{ width: "16px", height: "16px", cursor: "pointer", margin: 0 }}
          />
          <span>Existing Customer</span>
        </label>
      </div>

      <form onSubmit={placeOrder}>

        {/* ── EXISTING CUSTOMER ── */}
        {customerType === "existing" && (
          <>
            {/* Name search with dropdown */}
            <div style={{ ...fieldStyle, position: "relative" }} ref={dropdownRef}>
              <label style={labelStyle}>Search Customer by Name</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Start typing customer name..."
                  value={nameSearch}
                  onChange={(e) => {
                    setNameSearch(e.target.value);
                    if (customer) clearCustomer();
                  }}
                  autoComplete="off"
                  style={{
                    ...inputStyle,
                    borderColor: customer ? "#28a745" : "#ccc",
                    paddingRight: customer ? "36px" : "12px"
                  }}
                />
                {/* Clear button */}
                {customer && (
                  <button
                    type="button"
                    onClick={clearCustomer}
                    style={{
                      position: "absolute", right: "10px", top: "50%",
                      transform: "translateY(-50%)", background: "none",
                      border: "none", cursor: "pointer", fontSize: "16px",
                      color: "#999", lineHeight: 1
                    }}
                    title="Clear selection"
                  >✕</button>
                )}
              </div>

              {/* Search status */}
              {searching && (
                <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
                  Searching...
                </div>
              )}

              {/* Dropdown results */}
              {showDropdown && searchResults.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0,
                  background: "#fff", border: "1px solid #ddd", borderRadius: "6px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)", zIndex: 100,
                  maxHeight: "220px", overflowY: "auto"
                }}>
                  {searchResults.map((c) => (
                    <div
                      key={c.customer_id}
                      onClick={() => selectCustomer(c)}
                      style={{
                        padding: "10px 14px", cursor: "pointer",
                        borderBottom: "1px solid #f0f0f0",
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
                      onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                    >
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "14px" }}>{c.name}</div>
                        <div style={{ fontSize: "12px", color: "#888" }}>{c.phone} · {c.city}</div>
                      </div>
                      <span style={{
                        fontSize: "11px", background: "#f0f0f0",
                        padding: "2px 8px", borderRadius: "10px", color: "#555"
                      }}>
                        ID: {c.customer_id}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* No results */}
              {showDropdown && searchResults.length === 0 && !searching && nameSearch.trim() && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0,
                  background: "#fff", border: "1px solid #ddd", borderRadius: "6px",
                  padding: "12px 14px", color: "#888", fontSize: "13px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)", zIndex: 100
                }}>
                  No customer found with that name
                </div>
              )}
            </div>

            {/* Auto-filled readonly fields after selection */}
            {customer && (
              <div style={{
                background: "#f8fff8", border: "1px solid #c3e6cb",
                borderRadius: "8px", padding: "16px", marginBottom: "18px"
              }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#28a745", marginBottom: "12px" }}>
                  ✓ Customer Found
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: "12px", color: "#666" }}>Customer ID</label>
                    <input value={customer.customer_id} readOnly style={readOnlyStyle} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: "12px", color: "#666" }}>Mobile Number</label>
                    <input value={customer.phone || "—"} readOnly style={readOnlyStyle} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: "12px", color: "#666" }}>Email</label>
                    <input value={customer.email || "—"} readOnly style={readOnlyStyle} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: "12px", color: "#666" }}>City</label>
                    <input value={customer.city || "—"} readOnly style={readOnlyStyle} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── NEW CUSTOMER ── */}
        {customerType === "new" && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Customer Name</label>
              <input
                type="text"
                required
                className="form-control"
                style={inputStyle}
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                required
                className="form-control"
                style={inputStyle}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Mobile Number</label>
              <input
                type="text"
                required
                className="form-control"
                style={inputStyle}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Address</label>
              <textarea
                className="form-control"
                style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>City</label>
              <input
                type="text"
                className="form-control"
                style={inputStyle}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
          </>
        )}

        {/* ── ORDER FIELDS (shared) ── */}
        <div style={fieldStyle}>
          <label style={labelStyle}>System Size (kW)</label>
          <input
            type="number"
            className="form-control"
            style={inputStyle}
            value={form.system_size_kw}
            onChange={handleKWChange}
            required
            min="1"
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Total Amount (₹)</label>
          <input
            type="number"
            className="form-control"
            style={readOnlyStyle}
            value={form.total_amount}
            readOnly
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Notes</label>
          <textarea
            className="form-control"
            style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#f5a300",
            color: "#fff",
            border: "none",
            padding: "12px 25px",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "15px",
            fontWeight: "600",
            opacity: loading ? 0.75 : 1
          }}
        >
          {loading ? "Processing..." : "Place Order"}
        </button>
      </form>
    </section>
  );
}